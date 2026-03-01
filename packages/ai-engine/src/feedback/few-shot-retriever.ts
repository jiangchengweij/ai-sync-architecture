import { FeedbackRecord, FewShotExample } from './types';
import { FeedbackCollector } from './collector';

export class FewShotRetriever {
  constructor(private readonly collector: FeedbackCollector) {}

  /**
   * Retrieve the most relevant approved examples for few-shot prompting.
   * Matches by: same variant > same changeType > similar file paths.
   */
  retrieve(opts: {
    variantId: string;
    changeType: string;
    filePaths: string[];
    maxExamples?: number;
  }): FewShotExample[] {
    const max = opts.maxExamples || 3;

    // Get all approved records
    const approved = this.collector.getRecords({ action: 'approved' });
    if (approved.length === 0) return [];

    // Score each record by relevance
    const scored = approved.map((record) => ({
      record,
      score: this.computeRelevance(record, opts),
    }));

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map(({ record, score }) => ({
      changeType: record.changeType,
      baseDiff: record.baseDiff,
      variantContext: '', // Would be populated from stored context
      generatedPatch: record.modifiedPatch || record.generatedPatch,
      confidence: record.confidence,
      similarity: score,
    }));
  }

  private computeRelevance(
    record: FeedbackRecord,
    opts: { variantId: string; changeType: string; filePaths: string[] },
  ): number {
    let score = 0;

    // Same variant: highest weight
    if (record.variantId === opts.variantId) score += 0.4;

    // Same change type
    if (record.changeType === opts.changeType) score += 0.3;

    // File path overlap (Jaccard similarity)
    const recordPaths = new Set(record.filePaths);
    const queryPaths = new Set(opts.filePaths);
    const intersection = [...queryPaths].filter((p) => recordPaths.has(p)).length;
    const union = new Set([...recordPaths, ...queryPaths]).size;
    if (union > 0) score += 0.2 * (intersection / union);

    // Higher confidence records are more reliable examples
    score += 0.1 * record.confidence;

    return score;
  }

  /**
   * Format few-shot examples into a prompt section.
   */
  formatForPrompt(examples: FewShotExample[]): string {
    if (examples.length === 0) return '';

    const sections = examples.map((ex, i) => {
      return [
        `--- Example ${i + 1} (${ex.changeType}, confidence: ${(ex.confidence * 100).toFixed(0)}%) ---`,
        `Base Change:`,
        '```diff',
        ex.baseDiff.slice(0, 500),
        '```',
        `Approved Patch:`,
        '```diff',
        ex.generatedPatch.slice(0, 500),
        '```',
      ].join('\n');
    });

    return [
      '## Historical Approved Examples',
      'The following are previously approved sync patches for similar changes:',
      '',
      ...sections,
      '',
    ].join('\n');
  }
}
