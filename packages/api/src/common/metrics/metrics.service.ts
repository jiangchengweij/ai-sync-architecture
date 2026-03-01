import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    registers: [this.registry],
  });

  readonly syncTotal = new Counter({
    name: 'sync_tasks_total',
    help: 'Total number of sync tasks',
    labelNames: ['status', 'change_type'],
    registers: [this.registry],
  });

  readonly syncDuration = new Histogram({
    name: 'sync_duration_seconds',
    help: 'Duration of sync tasks in seconds',
    labelNames: ['stage'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [this.registry],
  });

  readonly syncSuccessRate = new Gauge({
    name: 'sync_success_rate',
    help: 'Sync task success rate (0-1)',
    registers: [this.registry],
  });

  readonly aiApiErrors = new Counter({
    name: 'ai_api_errors_total',
    help: 'Total AI API errors',
    labelNames: ['error_type'],
    registers: [this.registry],
  });

  readonly aiApiLatency = new Histogram({
    name: 'ai_api_latency_seconds',
    help: 'AI API call latency in seconds',
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [this.registry],
  });

  readonly reviewPendingCount = new Gauge({
    name: 'review_pending_count',
    help: 'Number of pending reviews',
    registers: [this.registry],
  });

  readonly queueDepth = new Gauge({
    name: 'queue_depth',
    help: 'Number of jobs in queue',
    labelNames: ['queue_name'],
    registers: [this.registry],
  });

  readonly activeConnections = new Gauge({
    name: 'websocket_active_connections',
    help: 'Number of active WebSocket connections',
    registers: [this.registry],
  });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
