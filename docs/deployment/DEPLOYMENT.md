# 部署方案文档

> 版本: 1.0 | 最后更新: 2026-02-26

## 概述

AI Project Sync 支持多种部署方案，从快速验证到生产级云原生部署。

---

## 方案一：自托管（推荐中小团队）

### 适用场景

- 5-20 个变体项目
- 团队规模 3-10 人
- 对数据隐私有要求
- 预算有限

### 系统要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 存储 | 50 GB SSD | 100 GB SSD |
| 网络 | 10 Mbps | 100 Mbps |

### 架构

```
┌─────────────────────────────────────────────────────────┐
│                    单机 Docker Compose                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Nginx     │  │   API       │  │   Web       │     │
│  │  (反向代理)  │  │  Server     │  │  Dashboard  │     │
│  │   :443      │  │   :3000     │  │   :8080     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ PostgreSQL  │  │   Redis     │  │   Qdrant    │     │
│  │   :5432     │  │   :6379     │  │   :6333     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              BullMQ Worker                       │   │
│  │         (后台同步任务处理)                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 部署步骤

#### 1. 准备服务器

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 创建应用目录
mkdir -p /opt/ai-project-sync/{data,logs,config}
cd /opt/ai-project-sync
```

#### 2. 配置环境变量

```bash
# /opt/ai-project-sync/.env
NODE_ENV=production

# 数据库配置
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ai_project_sync
POSTGRES_USER=aps_user
POSTGRES_PASSWORD=<strong-password>

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# AI 服务配置
CLAUDE_API_KEY=sk-ant-xxx
# OPENAI_API_KEY=sk-xxx  # 可选，作为备用

# JWT 配置
JWT_SECRET=<random-secret-key>
JWT_EXPIRES_IN=7d

# Git 配置
GIT_SSH_KEY=/app/config/git_ssh_key
GIT_USERNAME=AI Project Sync Bot
GIT_EMAIL=bot@example.com

# 向量数据库
QDRANT_URL=http://qdrant:6333

# 应用配置
API_URL=https://sync.yourcompany.com
WEB_URL=https://sync.yourcompany.com
```

#### 3. Docker Compose 配置

```yaml
# /opt/ai-project-sync/docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./config/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - web
    restart: always

  api:
    image: ai-project-sync/api:latest
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./data/repos:/app/repos
      - ./config/git_ssh_key:/app/config/git_ssh_key:ro
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
      - qdrant
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    image: ai-project-sync/worker:latest
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./data/repos:/app/repos
      - ./config/git_ssh_key:/app/config/git_ssh_key:ro
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
      - qdrant
    restart: always

  web:
    image: ai-project-sync/web:latest
    environment:
      - API_URL=https://sync.yourcompany.com/api/v1
    depends_on:
      - api
    restart: always

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ai_project_sync
      POSTGRES_USER: aps_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aps_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - ./data/qdrant:/qdrant/storage
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### 4. 启动服务

```bash
# 启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f api

# 运行数据库迁移
docker compose exec api npm run migration:run
```

### 预估成本

| 项目 | 月费用 |
|------|--------|
| 云服务器 (4C8G) | ¥200-400 |
| Claude API (预估) | ¥100-500 |
| 域名 + SSL | ¥50 |
| **总计** | **¥350-950/月** |

---

## 方案二：云原生（推荐中大团队）

### 适用场景

- 20+ 变体项目
- 团队规模 10+ 人
- 需要高可用和弹性扩展
- 多区域部署需求

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Cloud Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Load Balancer                      │   │
│  │                  (AWS ALB / GCP LB)                   │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────┼───────────────────────────┐   │
│  │                 Kubernetes Cluster                    │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │   │
│  │  │  API    │  │  API    │  │ Worker   │  │ Worker  │ │   │
│  │  │  Pod 1  │  │  Pod 2  │  │  Pod 1   │  │  Pod 2  │ │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │   │
│  │                                                       │   │
│  │  ┌─────────┐  ┌─────────┐                            │   │
│  │  │  Web    │  │  Web    │                            │   │
│  │  │  Pod 1  │  │  Pod 2  │                            │   │
│  │  └─────────┘  └─────────┘                            │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                 Managed Services                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐  │   │
│  │  │   RDS     │  │ElastiCache│  │   Qdrant Cloud    │  │   │
│  │  │PostgreSQL │  │   Redis   │  │   (或 Pinecone)   │  │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                 Monitoring Stack                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐  │   │
│  │  │Prometheus │  │  Grafana  │  │   AlertManager    │  │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Kubernetes 配置

#### API Deployment

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-project-sync-api
  labels:
    app: ai-project-sync
    component: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-project-sync
      component: api
  template:
    metadata:
      labels:
        app: ai-project-sync
        component: api
    spec:
      containers:
      - name: api
        image: ai-project-sync/api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: ai-project-sync-secrets
        - configMapRef:
            name: ai-project-sync-config
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Worker Deployment (HPA)

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-project-sync-worker
  labels:
    app: ai-project-sync
    component: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-project-sync
      component: worker
  template:
    spec:
      containers:
      - name: worker
        image: ai-project-sync/worker:latest
        envFrom:
        - secretRef:
            name: ai-project-sync-secrets
        resources:
          requests:
            cpu: 1000m
            memory: 1Gi
          limits:
            cpu: 4000m
            memory: 4Gi
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-project-sync-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-project-sync-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: bullmq_waiting_count
      target:
        type: AverageValue
        averageValue: 100
```

### 托管服务配置

#### AWS RDS PostgreSQL

```hcl
# terraform/rds.tf
resource "aws_db_instance" "postgres" {
  identifier           = "ai-project-sync-postgres"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.medium"
  allocated_storage    = 100
  storage_encrypted    = true

  db_name  = "ai_project_sync"
  username = "aps_admin"
  password = var.db_password

  multi_az               = true
  backup_retention_period = 7
  skip_final_snapshot    = false

  vpc_security_group_ids = [aws_security_group.rds.id]
}
```

#### ElastiCache Redis

```hcl
# terraform/elasticache.tf
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "ai-project-sync-redis"
  description          = "Redis cluster for AI Project Sync"

  node_type            = "cache.t3.medium"
  num_cache_clusters   = 2
  automatic_failover_enabled = true

  engine               = "redis"
  engine_version       = "7.0"
  parameter_group_name = "default.redis7"

  security_group_ids   = [aws_security_group.redis.id]
  subnet_group_name    = aws_elasticache_subnet_group.main.name
}
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Build and push Docker images
      run: |
        docker build -t ai-project-sync/api:${{ github.sha }} ./packages/api
        docker build -t ai-project-sync/worker:${{ github.sha }} ./packages/worker
        docker build -t ai-project-sync/web:${{ github.sha }} ./packages/web
        docker push ai-project-sync/api:${{ github.sha }}
        docker push ai-project-sync/worker:${{ github.sha }}
        docker push ai-project-sync/web:${{ github.sha }}

    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/ai-project-sync-api \
          api=ai-project-sync/api:${{ github.sha }}
        kubectl set image deployment/ai-project-sync-worker \
          worker=ai-project-sync/worker:${{ github.sha }}
        kubectl rollout status deployment/ai-project-sync-api
        kubectl rollout status deployment/ai-project-sync-worker
```

### 预估成本（月度）

| 项目 | 配置 | 费用 |
|------|------|------|
| EKS Cluster | 3 nodes, t3.large | $300 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ | $200 |
| ElastiCache Redis | cache.t3.medium, 2 nodes | $100 |
| Qdrant Cloud | 1GB vectors | $50-100 |
| Load Balancer | ALB | $50 |
| Claude API | 按使用量 | $100-500 |
| **总计** | | **$800-1250/月** |

---

## 方案三：MVP 快速验证

### 最小可行产品

仅需：
- 一个 CLI 工具（Node.js）
- 一个 Claude API Key
- Git 本地操作（无需服务端）

### 流程

```
CLI 读取 base commit diff
    ↓
构造 prompt (diff + 变体项目上下文)
    ↓
调用 Claude API
    ↓
输出 patch (适配后的改动)
    ↓
用户确认
    ↓
应用到变体项目
```

### CLI 实现

```typescript
// packages/cli/src/sync.ts
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function syncCode(
  baseDir: string,
  variantDir: string,
  commitHash: string
) {
  // 1. 获取 base diff
  const diff = execSync(
    `git -C ${baseDir} show ${commitHash} --format="" --patch`
  ).toString();

  // 2. 获取变体项目上下文
  const variantContext = getVariantContext(variantDir, diff);

  // 3. 调用 Claude 生成适配 patch
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `你是一个代码同步助手。根据基础项目的改动，生成适配到变体项目的 patch。

基础项目改动:
\`\`\`diff
${diff}
\`\`\`

变体项目相关代码:
\`\`\`
${variantContext}
\`\`\`

请生成适配后的 unified diff 格式 patch，并说明适配原因。`
    }]
  });

  const adaptedPatch = response.content[0].text;

  // 4. 显示 patch 并请求确认
  console.log('\n生成的适配 patch:\n');
  console.log(adaptedPatch);

  const confirmed = await confirm('是否应用此 patch?');
  if (confirmed) {
    // 5. 应用 patch
    applyPatch(variantDir, adaptedPatch);
    console.log('✅ Patch 已应用');
  }
}
```

### 使用方式

```bash
# 安装 CLI
npm install -g @ai-project-sync/cli

# 配置 API Key
export ANTHROPIC_API_KEY=sk-ant-xxx

# 执行同步
ai-sync sync \
  --base /path/to/base-project \
  --variant /path/to/variant-project \
  --commit a1b2c3d
```

### 验证目标

- [ ] 单文件级别同步准确率 > 80%
- [ ] 支持 TS/JS/Python 基础语法
- [ ] 2-3 个真实项目组验证通过

---

## 监控与告警

### 关键指标

| 指标 | 描述 | 告警阈值 |
|------|------|----------|
| `sync_success_rate` | 同步成功率 | < 90% |
| `sync_latency_p99` | 同步延迟 P99 | > 60s |
| `ai_api_error_rate` | AI API 错误率 | > 5% |
| `review_pending_count` | 待审核数量 | > 100 |
| `queue_depth` | 任务队列深度 | > 500 |

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "AI Project Sync",
    "panels": [
      {
        "title": "Sync Success Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(sync_total{status=\"success\"}[5m]) / rate(sync_total[5m])"
          }
        ]
      },
      {
        "title": "AI API Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, ai_api_latency_bucket)"
          }
        ]
      }
    ]
  }
}
```

---

## 备份与恢复

### 数据备份策略

| 数据类型 | 备份频率 | 保留时间 |
|----------|----------|----------|
| PostgreSQL | 每日全量 + 每小时增量 | 30 天 |
| Redis | 不备份（可重建） | - |
| 向量数据库 | 每日全量 | 7 天 |
| Git 仓库 | 不备份（远程仓库） | - |

### 恢复流程

```bash
# PostgreSQL 恢复
pg_restore -h localhost -U aps_user -d ai_project_sync backup.dump

# Qdrant 恢复
curl -X POST "http://qdrant:6333/collections/code_embeddings/snapshots/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "snapshot=@backup.snapshot"
```

---

## 安全加固

### 网络安全

- [ ] VPC 隔离，数据库不暴露公网
- [ ] 安全组最小权限原则
- [ ] WAF 保护 API 端点

### 访问控制

- [ ] RBAC 权限模型
- [ ] API Key 轮换机制
- [ ] 审计日志记录

### 数据安全

- [ ] 传输加密 (TLS 1.3)
- [ ] 存储加密 (AES-256)
- [ ] 敏感数据脱敏
