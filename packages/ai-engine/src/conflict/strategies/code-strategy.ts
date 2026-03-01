import { ConflictRisk } from '../types';
import { ResolutionContext, ResolutionStrategy } from './types';
import { Resolution } from '../resolver-types';
import { createResolution } from './registry';
import { CONFIDENCE_SCORES } from '../resolver-config';

/**
 * Strategy for resolving code conflicts.
 * Handles direct code mismatches between base and variant.
 */
export class CodeConflictStrategy implements ResolutionStrategy {
  readonly name = 'skip_line' as const;

  canHandle(conflict: ConflictRisk): boolean {
    return conflict.type === 'code_conflict';
  }

  resolve(conflict: ConflictRisk, context: ResolutionContext): Resolution {
    // Code conflicts (line not found) are generally hard to auto-resolve
    if (conflict.severity === 'high') {
      return createResolution(context, conflict, 'manual', {
        confidence: CONFIDENCE_SCORES.CODE_CONFLICT_HIGH,
        requiresHumanReview: true,
        explanation: 'Direct code conflict — the target lines differ in the variant. Manual resolution required.',
      });
    }

    // Lower severity - may be safe to skip
    return createResolution(context, conflict, 'skip_line', {
      confidence: CONFIDENCE_SCORES.SKIP_LINE,
      requiresHumanReview: true,
      explanation: 'Minor code mismatch — may be safe to skip this line change.',
    });
  }
}
