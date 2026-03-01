import { Module } from '@nestjs/common';
import { GitIntegrationController } from './git-integration.controller';
import { GitIntegrationService } from './git-integration.service';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [SyncModule],
  controllers: [GitIntegrationController],
  providers: [GitIntegrationService],
  exports: [GitIntegrationService],
})
export class GitIntegrationModule {}
