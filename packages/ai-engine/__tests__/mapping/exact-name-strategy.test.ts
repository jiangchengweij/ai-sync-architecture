import { ExactNameMappingStrategy } from '../../src/mapping/strategies/exact-name-strategy';
import { FileFunction, createMappingContext, MappingContext } from '../../src/mapping/strategies/types';

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

describe('ExactNameMappingStrategy', () => {
  let strategy: ExactNameMappingStrategy;

  beforeEach(() => {
    strategy = new ExactNameMappingStrategy();
  });

  describe('metadata', () => {
    test('has correct name', () => {
      expect(strategy.name).toBe('exact_name');
    });

    test('has highest priority (runs first)', () => {
      expect(strategy.priority).toBe(1);
    });
  });

  describe('canHandle', () => {
    test('always returns true (always applicable)', () => {
      const ctx = createMappingContext(null);
      expect(strategy.canHandle(ctx)).toBe(true);
    });
  });

  describe('findMatches', () => {
    test('matches functions with same file path and name', async () => {
      const base = [
        makeFileFunction({ key: 'src/utils.ts:helper', func: { ...makeFileFunction().func, name: 'helper' } }),
        makeFileFunction({ key: 'src/core.ts:process', func: { ...makeFileFunction().func, name: 'process' }, filePath: 'src/core.ts' }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/utils.ts:helper', func: { ...makeFileFunction().func, name: 'helper' } }),
        makeFileFunction({ key: 'src/core.ts:process', func: { ...makeFileFunction().func, name: 'process' }, filePath: 'src/core.ts' }),
        makeFileFunction({ key: 'src/other.ts:extra', func: { ...makeFileFunction().func, name: 'extra' }, filePath: 'src/other.ts' }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(2);
      expect(matches[0].matchType).toBe('exact_name');
      expect(matches[0].confidence).toBe(0.98);
    });

    test('does not match functions with different names', async () => {
      const base = [
        makeFileFunction({ key: 'src/utils.ts:getData', func: { ...makeFileFunction().func, name: 'getData' } }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/utils.ts:fetchData', func: { ...makeFileFunction().func, name: 'fetchData' } }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('does not match functions in different files with same name', async () => {
      const base = [
        makeFileFunction({ key: 'src/a.ts:helper', func: { ...makeFileFunction().func, name: 'helper' }, filePath: 'src/a.ts' }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/b.ts:helper', func: { ...makeFileFunction().func, name: 'helper' }, filePath: 'src/b.ts' }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('respects already mapped keys', async () => {
      const base = [
        makeFileFunction({ key: 'src/utils.ts:helper', func: { ...makeFileFunction().func, name: 'helper' } }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/utils.ts:helper', func: { ...makeFileFunction().func, name: 'helper' } }),
      ];

      const ctx = createMappingContext(null);
      ctx.mappedVariantKeys.add('src/utils.ts:helper'); // Already mapped

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('updates context with mapped keys', async () => {
      const base = [
        makeFileFunction({ key: 'src/utils.ts:helper', func: { ...makeFileFunction().func, name: 'helper' } }),
      ];
      const variant = [
        makeFileFunction({ key: 'src/utils.ts:helper', func: { ...makeFileFunction().func, name: 'helper' } }),
      ];

      const ctx = createMappingContext(null);
      await strategy.findMatches(base, variant, ctx);

      expect(ctx.mappedBaseKeys.has('src/utils.ts:helper')).toBe(true);
      expect(ctx.mappedVariantKeys.has('src/utils.ts:helper')).toBe(true);
    });

    test('handles class methods', async () => {
      const base = [
        makeFileFunction({
          key: 'src/service.ts:UserService.login',
          filePath: 'src/service.ts',
          func: {
            ...makeFileFunction().func,
            name: 'login',
            className: 'UserService',
          },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/service.ts:UserService.login',
          filePath: 'src/service.ts',
          func: {
            ...makeFileFunction().func,
            name: 'login',
            className: 'UserService',
          },
        }),
      ];

      const ctx = createMappingContext(null);
      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(1);
      expect(matches[0].baseFunctionKey).toBe('src/service.ts:UserService.login');
    });
  });
});
