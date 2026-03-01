import { Worker, Queue } from 'bullmq';
import { getQueueConfig } from './common/config';
import { disconnectPrisma } from './common/prisma';
import { analyzeProcessor } from './processors/analyze.processor';
import { generateProcessor } from './processors/generate.processor';
import { executeProcessor } from './processors/execute.processor';

const QUEUE_NAMES = {
  ANALYZE: 'sync:analyze',
  GENERATE: 'sync:generate',
  EXECUTE: 'sync:execute',
} as const;

async function main() {
  const config = getQueueConfig();
  const connection = config.redis;

  console.log(`[Worker] Connecting to Redis at ${connection.host}:${connection.port}`);

  // Create queues (for adding jobs from API side)
  const analyzeQueue = new Queue(QUEUE_NAMES.ANALYZE, { connection, defaultJobOptions: config.defaultJobOptions });
  const generateQueue = new Queue(QUEUE_NAMES.GENERATE, { connection, defaultJobOptions: config.defaultJobOptions });
  const executeQueue = new Queue(QUEUE_NAMES.EXECUTE, { connection, defaultJobOptions: config.defaultJobOptions });

  // Create workers
  const analyzeWorker = new Worker(QUEUE_NAMES.ANALYZE, analyzeProcessor, {
    connection,
    concurrency: 3,
  });

  const generateWorker = new Worker(QUEUE_NAMES.GENERATE, generateProcessor, {
    connection,
    concurrency: 2,
  });

  const executeWorker = new Worker(QUEUE_NAMES.EXECUTE, executeProcessor, {
    connection,
    concurrency: 2,
  });

  const workers = [analyzeWorker, generateWorker, executeWorker];

  // Event handlers
  for (const worker of workers) {
    worker.on('completed', (job) => {
      console.log(`[${worker.name}] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
      console.error(`[${worker.name}] Job ${job?.id} failed: ${err.message}`);
    });
    worker.on('progress', (job, progress) => {
      console.log(`[${worker.name}] Job ${job.id} progress: ${progress}%`);
    });
  }

  console.log('[Worker] All processors started');
  console.log(`[Worker] Queues: ${Object.values(QUEUE_NAMES).join(', ')}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down...');
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([analyzeQueue.close(), generateQueue.close(), executeQueue.close()]);
    await disconnectPrisma();
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});

export { QUEUE_NAMES };
