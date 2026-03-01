/**
 * Configuration constants for conflict resolution
 */

/**
 * Default confidence threshold for auto-resolution.
 * Resolutions with confidence >= this value will not require human review.
 */
export const DEFAULT_AUTO_RESOLVE_THRESHOLD = 0.8;

/**
 * Ordered list of [pattern, replacement] for adapting relative import paths.
 * Tried in sequence until a match is found.
 */
export const IMPORT_PATH_PATTERNS: Array<[RegExp, string]> = [
  [/^\.\/(.+)/, '../$1'],
  [/^\.\.\/(.+)/, './$1'],
  [/services\//, 'service/'],
  [/service\//, 'services/'],
];

/**
 * Confidence scores for different resolution strategies
 */
export const CONFIDENCE_SCORES = {
  /** Known mapping (import or name) - very high confidence */
  KNOWN_MAPPING: 0.95,
  /** Simple rename - high confidence */
  SIMPLE_RENAME: 0.85,
  /** Package install - high confidence */
  PACKAGE_INSTALL: 0.9,
  /** Path adaptation - medium confidence */
  PATH_ADAPTATION: 0.7,
  /** Single param addition - low-medium confidence */
  PARAM_ADDITION: 0.6,
  /** Param removal - low confidence */
  PARAM_REMOVAL: 0.4,
  /** Major signature change - very low confidence */
  MAJOR_CHANGE: 0.2,
  /** Code conflict high severity - very low confidence */
  CODE_CONFLICT_HIGH: 0.1,
  /** Skip line for minor mismatch */
  SKIP_LINE: 0.5,
  /** Fallback manual - no confidence */
  FALLBACK: 0,
} as const;
