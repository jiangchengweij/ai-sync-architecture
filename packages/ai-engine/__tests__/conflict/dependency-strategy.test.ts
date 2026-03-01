import { DependencyConflictStrategy } from '../../src/conflict/strategies/dependency-strategy';
import { ConflictRisk } from '../../src/conflict/types';
import { ResolutionContext } from '../../src/conflict/strategies';

function makeConflict(overrides: Partial<ConflictRisk> = {}): ConflictRisk {
  return {
    type: 'dependency_conflict',
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

describe('DependencyConflictStrategy', () => {
  let strategy: DependencyConflictStrategy;

  beforeEach(() => {
    strategy = new DependencyConflictStrategy();
  });

  describe('canHandle', () => {
    test('handles dependency conflicts', () => {
      expect(strategy.canHandle(makeConflict({ type: 'dependency_conflict' }))).toBe(true);
    });

    test('does not handle other conflict types', () => {
      expect(strategy.canHandle(makeConflict({ type: 'semantic_conflict' }))).toBe(false);
      expect(strategy.canHandle(makeConflict({ type: 'code_conflict' }))).toBe(false);
    });
  });

  describe('resolve - package imports', () => {
    test('resolves package dependency with install strategy', () => {
      const conflict = makeConflict({
        severity: 'low',
        description: 'New package import "lodash" — ensure it\'s installed in variant',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('install_package');
      expect(resolution.confidence).toBe(0.9);
      expect(resolution.requiresHumanReview).toBe(false);
      expect(resolution.patch).toContain('npm install lodash');
    });

    test('handles various package names', () => {
      const conflict = makeConflict({
        description: 'New package import "axios" — ensure it\'s installed',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('install_package');
      expect(resolution.patch).toContain('axios');
    });
  });

  describe('resolve - known import mappings', () => {
    test('resolves relative import with known mapping', () => {
      const context = makeContext({
        importMappings: new Map([['./utils/helpers', './lib/helpers']]),
      });
      const conflict = makeConflict({
        description: 'New import "./utils/helpers" may not exist in variant project',
      });

      const resolution = strategy.resolve(conflict, context);

      expect(resolution.strategy).toBe('adapt_import_path');
      expect(resolution.confidence).toBe(0.95);
      expect(resolution.requiresHumanReview).toBe(false);
      expect(resolution.patch).toContain('./lib/helpers');
    });
  });

  describe('resolve - relative path adaptation', () => {
    test('adapts ./path to ../path', () => {
      const conflict = makeConflict({
        description: 'New import "./services/helper" may not exist in variant project',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('adapt_import_path');
      expect(resolution.confidence).toBe(0.7);
      expect(resolution.patch).toContain('../services/helper');
    });

    test('adapts ../path to ./path', () => {
      const conflict = makeConflict({
        description: 'New import "../utils/core" may not exist in variant project',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('adapt_import_path');
      expect(resolution.patch).toContain('./utils/core');
    });

    test('adapts services/ to service/', () => {
      const conflict = makeConflict({
        description: 'New import "./services/auth" may not exist in variant project',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('adapt_import_path');
    });
  });

  describe('resolve - fallback', () => {
    test('falls back to manual for unrecognized relative import', () => {
      const conflict = makeConflict({
        description: 'New import "/absolute/path/module" may not exist in variant project',
      });

      const resolution = strategy.resolve(conflict, makeContext());

      expect(resolution.strategy).toBe('manual');
      expect(resolution.requiresHumanReview).toBe(true);
    });
  });

  describe('requiresHumanReview threshold', () => {
    test('path adaptation respects threshold', () => {
      const conflict = makeConflict({
        description: 'New import "./services/helper" may not exist',
      });
      const context = makeContext({ autoResolveThreshold: 0.9 });

      const resolution = strategy.resolve(conflict, context);

      // 0.7 confidence < 0.9 threshold = needs review
      expect(resolution.confidence).toBe(0.7);
      expect(resolution.requiresHumanReview).toBe(true);
    });

    test('package install always auto-resolves (high confidence)', () => {
      const conflict = makeConflict({
        description: 'New package import "lodash"',
      });
      const context = makeContext({ autoResolveThreshold: 0.8 });

      const resolution = strategy.resolve(conflict, context);

      // 0.9 confidence > 0.8 threshold = auto-resolve
      expect(resolution.confidence).toBe(0.9);
      expect(resolution.requiresHumanReview).toBe(false);
    });
  });
});
