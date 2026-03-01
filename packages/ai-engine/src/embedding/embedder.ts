import * as crypto from 'crypto';

export interface CodeEmbedding {
  id: string;
  projectId: string;
  filePath: string;
  functionName: string;
  vector: number[];
  code: string;
  language: string;
}

export interface EmbeddingSearchResult {
  embedding: CodeEmbedding;
  score: number;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  dimensions(): number;
}

export interface VectorStore {
  upsert(collectionName: string, embeddings: CodeEmbedding[]): Promise<void>;
  search(
    collectionName: string,
    vector: number[],
    filter: Record<string, string>,
    limit: number
  ): Promise<EmbeddingSearchResult[]>;
  delete(collectionName: string, ids: string[]): Promise<void>;
  ensureCollection(collectionName: string, dimensions: number): Promise<void>;
}

export class CodeEmbedder {
  private provider: EmbeddingProvider;
  private store: VectorStore;
  private collectionName: string;

  constructor(provider: EmbeddingProvider, store: VectorStore, collectionName = 'code_embeddings') {
    this.provider = provider;
    this.store = store;
    this.collectionName = collectionName;
  }

  async initialize(): Promise<void> {
    await this.store.ensureCollection(this.collectionName, this.provider.dimensions());
  }

  async indexFunction(
    projectId: string,
    filePath: string,
    functionName: string,
    code: string,
    language: string
  ): Promise<CodeEmbedding> {
    const vector = await this.provider.embed(code);
    const id = this.generateId(projectId, filePath, functionName);

    const embedding: CodeEmbedding = {
      id,
      projectId,
      filePath,
      functionName,
      vector,
      code,
      language,
    };

    await this.store.upsert(this.collectionName, [embedding]);
    return embedding;
  }

  async indexBatch(
    projectId: string,
    functions: Array<{ filePath: string; functionName: string; code: string; language: string }>
  ): Promise<CodeEmbedding[]> {
    const embeddings: CodeEmbedding[] = [];

    for (const func of functions) {
      const vector = await this.provider.embed(func.code);
      const id = this.generateId(projectId, func.filePath, func.functionName);
      embeddings.push({
        id,
        projectId,
        filePath: func.filePath,
        functionName: func.functionName,
        vector,
        code: func.code,
        language: func.language,
      });
    }

    await this.store.upsert(this.collectionName, embeddings);
    return embeddings;
  }

  async searchSimilar(
    code: string,
    projectId: string,
    limit = 5
  ): Promise<EmbeddingSearchResult[]> {
    const vector = await this.provider.embed(code);
    return this.store.search(
      this.collectionName,
      vector,
      { projectId },
      limit
    );
  }

  async removeProject(projectId: string, ids: string[]): Promise<void> {
    await this.store.delete(this.collectionName, ids);
  }

  private generateId(projectId: string, filePath: string, functionName: string): string {
    const input = `${projectId}:${filePath}:${functionName}`;
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
  }
}

/**
 * In-memory vector store for testing and MVP.
 */
export class InMemoryVectorStore implements VectorStore {
  private collections = new Map<string, CodeEmbedding[]>();

  async ensureCollection(collectionName: string, _dimensions: number): Promise<void> {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, []);
    }
  }

  async upsert(collectionName: string, embeddings: CodeEmbedding[]): Promise<void> {
    const collection = this.collections.get(collectionName) || [];
    for (const emb of embeddings) {
      const idx = collection.findIndex((e) => e.id === emb.id);
      if (idx >= 0) {
        collection[idx] = emb;
      } else {
        collection.push(emb);
      }
    }
    this.collections.set(collectionName, collection);
  }

  async search(
    collectionName: string,
    vector: number[],
    filter: Record<string, string>,
    limit: number
  ): Promise<EmbeddingSearchResult[]> {
    const collection = this.collections.get(collectionName) || [];

    const filtered = collection.filter((emb) =>
      Object.entries(filter).every(([key, value]) => (emb as any)[key] === value)
    );

    const scored = filtered.map((emb) => ({
      embedding: emb,
      score: this.cosineSimilarity(vector, emb.vector),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    const collection = this.collections.get(collectionName) || [];
    const idSet = new Set(ids);
    this.collections.set(
      collectionName,
      collection.filter((e) => !idSet.has(e.id))
    );
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
