# API 设计文档

> 版本: 1.0 | 最后更新: 2026-02-26

## 概述

AI Project Sync 提供 RESTful API 和 WebSocket 实时通知。

**Base URL**: `https://api.ai-project-sync.com/api/v1`

**认证方式**: Bearer Token (JWT)

---

## 项目组管理

### 创建项目组

```http
POST /api/v1/project-groups
```

**Request Body**:
```json
{
  "name": "客户项目组 A",
  "description": "为客户 A 定制的项目变体组",
  "baseProject": {
    "name": "base-project",
    "gitUrl": "https://github.com/org/base-project.git",
    "defaultBranch": "main"
  },
  "syncStrategy": {
    "mode": "semi-automatic",
    "confidenceThreshold": 0.85
  }
}
```

**Response**:
```json
{
  "id": "pg_abc123",
  "name": "客户项目组 A",
  "baseProject": {
    "id": "proj_base123",
    "name": "base-project",
    "gitUrl": "https://github.com/org/base-project.git"
  },
  "variants": [],
  "syncStrategy": {
    "mode": "semi-automatic",
    "confidenceThreshold": 0.85
  },
  "createdAt": "2026-02-26T10:00:00Z"
}
```

### 添加变体项目

```http
POST /api/v1/project-groups/:id/variants
```

**Request Body**:
```json
{
  "name": "client-alpha",
  "gitUrl": "https://github.com/org/client-alpha.git",
  "defaultBranch": "main",
  "customizationNotes": "客户 A 定制版本，包含品牌定制",
  "excludedPaths": ["src/branding/*", "src/config/client.ts"]
}
```

**Response**:
```json
{
  "id": "var_xyz789",
  "projectId": "proj_variant123",
  "name": "client-alpha",
  "status": "indexing",
  "diffRegions": [],
  "syncConfig": {
    "autoSync": false,
    "excludedPaths": ["src/branding/*", "src/config/client.ts"]
  },
  "createdAt": "2026-02-26T10:05:00Z"
}
```

### 获取代码映射关系

```http
GET /api/v1/project-groups/:id/mapping
```

**Query Parameters**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `variantId` | string | 可选，指定变体项目 ID |
| `path` | string | 可选，过滤指定路径 |

**Response**:
```json
{
  "projectGroupId": "pg_abc123",
  "mappings": [
    {
      "baseFile": "src/api/users.ts",
      "functionName": "fetchUserList",
      "variants": [
        {
          "variantId": "var_xyz789",
          "variantFile": "src/api/users.ts",
          "functionName": "fetchUserList",
          "matchConfidence": 0.98,
          "structuralMatch": true
        },
        {
          "variantId": "var_abc456",
          "variantFile": "src/services/user.service.ts",
          "functionName": "getUserList",
          "matchConfidence": 0.87,
          "structuralMatch": false,
          "notes": "函数名不同，但逻辑相似"
        }
      ]
    }
  ],
  "unmappedBaseFiles": ["src/legacy/old-api.ts"],
  "unmappedVariantFiles": {
    "var_xyz789": ["src/branding/theme.ts"]
  }
}
```

---

## 同步操作

### 分析同步可能性

```http
POST /api/v1/sync/analyze
```

**Request Body**:
```json
{
  "projectGroupId": "pg_abc123",
  "commitHash": "a1b2c3d",
  "targetVariants": ["var_xyz789", "var_abc456"]
}
```

**Response**:
```json
{
  "syncId": "sync_abc123",
  "baseCommit": "a1b2c3d",
  "changeSummary": "修复用户列表分页 Bug",
  "changeType": "bug_fix",
  "affectedFiles": [
    {
      "path": "src/api/users.ts",
      "changeType": "modified",
      "linesAdded": 5,
      "linesRemoved": 2
    }
  ],
  "variants": [
    {
      "projectId": "var_xyz789",
      "projectName": "client-alpha",
      "status": "ready",
      "confidence": 0.96,
      "affectedFiles": ["src/api/users.ts"],
      "riskLevel": "low",
      "estimatedComplexity": "simple"
    },
    {
      "projectId": "var_abc456",
      "projectName": "client-beta",
      "status": "needs_review",
      "confidence": 0.72,
      "affectedFiles": ["src/services/user.service.ts"],
      "riskLevel": "medium",
      "warnings": ["函数签名有差异，需确认参数映射"],
      "estimatedComplexity": "moderate"
    }
  ],
  "createdAt": "2026-02-26T11:00:00Z"
}
```

### 生成同步补丁

```http
POST /api/v1/sync/generate
```

**Request Body**:
```json
{
  "syncId": "sync_abc123",
  "variantIds": ["var_xyz789", "var_abc456"],
  "options": {
    "includeExplanation": true,
    "maxTokens": 4000
  }
}
```

**Response**:
```json
{
  "syncId": "sync_abc123",
  "generatedAt": "2026-02-26T11:05:00Z",
  "patches": [
    {
      "variantId": "var_xyz789",
      "status": "generated",
      "confidence": 0.96,
      "patch": "--- a/src/api/users.ts\n+++ b/src/api/users.ts\n@@ -10,7 +10,10 @@",
      "explanation": "直接应用原始修复，无需适配",
      "risks": [],
      "reviewRequired": false
    },
    {
      "variantId": "var_abc456",
      "status": "generated",
      "confidence": 0.72,
      "patch": "--- a/src/services/user.service.ts\n+++ b/src/services/user.service.ts\n@@ -25,7 +25,12 @@",
      "explanation": "适配函数签名差异，将 page/size 参数映射为 offset/limit",
      "risks": ["参数映射可能需要验证"],
      "reviewRequired": true
    }
  ]
}
```

### 执行同步操作

```http
POST /api/v1/sync/execute
```

**Request Body**:
```json
{
  "syncId": "sync_abc123",
  "approvedVariants": ["var_xyz789"],
  "branchPrefix": "sync/fix-user-pagination",
  "autoMerge": false,
  "createPr": true
}
```

**Response**:
```json
{
  "syncId": "sync_abc123",
  "status": "executing",
  "executedAt": "2026-02-26T11:10:00Z",
  "results": [
    {
      "variantId": "var_xyz789",
      "status": "success",
      "branch": "sync/fix-user-pagination-sync_abc123",
      "pullRequest": {
        "url": "https://github.com/org/client-alpha/pull/42",
        "number": 42
      }
    }
  ]
}
```

### 查询同步状态

```http
GET /api/v1/sync/:id/status
```

**Response**:
```json
{
  "syncId": "sync_abc123",
  "status": "completed",
  "progress": {
    "total": 2,
    "completed": 2,
    "failed": 0,
    "pending": 0
  },
  "variants": [
    {
      "variantId": "var_xyz789",
      "status": "merged",
      "mergedAt": "2026-02-26T12:00:00Z",
      "commitHash": "e4f5g6h"
    },
    {
      "variantId": "var_abc456",
      "status": "pending_review",
      "reviewId": "rev_def456"
    }
  ]
}
```

---

## 审核管理

### 获取待审核列表

```http
GET /api/v1/reviews/pending
```

**Query Parameters**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `projectGroupId` | string | 可选，过滤项目组 |
| `minConfidence` | number | 可选，最小置信度过滤 |
| `limit` | number | 可选，返回数量限制 |

**Response**:
```json
{
  "reviews": [
    {
      "id": "rev_def456",
      "syncId": "sync_abc123",
      "variantId": "var_abc456",
      "variantName": "client-beta",
      "confidence": 0.72,
      "riskLevel": "medium",
      "changeSummary": "修复用户列表分页 Bug",
      "affectedFiles": ["src/services/user.service.ts"],
      "warnings": ["函数签名有差异，需确认参数映射"],
      "createdAt": "2026-02-26T11:05:00Z",
      "expiresAt": "2026-03-05T11:05:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

### 获取审核详情

```http
GET /api/v1/reviews/:id
```

**Response**:
```json
{
  "id": "rev_def456",
  "syncId": "sync_abc123",
  "variant": {
    "id": "var_abc456",
    "name": "client-beta",
    "gitUrl": "https://github.com/org/client-beta.git"
  },
  "baseChange": {
    "commitHash": "a1b2c3d",
    "commitMessage": "fix: 修复用户列表分页 Bug",
    "author": "developer@example.com",
    "files": [
      {
        "path": "src/api/users.ts",
        "diff": "--- a/src/api/users.ts\n+++ b/src/api/users.ts\n..."
      }
    ]
  },
  "adaptedChange": {
    "confidence": 0.72,
    "files": [
      {
        "path": "src/services/user.service.ts",
        "diff": "--- a/src/services/user.service.ts\n+++ b/src/services/user.service.ts\n...",
        "explanation": "适配函数签名差异..."
      }
    ],
    "risks": ["参数映射可能需要验证"],
    "explanation": "根据 client-beta 的代码结构，将修复适配到 user.service.ts..."
  },
  "context": {
    "originalFunction": "function fetchUserList(page, size) { ... }",
    "adaptedFunction": "function getUserList(offset, limit) { ... }"
  }
}
```

### 批准改动

```http
POST /api/v1/reviews/:id/approve
```

**Request Body**:
```json
{
  "feedback": "确认适配正确",
  "applyImmediately": true
}
```

**Response**:
```json
{
  "reviewId": "rev_def456",
  "status": "approved",
  "approvedAt": "2026-02-26T14:00:00Z",
  "syncResult": {
    "branch": "sync/fix-user-pagination-sync_abc123",
    "pullRequest": {
      "url": "https://github.com/org/client-beta/pull/15",
      "number": 15
    }
  }
}
```

### 拒绝改动

```http
POST /api/v1/reviews/:id/reject
```

**Request Body**:
```json
{
  "reason": "参数映射不正确",
  "details": "offset 应该是 (page - 1) * size 而不是 page * size",
  "requestRegeneration": true
}
```

**Response**:
```json
{
  "reviewId": "rev_def456",
  "status": "rejected",
  "rejectedAt": "2026-02-26T14:00:00Z",
  "feedbackRecorded": true,
  "regenerationQueued": true
}
```

### 批量批准

```http
POST /api/v1/reviews/batch-approve
```

**Request Body**:
```json
{
  "projectGroupId": "pg_abc123",
  "minConfidence": 0.90,
  "excludeReviewIds": ["rev_special_case"]
}
```

**Response**:
```json
{
  "approved": 5,
  "skipped": 2,
  "results": [
    { "reviewId": "rev_001", "status": "approved" },
    { "reviewId": "rev_002", "status": "approved" }
  ]
}
```

---

## WebSocket 实时通知

### 连接

```
wss://api.ai-project-sync.com/ws/sync-events
```

**认证**: 在连接时通过 query parameter 或 header 传递 token

### 事件类型

| 事件 | 描述 | Payload |
|------|------|---------|
| `sync:started` | 同步任务开始 | `{ syncId, projectGroupId }` |
| `sync:progress` | 同步进度更新 | `{ syncId, variantId, progress }` |
| `sync:completed` | 同步任务完成 | `{ syncId, results }` |
| `sync:failed` | 同步任务失败 | `{ syncId, error }` |
| `review:pending` | 新的待审核 | `{ reviewId, variantId }` |
| `review:approved` | 审核已批准 | `{ reviewId, approvedBy }` |

### 示例

```javascript
const ws = new WebSocket('wss://api.ai-project-sync.com/ws/sync-events?token=xxx');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'sync:progress':
      console.log(`Sync ${data.syncId}: ${data.progress}%`);
      break;
    case 'review:pending':
      console.log(`New review pending: ${data.reviewId}`);
      break;
  }
};
```

---

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "error": {
    "code": "VARIANT_NOT_FOUND",
    "message": "Variant project not found",
    "details": {
      "variantId": "var_nonexistent"
    }
  },
  "requestId": "req_abc123"
}
```

### 常见错误码

| HTTP 状态码 | 错误码 | 描述 |
|-------------|--------|------|
| 400 | `INVALID_REQUEST` | 请求参数无效 |
| 401 | `UNAUTHORIZED` | 认证失败 |
| 403 | `FORBIDDEN` | 无权限访问 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突（如同名项目组） |
| 422 | `UNPROCESSABLE_ENTITY` | 语义错误（如 Git 仓库无法访问） |
| 429 | `RATE_LIMITED` | 请求频率超限 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
| 503 | `SERVICE_UNAVAILABLE` | AI 服务暂不可用 |

---

## 速率限制

| 端点类型 | 限制 | 窗口 |
|----------|------|------|
| 普通 API | 100 次 | 1 分钟 |
| 同步操作 | 10 次 | 1 分钟 |
| AI 生成 | 30 次 | 1 小时 |

响应头包含限制信息：
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708953600
```
