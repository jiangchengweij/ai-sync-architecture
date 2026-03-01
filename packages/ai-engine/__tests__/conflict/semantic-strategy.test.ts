import { SemanticConflictStrategy } from '../../src/conflict/strategies/semantic-strategy';
import { ConflictRisk } from '../../src/conflict/types';
import { ResolutionContext } from '../../src/conflict/strategies';

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

describe('SemanticConflictStrategy', () => {
  let strategy: SemanticConflictStrategy;

  beforeEach(() => {
    strategy = new SemanticConflictStrategy();
  });

  describe('canHandle', () => {
    test('handles semantic conflicts', () => {
      expect(strategy.canHandle(makeConflict({ type: 'semantic_conflict' }))).toBe(true);
    });

    test('does not handle other conflict types', () => {
      expect(strategy.canHandle(makeConflict({ type: 'code_conflict' }))).toBe(false);
      expect(strategy.canHandle(makeConflict({ type: 'dependency_conflict' }))).toBe(false);
    });
  });

  describe('resolve - rename detection', () => {
    test('detects rename pattern from description', () => {
      const conflict = makeConflict({
        description: 'Function renamed from "getData" to "fetchData", variant still references old name',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('rename_reference');
      expect(resolution.confidence).toBe(0.85);
      expect(resolution.explanation).toContain('getData');
      expect(resolution.explanation).toContain('fetchData');
      expect(resolution.patch).toContain('getData');
      expect(resolution.patch).toContain('fetchData');
    });

    test('uses known name mapping with higher confidence', () => {
      const conflict = makeConflict({
        description: 'Function renamed from "getData" to "fetchData"',
      });
      const context = makeContext({
        nameMappings: new Map([['getData', 'getVariantData']]),
      });

      const resolution = strategy.resolve(conflict, context);

      expect(resolution.strategy).toBe('rename_reference');
      expect(resolution.confidence).toBe(0.95);
      expect(resolution.requiresHumanReview).toBe(false);
      expect(resolution.patch).toContain('getVariantData');
    });

    test('case-change rename is detected', () => {
      const conflict = makeConflict({
        description: 'Function renamed from "getData" to "GetData", variant still uses old name',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('rename_reference');
    });
  });

  describe('resolve - param count changes', () => {
    test('detects single param addition', () => {
      const conflict = makeConflict({
        description: 'Function "process" signature changed (2 → 3 params), but variant calls it',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('update_params');
      expect(resolution.confidence).toBe(0.6);
      expect(resolution.requiresHumanReview).toBe(true);
      expect(resolution.explanation).toContain('2 → 3');
    });

    test('detects param removal', () => {
      const conflict = makeConflict({
        description: 'Function "process" signature changed (3 → 2 params)',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('update_params');
      expect(resolution.confidence).toBe(0.4);
      expect(resolution.requiresHumanReview).toBe(true);
      expect(resolution.explanation).toContain('3 → 2');
    });

    test('flags major param changes as manual', () => {
      const conflict = makeConflict({
        description: 'Function "process" signature changed (1 → 4 params)',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('manual');
      expect(resolution.confidence).toBe(0.2);
      expect(resolution.requiresHumanReview).toBe(true);
    });
  });

  describe('resolve - fallback', () => {
    test('falls back to manual for unrecognized semantic conflict', () => {
      const conflict = makeConflict({
        description: 'Some unknown semantic issue occurred',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('manual');
      expect(resolution.confidence).toBe(0);
      expect(resolution.requiresHumanReview).toBe(true);
    });
  });

  describe('requiresHumanReview threshold', () => {
    test('respects autoResolveThreshold from context', () => {
      const conflict = makeConflict({
        description: 'Function renamed from "a" to "b"',
      });
      const context = makeContext({ autoResolveThreshold: 0.9 });

      const resolution = strategy.resolve(conflict, context);

      // 0.85 confidence < 0.9 threshold = needs review
      expect(resolution.confidence).toBe(0.85);
      expect(resolution.requiresHumanReview).toBe(true);
    });

    test('auto-resolves when confidence exceeds threshold', () => {
      const conflict = makeConflict({
        description: 'Function renamed from "a" to "b"',
      });
      const context = makeContext({ autoResolveThreshold: 0.8 });

      const resolution = strategy.resolve(conflict, context);

      // 0.85 confidence > 0.8 threshold = auto-resolve
      expect(resolution.confidence).toBe(0.85);
      expect(resolution.requiresHumanReview).toBe(false);
    });
  });
});
