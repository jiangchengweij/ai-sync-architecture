import { SignatureMatcher } from '../../src/quality/signature-matcher';
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

describe('SignatureMatcher', () => {
  let matcher: SignatureMatcher;

  beforeEach(() => {
    matcher = new SignatureMatcher();
  });

  describe('signaturesMatch', () => {
    test('returns true for identical signatures', () => {
      const a = makeFunc();
      const b = makeFunc();

      expect(matcher.signaturesMatch(a, b)).toBe(true);
    });

    test('returns true when only param names differ', () => {
      const a = makeFunc({ params: ['a: string'] });
      const b = makeFunc({ params: ['b: string'] });

      // Same param count and types, just different names
      expect(matcher.signaturesMatch(a, b)).toBe(true);
    });

    test('returns false when param count differs', () => {
      const a = makeFunc({ params: ['a: string'] });
      const b = makeFunc({ params: ['a: string', 'b: number'] });

      expect(matcher.signaturesMatch(a, b)).toBe(false);
    });

    test('returns false when return type differs', () => {
      const a = makeFunc({ returnType: 'void' });
      const b = makeFunc({ returnType: 'string' });

      expect(matcher.signaturesMatch(a, b)).toBe(false);
    });

    test('returns false when async differs', () => {
      const a = makeFunc({ isAsync: false });
      const b = makeFunc({ isAsync: true });

      expect(matcher.signaturesMatch(a, b)).toBe(false);
    });

    test('handles undefined return types as void', () => {
      const a = makeFunc({ returnType: undefined });
      const b = makeFunc({ returnType: undefined });

      expect(matcher.signaturesMatch(a, b)).toBe(true);
    });

    test('handles empty params', () => {
      const a = makeFunc({ params: [] });
      const b = makeFunc({ params: [] });

      expect(matcher.signaturesMatch(a, b)).toBe(true);
    });

    test('handles multiple params with same count', () => {
      const a = makeFunc({ params: ['a: string', 'b: number', 'c: boolean'] });
      const b = makeFunc({ params: ['x: string', 'y: number', 'z: boolean'] });

      expect(matcher.signaturesMatch(a, b)).toBe(true);
    });
  });

  describe('formatSignature', () => {
    test('formats basic function signature', () => {
      const func = makeFunc({ params: ['a: string'], returnType: 'void', isAsync: false });

      expect(matcher.formatSignature(func)).toBe('(a: string) => void');
    });

    test('formats async function signature', () => {
      const func = makeFunc({ isAsync: true });

      expect(matcher.formatSignature(func)).toBe('async (a: string) => void');
    });

    test('formats function with multiple params', () => {
      const func = makeFunc({ params: ['a: string', 'b: number'] });

      expect(matcher.formatSignature(func)).toBe('(a: string, b: number) => void');
    });

    test('formats function with no params', () => {
      const func = makeFunc({ params: [] });

      expect(matcher.formatSignature(func)).toBe('() => void');
    });

    test('formats function with explicit return type', () => {
      const func = makeFunc({ returnType: 'Promise<string>' });

      expect(matcher.formatSignature(func)).toBe('(a: string) => Promise<string>');
    });

    test('treats undefined return type as void', () => {
      const func = makeFunc({ returnType: undefined });

      expect(matcher.formatSignature(func)).toBe('(a: string) => void');
    });

    test('formats complex params', () => {
      const func = makeFunc({
        params: ['data: Data<T>', 'options?: Options'],
        returnType: 'Result',
      });

      expect(matcher.formatSignature(func)).toBe('(data: Data<T>, options?: Options) => Result');
    });
  });

  describe('classifyDrift', () => {
    test('returns "signature" for param count mismatch', () => {
      const base = makeFunc({ params: ['a: string'] });
      const variant = makeFunc({ params: ['a: string', 'b: number'] });

      expect(matcher.classifyDrift(base, variant)).toBe('signature');
    });

    test('returns "signature" for return type mismatch', () => {
      const base = makeFunc({ returnType: 'void' });
      const variant = makeFunc({ returnType: 'string' });

      expect(matcher.classifyDrift(base, variant)).toBe('signature');
    });

    test('returns "structure" for async mismatch only', () => {
      const base = makeFunc({ isAsync: false });
      const variant = makeFunc({ isAsync: true });

      expect(matcher.classifyDrift(base, variant)).toBe('structure');
    });

    test('returns "naming" when only param names differ', () => {
      const base = makeFunc({ params: ['a: string', 'b: number'] });
      const variant = makeFunc({ params: ['x: string', 'y: number'] });

      // Same count and return type, just different names
      expect(matcher.classifyDrift(base, variant)).toBe('naming');
    });

    test('prioritizes signature over structure', () => {
      const base = makeFunc({ params: ['a: string'], isAsync: false, returnType: 'void' });
      const variant = makeFunc({ params: ['a: string', 'b: number'], isAsync: true, returnType: 'void' });

      // Param count differs, so signature drift takes priority
      expect(matcher.classifyDrift(base, variant)).toBe('signature');
    });

    test('prioritizes signature over naming', () => {
      const base = makeFunc({ params: ['a: string'], returnType: 'void' });
      const variant = makeFunc({ params: ['a: string'], returnType: 'string' });

      expect(matcher.classifyDrift(base, variant)).toBe('signature');
    });
  });
});
