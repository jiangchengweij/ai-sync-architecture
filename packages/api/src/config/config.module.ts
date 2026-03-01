import { Module, Global } from '@nestjs/common';

export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
  redisUrl: string;
  anthropicApiKey: string;
}

const configFactory = (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_project_sync',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
});

@Global()
@Module({
  providers: [
    {
      provide: 'APP_CONFIG',
      useFactory: configFactory,
    },
  ],
  exports: ['APP_CONFIG'],
})
export class ConfigModule {}
