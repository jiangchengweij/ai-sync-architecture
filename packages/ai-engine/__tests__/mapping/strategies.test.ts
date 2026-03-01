import {
  MappingStrategy,
  MappingContext,
  StrategyRegistry,
  DefaultMappingStrategyRegistry,
  FileFunction,
  CodeMapping,
  createMappingContext,
} from '../../src/mapping/strategies/types';

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

function makeContext(overrides: Partial<MappingContext> = {}): MappingContext {
  const ctx = createMappingContext(null);
  return {
    ...ctx,
    ...overrides,
  };
}

describe('MappingStrategy interface', () => {
  test('strategy with name, priority, canHandle, and findMatches', () => {
    const strategy: MappingStrategy = {
      name: 'exact_name',
      priority: 1,
      canHandle: () => true,
      findMatches: async () => [],
    };

    expect(strategy.name).toBe('exact_name');
    expect(strategy.priority).toBe(1);
    expect(typeof strategy.canHandle).toBe('function');
    expect(typeof strategy.findMatches).toBe('function');
  });
});

describe('DefaultMappingStrategyRegistry', () => {
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new DefaultMappingStrategyRegistry();
  });

  test('starts empty', () => {
    expect(registry.getStrategies()).toHaveLength(0);
  });

  test('registers strategies', () => {
    const strategy: MappingStrategy = {
      name: 'test',
      priority: 1,
      canHandle: () => true,
      findMatches: async () => [],
    };

    registry.register(strategy);

    expect(registry.getStrategies()).toHaveLength(1);
    expect(registry.getStrategies()[0]).toBe(strategy);
  });

  test('getStrategies returns in registration order (unsorted)', () => {
    const lowPriority: MappingStrategy = {
      name: 'low',
      priority: 10,
      canHandle: () => true,
      findMatches: async () => [],
    };
    const highPriority: MappingStrategy = {
      name: 'high',
      priority: 1,
      canHandle: () => true,
      findMatches: async () => [],
    };

    registry.register(lowPriority);
    registry.register(highPriority);

    // getStrategies returns in registration order
    const strategies = registry.getStrategies();
    expect(strategies[0].name).toBe('low');
    expect(strategies[1].name).toBe('high');

    // getOrderedStrategies returns sorted by priority
    const ordered = registry.getOrderedStrategies();
    expect(ordered[0].name).toBe('high');
    expect(ordered[1].name).toBe('low');
  });

  test('getOrderedStrategies returns sorted by priority', () => {
    registry.register({ name: 'c', priority: 3, canHandle: () => true, findMatches: async () => [] });
    registry.register({ name: 'a', priority: 1, canHandle: () => true, findMatches: async () => [] });
    registry.register({ name: 'b', priority: 2, canHandle: () => true, findMatches: async () => [] });

    const ordered = registry.getOrderedStrategies();

    expect(ordered.map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });
});

describe('MappingContext', () => {
  test('tracks mapped keys', () => {
    const ctx = makeContext();

    ctx.mappedBaseKeys.add('base:func1');
    ctx.mappedVariantKeys.add('variant:func1');

    expect(ctx.mappedBaseKeys.has('base:func1')).toBe(true);
    expect(ctx.mappedVariantKeys.has('variant:func1')).toBe(true);
  });

  test('can check if function is already mapped', () => {
    const ctx = makeContext({
      mappedBaseKeys: new Set(['src/a.ts:funcA']),
    });

    const ff = makeFileFunction({ key: 'src/a.ts:funcA' });
    expect(ctx.mappedBaseKeys.has(ff.key)).toBe(true);

    const unmapped = makeFileFunction({ key: 'src/b.ts:funcB' });
    expect(ctx.mappedBaseKeys.has(unmapped.key)).toBe(false);
  });
});
