import { ConflictRisk } from '../types';
import { ResolutionContext, ResolutionStrategy } from './types';
import { Resolution } from '../resolver-types';
import { createResolution } from './registry';
import { CONFIDENCE_SCORES, IMPORT_PATH_PATTERNS } from '../resolver-config';

/**
 * Strategy for resolving dependency conflicts.
 * Handles import path adaptations and package installations.
 */
export class DependencyConflictStrategy implements ResolutionStrategy {
  readonly name = 'adapt_import_path' as const;

  canHandle(conflict: ConflictRisk): boolean {
    return conflict.type === 'dependency_conflict';
  }

  resolve(conflict: ConflictRisk, context: ResolutionContext): Resolution {
    // Extract import path from description
    const importMatch = conflict.description.match(/"([^"]+)"/);
    const importPath = importMatch?.[1] || '';

    // Check if we have a known import mapping
    const mappedPath = context.importMappings.get(importPath);
    if (mappedPath) {
      return createResolution(context, conflict, 'adapt_import_path', {
        confidence: CONFIDENCE_SCORES.KNOWN_MAPPING,
        requiresHumanReview: false,
        patch: `// Replace import: "${importPath}" → "${mappedPath}"`,
        explanation: `Known import mapping: "${importPath}" → "${mappedPath}"`,
      });
    }

    // Package import (not relative)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return createResolution(context, conflict, 'install_package', {
        confidence: CONFIDENCE_SCORES.PACKAGE_INSTALL,
        requiresHumanReview: false,
        patch: `// Run: npm install ${importPath}`,
        explanation: `Install missing package "${importPath}" in variant project`,
      });
    }

    // Relative import — try common path adaptations
    const adapted = this.tryAdaptImportPath(importPath);
    if (adapted) {
      return createResolution(context, conflict, 'adapt_import_path', {
        confidence: CONFIDENCE_SCORES.PATH_ADAPTATION,
        patch: `// Replace import: "${importPath}" → "${adapted}"`,
        explanation: `Adapted relative import path: "${importPath}" → "${adapted}"`,
      });
    }

    // Fallback for unrecognized imports
    return createResolution(context, conflict, 'manual', {
      confidence: CONFIDENCE_SCORES.FALLBACK,
      explanation: `Unable to auto-resolve: ${conflict.description}`,
    });
  }

  private tryAdaptImportPath(importPath: string): string | null {
    for (const [pattern, replacement] of IMPORT_PATH_PATTERNS) {
      if (pattern.test(importPath)) {
        return importPath.replace(pattern, replacement);
      }
    }
    return null;
  }
}
