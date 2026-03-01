import { MappingStrategy, MappingContext, FileFunction, CodeMapping } from './types';

/**
 * Strategy that matches functions using vector similarity (embeddings).
 * This is the fallback strategy for functions that couldn't be matched
 * by exact name or fingerprint - it uses semantic similarity.
 *
 * Priority: 3 (runs last, after deterministic strategies)
 * Confidence: 0.70 - 1.0 (based on similarity score)
 * Minimum threshold: 0.70
 */
export class VectorSimilarityStrategy implements MappingStrategy {
  readonly name = 'vector_similarity';
  readonly priority = 3;

  /** Minimum similarity score to consider a match */
  private readonly minSimilarityThreshold = 0.7;

  /** Collection name for indexing variant functions */
  private readonly collectionName = 'variant_mapping';

  canHandle(context: MappingContext): boolean {
    // Only applicable when embedder is available
    return context.embedder !== null;
  }

  async findMatches(
    baseFuncs: FileFunction[],
    variantFuncs: FileFunction[],
    context: MappingContext,
  ): Promise<CodeMapping[]> {
    if (!context.embedder) {
      return [];
    }

    const matches: CodeMapping[] = [];

    // Filter to unmapped functions
    const unmappedBase = baseFuncs.filter((bf) => !context.mappedBaseKeys.has(bf.key));
    const unmappedVariant = variantFuncs.filter((vf) => !context.mappedVariantKeys.has(vf.key));

    if (unmappedBase.length === 0 || unmappedVariant.length === 0) {
      return [];
    }

    // Index unmapped variant functions
    await context.embedder.indexBatch(
      this.collectionName,
      unmappedVariant.map((vf) => ({
        filePath: vf.filePath,
        functionName: vf.func.name,
        code: vf.func.code,
        language: 'typescript',
      })),
    );

    // Search for each unmapped base function
    for (const bf of unmappedBase) {
      const results = await context.embedder.searchSimilar(
        bf.func.code,
        this.collectionName,
        1,
      );

      if (results.length > 0 && results[0].score >= this.minSimilarityThreshold) {
        const match = results[0];
        const variantKey = `${match.embedding.filePath}:${match.embedding.functionName}`;

        // Double-check variant is not already mapped (could have been mapped by another base function)
        if (!context.mappedVariantKeys.has(variantKey)) {
          matches.push({
            baseFunctionKey: bf.key,
            variantFunctionKey: variantKey,
            baseFilePath: bf.filePath,
            variantFilePath: match.embedding.filePath,
            baseFunctionName: bf.func.name,
            variantFunctionName: match.embedding.functionName,
            confidence: Math.round(match.score * 100) / 100,
            matchType: 'vector_similarity',
          });

          // Update context
          context.mappedBaseKeys.add(bf.key);
          context.mappedVariantKeys.add(variantKey);
        }
      }
    }

    return matches;
  }
}
