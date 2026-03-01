import { CodeConflictStrategy } from '../../src/conflict/strategies/code-strategy';
import { ConflictRisk } from '../../src/conflict/types';
import { ResolutionContext } from '../../src/conflict/strategies';

function makeConflict(overrides: Partial<ConflictRisk> = {}): ConflictRisk {
  return {
    type: 'code_conflict',
    severity: 'high',
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

describe('CodeConflictStrategy', () => {
  let strategy: CodeConflictStrategy;

  beforeEach(() => {
    strategy = new CodeConflictStrategy();
  });

  describe('canHandle', () => {
    test('handles code conflicts', () => {
      expect(strategy.canHandle(makeConflict({ type: 'code_conflict' }))).toBe(true);
    });

    test('does not handle other conflict types', () => {
      expect(strategy.canHandle(makeConflict({ type: 'semantic_conflict' }))).toBe(false);
      expect(strategy.canHandle(makeConflict({ type: 'dependency_conflict' }))).toBe(false);
    });
  });

  describe('resolve - high severity', () => {
    test('resolves high severity code conflict as manual', () => {
      const conflict = makeConflict({
        severity: 'high',
        description: 'Line to remove not found in variant',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('manual');
      expect(resolution.confidence).toBe(0.1);
      expect(resolution.requiresHumanReview).toBe(true);
      expect(resolution.explanation).toContain('Direct code conflict');
    });
  });

  describe('resolve - medium/low severity', () => {
    test('recommends skip_line for medium severity code conflict', () => {
      const conflict = makeConflict({
        severity: 'medium',
        description: 'Minor code mismatch',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('skip_line');
      expect(resolution.confidence).toBe(0.5);
      expect(resolution.requiresHumanReview).toBe(true);
    });

    test('recommends skip_line for low severity code conflict', () => {
      const conflict = makeConflict({
        severity: 'low',
        description: 'Minor code mismatch',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('skip_line');
      expect(resolution.confidence).toBe(0.5);
      expect(resolution.requiresHumanReview).toBe(true);
    });
  });

  describe('explanation quality', () => {
    test('high severity explains manual resolution needed', () => {
      const conflict = makeConflict({
        severity: 'high',
        description: 'Line to remove not found in variant: "return oldValue;"',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.explanation).toContain('Manual resolution required');
    });

    test('low severity suggests skip may be safe', () => {
      const conflict = makeConflict({
        severity: 'low',
        description: 'Minor code mismatch',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.explanation).toContain('safe to skip');
    });
  });
});
