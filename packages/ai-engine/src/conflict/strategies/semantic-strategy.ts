import { ConflictRisk } from '../types';
import { ResolutionContext, ResolutionStrategy } from './types';
import { Resolution } from '../resolver-types';
import { createResolution } from './registry';
import { CONFIDENCE_SCORES } from '../resolver-config';

/**
 * Strategy for resolving semantic conflicts.
 * Handles function renames and signature changes.
 */
export class SemanticConflictStrategy implements ResolutionStrategy {
  readonly name = 'rename_reference' as const;

  canHandle(conflict: ConflictRisk): boolean {
    return conflict.type === 'semantic_conflict';
  }

  resolve(conflict: ConflictRisk, context: ResolutionContext): Resolution {
    // Detect rename pattern
    const renameMatch = conflict.description.match(
      /renamed from "(\w+)" to "(\w+)"/,
    );
    if (renameMatch) {
      return this.resolveRename(conflict, context, renameMatch[1], renameMatch[2]);
    }

    // Detect param count change
    const paramMatch = conflict.description.match(
      /(\d+) → (\d+) params/,
    );
    if (paramMatch) {
      return this.resolveParamChange(
        conflict,
        context,
        parseInt(paramMatch[1], 10),
        parseInt(paramMatch[2], 10),
      );
    }

    // Fallback for unrecognized semantic conflicts
    return createResolution(context, conflict, 'manual', {
      confidence: CONFIDENCE_SCORES.FALLBACK,
      explanation: `Unable to auto-resolve: ${conflict.description}`,
    });
  }

  private resolveRename(
    conflict: ConflictRisk,
    context: ResolutionContext,
    oldName: string,
    newName: string,
  ): Resolution {
    // Check if we have a known name mapping
    const mappedName = context.nameMappings.get(oldName);
    if (mappedName) {
      return createResolution(context, conflict, 'rename_reference', {
        confidence: CONFIDENCE_SCORES.KNOWN_MAPPING,
        requiresHumanReview: false,
        patch: `// Replace all references: "${oldName}" → "${mappedName}"`,
        explanation: `Known mapping: "${oldName}" → "${mappedName}" in variant`,
      });
    }

    // Simple rename: high confidence auto-resolve
    return createResolution(context, conflict, 'rename_reference', {
      confidence: CONFIDENCE_SCORES.SIMPLE_RENAME,
      patch: `// Replace all references: "${oldName}" → "${newName}"`,
      explanation: `Rename "${oldName}" to "${newName}" across all call sites in variant`,
    });
  }

  private resolveParamChange(
    conflict: ConflictRisk,
    context: ResolutionContext,
    oldCount: number,
    newCount: number,
  ): Resolution {
    const diff = newCount - oldCount;

    if (diff === 1) {
      // One new param added — likely has a default value
      return createResolution(context, conflict, 'update_params', {
        confidence: CONFIDENCE_SCORES.PARAM_ADDITION,
        requiresHumanReview: true,
        explanation: `New parameter added (${oldCount} → ${newCount}). Check if it has a default value; if so, existing call sites may not need changes.`,
      });
    }

    if (diff === -1) {
      // One param removed
      return createResolution(context, conflict, 'update_params', {
        confidence: CONFIDENCE_SCORES.PARAM_REMOVAL,
        requiresHumanReview: true,
        explanation: `Parameter removed (${oldCount} → ${newCount}). All call sites must be updated to remove the extra argument.`,
      });
    }

    // Multiple param changes — too risky for auto-resolve
    return createResolution(context, conflict, 'manual', {
      confidence: CONFIDENCE_SCORES.MAJOR_CHANGE,
      requiresHumanReview: true,
      explanation: `Significant signature change (${oldCount} → ${newCount} params). Manual review required.`,
    });
  }
}
