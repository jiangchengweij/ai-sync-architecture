import {
  ResolutionStrategy,
  StrategyRegistry,
  ResolutionContext,
  DefaultStrategyRegistry,
  FallbackStrategy,
  createResolution,
} from '../../src/conflict/strategies';
import { ConflictRisk } from '../../src/conflict/types';
import { Resolution } from '../../src/conflict/resolver-types';

function makeConflict(overrides: Partial<ConflictRisk> = {}): ConflictRisk {
  return {
    type: 'semantic_conflict',
    severity: 'medium',
    filePath: 'src/utils.ts',
    description: 'Test conflict',
    suggestion: 'Fix it',
    ...overrides,
  };
}

function makeContext(overrides: Partial<ResolutionContext> = {}): ResolutionContext {
  return {
    conflictIndex: 0,
    importMappings: new Map(),
    nameMappings: new Map(),
    autoResolveThreshold: 0.8,
    ...overrides,
  };
}

describe('ResolutionStrategy interface', () => {
  test('strategy with canHandle and resolve methods', () => {
    const strategy: ResolutionStrategy = {
      name: 'rename_reference',
      canHandle: (conflict) => conflict.type === 'semantic_conflict',
      resolve: (conflict, context) => ({
        conflictIndex: context.conflictIndex,
        conflict,
        strategy: 'rename_reference',
        confidence: 0.85,
        requiresHumanReview: false,
        explanation: 'Test resolution',
      }),
    };

    expect(strategy.canHandle(makeConflict({ type: 'semantic_conflict' }))).toBe(true);
    expect(strategy.canHandle(makeConflict({ type: 'code_conflict' }))).toBe(false);
  });
});

describe('FallbackStrategy', () => {
  test('handles all conflicts', () => {
    const strategy = new FallbackStrategy();

    expect(strategy.canHandle(makeConflict({ type: 'semantic_conflict' }))).toBe(true);
    expect(strategy.canHandle(makeConflict({ type: 'code_conflict' }))).toBe(true);
    expect(strategy.canHandle(makeConflict({ type: 'dependency_conflict' }))).toBe(true);
  });

  test('returns manual resolution with zero confidence', () => {
    const strategy = new FallbackStrategy();
    const conflict = makeConflict();
    const context = makeContext();

    const resolution = strategy.resolve(conflict, context);

    expect(resolution.strategy).toBe('manual');
    expect(resolution.confidence).toBe(0);
    expect(resolution.requiresHumanReview).toBe(true);
    expect(resolution.explanation).toContain('Unable to auto-resolve');
  });
});

describe('DefaultStrategyRegistry', () => {
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = new DefaultStrategyRegistry();
  });

  test('starts empty', () => {
    expect(registry.getStrategies()).toHaveLength(0);
    expect(registry.findStrategy(makeConflict())).toBeUndefined();
  });

  test('registers strategies', () => {
    const strategy: ResolutionStrategy = {
      name: 'rename_reference',
      canHandle: () => true,
      resolve: () => null as any,
    };

    registry.register(strategy);

    expect(registry.getStrategies()).toHaveLength(1);
    expect(registry.getStrategies()[0]).toBe(strategy);
  });

  test('finds first matching strategy', () => {
    const strategy1: ResolutionStrategy = {
      name: 'rename_reference',
      canHandle: (c) => c.type === 'semantic_conflict',
      resolve: () => null as any,
    };
    const strategy2: ResolutionStrategy = {
      name: 'adapt_import_path',
      canHandle: (c) => c.type === 'dependency_conflict',
      resolve: () => null as any,
    };

    registry.register(strategy1);
    registry.register(strategy2);

    const semantic = makeConflict({ type: 'semantic_conflict' });
    const dependency = makeConflict({ type: 'dependency_conflict' });

    expect(registry.findStrategy(semantic)).toBe(strategy1);
    expect(registry.findStrategy(dependency)).toBe(strategy2);
  });

  test('returns first match when multiple strategies can handle', () => {
    const strategy1: ResolutionStrategy = {
      name: 'rename_reference',
      canHandle: () => true,
      resolve: () => null as any,
    };
    const strategy2: ResolutionStrategy = {
      name: 'adapt_import_path',
      canHandle: () => true,
      resolve: () => null as any,
    };

    registry.register(strategy1);
    registry.register(strategy2);

    // Both can handle, but first one wins
    expect(registry.findStrategy(makeConflict())).toBe(strategy1);
  });

  test('returns undefined when no strategy matches', () => {
    const strategy: ResolutionStrategy = {
      name: 'rename_reference',
      canHandle: (c) => c.type === 'semantic_conflict',
      resolve: () => null as any,
    };

    registry.register(strategy);

    expect(registry.findStrategy(makeConflict({ type: 'code_conflict' }))).toBeUndefined();
  });

  test('with fallback strategy, always finds a match', () => {
    registry.register(new FallbackStrategy());

    expect(registry.findStrategy(makeConflict({ type: 'semantic_conflict' }))).toBeDefined();
    expect(registry.findStrategy(makeConflict({ type: 'code_conflict' }))).toBeDefined();
  });
});

describe('createResolution helper', () => {
  test('creates resolution with all fields', () => {
    const context = makeContext({ conflictIndex: 5 });
    const conflict = makeConflict();

    const resolution = createResolution(context, conflict, 'rename_reference', {
      confidence: 0.9,
      patch: '// Replace x with y',
      explanation: 'Renamed function',
    });

    expect(resolution.conflictIndex).toBe(5);
    expect(resolution.conflict).toBe(conflict);
    expect(resolution.strategy).toBe('rename_reference');
    expect(resolution.confidence).toBe(0.9);
    expect(resolution.patch).toBe('// Replace x with y');
    expect(resolution.explanation).toBe('Renamed function');
  });

  test('auto-computes requiresHumanReview based on threshold', () => {
    const context = makeContext({ autoResolveThreshold: 0.8 });

    // High confidence - no human review needed
    const high = createResolution(context, makeConflict(), 'rename_reference', {
      confidence: 0.9,
      explanation: 'High confidence',
    });
    expect(high.requiresHumanReview).toBe(false);

    // Low confidence - human review needed
    const low = createResolution(context, makeConflict(), 'rename_reference', {
      confidence: 0.5,
      explanation: 'Low confidence',
    });
    expect(low.requiresHumanReview).toBe(true);
  });

  test('allows overriding requiresHumanReview', () => {
    const context = makeContext({ autoResolveThreshold: 0.8 });

    const resolution = createResolution(context, makeConflict(), 'rename_reference', {
      confidence: 0.9,
      requiresHumanReview: true, // Override
      explanation: 'Forced review',
    });

    expect(resolution.requiresHumanReview).toBe(true);
  });
});
