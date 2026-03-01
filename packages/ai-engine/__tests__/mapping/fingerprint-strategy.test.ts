import { FingerprintMappingStrategy } from '../../src/mapping/strategies/fingerprint-strategy';
import { FileFunction, createMappingContext } from '../../src/mapping/strategies/types';

function makeFileFunction(overrides: Partial<FileFunction> = {}): FileFunction {
  return {
    filePath: 'src/utils.ts',
    func: {
      name: 'doSomething',
      kind: 'function',
      params: ['a: string'],
      returnType: 'void',
      startLine: 1,
      endLine: 5,
      isAsync: false,
      isExported: true,
      code: 'function doSomething(a: string) {}',
    },
    fingerprint: 'abc123',
    key: 'src/utils.ts:doSomething',
    ...overrides,
  };
}

describe('FingerprintMappingStrategy', () => {
  let strategy: FingerprintMappingStrategy;

  beforeEach(() => {
    strategy = new FingerprintMappingStrategy();
  });

  describe('metadata', () => {
    test('has correct name', () => {
      expect(strategy.name).toBe('fingerprint');
    });

    test('has second priority (runs after exact name)', () => {
      expect(strategy.priority).toBe(2);
    });
  });

  describe('canHandle', () => {
    test('always returns true (always applicable)', () => {
      const ctx = createMappingContext(null);
      expect(strategy.canHandle(ctx)).toBe(true);
    });
  });

  describe('findMatches', () => {
    test('matches functions with identical fingerprints', async () => {
      const base = [
        makeFileFunction({
          key: 'src/old.ts:helper',
          filePath: 'src/old.ts',
          fingerprint: 'fp-12345',
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/new.ts:helper',
          filePath: 'src/new.ts',
          fingerprint: 'fp-12345', // Same fingerprint
        }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('fingerprint');
      expect(matches[0].confidence).toBe(0.85);
    });

    test('does not match functions with different fingerprints', async () => {
      const base = [
        makeFileFunction({ fingerprint: 'fp-aaa' }),
      ];
      const variant = [
        makeFileFunction({ fingerprint: 'fp-bbb' }), // Different fingerprint
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('matches renamed functions with same structure', async () => {
      const base = [
        makeFileFunction({
          key: 'src/utils.ts:fetchData',
          func: { ...makeFileFunction().func, name: 'fetchData' },
          fingerprint: 'fp-structure-1',
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/utils.ts:getData',
          func: { ...makeFileFunction().func, name: 'getData' }, // Renamed
          fingerprint: 'fp-structure-1', // Same structure
        }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(1);
      expect(matches[0].baseFunctionName).toBe('fetchData');
      expect(matches[0].variantFunctionName).toBe('getData');
    });

    test('matches moved functions with same structure', async () => {
      const base = [
        makeFileFunction({
          key: 'src/old/location.ts:helper',
          filePath: 'src/old/location.ts',
          fingerprint: 'fp-moved',
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/new/location.ts:helper',
          filePath: 'src/new/location.ts',
          fingerprint: 'fp-moved', // Same fingerprint
        }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(1);
    });

    test('skips already mapped base keys', async () => {
      const base = [
        makeFileFunction({ key: 'src/a.ts:fn', fingerprint: 'fp-same' }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/b.ts:fn', fingerprint: 'fp-same' }),
      ];

      const ctx = createMappingContext(null);
      ctx.mappedBaseKeys.add('src/a.ts:fn'); // Already mapped

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('skips already mapped variant keys', async () => {
      const base = [
        makeFileFunction({ key: 'src/a.ts:fn', fingerprint: 'fp-same' }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/b.ts:fn', fingerprint: 'fp-same' }),
      ];

      const ctx = createMappingContext(null);
      ctx.mappedVariantKeys.add('src/b.ts:fn'); // Already mapped

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('updates context with mapped keys', async () => {
      const base = [
        makeFileFunction({ key: 'src/a.ts:fn', fingerprint: 'fp-same' }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/b.ts:fn', fingerprint: 'fp-same' }),
      ];

      const ctx = createMappingContext(null);
      await strategy.findMatches(base, variant, ctx);

      expect(ctx.mappedBaseKeys.has('src/a.ts:fn')).toBe(true);
      expect(ctx.mappedVariantKeys.has('src/b.ts:fn')).toBe(true);
    });

    test('handles multiple functions with same fingerprint (first match wins)', async () => {
      const base = [
        makeFileFunction({ key: 'src/a.ts:fn1', fingerprint: 'fp-same' }),
        makeFileFunction({ key: 'src/a.ts:fn2', fingerprint: 'fp-same' }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/b.ts:fn1', fingerprint: 'fp-same' }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      // Only first base function matches
      expect(matches).toHaveLength(1);
      expect(matches[0].baseFunctionKey).toBe('src/a.ts:fn1');
    });
  });
});
