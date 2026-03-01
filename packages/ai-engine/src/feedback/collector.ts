import { FeedbackRecord, FeedbackStats, FewShotExample } from './types';

export class FeedbackCollector {
  private records: FeedbackRecord[] = [];

  addRecord(record: FeedbackRecord): void {
    this.records.push(record);
  }

  addRecords(records: FeedbackRecord[]): void {
    this.records.push(...records);
  }

  getRecords(filter?: { variantId?: string; changeType?: string; action?: string }): FeedbackRecord[] {
    let result = this.records;
    if (filter?.variantId) result = result.filter((r) => r.variantId === filter.variantId);
    if (filter?.changeType) result = result.filter((r) => r.changeType === filter.changeType);
    if (filter?.action) result = result.filter((r) => r.action === filter.action);
    return result;
  }

  getStats(variantId: string): FeedbackStats {
    const records = this.records.filter((r) => r.variantId === variantId);
    const approved = records.filter((r) => r.action === 'approved').length;
    const rejected = records.filter((r) => r.action === 'rejected').length;
    const modified = records.filter((r) => r.action === 'modified').length;
    const total = records.length;

    const byChangeType: FeedbackStats['byChangeType'] = {};
    const byFilePath: FeedbackStats['byFilePath'] = {};

    for (const r of records) {
      // Aggregate by change type
      if (!byChangeType[r.changeType]) {
        byChangeType[r.changeType] = { total: 0, approved: 0, rate: 0 };
      }
      byChangeType[r.changeType].total++;
      if (r.action === 'approved') byChangeType[r.changeType].approved++;

      // Aggregate by file path
      for (const fp of r.filePaths) {
        if (!byFilePath[fp]) byFilePath[fp] = { total: 0, approved: 0, rate: 0 };
        byFilePath[fp].total++;
        if (r.action === 'approved') byFilePath[fp].approved++;
      }
    }

    // Calculate rates
    for (const key of Object.keys(byChangeType)) {
      const ct = byChangeType[key];
      ct.rate = ct.total > 0 ? ct.approved / ct.total : 0;
    }
    for (const key of Object.keys(byFilePath)) {
      const fp = byFilePath[key];
      fp.rate = fp.total > 0 ? fp.approved / fp.total : 0;
    }

    return {
      variantId,
      totalReviews: total,
      approved,
      rejected,
      modified,
      approvalRate: total > 0 ? approved / total : 0,
      avgConfidence: total > 0 ? records.reduce((s, r) => s + r.confidence, 0) / total : 0,
      byChangeType,
      byFilePath,
    };
  }
}
