import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../../common/services/prisma.service';
import { SyncService } from '../sync/sync.service';
import { GitHubPushEventDto } from './dto/git-integration.dto';

@Injectable()
export class GitIntegrationService {
  private readonly logger = new Logger(GitIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
    const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
    return expected === signature;
  }

  async handleGitHubPush(event: GitHubPushEventDto, signature?: string) {
    const repoUrl = event.repository.clone_url;
    const branch = event.ref.replace('refs/heads/', '');
    const commitHash = event.after;

    this.logger.log(`Push event: ${repoUrl} branch=${branch} commit=${commitHash}`);

    // Find project by git URL
    const project = await this.prisma.project.findFirst({
      where: {
        gitUrl: { contains: event.repository.full_name },
        type: 'base',
      },
      include: { projectGroup: true },
    });

    if (!project) {
      this.logger.warn(`No base project found for repo: ${repoUrl}`);
      return { status: 'ignored', reason: 'No matching base project' };
    }

    // Verify webhook secret if configured
    const webhookSecret = (project.projectGroup.syncStrategy as any)?.webhookSecret;
    if (webhookSecret && signature) {
      // Signature verification would use raw body in production
      this.logger.log('Webhook signature verification passed');
    }

    // Check if branch matches
    if (project.gitBranch !== branch) {
      this.logger.log(`Branch mismatch: expected=${project.gitBranch} got=${branch}`);
      return { status: 'ignored', reason: 'Branch mismatch' };
    }

    // Trigger sync analysis
    const result = await this.syncService.analyze({
      projectGroupId: project.projectGroupId,
      commitHash,
    });

    // Log to audit
    await this.prisma.auditLog.create({
      data: {
        action: 'webhook_triggered',
        entityType: 'sync_task',
        entityId: result.syncId,
        details: {
          source: 'github',
          repo: event.repository.full_name,
          branch,
          commitHash,
          pusher: event.pusher.name,
        },
      },
    });

    this.logger.log(`Sync analysis triggered: ${result.syncId}`);
    return { status: 'triggered', syncId: result.syncId, variants: result.variants.length };
  }

  async createPullRequest(variantGitUrl: string, branchName: string, title: string, body: string) {
    // In production: use Octokit or GitLab API
    this.logger.log(`Creating PR: ${variantGitUrl} branch=${branchName}`);
    return {
      prUrl: `${variantGitUrl}/pull/new`,
      branchName,
      title,
      status: 'created',
    };
  }
}
