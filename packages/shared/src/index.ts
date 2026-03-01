export interface GeneratedPatch {
  patch: string;
  confidence: number;
  explanation: string;
  risks: string[];
}

export interface SyncResult {
  syncId: string;
  variantId: string;
  status: 'success' | 'failed' | 'pending_review';
  patch?: GeneratedPatch;
  error?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  gitUrl: string;
  type: 'base' | 'variant';
  branch: string;
}

export interface SyncStrategy {
  mode: 'automatic' | 'semi-automatic' | 'manual';
  confidenceThreshold: number;
  autoMerge: boolean;
}

export interface AffectedFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  linesAdded: number;
  linesRemoved: number;
}

export interface CommitDiff {
  commitHash: string;
  message: string;
  diff: string;
  affectedFiles: AffectedFile[];
}

export type ChangeType = 'bug_fix' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore';

export type RiskLevel = 'low' | 'medium' | 'high';
