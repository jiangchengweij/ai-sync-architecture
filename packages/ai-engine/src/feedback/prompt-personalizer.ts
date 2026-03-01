import { FeedbackCollector } from './collector';
import { FewShotRetriever } from './few-shot-retriever';
import { FeedbackStats } from './types';

export interface PersonalizedPrompt {
  systemAddendum: string;
  fewShotSection: string;
  confidenceHint: string;
}

export class PromptPersonalizer {
  private readonly retriever: FewShotRetriever;

  constructor(private readonly collector: FeedbackCollector) {
    this.retriever = new FewShotRetriever(collector);
  }

  /**
   * Generate personalized prompt additions based on variant feedback history.
   */
  personalize(opts: {
    variantId: string;
    changeType: string;
    filePaths: string[];
  }): PersonalizedPrompt {
    const stats = this.collector.getStats(opts.variantId);
    const examples = this.retriever.retrieve(opts);
    const fewShotSection = this.retriever.formatForPrompt(examples);

    return {
      systemAddendum: this.buildSystemAddendum(stats, opts),
      fewShotSection,
      confidenceHint: this.buildConfidenceHint(stats, opts),
    };
  }

  private buildSystemAddendum(
    stats: FeedbackStats,
    opts: { changeType: string; filePaths: string[] },
  ): string {
    const lines: string[] = [];

    if (stats.totalReviews === 0) return '';

    lines.push(`## Variant-Specific Context`);
    lines.push(`Historical approval rate for this variant: ${(stats.approvalRate * 100).toFixed(0)}% (${stats.totalReviews} reviews)`);

    // Change type specific guidance
    const ctStats = stats.byChangeType[opts.changeType];
    if (ctStats && ctStats.total >= 3) {
      if (ctStats.rate < 0.5) {
        lines.push(`WARNING: ${opts.changeType} changes have a low approval rate (${(ctStats.rate * 100).toFixed(0)}%) for this variant. Be extra careful with adaptations.`);
      } else if (ctStats.rate > 0.9) {
        lines.push(`${opts.changeType} changes have a high approval rate (${(ctStats.rate * 100).toFixed(0)}%) for this variant.`);
      }
    }

    // File-specific guidance
    const riskyFiles = opts.filePaths.filter((fp) => {
      const fpStats = stats.byFilePath[fp];
      return fpStats && fpStats.total >= 2 && fpStats.rate < 0.5;
    });

    if (riskyFiles.length > 0) {
      lines.push(`Historically problematic files for this variant: ${riskyFiles.join(', ')}. Apply changes conservatively.`);
    }

    // Common rejection patterns
    const rejections = this.collector.getRecords({
      variantId: stats.variantId,
      action: 'rejected',
    });

    if (rejections.length > 0) {
      const recentReasons = rejections
        .slice(-3)
        .filter((r) => r.reason)
        .map((r) => r.reason);

      if (recentReasons.length > 0) {
        lines.push(`Recent rejection reasons: ${recentReasons.join('; ')}`);
        lines.push(`Avoid these patterns in your generated patch.`);
      }
    }

    return lines.join('\n');
  }

  private buildConfidenceHint(
    stats: FeedbackStats,
    opts: { changeType: string },
  ): string {
    if (stats.totalReviews < 5) {
      return 'Limited feedback history — use conservative confidence estimates.';
    }

    const ctStats = stats.byChangeType[opts.changeType];
    if (ctStats && ctStats.rate > 0.9 && ctStats.total >= 10) {
      return 'High historical accuracy for this change type — confidence can be calibrated higher.';
    }

    if (stats.approvalRate < 0.6) {
      return 'Low historical approval rate — reduce confidence estimates by 10-15%.';
    }

    return '';
  }
}
