/**
 * Configuration constants for quality analysis
 */

/**
 * Default weights for consistency score calculation.
 * These determine how much each factor contributes to the overall consistency score.
 */
export const DEFAULT_CONSISTENCY_WEIGHTS = {
  /** Weight for file match rate (0-1) */
  FILE: 0.3,
  /** Weight for function match rate (0-1) */
  FUNCTION: 0.4,
  /** Weight for structural similarity (0-1) */
  STRUCTURAL: 0.3,
} as const;

/**
 * Thresholds for quality recommendations
 */
export const QUALITY_THRESHOLDS = {
  /** Below this score, recommend major sync effort */
  MAJOR_SYNC_THRESHOLD: 0.5,
  /** Below this score, recommend regular sync cycles */
  MODERATE_DRIFT_THRESHOLD: 0.8,
  /** Number of missing files to trigger recommendation */
  MISSING_FILES_THRESHOLD: 5,
  /** Number of diverged functions to trigger recommendation */
  DIVERGED_FUNCTIONS_THRESHOLD: 10,
  /** Low structural similarity threshold */
  LOW_STRUCTURAL_SIMILARITY: 0.7,
  /** Number of extra functions to flag as extra complexity */
  EXTRA_COMPLEXITY_THRESHOLD: 3,
  /** Number of functions in a file to be considered high severity when missing */
  HIGH_SEVERITY_FUNCTION_COUNT: 5,
} as const;

/** Type for consistency weights */
export type ConsistencyWeights = typeof DEFAULT_CONSISTENCY_WEIGHTS;

/** Type for quality thresholds */
export type QualityThresholds = typeof QUALITY_THRESHOLDS;

/**
 * Options for configuring the QualityAnalyzer
 */
export interface AnalyzerOptions {
  /** Custom weights for consistency calculation */
  consistencyWeights?: ConsistencyWeights;
  /** Custom quality thresholds */
  thresholds?: Partial<QualityThresholds>;
}

/**
 * Normalized analyzer options with all defaults applied
 */
export interface NormalizedAnalyzerOptions {
  consistencyWeights: ConsistencyWeights;
  thresholds: QualityThresholds;
}

/**
 * Validates and normalizes analyzer options with defaults
 */
export function normalizeAnalyzerOptions(
  options: AnalyzerOptions = {},
): NormalizedAnalyzerOptions {
  return {
    consistencyWeights: options.consistencyWeights ?? DEFAULT_CONSISTENCY_WEIGHTS,
    thresholds: {
      ...QUALITY_THRESHOLDS,
      ...options.thresholds,
    } as QualityThresholds,
  };
}
