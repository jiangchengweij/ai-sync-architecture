import { ConflictRisk } from '../types';
import { Resolution, Resolution as ResolutionType } from '../resolver-types';
import { ResolutionStrategy, StrategyRegistry, ResolutionContext } from './types';
import { CONFIDENCE_SCORES } from '../resolver-config';

/**
 * Default fallback strategy for unhandled conflicts.
 * Always requires human review with zero confidence.
 */
export class FallbackStrategy implements ResolutionStrategy {
  readonly name = 'fallback' as const;

  canHandle(_conflict: ConflictRisk): boolean {
    return true; // Fallback handles everything
  }

  resolve(conflict: ConflictRisk, context: ResolutionContext): Resolution {
    return {
      conflictIndex: context.conflictIndex,
      conflict,
      strategy: 'manual',
      confidence: CONFIDENCE_SCORES.FALLBACK,
      requiresHumanReview: true,
      explanation: `Unable to auto-resolve: ${conflict.description}`,
    };
  }
}

/**
 * Default implementation of the strategy registry.
 * Strategies are checked in registration order; first match wins.
 */
export class DefaultStrategyRegistry implements StrategyRegistry {
  private strategies: ResolutionStrategy[] = [];

  register(strategy: ResolutionStrategy): void {
    this.strategies.push(strategy);
  }

  getStrategies(): ResolutionStrategy[] {
    return [...this.strategies];
  }

  findStrategy(conflict: ConflictRisk): ResolutionStrategy | undefined {
    return this.strategies.find((s) => s.canHandle(conflict));
  }
}

/**
 * Creates a resolution object with common fields
 */
export function createResolution(
  context: ResolutionContext,
  conflict: ConflictRisk,
  strategy: ResolutionType['strategy'],
  options: {
    confidence: number;
    requiresHumanReview?: boolean;
    patch?: string;
    explanation: string;
  },
): Resolution {
  const requiresHumanReview = options.requiresHumanReview
    ?? options.confidence < context.autoResolveThreshold;

  return {
    conflictIndex: context.conflictIndex,
    conflict,
    strategy,
    confidence: options.confidence,
    requiresHumanReview,
    patch: options.patch,
    explanation: options.explanation,
  };
}
