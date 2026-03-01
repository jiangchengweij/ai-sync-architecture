import { Controller, Post, Body, Headers, RawBodyRequest, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { GitIntegrationService } from './git-integration.service';
import { GitHubPushEventDto } from './dto/git-integration.dto';

@ApiTags('webhooks')
@Controller('api/v1/webhooks')
export class GitIntegrationController {
  private readonly logger = new Logger(GitIntegrationController.name);

  constructor(private readonly service: GitIntegrationService) {}

  @Post('github')
  @ApiOperation({ summary: 'Receive GitHub webhook push events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleGitHubWebhook(
    @Body() body: GitHubPushEventDto,
    @Headers('x-hub-signature-256') signature?: string,
    @Headers('x-github-event') event?: string,
  ) {
    this.logger.log(`GitHub webhook received: event=${event}`);

    if (event !== 'push') {
      return { status: 'ignored', reason: `Event type '${event}' not handled` };
    }

    return this.service.handleGitHubPush(body, signature);
  }

  @Post('gitlab')
  @ApiOperation({ summary: 'Receive GitLab webhook push events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleGitLabWebhook(
    @Body() body: any,
    @Headers('x-gitlab-token') token?: string,
  ) {
    this.logger.log('GitLab webhook received');

    if (body.object_kind !== 'push') {
      return { status: 'ignored', reason: `Event type '${body.object_kind}' not handled` };
    }

    // Transform GitLab payload to GitHub-compatible format
    const pushEvent: GitHubPushEventDto = {
      ref: body.ref,
      after: body.after,
      before: body.before,
      repository: {
        id: body.project?.id,
        full_name: body.project?.path_with_namespace,
        clone_url: body.project?.git_http_url,
        default_branch: body.project?.default_branch,
      },
      pusher: { name: body.user_name, email: body.user_email },
      commits: body.commits?.map((c: any) => ({
        id: c.id,
        message: c.message,
        added: c.added || [],
        removed: c.removed || [],
        modified: c.modified || [],
      })),
    };

    return this.service.handleGitHubPush(pushEvent, token);
  }
}
