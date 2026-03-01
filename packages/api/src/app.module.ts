import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './common/services/prisma.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectGroupModule } from './modules/project-group/project-group.module';
import { SyncModule } from './modules/sync/sync.module';
import { ReviewModule } from './modules/review/review.module';
import { GitIntegrationModule } from './modules/git-integration/git-integration.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MetricsModule,
    AuthModule,
    ProjectGroupModule,
    SyncModule,
    ReviewModule,
    GitIntegrationModule,
    WebSocketModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
