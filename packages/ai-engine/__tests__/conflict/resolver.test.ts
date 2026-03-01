import { ConflictResolver } from '../../src/conflict/resolver';
import { ConflictRisk } from '../../src/conflict/detector';

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

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  test('resolves rename conflicts with high confidence', () => {
    const conflict = makeConflict({
      description: 'Function renamed from "getData" to "fetchData", variant still references old name in "main"',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].strategy).toBe('rename_reference');
    expect(resolutions[0].confidence).toBe(0.85);
    expect(resolutions[0].explanation).toContain('getData');
    expect(resolutions[0].explanation).toContain('fetchData');
  });

  test('resolves rename with known mapping at higher confidence', () => {
    const resolver = new ConflictResolver({
      nameMappings: new Map([['getData', 'getVariantData']]),
    });

    const conflict = makeConflict({
      description: 'Function renamed from "getData" to "fetchData"',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].confidence).toBe(0.95);
    expect(resolutions[0].requiresHumanReview).toBe(false);
  });

  test('resolves single param addition', () => {
    const conflict = makeConflict({
      description: 'Function "process" signature changed (2 → 3 params), but variant calls it',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].strategy).toBe('update_params');
    expect(resolutions[0].confidence).toBe(0.6);
    expect(resolutions[0].requiresHumanReview).toBe(true);
  });

  test('resolves param removal', () => {
    const conflict = makeConflict({
      description: 'Function "process" signature changed (3 → 2 params)',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].strategy).toBe('update_params');
    expect(resolutions[0].confidence).toBe(0.4);
  });

  test('flags major param changes as manual', () => {
    const conflict = makeConflict({
      description: 'Function "process" signature changed (1 → 4 params)',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].strategy).toBe('manual');
    expect(resolutions[0].confidence).toBe(0.2);
    expect(resolutions[0].requiresHumanReview).toBe(true);
  });

  test('resolves package dependency with install strategy', () => {
    const conflict = makeConflict({
      type: 'dependency_conflict',
      severity: 'low',
      description: 'New package import "lodash" — ensure it\'s installed in variant',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].strategy).toBe('install_package');
    expect(resolutions[0].confidence).toBe(0.9);
    expect(resolutions[0].requiresHumanReview).toBe(false);
  });

  test('resolves relative import with known mapping', () => {
    const resolver = new ConflictResolver({
      importPathMappings: new Map([['./utils/helpers', './lib/helpers']]),
    });

    const conflict = makeConflict({
      type: 'dependency_conflict',
      description: 'New import "./utils/helpers" may not exist in variant project',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].strategy).toBe('adapt_import_path');
    expect(resolutions[0].confidence).toBe(0.95);
  });

  test('resolves code conflict as manual for high severity', () => {
    const conflict = makeConflict({
      type: 'code_conflict',
      severity: 'high',
      description: 'Line to remove not found in variant',
    });

    const resolutions = resolver.resolve([conflict]);
    expect(resolutions[0].strategy).toBe('manual');
    expect(resolutions[0].requiresHumanReview).toBe(true);
  });

  test('resolveAll provides summary stats', () => {
    const conflicts = [
      makeConflict({ type: 'dependency_conflict', severity: 'low', description: 'New package import "axios"' }),
      makeConflict({ type: 'code_conflict', severity: 'high', description: 'Line not found' }),
      makeConflict({ description: 'Function renamed from "a" to "b"' }),
    ];

    const result = resolver.resolveAll(conflicts);
    expect(result.resolutions).toHaveLength(3);
    expect(result.autoResolved.length + result.needsHumanReview.length).toBe(3);
    expect(result.autoResolveRate).toBeGreaterThan(0);
    expect(result.autoResolveRate).toBeLessThanOrEqual(1);
  });

  test('empty conflicts returns 100% auto-resolve rate', () => {
    const result = resolver.resolveAll([]);
    expect(result.autoResolveRate).toBe(1);
  });

  describe('dependency conflict - relative path adaptation', () => {
    test('adapts ./path to ../path', () => {
      const conflict = makeConflict({
        type: 'dependency_conflict',
        description: 'New import "./services/helper" may not exist in variant project',
      });

      const resolutions = resolver.resolve([conflict]);
      expect(resolutions[0].strategy).toBe('adapt_import_path');
      expect(resolutions[0].confidence).toBe(0.7);
      expect(resolutions[0].patch).toContain('../services/helper');
    });

    test('adapts ../path to ./path', () => {
      const conflict = makeConflict({
        type: 'dependency_conflict',
        description: 'New import "../utils/core" may not exist in variant project',
      });

      const resolutions = resolver.resolve([conflict]);
      expect(resolutions[0].strategy).toBe('adapt_import_path');
      expect(resolutions[0].patch).toContain('./utils/core');
    });

    test('adapts services/ to service/ in relative path', () => {
      const conflict = makeConflict({
        type: 'dependency_conflict',
        description: 'New import "./services/auth" may not exist in variant project',
      });
      // Note: the ./services/auth first matches ./→../ rule before services/ rule
      const resolutions = resolver.resolve([conflict]);
      expect(resolutions[0].strategy).toBe('adapt_import_path');
    });

    test('falls back to manual for unrecognized relative import', () => {
      const conflict = makeConflict({
        type: 'dependency_conflict',
        description: 'New import "/absolute/path/module" may not exist in variant project',
      });

      const resolutions = resolver.resolve([conflict]);
      expect(resolutions[0].strategy).toBe('manual');
      expect(resolutions[0].requiresHumanReview).toBe(true);
    });
  });

  describe('semantic conflict - fallback', () => {
    test('falls back to manual for unrecognized semantic conflict', () => {
      const conflict = makeConflict({
        type: 'semantic_conflict',
        description: 'Some unknown semantic issue occurred',
      });

      const resolutions = resolver.resolve([conflict]);
      expect(resolutions[0].strategy).toBe('manual');
      expect(resolutions[0].confidence).toBe(0);
      expect(resolutions[0].requiresHumanReview).toBe(true);
    });
  });

  describe('code conflict - low severity', () => {
    test('recommends skip_line for non-high severity code conflict', () => {
      const conflict = makeConflict({
        type: 'code_conflict',
        severity: 'medium',
        description: 'Minor code mismatch',
      });

      const resolutions = resolver.resolve([conflict]);
      expect(resolutions[0].strategy).toBe('skip_line');
      expect(resolutions[0].confidence).toBe(0.5);
    });
  });
});
