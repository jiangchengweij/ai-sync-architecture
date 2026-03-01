import { ParsedFile, ParsedFunction } from '../ast/parser';
import {
  ConsistencyScore, QualityDiff, TechDebtItem, QualityReport,
} from './types';
import {
  DEFAULT_CONSISTENCY_WEIGHTS,
  QUALITY_THRESHOLDS,
  AnalyzerOptions,
  normalizeAnalyzerOptions,
} from './config';
import { SignatureMatcher } from './signature-matcher';
import { DriftDetector } from './drift-detector';

export interface ProjectFiles {
  projectId: string;
  files: Map<string, ParsedFile>;
}

export class QualityAnalyzer {
  private readonly weights: typeof DEFAULT_CONSISTENCY_WEIGHTS;
  private readonly thresholds: typeof QUALITY_THRESHOLDS;
  private readonly signatureMatcher: SignatureMatcher;
  private readonly driftDetector: DriftDetector;

  constructor(options: AnalyzerOptions = {}) {
    const normalized = normalizeAnalyzerOptions(options);
    this.weights = normalized.consistencyWeights;
    this.thresholds = normalized.thresholds;
    this.signatureMatcher = new SignatureMatcher();
    this.driftDetector = new DriftDetector();
  }

  /**
   * Generate a full quality report comparing a variant against the base.
   */
  analyze(base: ProjectFiles, variant: ProjectFiles): QualityReport {
    const consistency = this.computeConsistency(base, variant);
    const qualityDiffs = this.computeQualityDiffs(base, variant);
    const techDebt = this.identifyTechDebt(base, variant, qualityDiffs);
    const recommendations = this.generateRecommendations(consistency, techDebt);

    return {
      baseProjectId: base.projectId,
      variantId: variant.projectId,
      consistency,
      qualityDiffs,
      techDebt,
      recommendations,
      generatedAt: new Date(),
    };
  }

  computeConsistency(base: ProjectFiles, variant: ProjectFiles): ConsistencyScore {
    const baseFiles = new Set(base.files.keys());
    const variantFiles = new Set(variant.files.keys());

    const matchedFiles = [...baseFiles].filter((f) => variantFiles.has(f));
    const unmatchedBaseFiles = [...baseFiles].filter((f) => !variantFiles.has(f));
    const unmatchedVariantFiles = [...variantFiles].filter((f) => !baseFiles.has(f));

    const fileMatchRate = baseFiles.size > 0 ? matchedFiles.length / baseFiles.size : 1;

    // Function-level matching
    let totalBaseFuncs = 0;
    let matchedFuncs = 0;
    let structuralMatches = 0;

    for (const filePath of matchedFiles) {
      const baseParsed = base.files.get(filePath)!;
      const variantParsed = variant.files.get(filePath)!;
      const variantFuncNames = new Set(variantParsed.functions.map((f) => f.name));

      for (const baseFunc of baseParsed.functions) {
        totalBaseFuncs++;
        if (variantFuncNames.has(baseFunc.name)) {
          matchedFuncs++;
          const variantFunc = variantParsed.functions.find((f) => f.name === baseFunc.name)!;
          if (this.signatureMatcher.signaturesMatch(baseFunc, variantFunc)) {
            structuralMatches++;
          }
        }
      }
    }

    // Also count unmatched file functions
    for (const filePath of unmatchedBaseFiles) {
      totalBaseFuncs += base.files.get(filePath)!.functions.length;
    }

    const functionMatchRate = totalBaseFuncs > 0 ? matchedFuncs / totalBaseFuncs : 1;
    const structuralSimilarity = matchedFuncs > 0 ? structuralMatches / matchedFuncs : 1;

    const overallScore =
      fileMatchRate * this.weights.FILE +
      functionMatchRate * this.weights.FUNCTION +
      structuralSimilarity * this.weights.STRUCTURAL;

    return {
      variantId: variant.projectId,
      overallScore,
      fileMatchRate,
      functionMatchRate,
      structuralSimilarity,
      unmatchedBaseFiles,
      unmatchedVariantFiles,
    };
  }
  computeQualityDiffs(base: ProjectFiles, variant: ProjectFiles): QualityDiff[] {
    const diffs: QualityDiff[] = [];
    const baseFiles = new Set(base.files.keys());
    const variantFiles = new Set(variant.files.keys());
    const commonFiles = [...baseFiles].filter((f) => variantFiles.has(f));

    for (const filePath of commonFiles) {
      const baseParsed = base.files.get(filePath)!;
      const variantParsed = variant.files.get(filePath)!;
      const variantFuncMap = new Map(variantParsed.functions.map((f) => [f.name, f]));

      const diverged: QualityDiff['divergedFunctions'] = [];
      const unnecessary: QualityDiff['unnecessaryDifferences'] = [];
      let matched = 0;

      for (const baseFunc of baseParsed.functions) {
        const variantFunc = variantFuncMap.get(baseFunc.name);
        if (!variantFunc) continue;
        matched++;

        if (!this.signatureMatcher.signaturesMatch(baseFunc, variantFunc)) {
          diverged.push({
            name: baseFunc.name,
            baseSignature: this.signatureMatcher.formatSignature(baseFunc),
            variantSignature: this.signatureMatcher.formatSignature(variantFunc),
            driftType: this.signatureMatcher.classifyDrift(baseFunc, variantFunc),
          });
        }

        // Detect unnecessary differences (e.g. only whitespace/naming style)
        const unnDiff = this.driftDetector.detectUnnecessaryDiff(baseFunc, variantFunc);
        if (unnDiff) unnecessary.push(unnDiff);
      }

      if (diverged.length > 0 || unnecessary.length > 0 ||
          baseParsed.functions.length !== variantParsed.functions.length) {
        diffs.push({
          filePath,
          baseFunctionCount: baseParsed.functions.length,
          variantFunctionCount: variantParsed.functions.length,
          matchedFunctions: matched,
          divergedFunctions: diverged,
          unnecessaryDifferences: unnecessary,
        });
      }
    }

    return diffs;
  }

  identifyTechDebt(
    base: ProjectFiles, variant: ProjectFiles, diffs: QualityDiff[],
  ): TechDebtItem[] {
    const items: TechDebtItem[] = [];

    // Missing files in variant
    for (const [filePath, parsed] of base.files) {
      if (!variant.files.has(filePath)) {
        items.push({
          variantId: variant.projectId,
          filePath,
          functionName: '*',
          type: 'missing',
          severity: parsed.functions.length > this.thresholds.HIGH_SEVERITY_FUNCTION_COUNT ? 'high' : 'medium',
          description: `File "${filePath}" exists in base but not in variant (${parsed.functions.length} functions)`,
          suggestion: `Review if this file should be synced to the variant`,
        });
      }
    }

    // Diverged functions from quality diffs
    for (const diff of diffs) {
      for (const div of diff.divergedFunctions) {
        items.push({
          variantId: variant.projectId,
          filePath: diff.filePath,
          functionName: div.name,
          type: 'diverged',
          severity: div.driftType === 'signature' ? 'high' : 'medium',
          description: `"${div.name}" has diverged: ${div.driftType} (base: ${div.baseSignature}, variant: ${div.variantSignature})`,
          suggestion: `Align "${div.name}" signature with base or document the intentional difference`,
        });
      }

      // Extra functions in variant not in base
      const extraCount = diff.variantFunctionCount - diff.matchedFunctions;
      if (extraCount > this.thresholds.EXTRA_COMPLEXITY_THRESHOLD) {
        items.push({
          variantId: variant.projectId,
          filePath: diff.filePath,
          functionName: '*',
          type: 'extra_complexity',
          severity: 'low',
          description: `Variant has ${extraCount} extra functions not in base`,
          suggestion: `Review if extra functions are necessary customizations or accumulated debt`,
        });
      }
    }

    return items;
  }

  generateRecommendations(consistency: ConsistencyScore, techDebt: TechDebtItem[]): string[] {
    const recs: string[] = [];

    if (consistency.overallScore < this.thresholds.MAJOR_SYNC_THRESHOLD) {
      recs.push('Variant has significantly diverged from base. Consider a major sync effort.');
    } else if (consistency.overallScore < this.thresholds.MODERATE_DRIFT_THRESHOLD) {
      recs.push('Moderate drift detected. Schedule regular sync cycles to prevent further divergence.');
    }

    if (consistency.unmatchedBaseFiles.length > this.thresholds.MISSING_FILES_THRESHOLD) {
      recs.push(`${consistency.unmatchedBaseFiles.length} base files missing in variant. Review for sync gaps.`);
    }

    const highDebt = techDebt.filter((d) => d.severity === 'high');
    if (highDebt.length > 0) {
      recs.push(`${highDebt.length} high-severity tech debt items require immediate attention.`);
    }

    const divergedCount = techDebt.filter((d) => d.type === 'diverged').length;
    if (divergedCount > this.thresholds.DIVERGED_FUNCTIONS_THRESHOLD) {
      recs.push(`${divergedCount} diverged functions detected. Prioritize signature alignment.`);
    }

    if (consistency.structuralSimilarity < this.thresholds.LOW_STRUCTURAL_SIMILARITY) {
      recs.push('Low structural similarity. Many matched functions have different signatures.');
    }

    if (recs.length === 0) {
      recs.push('Variant is well-aligned with base. Continue regular sync cycles.');
    }

    return recs;
  }

}
