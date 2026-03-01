import * as fs from 'fs';
import * as path from 'path';
import { AffectedFile, GeneratedPatch } from '@ai-project-sync/shared';
import { ClaudeLLM } from '@ai-project-sync/ai-engine';
import { GitService } from './git';
import { ContextCollector } from './context';
import { PatchService, ParsedPatch, ApplyResult } from './patch';

export interface MultiFileSyncOptions {
  baseDir: string;
  variantDir: string;
  commitHash: string;
  llm: ClaudeLLM;
  dryRun?: boolean;
}

export interface MultiFileSyncResult {
  totalFiles: number;
  patches: FilePatchResult[];
  status: 'success' | 'partial' | 'failed';
  rollbackPerformed: boolean;
}

export interface FilePatchResult {
  filePath: string;
  generated: GeneratedPatch;
  parsed: ParsedPatch;
  applyResults: ApplyResult[];
  status: 'success' | 'failed' | 'skipped';
}

interface FileNode {
  filePath: string;
  imports: string[];
  dependsOn: string[];
}

export class MultiFileSync {
  private git: GitService;
  private collector: ContextCollector;
  private patchService: PatchService;

  constructor(baseDir: string, variantDir: string) {
    this.git = new GitService(baseDir);
    this.collector = new ContextCollector(variantDir);
    this.patchService = new PatchService();
  }

  async sync(options: MultiFileSyncOptions): Promise<MultiFileSyncResult> {
    const { baseDir, variantDir, commitHash, llm, dryRun } = options;

    // 1. Get commit info
    const commitDiff = this.git.getFullCommitDiff(commitHash);
    const affectedFiles = commitDiff.affectedFiles;

    if (affectedFiles.length === 0) {
      return { totalFiles: 0, patches: [], status: 'success', rollbackPerformed: false };
    }

    // 2. Analyze dependencies and sort files
    const sortedFiles = this.sortByDependency(affectedFiles, baseDir, commitHash);

    // 3. Generate patches for each file in dependency order
    const patches: FilePatchResult[] = [];
    const backups = new Map<string, string>();

    for (const file of sortedFiles) {
      // Get individual file diff
      const fileDiff = this.extractFileDiff(commitDiff.diff, file.path);
      if (!fileDiff) continue;

      // Collect context for this specific file
      const context = this.collector.collect([file]);
      if (context.files.length === 0) continue;

      const contextText = this.collector.formatForPrompt(context);

      try {
        // Generate adapted patch via AI
        const generated = await llm.generatePatch({
          baseDiff: fileDiff,
          variantContext: contextText,
          commitMessage: commitDiff.message,
        });

        const parsed = this.patchService.parsePatch(generated.patch);

        if (dryRun) {
          patches.push({
            filePath: file.path,
            generated,
            parsed,
            applyResults: [],
            status: 'skipped',
          });
          continue;
        }

        // Backup before applying
        for (const pf of parsed.files) {
          const fullPath = path.join(variantDir, pf.newPath);
          if (fs.existsSync(fullPath)) {
            backups.set(fullPath, fs.readFileSync(fullPath, 'utf-8'));
          }
        }

        // Apply patch
        const applyResults = this.patchService.applyPatch(variantDir, parsed);
        const allSuccess = applyResults.every((r) => r.status !== 'failed');

        patches.push({
          filePath: file.path,
          generated,
          parsed,
          applyResults,
          status: allSuccess ? 'success' : 'failed',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patches.push({
          filePath: file.path,
          generated: { patch: '', confidence: 0, explanation: message, risks: [] },
          parsed: { files: [] },
          applyResults: [],
          status: 'failed',
        });
      }
    }

    // 4. Check results and rollback if needed
    const failedCount = patches.filter((p) => p.status === 'failed').length;
    const successCount = patches.filter((p) => p.status === 'success').length;
    let rollbackPerformed = false;

    if (failedCount > 0 && successCount > 0 && !dryRun) {
      // Partial failure — rollback all changes for atomicity
      this.rollback(backups);
      rollbackPerformed = true;
    }

    let status: MultiFileSyncResult['status'];
    if (failedCount === 0) {
      status = 'success';
    } else if (successCount === 0) {
      status = 'failed';
    } else {
      status = 'partial';
    }

    return {
      totalFiles: sortedFiles.length,
      patches,
      status: rollbackPerformed ? 'failed' : status,
      rollbackPerformed,
    };
  }

  private sortByDependency(files: AffectedFile[], baseDir: string, commitHash: string): AffectedFile[] {
    const nodes: FileNode[] = files.map((f) => {
      let imports: string[] = [];
      try {
        const content = this.git.getFileContent(f.path, commitHash);
        imports = this.extractImports(content);
      } catch {
        // File might be new or deleted
      }
      return {
        filePath: f.path,
        imports,
        dependsOn: [],
      };
    });

    // Build dependency graph
    const filePaths = new Set(files.map((f) => f.path));
    for (const node of nodes) {
      node.dependsOn = node.imports.filter((imp) => {
        // Resolve relative imports to file paths
        const resolved = this.resolveImport(imp, node.filePath);
        return resolved && filePaths.has(resolved);
      });
    }

    // Topological sort
    return this.topologicalSort(nodes, files);
  }

  private topologicalSort(nodes: FileNode[], files: AffectedFile[]): AffectedFile[] {
    const fileMap = new Map(files.map((f) => [f.path, f]));
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (filePath: string) => {
      if (visited.has(filePath)) return;
      visited.add(filePath);

      const node = nodes.find((n) => n.filePath === filePath);
      if (node) {
        for (const dep of node.dependsOn) {
          visit(dep);
        }
      }
      result.push(filePath);
    };

    for (const node of nodes) {
      visit(node.filePath);
    }

    return result
      .map((fp) => fileMap.get(fp))
      .filter((f): f is AffectedFile => f !== undefined);
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }
    return imports;
  }

  private resolveImport(importPath: string, fromFile: string): string | null {
    if (!importPath.startsWith('.')) return null;

    const dir = path.dirname(fromFile);
    let resolved = path.join(dir, importPath);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (candidate) return candidate;
    }

    // Try index file
    for (const ext of extensions) {
      const candidate = path.join(resolved, `index${ext}`);
      if (candidate) return candidate;
    }

    return resolved;
  }

  private extractFileDiff(fullDiff: string, filePath: string): string | null {
    const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `diff --git a/${escapedPath} b/${escapedPath}[\\s\\S]*?(?=diff --git|$)`,
      'm'
    );
    const match = fullDiff.match(regex);
    return match ? match[0] : null;
  }

  private rollback(backups: Map<string, string>): void {
    for (const [filePath, content] of backups) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }
}
