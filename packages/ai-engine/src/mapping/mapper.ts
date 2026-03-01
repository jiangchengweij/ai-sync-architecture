import { ASTParser, ParsedFunction } from '../ast/parser';
import { PythonParser } from '../ast/python-parser';
import { CodeEmbedder, EmbeddingSearchResult } from '../embedding/embedder';

export interface CodeMapping {
  baseFunctionKey: string;
  variantFunctionKey: string;
  baseFilePath: string;
  variantFilePath: string;
  baseFunctionName: string;
  variantFunctionName: string;
  confidence: number;
  matchType: 'exact_name' | 'fingerprint' | 'vector_similarity';
}

export interface MappingResult {
  mappings: CodeMapping[];
  unmappedBase: string[];
  unmappedVariant: string[];
}

interface FileFunction {
  filePath: string;
  func: ParsedFunction;
  fingerprint: string;
  key: string;
}

export class CodeMapper {
  private tsParser: ASTParser;
  private pyParser: PythonParser;
  private embedder: CodeEmbedder | null;

  constructor(embedder?: CodeEmbedder) {
    this.tsParser = new ASTParser();
    this.pyParser = new PythonParser();
    this.embedder = embedder || null;
  }

  async buildMapping(
    baseFiles: Map<string, string>,
    variantFiles: Map<string, string>
  ): Promise<MappingResult> {
    const baseFuncs = this.extractAllFunctions(baseFiles);
    const variantFuncs = this.extractAllFunctions(variantFiles);

    const mappings: CodeMapping[] = [];
    const mappedBaseKeys = new Set<string>();
    const mappedVariantKeys = new Set<string>();

    // Pass 1: Exact name match (same file path + function name)
    for (const bf of baseFuncs) {
      const exactMatch = variantFuncs.find(
        (vf) => vf.filePath === bf.filePath && vf.func.name === bf.func.name
          && !mappedVariantKeys.has(vf.key)
      );
      if (exactMatch) {
        mappings.push({
          baseFunctionKey: bf.key,
          variantFunctionKey: exactMatch.key,
          baseFilePath: bf.filePath,
          variantFilePath: exactMatch.filePath,
          baseFunctionName: bf.func.name,
          variantFunctionName: exactMatch.func.name,
          confidence: 0.98,
          matchType: 'exact_name',
        });
        mappedBaseKeys.add(bf.key);
        mappedVariantKeys.add(exactMatch.key);
      }
    }

    // Pass 2: Fingerprint match (same structure, different file/name)
    for (const bf of baseFuncs) {
      if (mappedBaseKeys.has(bf.key)) continue;

      const fpMatch = variantFuncs.find(
        (vf) => !mappedVariantKeys.has(vf.key) && vf.fingerprint === bf.fingerprint
      );
      if (fpMatch) {
        mappings.push({
          baseFunctionKey: bf.key,
          variantFunctionKey: fpMatch.key,
          baseFilePath: bf.filePath,
          variantFilePath: fpMatch.filePath,
          baseFunctionName: bf.func.name,
          variantFunctionName: fpMatch.func.name,
          confidence: 0.85,
          matchType: 'fingerprint',
        });
        mappedBaseKeys.add(bf.key);
        mappedVariantKeys.add(fpMatch.key);
      }
    }

    // Pass 3: Vector similarity match (semantic similarity via embeddings)
    if (this.embedder) {
      const unmappedBase = baseFuncs.filter((bf) => !mappedBaseKeys.has(bf.key));
      const unmappedVariant = variantFuncs.filter((vf) => !mappedVariantKeys.has(vf.key));

      // Index unmapped variant functions
      if (unmappedVariant.length > 0) {
        await this.embedder.indexBatch(
          'variant_mapping',
          unmappedVariant.map((vf) => ({
            filePath: vf.filePath,
            functionName: vf.func.name,
            code: vf.func.code,
            language: 'typescript',
          }))
        );
      }

      // Search for each unmapped base function
      for (const bf of unmappedBase) {
        const results = await this.embedder.searchSimilar(
          bf.func.code,
          'variant_mapping',
          1
        );

        if (results.length > 0 && results[0].score >= 0.7) {
          const match = results[0];
          const variantKey = `${match.embedding.filePath}:${match.embedding.functionName}`;

          if (!mappedVariantKeys.has(variantKey)) {
            mappings.push({
              baseFunctionKey: bf.key,
              variantFunctionKey: variantKey,
              baseFilePath: bf.filePath,
              variantFilePath: match.embedding.filePath,
              baseFunctionName: bf.func.name,
              variantFunctionName: match.embedding.functionName,
              confidence: Math.round(match.score * 100) / 100,
              matchType: 'vector_similarity',
            });
            mappedBaseKeys.add(bf.key);
            mappedVariantKeys.add(variantKey);
          }
        }
      }
    }

    const unmappedBase = baseFuncs
      .filter((bf) => !mappedBaseKeys.has(bf.key))
      .map((bf) => bf.key);
    const unmappedVariant = variantFuncs
      .filter((vf) => !mappedVariantKeys.has(vf.key))
      .map((vf) => vf.key);

    // Sort by confidence descending
    mappings.sort((a, b) => b.confidence - a.confidence);

    return { mappings, unmappedBase, unmappedVariant };
  }

  private extractAllFunctions(files: Map<string, string>): FileFunction[] {
    const results: FileFunction[] = [];

    for (const [filePath, content] of files) {
      let parsed;
      if (this.pyParser.supportsFile(filePath)) {
        parsed = this.pyParser.parseFile(content);
        for (const func of parsed.functions) {
          const fingerprint = this.pyParser.generateFingerprint(func);
          const key = `${filePath}:${func.className ? func.className + '.' : ''}${func.name}`;
          results.push({ filePath, func, fingerprint, key });
        }
      } else if (this.tsParser.supportsFile(filePath)) {
        parsed = this.tsParser.parseFile(content, filePath);
        for (const func of parsed.functions) {
          const fingerprint = this.tsParser.generateFingerprint(func);
          const key = `${filePath}:${func.className ? func.className + '.' : ''}${func.name}`;
          results.push({ filePath, func, fingerprint, key });
        }
      }
    }

    return results;
  }
}
