import { DriftDetector } from '../../src/quality/drift-detector';
import { ParsedFunction } from '../../src/ast/parser';

function makeFunc(overrides: Partial<ParsedFunction> = {}): ParsedFunction {
  return {
    name: 'testFunc',
    kind: 'function',
    params: ['a: string'],
    returnType: 'void',
    startLine: 1,
    endLine: 5,
    isAsync: false,
    isExported: true,
    code: 'function testFunc(a: string) {}',
    ...overrides,
  };
}

describe('DriftDetector', () => {
  let detector: DriftDetector;

  beforeEach(() => {
    detector = new DriftDetector();
  });

  describe('detectUnnecessaryDiff', () => {
    test('returns null when functions are identical', () => {
      const base = makeFunc();
      const variant = makeFunc();

      const result = detector.detectUnnecessaryDiff(base, variant);

      expect(result).toBeNull();
    });

    test('detects unnecessary async mismatch', () => {
      const base = makeFunc({ isAsync: false });
      const variant = makeFunc({ isAsync: true });

      const result = detector.detectUnnecessaryDiff(base, variant);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('testFunc');
      expect(result?.description).toContain('async mismatch');
    });

    test('detects async mismatch when base is async and variant is not', () => {
      const base = makeFunc({ isAsync: true });
      const variant = makeFunc({ isAsync: false });

      const result = detector.detectUnnecessaryDiff(base, variant);

      expect(result).not.toBeNull();
      expect(result?.description).toContain('base=true');
      expect(result?.description).toContain('variant=false');
    });

    test('returns null when async matches', () => {
      const base = makeFunc({ isAsync: true });
      const variant = makeFunc({ isAsync: true });

      const result = detector.detectUnnecessaryDiff(base, variant);

      expect(result).toBeNull();
    });

    test('includes suggestion for async mismatch', () => {
      const base = makeFunc({ isAsync: false });
      const variant = makeFunc({ isAsync: true });

      const result = detector.detectUnnecessaryDiff(base, variant);

      expect(result?.suggestion).toContain('Align async modifier');
    });

    test('does not report async mismatch when param counts differ', () => {
      const base = makeFunc({ isAsync: false, params: ['a: string'] });
      const variant = makeFunc({ isAsync: true, params: ['a: string', 'b: number'] });

      const result = detector.detectUnnecessaryDiff(base, variant);

      // Async mismatch with param count difference is considered intentional
      expect(result).toBeNull();
    });

    test('reports async mismatch when param counts are same', () => {
      const base = makeFunc({ isAsync: false, params: ['a: string', 'b: number'] });
      const variant = makeFunc({ isAsync: true, params: ['a: string', 'b: number'] });

      const result = detector.detectUnnecessaryDiff(base, variant);

      expect(result).not.toBeNull();
    });
  });

  describe('isUnnecessaryAsyncChange', () => {
    test('returns true for async mismatch with same param count', () => {
      const base = makeFunc({ isAsync: false, params: ['a: string'] });
      const variant = makeFunc({ isAsync: true, params: ['a: string'] });

      expect(detector.isUnnecessaryAsyncChange(base, variant)).toBe(true);
    });

    test('returns false when async matches', () => {
      const base = makeFunc({ isAsync: true });
      const variant = makeFunc({ isAsync: true });

      expect(detector.isUnnecessaryAsyncChange(base, variant)).toBe(false);
    });

    test('returns false when param counts differ', () => {
      const base = makeFunc({ isAsync: false, params: ['a: string'] });
      const variant = makeFunc({ isAsync: true, params: ['a: string', 'b: number'] });

      expect(detector.isUnnecessaryAsyncChange(base, variant)).toBe(false);
    });
  });
});
