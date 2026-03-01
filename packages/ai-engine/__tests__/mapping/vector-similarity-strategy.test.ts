import { VectorSimilarityStrategy } from '../../src/mapping/strategies/vector-similarity-strategy';
import { FileFunction, createMappingContext } from '../../src/mapping/strategies/types';
import { CodeEmbedder, EmbeddingSearchResult } from '../../src/embedding/embedder';

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

function makeMockEmbedder(): jest.Mocked<CodeEmbedder> {
  return {
    indexBatch: jest.fn().mockResolvedValue(undefined),
    searchSimilar: jest.fn().mockResolvedValue([]),
    clearCollection: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    generateEmbedding: jest.fn().mockResolvedValue([]),
    getCollection: jest.fn(),
    deleteCollection: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CodeEmbedder>;
}

describe('VectorSimilarityStrategy', () => {
  let strategy: VectorSimilarityStrategy;

  beforeEach(() => {
    strategy = new VectorSimilarityStrategy();
  });

  describe('metadata', () => {
    test('has correct name', () => {
      expect(strategy.name).toBe('vector_similarity');
    });

    test('has lowest priority (runs last)', () => {
      expect(strategy.priority).toBe(3);
    });
  });

  describe('canHandle', () => {
    test('returns false when no embedder available', () => {
      const ctx = createMappingContext(null);
      expect(strategy.canHandle(ctx)).toBe(false);
    });

    test('returns true when embedder is available', () => {
      const embedder = makeMockEmbedder();
      const ctx = createMappingContext(embedder);
      expect(strategy.canHandle(ctx)).toBe(true);
    });
  });

  describe('findMatches', () => {
    test('returns empty array when no embedder', async () => {
      const base = [makeFileFunction()];
      const variant = [makeFileFunction()];
      const ctx = createMappingContext(null);

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('indexes variant functions and searches for base functions', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn', code: 'function fn() {}' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn', code: 'function fn() {}' },
        }),
      ];
      const ctx = createMappingContext(embedder);

      embedder.searchSimilar.mockResolvedValueOnce([
        {
          embedding: {
            filePath: 'src/b.ts',
            functionName: 'fn',
            code: 'function fn() {}',
            language: 'typescript',
          },
          score: 0.85,
        },
      ] as EmbeddingSearchResult[]);

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(embedder.indexBatch).toHaveBeenCalledWith(
        'variant_mapping',
        expect.arrayContaining([
          expect.objectContaining({
            filePath: 'src/b.ts',
            functionName: 'fn',
          }),
        ]),
      );

      expect(embedder.searchSimilar).toHaveBeenCalled();

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('vector_similarity');
      expect(matches[0].confidence).toBe(0.85);
    });

    test('requires minimum similarity threshold (0.7)', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const ctx = createMappingContext(embedder);

      embedder.searchSimilar.mockResolvedValueOnce([
        {
          embedding: {
            filePath: 'src/b.ts',
            functionName: 'fn',
            code: 'function fn() {}',
            language: 'typescript',
          },
          score: 0.65, // Below 0.7 threshold
        },
      ] as EmbeddingSearchResult[]);

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('skips already mapped variant keys', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const ctx = createMappingContext(embedder);
      ctx.mappedVariantKeys.add('src/b.ts:fn'); // Already mapped

      embedder.searchSimilar.mockResolvedValueOnce([
        {
          embedding: {
            filePath: 'src/b.ts',
            functionName: 'fn',
            code: 'function fn() {}',
            language: 'typescript',
          },
          score: 0.85,
        },
      ] as EmbeddingSearchResult[]);

      const matches = await strategy.findMatches(base, variant, ctx);

      // Match rejected because variant is already mapped
      expect(matches).toHaveLength(0);
    });

    test('skips already mapped base keys (does not search)', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const ctx = createMappingContext(embedder);
      ctx.mappedBaseKeys.add('src/a.ts:fn'); // Already mapped

      const matches = await strategy.findMatches(base, variant, ctx);

      // Should not search for already mapped base
      expect(embedder.searchSimilar).not.toHaveBeenCalled();
      expect(matches).toHaveLength(0);
    });

    test('updates context with mapped keys', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const ctx = createMappingContext(embedder);

      embedder.searchSimilar.mockResolvedValueOnce([
        {
          embedding: {
            filePath: 'src/b.ts',
            functionName: 'fn',
            code: 'function fn() {}',
            language: 'typescript',
          },
          score: 0.85,
        },
      ] as EmbeddingSearchResult[]);

      await strategy.findMatches(base, variant, ctx);

      expect(ctx.mappedBaseKeys.has('src/a.ts:fn')).toBe(true);
      expect(ctx.mappedVariantKeys.has('src/b.ts:fn')).toBe(true);
    });

    test('handles no search results', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const ctx = createMappingContext(embedder);

      embedder.searchSimilar.mockResolvedValueOnce([]);

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches).toHaveLength(0);
    });

    test('rounds confidence to 2 decimal places', async () => {
      const embedder = makeMockEmbedder();
      const base = [
        makeFileFunction({
          key: 'src/a.ts:fn',
          filePath: 'src/a.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const variant = [
        makeFileFunction({
          key: 'src/b.ts:fn',
          filePath: 'src/b.ts',
          func: { ...makeFileFunction().func, name: 'fn' },
        }),
      ];
      const ctx = createMappingContext(embedder);

      embedder.searchSimilar.mockResolvedValueOnce([
        {
          embedding: {
            filePath: 'src/b.ts',
            functionName: 'fn',
            code: 'function fn() {}',
            language: 'typescript',
          },
          score: 0.85789, // Should be rounded to 0.86
        },
      ] as EmbeddingSearchResult[]);

      const matches = await strategy.findMatches(base, variant, ctx);

      expect(matches[0].confidence).toBe(0.86);
    });
  });
});
