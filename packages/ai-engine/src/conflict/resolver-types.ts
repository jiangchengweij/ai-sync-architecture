import { ConflictRisk, ConflictType } from './types';

export interface Resolution {
  conflictIndex: number;
  conflict: ConflictRisk;
  strategy: ResolutionStrategy;
  patch?: string;
  confidence: number;
  requiresHumanReview: boolean;
  explanation: string;
}

export type ResolutionStrategy =
  | 'rename_reference'
  | 'update_params'
  | 'adapt_import_path'
  | 'install_package'
  | 'skip_line'
  | 'manual';

export interface ResolverOptions {
  /** Import path mappings: base path -> variant path */
  importPathMappings?: Map<string, string>;
  /** Function name mappings: base name -> variant name */
  nameMappings?: Map<string, string>;
  /** Minimum confidence to auto-resolve (0-1) */
  autoResolveThreshold?: number;
}
