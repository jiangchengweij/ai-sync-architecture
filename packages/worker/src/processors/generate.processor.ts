import { Job } from 'bullmq';
import { getPrisma } from '../common/prisma';

export interface GenerateJobData {
  syncTaskId: string;
  variantIds: string[];
  options?: { includeExplanation?: boolean; maxTokens?: number };
}

export async function generateProcessor(job: Job<GenerateJobData>): Promise<void> {
  const prisma = getPrisma();
  const { syncTaskId, variantIds, options } = job.data;

  try {
    await job.updateProgress(10);

    const syncTask = await prisma.syncTask.findUnique({
      where: { id: syncTaskId },
      include: { projectGroup: { include: { projects: true } } },
    });

    if (!syncTask) {
      throw new Error(`Sync task ${syncTaskId} not found`);
    }

    const syncResults = await prisma.syncResult.findMany({
      where: { syncTaskId, variantId: { in: variantIds } },
    });

    await job.updateProgress(20);

    const totalVariants = syncResults.length;
    let processed = 0;

    for (const result of syncResults) {
      // In production: call AI engine to generate patch
      // ClaudeLLM.generatePatch(baseDiff, variantContext, changeType)
      const generatedPatch = JSON.stringify({
        files: [],
        explanation: 'Simulated patch generation',
        confidence: result.confidence,
      });

      await prisma.syncResult.update({
        where: { id: result.id },
        data: {
          status: 'generated',
          generatedPatch,
        },
      });

      // Create review record for this result
      await prisma.review.create({
        data: {
          syncResultId: result.id,
          status: 'pending',
          aiConfidence: result.confidence,
        },
      });

      processed++;
      const progress = 20 + Math.round((processed / totalVariants) * 70);
      await job.updateProgress(progress);
    }

    await prisma.syncTask.update({
      where: { id: syncTaskId },
      data: { status: 'generated' },
    });

    await job.updateProgress(100);
  } catch (error) {
    await prisma.syncTask.update({
      where: { id: syncTaskId },
      data: { status: 'failed' },
    });
    throw error;
  }
}
