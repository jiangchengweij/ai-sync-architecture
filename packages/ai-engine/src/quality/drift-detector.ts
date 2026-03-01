import { ParsedFunction } from '../ast/parser';
import { QualityDiff } from './types';

/**
 * Unnecessary difference detected between base and variant functions
 */
export interface UnnecessaryDifference {
  name: string;
  description: string;
  suggestion: string;
}

/**
 * Utility class for detecting unnecessary differences between functions.
 * These are differences that are likely unintentional or stylistic rather
 * than intentional customizations.
 */
export class DriftDetector {
  /**
   * Detect unnecessary differences between base and variant functions.
   * Returns null if no unnecessary differences are detected.
   */
  detectUnnecessaryDiff(
    base: ParsedFunction,
    variant: ParsedFunction,
  ): UnnecessaryDifference | null {
    // Detect async mismatch where it's likely unnecessary
    if (this.isUnnecessaryAsyncChange(base, variant)) {
      return {
        name: base.name,
        description: `Unnecessary async mismatch: base=${base.isAsync}, variant=${variant.isAsync}`,
        suggestion: `Align async modifier with base implementation`,
      };
    }
    return null;
  }

  /**
   * Check if async modifier difference is unnecessary.
   * Async changes are considered unnecessary only when param counts match,
   * suggesting the function signature hasn't fundamentally changed.
   */
  isUnnecessaryAsyncChange(base: ParsedFunction, variant: ParsedFunction): boolean {
    return base.isAsync !== variant.isAsync && base.params.length === variant.params.length;
  }
}
