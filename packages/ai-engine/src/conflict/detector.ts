import { ASTParser, ParsedFunction } from '../ast/parser';
import { RiskLevel } from '@ai-project-sync/shared';

export type ConflictType = 'code_conflict' | 'semantic_conflict' | 'dependency_conflict';

export interface ConflictRisk {
  type: ConflictType;
  severity: RiskLevel;
  filePath: string;
  description: string;
  suggestion: string;
  affectedFunction?: string;
}

export interface ConflictReport {
  conflicts: ConflictRisk[];
  overallRisk: RiskLevel;
  canAutoResolve: boolean;
}

export class ConflictDetector {
  private parser: ASTParser;

  constructor() {
    this.parser = new ASTParser();
  }

  detect(
    baseDiff: string,
    variantCode: Map<string, string>,
    patchContent: string
  ): ConflictReport {
    const conflicts: ConflictRisk[] = [];

    // 1. Check for direct code conflicts
    conflicts.push(...this.detectCodeConflicts(patchContent, variantCode));

    // 2. Check for semantic conflicts
    conflicts.push(...this.detectSemanticConflicts(baseDiff, variantCode));

    // 3. Check for dependency conflicts
    conflicts.push(...this.detectDependencyConflicts(baseDiff, variantCode));

    const overallRisk = this.calculateOverallRisk(conflicts);
    const canAutoResolve = conflicts.every(
      (c) => c.severity === 'low' || c.type === 'dependency_conflict'
    );

    return { conflicts, overallRisk, canAutoResolve };
  }

  private detectCodeConflicts(
    patchContent: string,
    variantCode: Map<string, string>
  ): ConflictRisk[] {
    const conflicts: ConflictRisk[] = [];

    // Parse patch to find target files and line ranges
    const patchFiles = this.extractPatchTargets(patchContent);

    for (const { filePath, removedLines } of patchFiles) {
      const variantContent = variantCode.get(filePath);
      if (!variantContent) continue;

      const variantLines = variantContent.split('\n');

      // Check if lines to be removed actually exist in variant
      for (const line of removedLines) {
        const trimmed = line.trim();
        if (trimmed === '') continue;

        const exists = variantLines.some((vl) => vl.trim() === trimmed);
        if (!exists) {
          conflicts.push({
            type: 'code_conflict',
            severity: 'high',
            filePath,
            description: `Line to remove not found in variant: "${trimmed.slice(0, 60)}"`,
            suggestion: 'Manually verify the patch target lines match the variant code',
          });
        }
      }
    }

    return conflicts;
  }

  private detectSemanticConflicts(
    baseDiff: string,
    variantCode: Map<string, string>
  ): ConflictRisk[] {
    const conflicts: ConflictRisk[] = [];
    const sigChanges = this.extractSignatureChanges(baseDiff);

    for (const { oldSig, newSig } of sigChanges) {
      // Check all variant files — the diff doesn't carry reliable file path info
      for (const [filePath, variantContent] of variantCode) {
        const parsed = this.parser.parseFile(variantContent, filePath);
        conflicts.push(...this.checkCallSiteConflicts(parsed.functions, filePath, oldSig, newSig));
      }
    }

    return conflicts;
  }

  private checkCallSiteConflicts(
    functions: ParsedFunction[],
    filePath: string,
    oldSig: FuncSig,
    newSig: FuncSig,
  ): ConflictRisk[] {
    const conflicts: ConflictRisk[] = [];

    for (const func of functions) {
      if (!oldSig.name || !func.code.includes(oldSig.name + '(')) continue;

      if (oldSig.paramCount !== newSig.paramCount) {
        conflicts.push({
          type: 'semantic_conflict',
          severity: 'high',
          filePath,
          description: `Function "${oldSig.name}" signature changed (${oldSig.paramCount} → ${newSig.paramCount} params), but variant calls it in "${func.name}"`,
          suggestion: `Update all call sites of "${oldSig.name}" in the variant to match the new signature`,
          affectedFunction: func.name,
        });
      }

      if (oldSig.name !== newSig.name) {
        conflicts.push({
          type: 'semantic_conflict',
          severity: 'medium',
          filePath,
          description: `Function renamed from "${oldSig.name}" to "${newSig.name}", variant still references old name in "${func.name}"`,
          suggestion: `Rename all references from "${oldSig.name}" to "${newSig.name}" in the variant`,
          affectedFunction: func.name,
        });
      }
    }

    return conflicts;
  }

  private detectDependencyConflicts(
    baseDiff: string,
    variantCode: Map<string, string>
  ): ConflictRisk[] {
    const conflicts: ConflictRisk[] = [];

    // Extract new imports from diff
    const newImports = this.extractNewImports(baseDiff);

    // Combine all variant code to check if import exists anywhere
    const allVariantCode = Array.from(variantCode.values()).join('\n');

    for (const { importPath } of newImports) {
      const hasImport = allVariantCode.includes(importPath);
      if (!hasImport) {
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          conflicts.push({
            type: 'dependency_conflict',
            severity: 'medium',
            filePath: '',
            description: `New import "${importPath}" may not exist in variant project`,
            suggestion: `Verify that "${importPath}" exists in the variant, or adapt the import path`,
          });
        } else {
          conflicts.push({
            type: 'dependency_conflict',
            severity: 'low',
            filePath: '',
            description: `New package import "${importPath}" — ensure it's installed in variant`,
            suggestion: `Run "npm install ${importPath}" in the variant project if not already installed`,
          });
        }
      }
    }

    return conflicts;
  }

  private extractPatchTargets(
    patchContent: string
  ): Array<{ filePath: string; removedLines: string[] }> {
    const results: Array<{ filePath: string; removedLines: string[] }> = [];
    const fileChunks = patchContent.split(/^--- /m).slice(1);

    for (const chunk of fileChunks) {
      const pathMatch = chunk.match(/^(?:a\/)?(.+)/m);
      if (!pathMatch) continue;

      const filePath = pathMatch[1].trim();
      const removedLines = chunk
        .split('\n')
        .filter((l) => l.startsWith('-') && !l.startsWith('---'))
        .map((l) => l.slice(1));

      results.push({ filePath, removedLines });
    }

    return results;
  }

  private extractSignatureChanges(
    diff: string
  ): Array<{ filePath: string; oldSig: FuncSig; newSig: FuncSig }> {
    const results: Array<{ filePath: string; oldSig: FuncSig; newSig: FuncSig }> = [];
    const funcPattern = /^[-+]\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm;

    let match;
    const removed: FuncSig[] = [];
    const added: FuncSig[] = [];

    while ((match = funcPattern.exec(diff)) !== null) {
      const line = match[0];
      const name = match[1];
      const params = match[2].split(',').filter((p) => p.trim()).length;

      if (line.startsWith('-')) {
        removed.push({ name, paramCount: params });
      } else if (line.startsWith('+')) {
        added.push({ name, paramCount: params });
      }
    }

    // Match removed → added by name similarity
    for (const old of removed) {
      const newSig = added.find((a) => a.name === old.name || a.name.toLowerCase() === old.name.toLowerCase());
      if (newSig && (old.paramCount !== newSig.paramCount || old.name !== newSig.name)) {
        results.push({ filePath: '', oldSig: old, newSig });
      }
    }

    return results;
  }

  private extractNewImports(diff: string): Array<{ filePath: string; importPath: string }> {
    const results: Array<{ filePath: string; importPath: string }> = [];
    const importPattern = /\+\s*import\s+.*?from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importPattern.exec(diff)) !== null) {
      results.push({ filePath: '', importPath: match[1] });
    }

    return results;
  }

  private calculateOverallRisk(conflicts: ConflictRisk[]): RiskLevel {
    if (conflicts.length === 0) return 'low';
    if (conflicts.some((c) => c.severity === 'high')) return 'high';
    if (conflicts.some((c) => c.severity === 'medium')) return 'medium';
    return 'low';
  }
}

interface FuncSig {
  name: string;
  paramCount: number;
}
