import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

export interface TrustScore {
  variantId: string;
  changeType: string;
  filePath: string;
  score: number; // 0-1
  totalReviews: number;
  approvedCount: number;
}

export interface AutoApproveDecision {
  reviewId: string;
  syncResultId: string;
  approved: boolean;
  reason: string;
  trustScore: number;
  aiConfidence: number;
}

export interface AutoApprovePolicy {
  /** Minimum AI confidence to consider auto-approve */
  minConfidence: number;
  /** Minimum trust score to auto-approve */
  minTrustScore: number;
  /** Minimum number of historical reviews before trusting */
  minHistoryCount: number;
  /** Maximum risk level that can be auto-approved */
  maxRiskLevel: 'low' | 'medium';
}

const DEFAULT_POLICY: AutoApprovePolicy = {
  minConfidence: 0.95,
  minTrustScore: 0.85,
  minHistoryCount: 10,
  maxRiskLevel: 'low',
};

@Injectable()
export class AutoApproveService {
  private readonly logger = new Logger(AutoApproveService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    reviewId: string,
    policy: AutoApprovePolicy = DEFAULT_POLICY,
  ): Promise<AutoApproveDecision> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        syncResult: {
          include: {
            variant: true,
            syncTask: true,
          },
        },
      },
    });

    if (!review) {
      return { reviewId, syncResultId: '', approved: false, reason: 'Review not found', trustScore: 0, aiConfidence: 0 };
    }

    const aiConfidence = Number(review.aiConfidence);
    const riskLevel = review.syncResult.riskLevel;
    const variantId = review.syncResult.variantId;
    const changeType = review.syncResult.syncTask.changeType;

    // Check AI confidence threshold
    if (aiConfidence < policy.minConfidence) {
      return {
        reviewId, syncResultId: review.syncResultId,
        approved: false,
        reason: `AI confidence ${(aiConfidence * 100).toFixed(0)}% below threshold ${(policy.minConfidence * 100).toFixed(0)}%`,
        trustScore: 0, aiConfidence,
      };
    }

    // Check risk level
    const riskOrder = { low: 0, medium: 1, high: 2 };
    const maxRisk = riskOrder[policy.maxRiskLevel] ?? 0;
    if ((riskOrder[riskLevel as keyof typeof riskOrder] ?? 2) > maxRisk) {
      return {
        reviewId, syncResultId: review.syncResultId,
        approved: false,
        reason: `Risk level "${riskLevel}" exceeds max "${policy.maxRiskLevel}"`,
        trustScore: 0, aiConfidence,
      };
    }

    // Calculate trust score
    const trustScore = await this.calculateTrustScore(variantId, changeType);

    if (trustScore.totalReviews < policy.minHistoryCount) {
      return {
        reviewId, syncResultId: review.syncResultId,
        approved: false,
        reason: `Insufficient history: ${trustScore.totalReviews} reviews (need ${policy.minHistoryCount})`,
        trustScore: trustScore.score, aiConfidence,
      };
    }

    if (trustScore.score < policy.minTrustScore) {
      return {
        reviewId, syncResultId: review.syncResultId,
        approved: false,
        reason: `Trust score ${(trustScore.score * 100).toFixed(0)}% below threshold ${(policy.minTrustScore * 100).toFixed(0)}%`,
        trustScore: trustScore.score, aiConfidence,
      };
    }

    return {
      reviewId, syncResultId: review.syncResultId,
      approved: true,
      reason: `Auto-approved: confidence=${(aiConfidence * 100).toFixed(0)}%, trust=${(trustScore.score * 100).toFixed(0)}%, risk=${riskLevel}`,
      trustScore: trustScore.score, aiConfidence,
    };
  }
  async calculateTrustScore(variantId: string, changeType: string): Promise<TrustScore> {
    // Get historical feedback for this variant + changeType
    const history = await this.prisma.feedbackHistory.findMany({
      where: {
        review: {
          syncResult: {
            variantId,
            syncTask: { changeType },
          },
        },
      },
      select: { action: true },
    });

    const total = history.length;
    const approved = history.filter((h) => h.action === 'approved' || h.action === 'batch_approved').length;

    // Weighted score: recent reviews matter more
    const score = total > 0 ? approved / total : 0;

    return {
      variantId,
      changeType,
      filePath: '',
      score,
      totalReviews: total,
      approvedCount: approved,
    };
  }

  async evaluateBatch(
    policy: AutoApprovePolicy = DEFAULT_POLICY,
  ): Promise<{ decisions: AutoApproveDecision[]; autoApproved: number; rejected: number }> {
    const pendingReviews = await this.prisma.review.findMany({
      where: { status: 'pending' },
      select: { id: true },
    });

    const decisions: AutoApproveDecision[] = [];
    let autoApproved = 0;
    let rejected = 0;

    for (const review of pendingReviews) {
      const decision = await this.evaluate(review.id, policy);
      decisions.push(decision);

      if (decision.approved) {
        await this.executeAutoApprove(decision);
        autoApproved++;
      } else {
        rejected++;
      }
    }

    this.logger.log(`Auto-approve batch: ${autoApproved} approved, ${rejected} deferred`);
    return { decisions, autoApproved, rejected };
  }

  private async executeAutoApprove(decision: AutoApproveDecision): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id: decision.reviewId },
        data: { status: 'approved', humanOverride: false, reviewedAt: now },
      }),
      this.prisma.syncResult.update({
        where: { id: decision.syncResultId },
        data: { status: 'approved' },
      }),
      this.prisma.feedbackHistory.create({
        data: {
          reviewId: decision.reviewId,
          action: 'auto_approved',
          userId: 'system',
          reason: decision.reason,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'auto_approve',
          entityType: 'review',
          entityId: decision.reviewId,
          details: {
            trustScore: decision.trustScore,
            aiConfidence: decision.aiConfidence,
            reason: decision.reason,
          },
        },
      }),
    ]);

    this.logger.log(`Auto-approved review ${decision.reviewId}: ${decision.reason}`);
  }
}
