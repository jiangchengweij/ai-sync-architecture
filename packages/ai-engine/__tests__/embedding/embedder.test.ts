import {
  CodeEmbedder,
  InMemoryVectorStore,
  EmbeddingProvider,
} from '../../src/embedding/embedder';

class MockEmbeddingProvider implements EmbeddingProvider {
  private callCount = 0;

  dimensions(): number {
    return 4;
  }

  async embed(text: string): Promise<number[]> {
    this.callCount++;
    // Deterministic mock: hash text into a simple vector
    const hash = Array.from(text).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const base = hash % 100;
    return [base / 100, (base + 10) / 100, (base + 20) / 100, (base + 30) / 100];
  }

  getCallCount(): number {
    return this.callCount;
  }
}

describe('CodeEmbedder', () => {
  let embedder: CodeEmbedder;
  let provider: MockEmbeddingProvider;
  let store: InMemoryVectorStore;

  beforeEach(async () => {
    provider = new MockEmbeddingProvider();
    store = new InMemoryVectorStore();
    embedder = new CodeEmbedder(provider, store);
    await embedder.initialize();
  });

  describe('indexFunction', () => {
    it('should index a function and return embedding', async () => {
      const result = await embedder.indexFunction(
        'proj-1', 'src/utils.ts', 'add', 'function add(a, b) { return a + b; }', 'typescript'
      );

      expect(result.id).toBeTruthy();
      expect(result.projectId).toBe('proj-1');
      expect(result.filePath).toBe('src/utils.ts');
      expect(result.functionName).toBe('add');
      expect(result.vector).toHaveLength(4);
    });

    it('should generate consistent IDs for same input', async () => {
      const r1 = await embedder.indexFunction('p1', 'a.ts', 'fn', 'code', 'ts');
      const r2 = await embedder.indexFunction('p1', 'a.ts', 'fn', 'code2', 'ts');
      expect(r1.id).toBe(r2.id); // same project+file+function → same ID (upsert)
    });
  });

  describe('indexBatch', () => {
    it('should index multiple functions', async () => {
      const results = await embedder.indexBatch('proj-1', [
        { filePath: 'a.ts', functionName: 'fn1', code: 'code1', language: 'ts' },
        { filePath: 'b.ts', functionName: 'fn2', code: 'code2', language: 'ts' },
      ]);

      expect(results).toHaveLength(2);
      expect(provider.getCallCount()).toBe(2);
    });
  });

  describe('searchSimilar', () => {
    it('should find similar functions by vector similarity', async () => {
      await embedder.indexBatch('proj-1', [
        { filePath: 'a.ts', functionName: 'add', code: 'function add(a, b) { return a + b; }', language: 'ts' },
        { filePath: 'b.ts', functionName: 'subtract', code: 'function subtract(a, b) { return a - b; }', language: 'ts' },
        { filePath: 'c.ts', functionName: 'unrelated', code: 'class Foo { bar() {} }', language: 'ts' },
      ]);

      const results = await embedder.searchSimilar(
        'function add(x, y) { return x + y; }',
        'proj-1',
        2
      );

      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].embedding.projectId).toBe('proj-1');
    });

    it('should filter by projectId', async () => {
      await embedder.indexFunction('proj-1', 'a.ts', 'fn', 'code1', 'ts');
      await embedder.indexFunction('proj-2', 'a.ts', 'fn', 'code1', 'ts');

      const results = await embedder.searchSimilar('code1', 'proj-1', 10);
      expect(results.every((r) => r.embedding.projectId === 'proj-1')).toBe(true);
    });
  });

  describe('removeProject', () => {
    it('should remove embeddings by IDs', async () => {
      const emb = await embedder.indexFunction('proj-1', 'a.ts', 'fn', 'code', 'ts');
      const before = await embedder.searchSimilar('code', 'proj-1', 10);
      expect(before).toHaveLength(1);

      await embedder.removeProject('proj-1', [emb.id]);
      const after = await embedder.searchSimilar('code', 'proj-1', 10);
      expect(after).toHaveLength(0);
    });
  });
});

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(async () => {
    store = new InMemoryVectorStore();
    await store.ensureCollection('test', 4);
  });

  it('should upsert and search', async () => {
    await store.upsert('test', [{
      id: '1', projectId: 'p1', filePath: 'a.ts',
      functionName: 'fn', vector: [1, 0, 0, 0], code: 'code', language: 'ts',
    }]);

    const results = await store.search('test', [1, 0, 0, 0], { projectId: 'p1' }, 5);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeCloseTo(1.0);
  });

  it('should handle cosine similarity correctly', async () => {
    await store.upsert('test', [
      { id: '1', projectId: 'p1', filePath: 'a.ts', functionName: 'a', vector: [1, 0, 0, 0], code: '', language: 'ts' },
      { id: '2', projectId: 'p1', filePath: 'b.ts', functionName: 'b', vector: [0, 1, 0, 0], code: '', language: 'ts' },
    ]);

    const results = await store.search('test', [1, 0, 0, 0], { projectId: 'p1' }, 5);
    expect(results[0].embedding.id).toBe('1');
    expect(results[0].score).toBeCloseTo(1.0);
    expect(results[1].score).toBeCloseTo(0.0);
  });
});
