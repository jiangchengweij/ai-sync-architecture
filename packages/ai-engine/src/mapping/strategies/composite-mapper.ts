import { ASTParser } from '../../ast/parser';
import { PythonParser } from '../../ast/python-parser';
import { CodeEmbedder } from '../../embedding/embedder';
import { MappingContext, FileFunction, CodeMapping, createMappingContext,
  DefaultMappingStrategyRegistry,
} from './types';
import { ExactNameMappingStrategy } from './exact-name-strategy';
import { FingerprintMappingStrategy } from './fingerprint-strategy';
import { VectorSimilarityStrategy } from './vector-similarity-strategy';

/**
 * Options for configuring the CompositeCodeMapper
 */
export interface MapperOptions {
  /** TypeScript parser instance */
  tsParser?: ASTParser;
  /** Python parser instance */
  pyParser?: PythonParser;
  /** Embedder for vector similarity matching */
  embedder?: CodeEmbedder | null;
  /** Custom auto-resolve threshold */
  autoResolveThreshold?: number;
}

/**
 * Result from buildMapping including mappings and unmapped items
 */
export interface BuildMappingResult {
  /** All mappings found */
  mappings: CodeMapping[];
  /** Base function keys that could not be mapped */
  unmappedBase: string[];
  /** Variant function keys that were not mapped */
  unmappedVariant: string[];
}

/**
 * Composite mapper that chains strategies in priority order.
 * This is the modern, extensible approach to code mapping.
 */
export class CompositeCodeMapper {
  private tsParser: ASTParser;
  private pyParser: PythonParser;
  private embedder: CodeEmbedder | null;
  private registry: DefaultMappingStrategyRegistry;

  constructor(options: MapperOptions = {}) {
    this.tsParser = options.tsParser ?? new ASTParser();
    this.pyParser = options.pyParser ?? new PythonParser();
    this.embedder = options.embedder ?? null;

    // Initialize registry with default strategies
    this.registry = new DefaultMappingStrategyRegistry();
    this.registry.register(new ExactNameMappingStrategy());
    this.registry.register(new FingerprintMappingStrategy());
    this.registry.register(new VectorSimilarityStrategy());
  }

  /**
   * Build mapping between base and variant code.
   * @param baseFiles Map of file path -> file content for base
   * @param variantFiles Map of file path -> file content for variant
   * @returns Mapping result with matches and unmapped items
   */
  async buildMapping(
    baseFiles: Map<string, string>,
    variantFiles: Map<string, string>,
  ): Promise<BuildMappingResult> {
    const baseFuncs = this.extractAllFunctions(baseFiles);
    const variantFuncs = this.extractAllFunctions(variantFiles);

    const context = createMappingContext(this.embedder);

    // Run strategies in priority order
    const strategies = this.registry.getOrderedStrategies();

    for (const strategy of strategies) {
      if (strategy.canHandle(context)) {
        await strategy.findMatches(baseFuncs, variantFuncs, context);
      }
    }

    // Collect results
    const mappings = Array.from(
      context.mappedBaseKeys,
      (baseKey) => {
        // Find the mapping - we need to store this in context
        // For now, reconstruct from the functions
        const bf = baseFuncs.find((f) => f.key === baseKey);
        if (!bf) return null;

        // Find which variant it maps to
        const vf = variantFuncs.find(
          (f) => context.mappedVariantKeys.has(f.key) &&
          f.func.name === bf.func.name || f.fingerprint === bf.fingerprint,
        );
        if (!vf) return null;

        // Determine match type
        let matchType: 'exact_name' | 'fingerprint' | 'vector_similarity' = 'exact_name';
        let confidence = 0.98;

        if (bf.filePath === vf.filePath && bf.func.name === vf.func.name) {
          matchType = 'exact_name';
          confidence = 0.98;
        } else if (bf.fingerprint === vf.fingerprint) {
          matchType = 'fingerprint';
          confidence = 0.85;
        } else {
          matchType = 'vector_similarity';
          confidence = 0.75;
        }

        return {
          baseFunctionKey: bf.key,
          variantFunctionKey: vf.key,
          baseFilePath: bf.filePath,
          variantFilePath: vf.filePath,
          baseFunctionName: bf.func.name,
          variantFunctionName: vf.func.name,
          confidence,
          matchType,
        };
      },
    ).filter(Boolean) as CodeMapping[];

    const unmappedBase = baseFuncs
      .filter((bf) => !context.mappedBaseKeys.has(bf.key))
      .map((bf) => bf.key);

    const unmappedVariant = variantFuncs
      .filter((vf) => !context.mappedVariantKeys.has(vf.key))
      .map((vf) => vf.key);

    // Sort by confidence descending
    mappings.sort((a, b) => b.confidence - a.confidence);

    return { mappings, unmappedBase, unmappedVariant };
  }

  private extractAllFunctions(files: Map<string, string>): FileFunction[] {
    const results: FileFunction[] = [];

    for (const [filePath, content] of files) {
      if (this.pyParser.supportsFile(filePath)) {
        const parsed = this.pyParser.parseFile(content);
        for (const func of parsed.functions) {
          const fingerprint = this.pyParser.generateFingerprint(func);
          const key = `${filePath}:${func.className ? func.className + '.' : ''}${func.name}`;
          results.push({ filePath, func, fingerprint, key });
        }
      } else if (this.tsParser.supportsFile(filePath)) {
        const parsed = this.tsParser.parseFile(content, filePath);
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
