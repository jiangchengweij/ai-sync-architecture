import { RiskLevel } from '@ai-project-sync/shared';

/**
 * Types of conflicts that can occur during sync operations
 */
export type ConflictType = 'code_conflict' | 'semantic_conflict' | 'dependency_conflict';

/**
 * Represents a function signature for comparison purposes
 */
export interface FuncSig {
  name: string;
  paramCount: number;
}

/**
 * Describes a detected conflict with severity and resolution guidance
 */
export interface ConflictRisk {
  type: ConflictType;
  severity: RiskLevel;
  filePath: string;
  description: string;
  suggestion: string;
  affectedFunction?: string;
}

/**
 * Complete conflict analysis report
 */
export interface ConflictReport {
  conflicts: ConflictRisk[];
  overallRisk: RiskLevel;
  canAutoResolve: boolean;
}
