export interface Review {
  id: string;
  syncId: string;
  variantId: string;
  variantName: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  changeSummary: string;
  changeType: string;
  affectedFiles: string[];
  warnings: string[];
  createdAt: string;
  expiresAt: string;
}

export interface ReviewDetail extends Review {
  baseChange: {
    commitHash: string;
    commitMessage: string;
    author: string;
    files: Array<{ path: string; diff: string }>;
  };
  adaptedChange: {
    confidence: number;
    files: Array<{ path: string; diff: string; explanation: string }>;
    risks: string[];
    explanation: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  token: string | null;
  user: { id: string; name: string; email: string } | null;
}

export interface ProjectGroup {
  id: string;
  name: string;
  description: string;
  syncStrategy: { mode: string; confidenceThreshold: number; autoMerge: boolean };
  projects: Project[];
  _count: { syncTasks: number };
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  gitUrl: string;
  gitBranch: string;
  type: 'base' | 'variant';
  status: string;
}

export interface SyncTask {
  syncId: string;
  status: string;
  baseCommit: string;
  progress: { total: number; completed: number; failed: number; pending: number };
  variants: SyncVariant[];
  createdAt: string;
}

export interface SyncVariant {
  variantId: string;
  variantName: string;
  status: string;
  confidence: number;
  riskLevel: string;
  branchName?: string;
  prUrl?: string;
}

export interface StatsOverview {
  totalGroups: number;
  totalSyncs: number;
  pendingReviews: number;
  successRate: number;
  recentSyncs: Array<{ id: string; status: string; createdAt: string }>;
}
