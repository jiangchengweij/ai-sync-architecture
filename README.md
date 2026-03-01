# AI Project Sync

AI 驱动的代码同步工具，智能地将基础项目的代码变更同步到多个定制化变体项目中。

## 核心问题

当一个基础项目衍生出多个定制化变体项目后，如何在变更共享代码时，智能地将改动同步到所有变体项目中。

## 适用场景

| 场景 | 描述 |
|------|------|
| 外包定制 | 为不同客户定制的同源项目 |
| SaaS 私有化 | 多租户私有化部署版本 |
| 白标产品 | 多品牌变体 |
| 多地区版本 | 多地区/多语言版本的应用 |

## 工作原理

```
检测改动 → 语义分析 → 映射定位 → AI 适配生成 → 人工审核 → 同步应用
```

1. 检测 base 项目的 Git commit 变更
2. AST 解析 + AI 理解改动意图（bug fix / feature / refactor）
3. 通过代码映射引擎（同名匹配 → 指纹匹配 → 向量相似度）在变体中定位对应代码
4. Claude LLM 生成适配后的补丁，保留变体的定制化差异
5. 人工审核或自动确认（基于置信度 + 历史信任评分）
6. 创建 Git 分支和 PR，应用到各变体项目

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建 | pnpm + Turborepo monorepo |
| AI 引擎 | Claude API, TypeScript AST, 向量嵌入 |
| 后端 | NestJS, Prisma, PostgreSQL, BullMQ, Redis |
| 前端 | React, Vite, Socket.IO |
| CLI | Commander.js |
| IDE | VS Code Extension |
| 监控 | Prometheus + Grafana + AlertManager |

## 项目结构

```
packages/
├── shared/              # 共享类型定义
├── ai-engine/           # AI 核心引擎 (AST/嵌入/映射/冲突/反馈/知识图谱/质量分析)
├── api/                 # NestJS 后端 (REST + WebSocket + JWT 认证)
├── worker/              # BullMQ 异步任务处理器
├── cli/                 # 命令行工具
├── web/                 # React Web Dashboard
├── vscode-extension/    # VS Code 插件
docs/
├── ARCHITECTURE.md      # 技术架构设计文档
├── TASKS.md             # 任务拆解文档
infra/
└── monitoring/          # Prometheus + Grafana + AlertManager 配置
```
## 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.15.0
- PostgreSQL
- Redis

### 安装

```bash
git clone <repo-url>
cd ai-sync-architecture
pnpm install
npm run build
```

### 数据库初始化

```bash
cd packages/api
# 配置 .env 文件 (参考 .env.example)
# DATABASE_URL=postgresql://user:pass@localhost:5432/ai_sync
pnpm migration:dev
pnpm seed
```

### 启动服务

```bash
# 启动所有服务 (API + Worker + Web)
npm run dev

# 或分别启动
cd packages/api && pnpm dev       # API 服务 :3000
cd packages/worker && pnpm dev    # Worker 进程
cd packages/web && pnpm dev       # Web Dashboard :8080
```

### CLI 使用

```bash
cd packages/cli
npx ai-sync sync --base /path/to/base --variant /path/to/variant --commit abc1234
```

## API 端点

API 文档: `http://localhost:3000/api/docs` (Swagger UI)

| 模块 | 端点 | 说明 |
|------|------|------|
| 认证 | `POST /api/v1/auth/login` | JWT 登录 |
| 项目组 | `GET/POST /api/v1/project-groups` | 项目组 CRUD |
| 项目组 | `POST /api/v1/project-groups/:id/variants` | 添加变体 |
| 同步 | `POST /api/v1/sync/analyze` | 分析同步可能性 |
| 同步 | `POST /api/v1/sync/generate` | 生成同步补丁 |
| 同步 | `POST /api/v1/sync/execute` | 执行同步操作 |
| 同步 | `GET /api/v1/sync/:id/status` | 查询同步状态 |
| 审核 | `GET /api/v1/reviews/pending` | 待审核列表 |
| 审核 | `POST /api/v1/reviews/:id/approve` | 批准 |
| 审核 | `POST /api/v1/reviews/:id/reject` | 拒绝 |
| 审核 | `POST /api/v1/reviews/auto-approve/batch` | 自动批量审批 |
| Webhook | `POST /api/v1/webhooks/github` | GitHub Push 事件 |
| Webhook | `POST /api/v1/webhooks/gitlab` | GitLab Push 事件 |
| 监控 | `GET /metrics` | Prometheus 指标 |

## 测试

```bash
# 运行全部测试
npm run test

# 运行 AI 引擎测试 (121 tests)
cd packages/ai-engine && npx jest

# 运行特定模块测试
npx jest __tests__/feedback
npx jest --testPathPattern=resolver
```

## 监控

```bash
cd infra/monitoring
docker compose up -d
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3100 (admin/admin)
# AlertManager: http://localhost:9093
```

关键告警规则:
- 同步成功率 < 90%
- P99 延迟 > 60s
- 队列深度 > 500
- 待审核数 > 50

## 设计原则

- **AI 辅助，人工兜底** — AI 负责分析和生成，人工负责审核确认
- **渐进式信任** — 根据历史准确率动态调整审核粒度，高置信度改动可自动确认
- **最小侵入** — 不改变现有开发工作流，通过 Git Hook / CLI / IDE 插件无缝接入
- **可回滚安全** — 所有同步操作生成独立 Git 分支和 PR

## 实施路线

| 阶段 | 目标 | 关键指标 |
|------|------|----------|
| Phase 0: 验证期 | CLI 工具可用 | Bug Fix 同步准确率 > 80% |
| Phase 1: 核心功能 | AST + 向量 + 多文件同步 | 多文件准确率 > 70%，3+ 语言 |
| Phase 2: 产品化 | Web + API + 审核流程 | 5+ 人团队日常使用 |
| Phase 3: 智能化 | 自动确认 + 知识图谱 | 准确率 > 90%，自动确认 > 50% |

## License

Private
