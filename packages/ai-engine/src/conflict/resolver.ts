import { ConflictRisk } from './types';
import { Resolution, ResolutionStrategy, ResolverOptions } from './resolver-types';
import {
  DEFAULT_AUTO_RESOLVE_THRESHOLD,
  IMPORT_PATH_PATTERNS,
  CONFIDENCE_SCORES,
} from './resolver-config';

export class ConflictResolver {
  private importMappings: Map<string, string>;
  private nameMappings: Map<string, string>;
  private autoResolveThreshold: number;

  constructor(options: ResolverOptions = {}) {
    this.importMappings = options.importPathMappings || new Map();
    this.nameMappings = options.nameMappings || new Map();
    this.autoResolveThreshold = options.autoResolveThreshold ?? DEFAULT_AUTO_RESOLVE_THRESHOLD;
  }

  resolve(conflicts: ConflictRisk[]): Resolution[] {
    return conflicts.map((conflict, index) => {
      switch (conflict.type) {
        case 'semantic_conflict':
          return this.resolveSemanticConflict(conflict, index);
        case 'dependency_conflict':
          return this.resolveDependencyConflict(conflict, index);
        case 'code_conflict':
          return this.resolveCodeConflict(conflict, index);
        default:
          return this.fallbackResolution(conflict, index);
      }
    });
  }

  resolveAll(conflicts: ConflictRisk[]): {
    resolutions: Resolution[];
    autoResolved: Resolution[];
    needsHumanReview: Resolution[];
    autoResolveRate: number;
  } {
    const resolutions = this.resolve(conflicts);
    const autoResolved = resolutions.filter((r) => !r.requiresHumanReview);
    const needsHumanReview = resolutions.filter((r) => r.requiresHumanReview);

    return {
      resolutions,
      autoResolved,
      needsHumanReview,
      autoResolveRate: resolutions.length > 0 ? autoResolved.length / resolutions.length : 1,
    };
  }

  private resolveSemanticConflict(conflict: ConflictRisk, index: number): Resolution {
    // Detect rename pattern
    const renameMatch = conflict.description.match(
      /renamed from "(\w+)" to "(\w+)"/,
    );
    if (renameMatch) {
      return this.resolveRename(conflict, index, renameMatch[1], renameMatch[2]);
    }

    // Detect param count change
    const paramMatch = conflict.description.match(
      /(\d+) → (\d+) params/,
    );
    if (paramMatch) {
      return this.resolveParamChange(
        conflict, index,
        parseInt(paramMatch[1], 10),
        parseInt(paramMatch[2], 10),
      );
    }

    return this.fallbackResolution(conflict, index);
  }
  private resolveRename(
    conflict: ConflictRisk, index: number,
    oldName: string, newName: string,
  ): Resolution {
    // Check if we have a known name mapping
    const mappedName = this.nameMappings.get(oldName);
    if (mappedName) {
      return {
        conflictIndex: index,
        conflict,
        strategy: 'rename_reference',
        patch: `// Replace all references: "${oldName}" → "${mappedName}"`,
        confidence: CONFIDENCE_SCORES.KNOWN_MAPPING,
        requiresHumanReview: false,
        explanation: `Known mapping: "${oldName}" → "${mappedName}" in variant`,
      };
    }

    // Simple rename: high confidence auto-resolve
    const confidence = CONFIDENCE_SCORES.SIMPLE_RENAME;
    return {
      conflictIndex: index,
      conflict,
      strategy: 'rename_reference',
      patch: `// Replace all references: "${oldName}" → "${newName}"`,
      confidence,
      requiresHumanReview: confidence < this.autoResolveThreshold,
      explanation: `Rename "${oldName}" to "${newName}" across all call sites in variant`,
    };
  }

  private resolveParamChange(
    conflict: ConflictRisk, index: number,
    oldCount: number, newCount: number,
  ): Resolution {
    const diff = newCount - oldCount;

    if (diff === 1) {
      // One new param added — likely has a default value
      return {
        conflictIndex: index,
        conflict,
        strategy: 'update_params',
        confidence: CONFIDENCE_SCORES.PARAM_ADDITION,
        requiresHumanReview: true,
        explanation: `New parameter added (${oldCount} → ${newCount}). Check if it has a default value; if so, existing call sites may not need changes.`,
      };
    }

    if (diff === -1) {
      // One param removed
      return {
        conflictIndex: index,
        conflict,
        strategy: 'update_params',
        confidence: CONFIDENCE_SCORES.PARAM_REMOVAL,
        requiresHumanReview: true,
        explanation: `Parameter removed (${oldCount} → ${newCount}). All call sites must be updated to remove the extra argument.`,
      };
    }

    // Multiple param changes — too risky for auto-resolve
    return {
      conflictIndex: index,
      conflict,
      strategy: 'manual',
      confidence: CONFIDENCE_SCORES.MAJOR_CHANGE,
      requiresHumanReview: true,
      explanation: `Significant signature change (${oldCount} → ${newCount} params). Manual review required.`,
    };
  }

  private resolveDependencyConflict(conflict: ConflictRisk, index: number): Resolution {
    // Extract import path from description
    const importMatch = conflict.description.match(/"([^"]+)"/);
    const importPath = importMatch?.[1] || '';

    // Check if we have a known import mapping
    const mappedPath = this.importMappings.get(importPath);
    if (mappedPath) {
      return {
        conflictIndex: index,
        conflict,
        strategy: 'adapt_import_path',
        patch: `// Replace import: "${importPath}" → "${mappedPath}"`,
        confidence: CONFIDENCE_SCORES.KNOWN_MAPPING,
        requiresHumanReview: false,
        explanation: `Known import mapping: "${importPath}" → "${mappedPath}"`,
      };
    }

    // Package import (not relative)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return {
        conflictIndex: index,
        conflict,
        strategy: 'install_package',
        patch: `// Run: npm install ${importPath}`,
        confidence: CONFIDENCE_SCORES.PACKAGE_INSTALL,
        requiresHumanReview: false,
        explanation: `Install missing package "${importPath}" in variant project`,
      };
    }

    // Relative import — try common path adaptations
    const adapted = this.tryAdaptImportPath(importPath);
    if (adapted) {
      const confidence = CONFIDENCE_SCORES.PATH_ADAPTATION;
      return {
        conflictIndex: index,
        conflict,
        strategy: 'adapt_import_path',
        patch: `// Replace import: "${importPath}" → "${adapted}"`,
        confidence,
        requiresHumanReview: confidence < this.autoResolveThreshold,
        explanation: `Adapted relative import path: "${importPath}" → "${adapted}"`,
      };
    }

    return this.fallbackResolution(conflict, index);
  }

  private resolveCodeConflict(conflict: ConflictRisk, index: number): Resolution {
    // Code conflicts (line not found) are generally hard to auto-resolve
    if (conflict.severity === 'high') {
      return {
        conflictIndex: index,
        conflict,
        strategy: 'manual',
        confidence: CONFIDENCE_SCORES.CODE_CONFLICT_HIGH,
        requiresHumanReview: true,
        explanation: 'Direct code conflict — the target lines differ in the variant. Manual resolution required.',
      };
    }

    return {
      conflictIndex: index,
      conflict,
      strategy: 'skip_line',
      confidence: CONFIDENCE_SCORES.SKIP_LINE,
      requiresHumanReview: true,
      explanation: 'Minor code mismatch — may be safe to skip this line change.',
    };
  }

  private tryAdaptImportPath(importPath: string): string | null {
    for (const [pattern, replacement] of IMPORT_PATH_PATTERNS) {
      if (pattern.test(importPath)) {
        return importPath.replace(pattern, replacement);
      }
    }
    return null;
  }

  private fallbackResolution(conflict: ConflictRisk, index: number): Resolution {
    return {
      conflictIndex: index,
      conflict,
      strategy: 'manual',
      confidence: CONFIDENCE_SCORES.FALLBACK,
      requiresHumanReview: true,
      explanation: `Unable to auto-resolve: ${conflict.description}`,
    };
  }
}
