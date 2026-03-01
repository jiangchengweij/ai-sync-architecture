import { Job } from 'bullmq';
import { getPrisma } from '../common/prisma';

export interface AnalyzeJobData {
  syncTaskId: string;
  projectGroupId: string;
  commitHash: string;
}

export async function analyzeProcessor(job: Job<AnalyzeJobData>): Promise<void> {
  const prisma = getPrisma();
  const { syncTaskId, projectGroupId, commitHash } = job.data;

  try {
    await job.updateProgress(10);

    // Fetch project group with projects
    const group = await prisma.projectGroup.findUnique({
      where: { id: projectGroupId },
      include: { projects: true },
    });

    if (!group) {
      throw new Error(`Project group ${projectGroupId} not found`);
    }

    const baseProject = group.projects.find((p) => p.type === 'base');
    const variants = group.projects.filter((p) => p.type === 'variant');

    if (!baseProject) {
      throw new Error('No base project found in group');
    }

    await job.updateProgress(30);

    // In production: clone repos, extract diff, run AST analysis
    // For now, update sync results with simulated analysis
    const syncResults = await prisma.syncResult.findMany({
      where: { syncTaskId },
    });

    await job.updateProgress(60);

    // Update each sync result with analysis
    for (const result of syncResults) {
      const variant = variants.find((v) => v.id === result.variantId);
      // Simulated confidence based on variant existence
      const confidence = variant ? 0.85 : 0;
      const riskLevel = confidence > 0.8 ? 'low' : confidence > 0.5 ? 'medium' : 'high';

      await prisma.syncResult.update({
        where: { id: result.id },
        data: {
          status: 'analyzed',
          confidence,
          riskLevel,
        },
      });
    }

    await job.updateProgress(90);

    // Detect change type from commit message or diff
    await prisma.syncTask.update({
      where: { id: syncTaskId },
      data: {
        status: 'analyzed',
        changeType: 'bug_fix', // Would be detected from actual diff
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
