import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AnalyzeSyncDto, GenerateSyncDto, ExecuteSyncDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(dto: AnalyzeSyncDto) {
    const group = await this.prisma.projectGroup.findUnique({
      where: { id: dto.projectGroupId },
      include: { projects: true },
    });
    if (!group) throw new NotFoundException('Project group not found');

    const variants = group.projects.filter((p) => p.type === 'variant');
    const targetVariants = dto.targetVariants
      ? variants.filter((v) => dto.targetVariants!.includes(v.id))
      : variants;

    const syncTask = await this.prisma.syncTask.create({
      data: {
        projectGroupId: dto.projectGroupId,
        baseCommitHash: dto.commitHash,
        changeType: 'unknown',
        status: 'analyzing',
        startedAt: new Date(),
      },
    });

    // Create sync results for each variant
    const syncResults = await Promise.all(
      targetVariants.map((v) =>
        this.prisma.syncResult.create({
          data: {
            syncTaskId: syncTask.id,
            variantId: v.id,
            status: 'pending',
            confidence: 0,
            riskLevel: 'medium',
          },
        })
      )
    );

    return {
      syncId: syncTask.id,
      baseCommit: dto.commitHash,
      status: 'analyzing',
      variants: targetVariants.map((v, i) => ({
        projectId: v.id,
        projectName: v.name,
        status: 'pending',
        syncResultId: syncResults[i].id,
      })),
      createdAt: syncTask.createdAt,
    };
  }

  async generate(dto: GenerateSyncDto) {
    const syncTask = await this.prisma.syncTask.findUnique({ where: { id: dto.syncId } });
    if (!syncTask) throw new NotFoundException('Sync task not found');

    await this.prisma.syncTask.update({
      where: { id: dto.syncId },
      data: { status: 'generating' },
    });

    // In production, this would queue BullMQ jobs
    return {
      syncId: dto.syncId,
      status: 'generating',
      generatedAt: new Date().toISOString(),
      variantIds: dto.variantIds,
    };
  }

  async execute(dto: ExecuteSyncDto) {
    const syncTask = await this.prisma.syncTask.findUnique({ where: { id: dto.syncId } });
    if (!syncTask) throw new NotFoundException('Sync task not found');

    await this.prisma.syncTask.update({
      where: { id: dto.syncId },
      data: { status: 'executing' },
    });

    // Update approved variants
    await this.prisma.syncResult.updateMany({
      where: {
        syncTaskId: dto.syncId,
        variantId: { in: dto.approvedVariants },
      },
      data: { status: 'approved' },
    });

    // In production, this would queue BullMQ execute jobs
    return {
      syncId: dto.syncId,
      status: 'executing',
      executedAt: new Date().toISOString(),
      approvedVariants: dto.approvedVariants,
    };
  }

  async getStatus(syncId: string) {
    const syncTask = await this.prisma.syncTask.findUnique({
      where: { id: syncId },
      include: {
        syncResults: {
          include: {
            variant: { select: { id: true, name: true } },
            review: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!syncTask) throw new NotFoundException('Sync task not found');

    const results = syncTask.syncResults;
    const total = results.length;
    const completed = results.filter((r) => ['applied', 'merged'].includes(r.status)).length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const pending = total - completed - failed;

    return {
      syncId,
      status: syncTask.status,
      progress: { total, completed, failed, pending },
      variants: results.map((r) => ({
        variantId: r.variantId,
        variantName: r.variant.name,
        status: r.status,
        confidence: Number(r.confidence),
        riskLevel: r.riskLevel,
        branchName: r.branchName,
        prUrl: r.prUrl,
        reviewId: r.review?.id,
      })),
    };
  }
}
