import { ParsedFunction } from '../../ast/parser';
import { CodeEmbedder } from '../../embedding/embedder';

/**
 * Represents a function extracted from a file, ready for mapping.
 */
export interface FileFunction {
  filePath: string;
  func: ParsedFunction;
  fingerprint: string;
  key: string;
}

/**
 * Code mapping types (match types from parent mapper module)
 */
export type MatchType = 'exact_name' | 'fingerprint' | 'vector_similarity';

/**
 * Represents a mapping between base and variant functions.
 */
export interface CodeMapping {
  baseFunctionKey: string;
  variantFunctionKey: string;
  baseFilePath: string;
  variantFilePath: string;
  baseFunctionName: string;
  variantFunctionName: string;
  confidence: number;
  matchType: MatchType;
}

/**
 * Context passed to mapping strategies during execution.
 * Tracks state across strategy invocations.
 */
export interface MappingContext {
  /** Base function keys that have been mapped */
  mappedBaseKeys: Set<string>;
  /** Variant function keys that have been mapped */
  mappedVariantKeys: Set<string>;
  /** Embedder for vector similarity (optional) */
  embedder: CodeEmbedder | null;
}

/**
 * Strategy interface for finding code mappings.
 * Each strategy implements a specific matching algorithm.
 */
export interface MappingStrategy {
  /**
   * Unique name for this strategy (used in logging/debugging).
   */
  readonly name: string;

  /**
   * Priority determines execution order. Lower = earlier.
   * Strategies are executed in priority order.
   */
  readonly priority: number;

  /**
   * Determines if this strategy should be considered for mapping.
   * @param context Current mapping context
   * @returns true if strategy can run (e.g., has unmapped functions)
   */
  canHandle(context: MappingContext): boolean;

  /**
   * Find matches between base and variant functions.
   * @param baseFuncs All base functions
   * @param variantFuncs All variant functions
   * @param context Current mapping context (tracks mapped keys)
   * @returns Array of new mappings found by this strategy
   */
  findMatches(
    baseFuncs: FileFunction[],
    variantFuncs: FileFunction[],
    context: MappingContext,
  ): Promise<CodeMapping[]>;
}

/**
 * Registry for managing mapping strategies.
 */
export interface StrategyRegistry {
  /**
   * Register a strategy for use in mapping.
   */
  register(strategy: MappingStrategy): void;

  /**
   * Get all registered strategies (unsorted).
   */
  getStrategies(): MappingStrategy[];

  /**
   * Get strategies sorted by priority (ascending).
   */
  getOrderedStrategies(): MappingStrategy[];
}

/**
 * Default implementation of the strategy registry.
 */
export class DefaultMappingStrategyRegistry implements StrategyRegistry {
  private strategies: MappingStrategy[] = [];

  register(strategy: MappingStrategy): void {
    this.strategies.push(strategy);
  }

  getStrategies(): MappingStrategy[] {
    return [...this.strategies];
  }

  getOrderedStrategies(): MappingStrategy[] {
    return [...this.strategies].sort((a, b) => a.priority - b.priority);
  }
}

/**
 * Creates a new mapping context with empty state.
 */
export function createMappingContext(embedder: CodeEmbedder | null = null): MappingContext {
  return {
    mappedBaseKeys: new Set(),
    mappedVariantKeys: new Set(),
    embedder,
  };
}
