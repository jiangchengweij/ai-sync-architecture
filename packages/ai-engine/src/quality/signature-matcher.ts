import { ParsedFunction } from '../ast/parser';

/**
 * Drift classification type
 */
export type DriftType = 'signature' | 'structure' | 'naming';

/**
 * Utility class for comparing and analyzing function signatures.
 * Extracted from QualityAnalyzer for better testability and reusability.
 */
export class SignatureMatcher {
  /**
   * Check if two functions have matching signatures.
   * Compares param count, return type, and async flag.
   */
  signaturesMatch(a: ParsedFunction, b: ParsedFunction): boolean {
    return a.params.length === b.params.length &&
      a.returnType === b.returnType &&
      a.isAsync === b.isAsync;
  }

  /**
   * Format a function signature as a readable string.
   * Example: "async (a: string, b: number) => Promise<void>"
   */
  formatSignature(func: ParsedFunction): string {
    const params = func.params.join(', ');
    const async_ = func.isAsync ? 'async ' : '';
    return `${async_}(${params}) => ${func.returnType || 'void'}`;
  }

  /**
   * Classify the type of drift between base and variant functions.
   * Returns 'signature' for param/return type changes (most significant).
   * Returns 'structure' for async-only changes.
   * Returns 'naming' for minor differences.
   */
  classifyDrift(base: ParsedFunction, variant: ParsedFunction): DriftType {
    if (base.params.length !== variant.params.length || base.returnType !== variant.returnType) {
      return 'signature';
    }
    if (base.isAsync !== variant.isAsync) return 'structure';
    return 'naming';
  }
}
