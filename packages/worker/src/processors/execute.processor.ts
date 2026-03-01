import { Job } from 'bullmq';
import { getPrisma } from '../common/prisma';

export interface ExecuteJobData {
  syncTaskId: string;
  approvedVariants: string[];
  branchPrefix?: string;
  autoMerge?: boolean;
  createPr?: boolean;
}

export async function executeProcessor(job: Job<ExecuteJobData>): Promise<void> {
  const prisma = getPrisma();
  const { syncTaskId, approvedVariants, branchPrefix, createPr } = job.data;

  try {
    await job.updateProgress(10);

    const syncResults = await prisma.syncResult.findMany({
      where: { syncTaskId, variantId: { in: approvedVariants } },
      include: { variant: true },
    });

    const totalVariants = syncResults.length;
    let processed = 0;

    for (const result of syncResults) {
      try {
        // In production: apply patch to variant repo
        // 1. Clone/checkout variant repo
        // 2. Create branch
        // 3. Apply generated patch
        // 4. Commit and push
        // 5. Create PR if requested

        const branchName = `${branchPrefix || 'sync'}/${syncTaskId.slice(0, 8)}-${result.variant.name}`;

        await prisma.syncResult.update({
          where: { id: result.id },
          data: {
            status: 'applied',
            branchName,
            prUrl: createPr ? `https://github.com/org/${result.variant.name}/pull/new` : null,
            appliedAt: new Date(),
          },
        });

        // Update review status
        await prisma.review.updateMany({
          where: { syncResultId: result.id },
          data: { status: 'approved', reviewedAt: new Date() },
        });

        processed++;
        const progress = 10 + Math.round((processed / totalVariants) * 80);
        await job.updateProgress(progress);
      } catch (variantError) {
        // Mark individual variant as failed, continue with others
        await prisma.syncResult.update({
          where: { id: result.id },
          data: { status: 'failed' },
        });
        processed++;
      }
    }

    // Determine overall status
    const allResults = await prisma.syncResult.findMany({ where: { syncTaskId } });
    const allDone = allResults.every((r) => ['applied', 'merged', 'failed', 'skipped'].includes(r.status));
    const anyFailed = allResults.some((r) => r.status === 'failed');

    await prisma.syncTask.update({
      where: { id: syncTaskId },
      data: {
        status: allDone ? (anyFailed ? 'partial' : 'completed') : 'executing',
        completedAt: allDone ? new Date() : undefined,
      },
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
