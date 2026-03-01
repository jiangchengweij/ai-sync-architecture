import { FeedbackCollector } from '../../src/feedback/collector';
import { FewShotRetriever } from '../../src/feedback/few-shot-retriever';
import { PromptPersonalizer } from '../../src/feedback/prompt-personalizer';
import { FeedbackRecord } from '../../src/feedback/types';

function makeRecord(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    reviewId: 'rev-1',
    syncResultId: 'sr-1',
    variantId: 'v-1',
    action: 'approved',
    changeType: 'bug_fix',
    filePaths: ['src/utils.ts'],
    baseDiff: '- old\n+ new',
    generatedPatch: '- variant_old\n+ variant_new',
    confidence: 0.9,
    timestamp: new Date(),
    ...overrides,
  };
}

describe('FeedbackCollector', () => {
  let collector: FeedbackCollector;

  beforeEach(() => {
    collector = new FeedbackCollector();
  });

  test('adds and retrieves records', () => {
    collector.addRecord(makeRecord());
    collector.addRecord(makeRecord({ action: 'rejected' }));
    expect(collector.getRecords()).toHaveLength(2);
  });

  test('filters by variantId', () => {
    collector.addRecord(makeRecord({ variantId: 'v-1' }));
    collector.addRecord(makeRecord({ variantId: 'v-2' }));
    expect(collector.getRecords({ variantId: 'v-1' })).toHaveLength(1);
  });

  test('filters by action', () => {
    collector.addRecord(makeRecord({ action: 'approved' }));
    collector.addRecord(makeRecord({ action: 'rejected' }));
    collector.addRecord(makeRecord({ action: 'approved' }));
    expect(collector.getRecords({ action: 'rejected' })).toHaveLength(1);
  });

  test('computes stats correctly', () => {
    collector.addRecords([
      makeRecord({ action: 'approved', confidence: 0.9 }),
      makeRecord({ action: 'approved', confidence: 0.8 }),
      makeRecord({ action: 'rejected', confidence: 0.5 }),
      makeRecord({ action: 'modified', confidence: 0.7 }),
    ]);

    const stats = collector.getStats('v-1');
    expect(stats.totalReviews).toBe(4);
    expect(stats.approved).toBe(2);
    expect(stats.rejected).toBe(1);
    expect(stats.modified).toBe(1);
    expect(stats.approvalRate).toBe(0.5);
    expect(stats.avgConfidence).toBeCloseTo(0.725);
  });

  test('computes stats by changeType', () => {
    collector.addRecords([
      makeRecord({ changeType: 'bug_fix', action: 'approved' }),
      makeRecord({ changeType: 'bug_fix', action: 'approved' }),
      makeRecord({ changeType: 'feature', action: 'rejected' }),
    ]);

    const stats = collector.getStats('v-1');
    expect(stats.byChangeType['bug_fix'].rate).toBe(1);
    expect(stats.byChangeType['feature'].rate).toBe(0);
  });

  test('computes stats by filePath', () => {
    collector.addRecords([
      makeRecord({ filePaths: ['a.ts'], action: 'approved' }),
      makeRecord({ filePaths: ['a.ts', 'b.ts'], action: 'rejected' }),
    ]);

    const stats = collector.getStats('v-1');
    expect(stats.byFilePath['a.ts'].total).toBe(2);
    expect(stats.byFilePath['a.ts'].rate).toBe(0.5);
    expect(stats.byFilePath['b.ts'].total).toBe(1);
  });
});
describe('FewShotRetriever', () => {
  let collector: FeedbackCollector;
  let retriever: FewShotRetriever;

  beforeEach(() => {
    collector = new FeedbackCollector();
    retriever = new FewShotRetriever(collector);
  });

  test('returns empty when no records', () => {
    const examples = retriever.retrieve({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [] });
    expect(examples).toHaveLength(0);
  });

  test('retrieves approved examples sorted by relevance', () => {
    collector.addRecords([
      makeRecord({ variantId: 'v-1', changeType: 'bug_fix', filePaths: ['a.ts'], confidence: 0.9 }),
      makeRecord({ variantId: 'v-2', changeType: 'bug_fix', filePaths: ['a.ts'], confidence: 0.8 }),
      makeRecord({ variantId: 'v-1', changeType: 'feature', filePaths: ['b.ts'], confidence: 0.7 }),
      makeRecord({ variantId: 'v-2', changeType: 'feature', filePaths: ['c.ts'], action: 'rejected', confidence: 0.6 }),
    ]);

    const examples = retriever.retrieve({ variantId: 'v-1', changeType: 'bug_fix', filePaths: ['a.ts'] });
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.length).toBeLessThanOrEqual(3);
    // First result should be the most relevant (same variant + same changeType + same file)
    expect(examples[0].changeType).toBe('bug_fix');
    expect(examples[0].similarity).toBeGreaterThan(examples[examples.length - 1].similarity);
  });

  test('respects maxExamples', () => {
    for (let i = 0; i < 10; i++) {
      collector.addRecord(makeRecord());
    }
    const examples = retriever.retrieve({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [], maxExamples: 2 });
    expect(examples).toHaveLength(2);
  });

  test('formatForPrompt returns empty string when no examples', () => {
    expect(retriever.formatForPrompt([])).toBe('');
  });

  test('formatForPrompt includes example content', () => {
    collector.addRecord(makeRecord());
    const examples = retriever.retrieve({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [] });
    const prompt = retriever.formatForPrompt(examples);
    expect(prompt).toContain('Historical Approved Examples');
    expect(prompt).toContain('Example 1');
    expect(prompt).toContain('bug_fix');
  });
});

describe('PromptPersonalizer', () => {
  let collector: FeedbackCollector;
  let personalizer: PromptPersonalizer;

  beforeEach(() => {
    collector = new FeedbackCollector();
    personalizer = new PromptPersonalizer(collector);
  });

  test('returns empty addendum when no history', () => {
    const result = personalizer.personalize({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [] });
    expect(result.systemAddendum).toBe('');
    expect(result.fewShotSection).toBe('');
  });

  test('includes approval rate in addendum', () => {
    for (let i = 0; i < 5; i++) {
      collector.addRecord(makeRecord({ action: i < 4 ? 'approved' : 'rejected' }));
    }
    const result = personalizer.personalize({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [] });
    expect(result.systemAddendum).toContain('80%');
  });

  test('warns about low approval rate change types', () => {
    for (let i = 0; i < 4; i++) {
      collector.addRecord(makeRecord({ changeType: 'refactor', action: i < 1 ? 'approved' : 'rejected' }));
    }
    const result = personalizer.personalize({ variantId: 'v-1', changeType: 'refactor', filePaths: [] });
    expect(result.systemAddendum).toContain('WARNING');
    expect(result.systemAddendum).toContain('low approval rate');
  });

  test('flags historically problematic files', () => {
    collector.addRecords([
      makeRecord({ filePaths: ['risky.ts'], action: 'rejected' }),
      makeRecord({ filePaths: ['risky.ts'], action: 'rejected' }),
    ]);
    const result = personalizer.personalize({ variantId: 'v-1', changeType: 'bug_fix', filePaths: ['risky.ts'] });
    expect(result.systemAddendum).toContain('risky.ts');
    expect(result.systemAddendum).toContain('problematic');
  });

  test('includes rejection reasons', () => {
    collector.addRecord(makeRecord({ action: 'rejected', reason: 'Wrong import path' }));
    const result = personalizer.personalize({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [] });
    expect(result.systemAddendum).toContain('Wrong import path');
  });

  test('provides confidence hint for limited history', () => {
    collector.addRecord(makeRecord());
    const result = personalizer.personalize({ variantId: 'v-1', changeType: 'bug_fix', filePaths: [] });
    expect(result.confidenceHint).toContain('conservative');
  });
});
