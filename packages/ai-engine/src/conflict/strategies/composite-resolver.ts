import { ConflictRisk } from '../types';
import { Resolution, ResolverOptions } from '../resolver-types';
import { DefaultStrategyRegistry, FallbackStrategy } from './registry';
import { ResolutionContext } from './types';
import { SemanticConflictStrategy } from './semantic-strategy';
import { DependencyConflictStrategy } from './dependency-strategy';
import { CodeConflictStrategy } from './code-strategy';

/**
 * Composite resolver that uses strategy pattern for conflict resolution.
 * This is the modern, extensible approach to conflict resolution.
 */
export class CompositeConflictResolver {
  private registry: DefaultStrategyRegistry;
  private importMappings: Map<string, string>;
  private nameMappings: Map<string, string>;
  private autoResolveThreshold: number;

  constructor(options: ResolverOptions = {}) {
    this.importMappings = options.importPathMappings || new Map();
    this.nameMappings = options.nameMappings || new Map();
    this.autoResolveThreshold = options.autoResolveThreshold ?? 0.8;

    // Initialize registry with default strategies
    this.registry = new DefaultStrategyRegistry();
    this.registry.register(new SemanticConflictStrategy());
    this.registry.register(new DependencyConflictStrategy());
    this.registry.register(new CodeConflictStrategy());
    this.registry.register(new FallbackStrategy()); // Always last as catch-all
  }

  resolve(conflicts: ConflictRisk[]): Resolution[] {
    return conflicts.map((conflict, index) => {
      const context: ResolutionContext = {
        conflictIndex: index,
        importMappings: this.importMappings,
        nameMappings: this.nameMappings,
        autoResolveThreshold: this.autoResolveThreshold,
      };

      const strategy = this.registry.findStrategy(conflict);
      if (strategy) {
        return strategy.resolve(conflict, context);
      }

      // This should never happen since FallbackStrategy handles everything
      throw new Error(`No strategy found for conflict: ${conflict.type}`);
    });
  }

  resolveAll(conflicts: ConflictRisk[]): {
    resolutions: Resolution[];
    autoResolved: Resolution[];
    needsHumanReview: Resolution[];
    autoResolveRate: number;
  } {
    const resolutions = this.resolve(conflicts);
    const autoResolved = resolutions.filter((r) => !r.requiresHumanReview);
    const needsHumanReview = resolutions.filter((r) => r.requiresHumanReview);

    return {
      resolutions,
      autoResolved,
      needsHumanReview,
      autoResolveRate: resolutions.length > 0 ? autoResolved.length / resolutions.length : 1,
    };
  }
}
