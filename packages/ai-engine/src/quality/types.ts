export interface ConsistencyScore {
  variantId: string;
  overallScore: number; // 0-1, 1 = identical to base
  fileMatchRate: number;
  functionMatchRate: number;
  structuralSimilarity: number;
  unmatchedBaseFiles: string[];
  unmatchedVariantFiles: string[];
}

export interface QualityDiff {
  filePath: string;
  baseFunctionCount: number;
  variantFunctionCount: number;
  matchedFunctions: number;
  divergedFunctions: Array<{
    name: string;
    baseSignature: string;
    variantSignature: string;
    driftType: 'signature' | 'structure' | 'naming';
  }>;
  unnecessaryDifferences: Array<{
    name: string;
    description: string;
    suggestion: string;
  }>;
}

export interface TechDebtItem {
  variantId: string;
  filePath: string;
  functionName: string;
  type: 'outdated' | 'diverged' | 'missing' | 'extra_complexity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface QualityReport {
  baseProjectId: string;
  variantId: string;
  consistency: ConsistencyScore;
  qualityDiffs: QualityDiff[];
  techDebt: TechDebtItem[];
  recommendations: string[];
  generatedAt: Date;
}
