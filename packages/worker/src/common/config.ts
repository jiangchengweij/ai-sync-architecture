export interface QueueConfig {
  redis: { host: string; port: number; password?: string };
  defaultJobOptions: {
    attempts: number;
    backoff: { type: string; delay: number };
    removeOnComplete: number;
    removeOnFail: number;
  };
}

export function getQueueConfig(): QueueConfig {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  };
}
