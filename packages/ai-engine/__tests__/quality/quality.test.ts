import { QualityAnalyzer, ProjectFiles } from '../../src/quality/analyzer';
import { ParsedFile, ParsedFunction } from '../../src/ast/parser';

function makeFunc(overrides: Partial<ParsedFunction> = {}): ParsedFunction {
  return {
    name: 'doSomething',
    kind: 'function',
    params: ['a: string'],
    returnType: 'void',
    startLine: 1,
    endLine: 5,
    isAsync: false,
    isExported: true,
    code: 'function doSomething(a: string) {}',
    ...overrides,
  };
}

function makeParsedFile(functions: ParsedFunction[]): ParsedFile {
  return { functions, imports: [], exports: [], language: 'typescript' };
}

function makeProject(id: string, files: Record<string, ParsedFunction[]>): ProjectFiles {
  const fileMap = new Map<string, ParsedFile>();
  for (const [path, funcs] of Object.entries(files)) {
    fileMap.set(path, { functions: funcs, imports: [], exports: [], language: 'typescript' });
  }
  return { projectId: id, files: fileMap };
}

describe('QualityAnalyzer', () => {
  let analyzer: QualityAnalyzer;

  beforeEach(() => {
    analyzer = new QualityAnalyzer();
  });

  describe('computeConsistency', () => {
    test('identical projects score 1.0', () => {
      const funcs = [makeFunc({ name: 'a' }), makeFunc({ name: 'b' })];
      const base = makeProject('base', { 'src/utils.ts': funcs });
      const variant = makeProject('variant', { 'src/utils.ts': funcs });

      const score = analyzer.computeConsistency(base, variant);
      expect(score.overallScore).toBe(1);
      expect(score.fileMatchRate).toBe(1);
      expect(score.functionMatchRate).toBe(1);
      expect(score.structuralSimilarity).toBe(1);
    });

    test('missing files reduce score', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc({ name: 'x' })],
        'b.ts': [makeFunc({ name: 'y' })],
      });
      const variant = makeProject('variant', {
        'a.ts': [makeFunc({ name: 'x' })],
      });

      const score = analyzer.computeConsistency(base, variant);
      expect(score.fileMatchRate).toBe(0.5);
      expect(score.unmatchedBaseFiles).toEqual(['b.ts']);
      expect(score.overallScore).toBeLessThan(1);
    });

    test('missing functions reduce score', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc({ name: 'x' }), makeFunc({ name: 'y' })],
      });
      const variant = makeProject('variant', {
        'a.ts': [makeFunc({ name: 'x' })],
      });

      const score = analyzer.computeConsistency(base, variant);
      expect(score.functionMatchRate).toBe(0.5);
    });

    test('signature mismatch reduces structural similarity', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc({ name: 'x', params: ['a: string'] })],
      });
      const variant = makeProject('variant', {
        'a.ts': [makeFunc({ name: 'x', params: ['a: string', 'b: number'] })],
      });

      const score = analyzer.computeConsistency(base, variant);
      expect(score.functionMatchRate).toBe(1);
      expect(score.structuralSimilarity).toBe(0);
    });
  });

  describe('computeQualityDiffs', () => {
    test('detects diverged functions', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc({ name: 'fn', params: ['a: string'], returnType: 'void' })],
      });
      const variant = makeProject('variant', {
        'a.ts': [makeFunc({ name: 'fn', params: ['a: string', 'b: number'], returnType: 'string' })],
      });

      const diffs = analyzer.computeQualityDiffs(base, variant);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].divergedFunctions).toHaveLength(1);
      expect(diffs[0].divergedFunctions[0].driftType).toBe('signature');
    });

    test('detects unnecessary async mismatch', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc({ name: 'fn', isAsync: false })],
      });
      const variant = makeProject('variant', {
        'a.ts': [makeFunc({ name: 'fn', isAsync: true })],
      });

      const diffs = analyzer.computeQualityDiffs(base, variant);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].unnecessaryDifferences).toHaveLength(1);
      expect(diffs[0].unnecessaryDifferences[0].description).toContain('async');
    });

    test('returns empty for identical files', () => {
      const funcs = [makeFunc({ name: 'a' })];
      const base = makeProject('base', { 'a.ts': funcs });
      const variant = makeProject('variant', { 'a.ts': funcs });

      const diffs = analyzer.computeQualityDiffs(base, variant);
      expect(diffs).toHaveLength(0);
    });
  });
  describe('identifyTechDebt', () => {
    test('flags missing files as tech debt', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc(), makeFunc({ name: 'b' })],
      });
      const variant = makeProject('variant', {});

      const diffs = analyzer.computeQualityDiffs(base, variant);
      const debt = analyzer.identifyTechDebt(base, variant, diffs);
      expect(debt).toHaveLength(1);
      expect(debt[0].type).toBe('missing');
      expect(debt[0].filePath).toBe('a.ts');
    });

    test('flags diverged functions as tech debt', () => {
      const base = makeProject('base', {
        'a.ts': [makeFunc({ name: 'fn', params: ['a: string'] })],
      });
      const variant = makeProject('variant', {
        'a.ts': [makeFunc({ name: 'fn', params: ['a: string', 'b: number'] })],
      });

      const diffs = analyzer.computeQualityDiffs(base, variant);
      const debt = analyzer.identifyTechDebt(base, variant, diffs);
      const diverged = debt.filter((d) => d.type === 'diverged');
      expect(diverged).toHaveLength(1);
      expect(diverged[0].severity).toBe('high');
    });

    test('flags extra complexity when variant has many extra functions', () => {
      const baseFuncs = [makeFunc({ name: 'a' })];
      const variantFuncs = [
        makeFunc({ name: 'a' }),
        makeFunc({ name: 'b' }), makeFunc({ name: 'c' }),
        makeFunc({ name: 'd' }), makeFunc({ name: 'e' }),
      ];
      const base = makeProject('base', { 'a.ts': baseFuncs });
      const variant = makeProject('variant', { 'a.ts': variantFuncs });

      const diffs = analyzer.computeQualityDiffs(base, variant);
      const debt = analyzer.identifyTechDebt(base, variant, diffs);
      const extra = debt.filter((d) => d.type === 'extra_complexity');
      expect(extra).toHaveLength(1);
    });
  });

  describe('generateRecommendations', () => {
    test('recommends major sync for low consistency', () => {
      const consistency = {
        variantId: 'v', overallScore: 0.3, fileMatchRate: 0.3,
        functionMatchRate: 0.3, structuralSimilarity: 0.3,
        unmatchedBaseFiles: [], unmatchedVariantFiles: [],
      };
      const recs = analyzer.generateRecommendations(consistency, []);
      expect(recs.some((r) => r.includes('major sync'))).toBe(true);
    });

    test('recommends regular sync for moderate drift', () => {
      const consistency = {
        variantId: 'v', overallScore: 0.65, fileMatchRate: 0.7,
        functionMatchRate: 0.7, structuralSimilarity: 0.7,
        unmatchedBaseFiles: [], unmatchedVariantFiles: [],
      };
      const recs = analyzer.generateRecommendations(consistency, []);
      expect(recs.some((r) => r.includes('regular sync'))).toBe(true);
    });

    test('flags high severity tech debt', () => {
      const consistency = {
        variantId: 'v', overallScore: 0.9, fileMatchRate: 0.9,
        functionMatchRate: 0.9, structuralSimilarity: 0.9,
        unmatchedBaseFiles: [], unmatchedVariantFiles: [],
      };
      const debt = [{
        variantId: 'v', filePath: 'a.ts', functionName: 'fn',
        type: 'diverged' as const, severity: 'high' as const,
        description: 'test', suggestion: 'fix',
      }];
      const recs = analyzer.generateRecommendations(consistency, debt);
      expect(recs.some((r) => r.includes('high-severity'))).toBe(true);
    });

    test('positive message for well-aligned variant', () => {
      const consistency = {
        variantId: 'v', overallScore: 0.95, fileMatchRate: 1,
        functionMatchRate: 0.95, structuralSimilarity: 0.95,
        unmatchedBaseFiles: [], unmatchedVariantFiles: [],
      };
      const recs = analyzer.generateRecommendations(consistency, []);
      expect(recs.some((r) => r.includes('well-aligned'))).toBe(true);
    });

    test('recommends addressing sync gaps when many base files are missing', () => {
      const manyMissing = Array.from({ length: 6 }, (_, i) => `file${i}.ts`);
      const consistency = {
        variantId: 'v', overallScore: 0.9, fileMatchRate: 0.9,
        functionMatchRate: 0.9, structuralSimilarity: 0.9,
        unmatchedBaseFiles: manyMissing, unmatchedVariantFiles: [],
      };
      const recs = analyzer.generateRecommendations(consistency, []);
      expect(recs.some((r) => r.includes('base files missing'))).toBe(true);
      expect(recs.some((r) => r.includes('6'))).toBe(true);
    });

    test('recommends signature alignment when many functions diverged', () => {
      const consistency = {
        variantId: 'v', overallScore: 0.9, fileMatchRate: 0.9,
        functionMatchRate: 0.9, structuralSimilarity: 0.5,
        unmatchedBaseFiles: [], unmatchedVariantFiles: [],
      };
      const manyDiverged = Array.from({ length: 11 }, (_, i) => ({
        variantId: 'v', filePath: 'a.ts', functionName: `fn${i}`,
        type: 'diverged' as const, severity: 'medium' as const,
        description: 'test', suggestion: 'fix',
      }));
      const recs = analyzer.generateRecommendations(consistency, manyDiverged);
      expect(recs.some((r) => r.includes('signature alignment'))).toBe(true);
    });

    test('recommends signature review for low structural similarity', () => {
      const consistency = {
        variantId: 'v', overallScore: 0.9, fileMatchRate: 0.9,
        functionMatchRate: 0.9, structuralSimilarity: 0.6,
        unmatchedBaseFiles: [], unmatchedVariantFiles: [],
      };
      const recs = analyzer.generateRecommendations(consistency, []);
      expect(recs.some((r) => r.includes('structural similarity'))).toBe(true);
    });
  });

  describe('full analyze', () => {
    test('generates complete quality report', () => {
      const base = makeProject('base', {
        'src/utils.ts': [makeFunc({ name: 'a' }), makeFunc({ name: 'b' })],
        'src/core.ts': [makeFunc({ name: 'c' })],
      });
      const variant = makeProject('variant', {
        'src/utils.ts': [makeFunc({ name: 'a' }), makeFunc({ name: 'b', params: ['x: number'] })],
      });

      const report = analyzer.analyze(base, variant);
      expect(report.baseProjectId).toBe('base');
      expect(report.variantId).toBe('variant');
      expect(report.consistency.overallScore).toBeLessThan(1);
      expect(report.techDebt.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });
  });
});
