import { CompositeConflictResolver } from '../../src/conflict/strategies/composite-resolver';
import { ConflictRisk } from '../../src/conflict/types';
import { ResolverOptions } from '../../src/conflict/resolver-types';

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

describe('CompositeConflictResolver', () => {
  describe('resolve', () => {
    test('resolves conflicts using registered strategies', () => {
      const resolver = new CompositeConflictResolver();

      const conflicts = [
        makeConflict({ type: 'semantic_conflict', description: 'Function renamed from "a" to "b"' }),
        makeConflict({ type: 'dependency_conflict', description: 'New package import "lodash"' }),
        makeConflict({ type: 'code_conflict', severity: 'high', description: 'Line not found' }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions).toHaveLength(3);
      expect(resolutions[0].strategy).toBe('rename_reference');
      expect(resolutions[1].strategy).toBe('install_package');
      expect(resolutions[2].strategy).toBe('manual');
    });

    test('uses fallback for unknown conflict types', () => {
      const resolver = new CompositeConflictResolver();

      // Create a conflict that doesn't match any specific strategy pattern
      const conflicts = [
        makeConflict({ type: 'semantic_conflict', description: 'Unknown semantic issue' }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].strategy).toBe('manual');
      expect(resolutions[0].confidence).toBe(0);
    });
  });

  describe('resolveAll', () => {
    test('provides summary stats', () => {
      const resolver = new CompositeConflictResolver();

      const conflicts = [
        makeConflict({ type: 'dependency_conflict', severity: 'low', description: 'New package import "axios"' }),
        makeConflict({ type: 'code_conflict', severity: 'high', description: 'Line not found' }),
        makeConflict({ type: 'semantic_conflict', description: 'Function renamed from "a" to "b"' }),
      ];

      const result = resolver.resolveAll(conflicts);

      expect(result.resolutions).toHaveLength(3);
      expect(result.autoResolved.length + result.needsHumanReview.length).toBe(3);
      expect(result.autoResolveRate).toBeGreaterThan(0);
      expect(result.autoResolveRate).toBeLessThanOrEqual(1);
    });

    test('empty conflicts returns 100% auto-resolve rate', () => {
      const resolver = new CompositeConflictResolver();

      const result = resolver.resolveAll([]);

      expect(result.autoResolveRate).toBe(1);
      expect(result.resolutions).toHaveLength(0);
    });
  });

  describe('options', () => {
    test('accepts import path mappings', () => {
      const options: ResolverOptions = {
        importPathMappings: new Map([['./utils/helpers', './lib/helpers']]),
      };
      const resolver = new CompositeConflictResolver(options);

      const conflicts = [
        makeConflict({
          type: 'dependency_conflict',
          description: 'New import "./utils/helpers" may not exist in variant project',
        }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions[0].strategy).toBe('adapt_import_path');
      expect(resolutions[0].confidence).toBe(0.95);
      expect(resolutions[0].patch).toContain('./lib/helpers');
    });

    test('accepts name mappings', () => {
      const options: ResolverOptions = {
        nameMappings: new Map([['getData', 'getVariantData']]),
      };
      const resolver = new CompositeConflictResolver(options);

      const conflicts = [
        makeConflict({
          type: 'semantic_conflict',
          description: 'Function renamed from "getData" to "fetchData"',
        }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions[0].confidence).toBe(0.95);
      expect(resolutions[0].patch).toContain('getVariantData');
    });

    test('accepts custom autoResolveThreshold', () => {
      const options: ResolverOptions = {
        autoResolveThreshold: 0.9,
      };
      const resolver = new CompositeConflictResolver(options);

      const conflicts = [
        makeConflict({
          type: 'semantic_conflict',
          description: 'Function renamed from "a" to "b"',
        }),
      ];

      const resolutions = resolver.resolve(conflicts);

      // 0.85 confidence < 0.9 threshold = needs review
      expect(resolutions[0].confidence).toBe(0.85);
      expect(resolutions[0].requiresHumanReview).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    test('produces same results as original ConflictResolver for semantic conflicts', () => {
      const resolver = new CompositeConflictResolver();

      const conflicts = [
        makeConflict({
          type: 'semantic_conflict',
          description: 'Function renamed from "getData" to "fetchData", variant still references old name in "main"',
        }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].strategy).toBe('rename_reference');
      expect(resolutions[0].confidence).toBe(0.85);
      expect(resolutions[0].explanation).toContain('getData');
      expect(resolutions[0].explanation).toContain('fetchData');
    });

    test('produces same results as original ConflictResolver for dependency conflicts', () => {
      const resolver = new CompositeConflictResolver();

      const conflicts = [
        makeConflict({
          type: 'dependency_conflict',
          severity: 'low',
          description: 'New package import "lodash" — ensure it\'s installed in variant',
        }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions[0].strategy).toBe('install_package');
      expect(resolutions[0].confidence).toBe(0.9);
      expect(resolutions[0].requiresHumanReview).toBe(false);
    });

    test('produces same results as original ConflictResolver for code conflicts', () => {
      const resolver = new CompositeConflictResolver();

      const conflicts = [
        makeConflict({
          type: 'code_conflict',
          severity: 'high',
          description: 'Line to remove not found in variant',
        }),
      ];

      const resolutions = resolver.resolve(conflicts);

      expect(resolutions[0].strategy).toBe('manual');
      expect(resolutions[0].confidence).toBe(0.1);
      expect(resolutions[0].requiresHumanReview).toBe(true);
    });
  });
});
