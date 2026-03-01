# AI Project Sync - 使用指南

本文档详细说明如何使用 AI Project Sync 进行代码同步。

## 目录

- [安装配置](#安装配置)
- [CLI 使用](#cli-使用)
- [Web Dashboard](#web-dashboard)
- [VS Code 插件](#vs-code-插件)
- [API 使用](#api-使用)
- [配置参考](#配置参考)
- [最佳实践](#最佳实践)

---

## 安装配置

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20.0.0 | LTS 版本推荐 |
| pnpm | >= 8.15.0 | 包管理器 |
| PostgreSQL | >= 14 | 数据库 |
| Redis | >= 6 | 缓存/队列 |

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/jiangchengweij/ai-sync-architecture.git
cd ai-sync-architecture

# 2. 安装依赖
pnpm install

# 3. 构建项目
npm run build

# 4. 配置环境变量
cp packages/api/.env.example packages/api/.env
# 编辑 .env 文件，填入必要配置
```

### 环境变量配置

```bash
# packages/api/.env

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/ai_sync

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Claude API (AI 引擎)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# 可选: 向量数据库
PINECONE_API_KEY=xxxxx
PINECONE_ENVIRONMENT=us-west1
```

### 数据库初始化

```bash
cd packages/api

# 运行迁移
pnpm migration:dev

# 填充初始数据
pnpm seed
```

---

## CLI 使用

### 安装 CLI

```bash
# 全局安装
npm install -g @ai-sync/cli

# 或使用 npx (无需安装)
npx @ai-sync-cli <command>
```

### 基本命令

#### 1. 初始化项目组

```bash
# 创建新的项目组
ai-sync init --name "我的项目组" --base /path/to/base-project

# 输出示例:
# ✓ 项目组创建成功
#   ID: proj_abc123
#   Base: /path/to/base-project
```

#### 2. 添加变体项目

```bash
# 添加变体项目到项目组
ai-sync variant add \
  --group proj_abc123 \
  --name "客户A定制版" \
  --path /path/to/variant-a \
  --remote git@github.com:org/variant-a.git

ai-sync variant add \
  --group proj_abc123 \
  --name "客户B定制版" \
  --path /path/to/variant-b \
  --remote git@github.com:org/variant-b.git
```

#### 3. 执行同步

```bash
# 同步单个 commit
ai-sync sync \
  --group proj_abc123 \
  --commit abc1234 \
  --variant variant-a

# 同步多个 commits (范围)
ai-sync sync \
  --group proj_abc123 \
  --from-commit abc1234 \
  --to-commit def5678 \
  --all-variants

# 同步特定文件
ai-sync sync \
  --group proj_abc123 \
  --commit abc1234 \
  --files "src/utils/*.ts,src/services/auth.ts"
```

#### 4. 审核同步结果

```bash
# 查看待审核列表
ai-sync review list --group proj_abc123

# 预览同步差异
ai-sync review preview --sync-id sync_xyz789

# 批准同步
ai-sync review approve --sync-id sync_xyz789

# 拒绝同步 (带原因)
ai-sync review reject --sync-id sync_xyz789 --reason "定制化差异过大"
```

#### 5. 查看状态

```bash
# 查看项目组状态
ai-sync status --group proj_abc123

# 查看同步历史
ai-sync history --group proj_abc123 --limit 20

# 查看冲突报告
ai-sync conflicts --group proj_abc123
```

### CLI 选项参考

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--dry-run` | 仅模拟，不执行实际同步 | `false` |
| `--auto-approve` | 高置信度时自动批准 | `false` |
| `--confidence-threshold` | 自动批准的置信度阈值 | `0.9` |
| `--output` | 输出格式 (json/table) | `table` |
| `--verbose` | 详细日志 | `false` |

---

## Web Dashboard

### 启动 Web 服务

```bash
cd packages/web
pnpm dev
# 访问 http://localhost:8080
```

### 主要功能

#### 1. 项目组管理

- 创建/编辑/删除项目组
- 配置 Base 项目和变体项目
- 查看 Git 仓库连接状态

#### 2. 同步监控

- 实时同步进度
- 成功/失败统计
- 冲突警告提示

#### 3. 审核队列

- 待审核同步列表
- 差异对比视图 (类似 Git diff)
- 批量审核操作

#### 4. 历史记录

- 同步历史时间线
- 筛选和搜索
- 导出报告

---

## VS Code 插件

### 安装

1. 在 VS Code 扩展市场搜索 "AI Project Sync"
2. 或手动安装 `.vsix` 文件:
   ```bash
   cd packages/vscode-extension
   pnpm package
   code --install-extension ai-sync-*.vsix
   ```

### 配置

在 VS Code 设置中配置:

```json
{
  "aiSync.apiUrl": "http://localhost:3000",
  "aiSync.autoSync": false,
  "aiSync.showNotifications": true
}
```

### 功能

- **状态栏**: 显示当前项目组同步状态
- **右键菜单**: 快速同步选中的代码变更
- **差异预览**: 内联显示同步差异
- **快捷键**:
  - `Cmd+Shift+S`: 同步当前文件
  - `Cmd+Shift+R`: 打开审核面板

---

## API 使用

### 认证

```bash
# 登录获取 JWT
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# 响应
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "email": "admin@example.com" }
}

# 后续请求携带 Token
curl http://localhost:3000/api/v1/project-groups \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 同步 API 示例

#### 1. 创建项目组

```bash
POST /api/v1/project-groups
{
  "name": "电商平台",
  "description": "电商基础平台及定制版本",
  "basePath": "/projects/ecommerce-base",
  "baseRemote": "git@github.com:org/ecommerce-base.git"
}
```

#### 2. 添加变体

```bash
POST /api/v1/project-groups/:id/variants
{
  "name": "客户A定制版",
  "path": "/projects/ecommerce-client-a",
  "remote": "git@github.com:org/ecommerce-client-a.git",
  "branch": "main"
}
```

#### 3. 分析同步

```bash
POST /api/v1/sync/analyze
{
  "projectGroupId": "proj_abc123",
  "commitSha": "abc1234",
  "variantIds": ["var_1", "var_2"]
}

# 响应
{
  "analysisId": "ana_xyz789",
  "files": [
    {
      "path": "src/services/payment.ts",
      "changeType": "modified",
      "confidence": 0.95,
      "mappingStrategy": "exact-name"
    }
  ],
  "estimatedTime": "2m"
}
```

#### 4. 生成同步

```bash
POST /api/v1/sync/generate
{
  "analysisId": "ana_xyz789"
}

# 响应
{
  "syncId": "sync_123",
  "patches": [
    {
      "variantId": "var_1",
      "file": "src/services/payment.ts",
      "patch": "--- a/src/services/payment.ts\n+++ b/src/services/payment.ts\n...",
      "confidence": 0.92
    }
  ]
}
```

#### 5. 执行同步

```bash
POST /api/v1/sync/execute
{
  "syncId": "sync_123",
  "approvedPatches": ["patch_1", "patch_2"]
}
```

---

## 配置参考

### 项目组配置文件

在 Base 项目根目录创建 `.ai-sync.yml`:

```yaml
# .ai-sync.yml
version: 1

# 同步配置
sync:
  # 自动同步的分支
  autoSyncBranches:
    - main
    - release/*

  # 忽略的文件/目录
  ignore:
    - "node_modules/**"
    - "*.test.ts"
    - "docs/**"

  # 定制化保护区域 (不会被覆盖)
  protectedRegions:
    - start: "// CUSTOMIZATION START"
      end: "// CUSTOMIZATION END"

# 映射策略配置
mapping:
  # 优先级: exact-name > fingerprint > vector
  strategies:
    - type: exact-name
      enabled: true
      confidence: 0.98
    - type: fingerprint
      enabled: true
      confidence: 0.85
    - type: vector
      enabled: true
      confidence: 0.70

  # 代码指纹配置
  fingerprint:
    includeComments: false
    includeWhitespace: false

# 冲突解决配置
conflict:
  # 自动解决阈值
  autoResolveThreshold: 0.8

  # 导入路径映射
  importPathMappings:
    "@base/": "@client-a/"
    "@shared/utils": "@client-a/utils"

  # 函数名映射
  nameMappings:
    processOrder: handleClientAOrder

# 质量检查配置
quality:
  enabled: true
  thresholds:
    minConfidence: 0.7
    maxBreakingChanges: 0

  # 一致性权重
  weights:
    signature: 0.4
    behavior: 0.3
    dependencies: 0.3
```

### 全局配置

`~/.ai-sync/config.yml`:

```yaml
# API 端点
api:
  url: http://localhost:3000
  timeout: 30000

# 日志
logging:
  level: info
  file: ~/.ai-sync/logs/ai-sync.log

# 缓存
cache:
  enabled: true
  ttl: 3600
  directory: ~/.ai-sync/cache
```

---

## 最佳实践

### 1. 项目结构规范

**推荐**: 保持 Base 和变体项目的目录结构一致

```
base-project/           variant-a/
├── src/                ├── src/
│   ├── services/       │   ├── services/
│   ├── utils/          │   ├── utils/
│   └── models/         │   └── models/
└── tests/              └── tests/
```

**避免**: 结构差异过大

```
base-project/           variant-a/
├── src/                ├── app/
│   └── services/       │   └── modules/
```

### 2. 定制化代码保护

使用保护区域标记定制化代码:

```typescript
// src/services/order.ts

export function processOrder(order: Order) {
  // 通用订单处理逻辑
  validateOrder(order);
  
  // CUSTOMIZATION START
  // 客户A特有的折扣逻辑
  if (order.customer === 'VIP') {
    order.discount = 0.2;
  }
  // CUSTOMIZATION END
  
  return saveOrder(order);
}
```

### 3. 渐进式信任

- 初始阶段: 所有同步需人工审核
- 中期阶段: 高置信度 (>0.9) 自动批准
- 成熟阶段: 常规改动自动同步

```yaml
# .ai-sync.yml
trust:
  levels:
    - minAccuracy: 0.95
      autoApprove: true
    - minAccuracy: 0.8
      requireReview: false
    - minAccuracy: 0.0
      requireReview: true
```

### 4. 定期同步策略

建议同步频率:

| 变更类型 | 同步策略 |
|---------|---------|
| Bug Fix | 立即同步 |
| 安全补丁 | 立即同步 |
| 小功能 | 每周同步 |
| 大功能 | 计划性同步 (配合发布周期) |

### 5. 监控告警

配置告警规则:

```yaml
# infra/monitoring/alerts.yml
groups:
  - name: ai-sync
    rules:
      - alert: SyncFailureRate
        expr: sync_success_rate < 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "同步成功率低于 90%"
      
      - alert: PendingReviews
        expr: pending_reviews_count > 50
        for: 30m
        labels:
          severity: info
        annotations:
          summary: "待审核队列过长"
```

---

## 故障排除

### 常见问题

#### 1. 映射失败

**症状**: 提示 "无法在变体中找到对应代码"

**解决方案**:
- 检查文件路径是否一致
- 确认函数/类名是否被重命名
- 配置 `nameMappings` 手动映射

#### 2. 置信度过低

**症状**: 同步始终需要人工审核

**解决方案**:
- 检查代码差异是否过大
- 添加更多上下文注释
- 使用保护区域隔离定制代码

#### 3. 冲突无法自动解决

**症状**: 冲突检测失败

**解决方案**:
- 检查 `importPathMappings` 配置
- 确认依赖版本兼容性
- 手动解决后更新知识图谱

---

## 获取帮助

- **文档**: [docs.openclaw.ai/ai-sync](https://docs.openclaw.ai/ai-sync)
- **GitHub Issues**: [github.com/jiangchengweij/ai-sync-architecture/issues](https://github.com/jiangchengweij/ai-sync-architecture/issues)
- **Discord**: [discord.gg/clawd](https://discord.gg/clawd)

