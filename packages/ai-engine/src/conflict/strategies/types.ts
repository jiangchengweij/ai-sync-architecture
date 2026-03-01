import { ConflictRisk } from '../types';
import { Resolution, ResolutionStrategy as StrategyName } from '../resolver-types';

/**
 * Context passed to strategies for resolution decisions
 */
export interface ResolutionContext {
  /** Index of the conflict in the original array */
  conflictIndex: number;
  /** Import path mappings: base path -> variant path */
  importMappings: Map<string, string>;
  /** Function name mappings: base name -> variant name */
  nameMappings: Map<string, string>;
  /** Minimum confidence to auto-resolve (0-1) */
  autoResolveThreshold: number;
}

/**
 * Strategy interface for resolving specific types of conflicts.
 * Implementations handle specific conflict types and return resolutions.
 */
export interface ResolutionStrategy {
  /**
   * Unique name identifier for this strategy
   */
  readonly name: StrategyName | 'fallback';

  /**
   * Determines if this strategy can handle the given conflict.
   * @param conflict The conflict to evaluate
   * @returns true if this strategy should handle the conflict
   */
  canHandle(conflict: ConflictRisk): boolean;

  /**
   * Resolves the conflict and returns a resolution.
   * @param conflict The conflict to resolve
   * @param context Context for resolution decisions
   * @returns The resolution for this conflict
   */
  resolve(conflict: ConflictRisk, context: ResolutionContext): Resolution;
}

/**
 * Registry for managing resolution strategies.
 * Strategies are checked in registration order.
 */
export interface StrategyRegistry {
  /**
   * Register a strategy to be used for conflict resolution
   */
  register(strategy: ResolutionStrategy): void;

  /**
   * Get all registered strategies
   */
  getStrategies(): ResolutionStrategy[];

  /**
   * Find the first strategy that can handle the given conflict
   */
  findStrategy(conflict: ConflictRisk): ResolutionStrategy | undefined;
}
