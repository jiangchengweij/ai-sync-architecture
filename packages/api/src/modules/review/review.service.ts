import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { RejectReviewDto, BatchApproveDto, ReviewQueryDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async findPending(query: ReviewQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { status: 'pending' };
    if (query.projectGroupId) {
      where.syncResult = { syncTask: { projectGroupId: query.projectGroupId } };
    }

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { aiConfidence: 'desc' },
        include: {
          syncResult: {
            include: {
              variant: { select: { id: true, name: true } },
              syncTask: { select: { id: true, baseCommitHash: true, changeType: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        status: r.status,
        aiConfidence: Number(r.aiConfidence),
        variantId: r.syncResult.variantId,
        variantName: r.syncResult.variant.name,
        syncTaskId: r.syncResult.syncTaskId,
        changeType: r.syncResult.syncTask.changeType,
        riskLevel: r.syncResult.riskLevel,
        createdAt: r.createdAt,
      })),
      pagination: { total, page, limit },
    };
  }
  async findOne(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        syncResult: {
          include: {
            variant: true,
            syncTask: { include: { projectGroup: { select: { id: true, name: true } } } },
          },
        },
        feedbackHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!review) throw new NotFoundException('Review not found');

    return {
      id: review.id,
      status: review.status,
      aiConfidence: Number(review.aiConfidence),
      humanOverride: review.humanOverride,
      reviewedAt: review.reviewedAt,
      variant: {
        id: review.syncResult.variant.id,
        name: review.syncResult.variant.name,
      },
      syncTask: {
        id: review.syncResult.syncTask.id,
        changeType: review.syncResult.syncTask.changeType,
        baseCommitHash: review.syncResult.syncTask.baseCommitHash,
        projectGroup: review.syncResult.syncTask.projectGroup,
      },
      generatedPatch: review.syncResult.generatedPatch,
      riskLevel: review.syncResult.riskLevel,
      branchName: review.syncResult.branchName,
      prUrl: review.syncResult.prUrl,
      feedbackHistory: review.feedbackHistory,
      createdAt: review.createdAt,
    };
  }

  async approve(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { syncResult: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    const [updatedReview] = await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id },
        data: { status: 'approved', humanOverride: true, reviewedAt: new Date() },
      }),
      this.prisma.syncResult.update({
        where: { id: review.syncResultId },
        data: { status: 'approved' },
      }),
      this.prisma.feedbackHistory.create({
        data: { reviewId: id, action: 'approved', userId: 'system' },
      }),
    ]);

    return { id: updatedReview.id, status: 'approved' };
  }
  async reject(id: string, dto: RejectReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { syncResult: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    const [updatedReview] = await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id },
        data: { status: 'rejected', humanOverride: true, reviewedAt: new Date() },
      }),
      this.prisma.syncResult.update({
        where: { id: review.syncResultId },
        data: { status: 'rejected' },
      }),
      this.prisma.feedbackHistory.create({
        data: {
          reviewId: id,
          action: 'rejected',
          userId: 'system',
          reason: dto.reason,
          suggestedFix: dto.suggestedFix,
        },
      }),
    ]);

    return { id: updatedReview.id, status: 'rejected' };
  }

  async batchApprove(dto: BatchApproveDto) {
    const where: any = { status: 'pending' };

    if (dto.reviewIds) {
      where.id = { in: dto.reviewIds };
    } else if (dto.confidenceThreshold) {
      where.aiConfidence = { gte: dto.confidenceThreshold };
    } else {
      return { approved: 0 };
    }

    const reviews = await this.prisma.review.findMany({
      where,
      include: { syncResult: true },
    });

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.review.updateMany({
        where: { id: { in: reviews.map((r) => r.id) } },
        data: { status: 'approved', humanOverride: true, reviewedAt: now },
      }),
      this.prisma.syncResult.updateMany({
        where: { id: { in: reviews.map((r) => r.syncResultId) } },
        data: { status: 'approved' },
      }),
      ...reviews.map((r) =>
        this.prisma.feedbackHistory.create({
          data: { reviewId: r.id, action: 'batch_approved', userId: 'system' },
        }),
      ),
    ]);

    return { approved: reviews.length, reviewIds: reviews.map((r) => r.id) };
  }
}
