export interface FeedbackRecord {
  id: string;
  reviewId: string;
  syncResultId: string;
  variantId: string;
  action: 'approved' | 'rejected' | 'modified';
  changeType: string;
  filePaths: string[];
  baseDiff: string;
  generatedPatch: string;
  modifiedPatch?: string;
  reason?: string;
  confidence: number;
  timestamp: Date;
}

export interface FewShotExample {
  changeType: string;
  baseDiff: string;
  variantContext: string;
  generatedPatch: string;
  confidence: number;
  similarity: number;
}

export interface FeedbackStats {
  variantId: string;
  totalReviews: number;
  approved: number;
  rejected: number;
  modified: number;
  approvalRate: number;
  avgConfidence: number;
  byChangeType: Record<string, { total: number; approved: number; rate: number }>;
  byFilePath: Record<string, { total: number; approved: number; rate: number }>;
}
