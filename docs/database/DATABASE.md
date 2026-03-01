# 数据库设计文档

> 版本: 1.0 | 最后更新: 2026-02-26

## 概述

AI Project Sync 使用 PostgreSQL 作为主数据库，Redis 作为缓存和任务队列，Qdrant 作为向量数据库。

---

## 实体关系图

```
┌───────────────────┐       ┌───────────────────┐
│   project_groups  │       │     projects      │
├───────────────────┤       ├───────────────────┤
│ id (PK)           │       │ id (PK)           │
│ name              │───────│ project_group_id  │
│ description       │   1:N │ name              │
│ sync_strategy     │       │ git_url           │
│ created_at        │       │ type (base/variant)│
│ updated_at        │       │ created_at        │
└───────────────────┘       └─────────┬─────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │   diff_regions   │ │   code_mappings  │ │   sync_tasks     │
         ├──────────────────┤ ├──────────────────┤ ├──────────────────┤
         │ id (PK)          │ │ id (PK)          │ │ id (PK)          │
         │ project_id (FK)  │ │ base_project_id  │ │ project_group_id │
         │ path_pattern     │ │ variant_project_id│ │ base_commit_hash │
         │ region_type      │ │ base_file_path   │ │ status           │
         │ description      │ │ variant_file_path│ │ created_at       │
         │ created_at       │ │ match_confidence │ │ completed_at     │
         └──────────────────┘ │ created_at       │ └────────┬─────────┘
                              └──────────────────┘          │
                                                            │
                              ┌─────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────┐       ┌──────────────────┐
                   │  sync_results    │       │     reviews      │
                   ├──────────────────┤       ├──────────────────┤
                   │ id (PK)          │       │ id (PK)          │
                   │ sync_task_id (FK)│───────│ sync_result_id   │
                   │ variant_id (FK)  │   1:1 │ reviewer_id      │
                   │ status           │       │ status           │
                   │ branch_name      │       │ feedback         │
                   │ pr_url           │       │ created_at       │
                   │ confidence       │       │ reviewed_at      │
                   │ patch_content    │       └──────────────────┘
                   │ created_at       │
                   └──────────────────┘
```

---

## 表结构设计

### 1. project_groups (项目组)

```sql
CREATE TABLE project_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sync_strategy JSONB NOT NULL DEFAULT '{
        "mode": "semi-automatic",
        "confidenceThreshold": 0.85,
        "autoMerge": false
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_project_groups_name UNIQUE (name)
);

-- 索引
CREATE INDEX idx_project_groups_created_at ON project_groups(created_at);

-- 注释
COMMENT ON TABLE project_groups IS '项目组：包含一个基础项目和多个变体项目';
COMMENT ON COLUMN project_groups.sync_strategy IS '同步策略配置：mode(自动/半自动/手动)、confidenceThreshold、autoMerge';
```

### 2. projects (项目)

```sql
CREATE TYPE project_type AS ENUM ('base', 'variant');

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_group_id UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    git_url VARCHAR(500) NOT NULL,
    git_branch VARCHAR(255) NOT NULL DEFAULT 'main',
    type project_type NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    code_fingerprint TEXT,
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_projects_git_url UNIQUE (git_url)
);

-- 索引
CREATE INDEX idx_projects_project_group_id ON projects(project_group_id);
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_status ON projects(status);

-- 注释
COMMENT ON TABLE projects IS '项目：基础项目或变体项目';
COMMENT ON COLUMN projects.code_fingerprint IS '代码结构指纹，用于快速匹配';
COMMENT ON COLUMN projects.metadata IS '项目元数据：定制说明、排除路径等';
```

### 3. diff_regions (差异区域)

```sql
CREATE TYPE diff_region_type AS ENUM ('excluded', 'customized', 'auto_detected');

CREATE TABLE diff_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path_pattern VARCHAR(500) NOT NULL,
    region_type diff_region_type NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_diff_regions_project_id ON diff_regions(project_id);
CREATE INDEX idx_diff_regions_region_type ON diff_regions(region_type);

-- 注释
COMMENT ON TABLE diff_regions IS '差异区域：变体项目与基础项目的差异标注';
COMMENT ON COLUMN diff_regions.path_pattern IS '路径模式，支持 glob 语法';
```

### 4. code_mappings (代码映射)

```sql
CREATE TABLE code_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_group_id UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
    base_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    variant_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    base_file_path VARCHAR(500) NOT NULL,
    base_function_name VARCHAR(255),
    variant_file_path VARCHAR(500) NOT NULL,
    variant_function_name VARCHAR(255),
    match_confidence DECIMAL(5,4) NOT NULL,
    structural_match BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_code_mappings UNIQUE (
        base_project_id, variant_project_id, base_file_path, variant_file_path
    )
);

-- 索引
CREATE INDEX idx_code_mappings_project_group_id ON code_mappings(project_group_id);
CREATE INDEX idx_code_mappings_base_project_id ON code_mappings(base_project_id);
CREATE INDEX idx_code_mappings_variant_project_id ON code_mappings(variant_project_id);
CREATE INDEX idx_code_mappings_confidence ON code_mappings(match_confidence);

-- 注释
COMMENT ON TABLE code_mappings IS '代码映射：基础项目与变体项目的代码对应关系';
COMMENT ON COLUMN code_mappings.structural_match IS '是否为结构化匹配（AST 级别）';
```

### 5. sync_tasks (同步任务)

```sql
CREATE TYPE sync_status AS ENUM (
    'pending', 'analyzing', 'generating',
    'reviewing', 'executing', 'completed', 'failed', 'cancelled'
);

CREATE TABLE sync_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_group_id UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
    base_commit_hash VARCHAR(40) NOT NULL,
    base_commit_message TEXT,
    change_type VARCHAR(50) NOT NULL,
    change_summary TEXT,
    affected_files JSONB NOT NULL DEFAULT '[]'::jsonb,
    status sync_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_sync_tasks_project_group_id ON sync_tasks(project_group_id);
CREATE INDEX idx_sync_tasks_status ON sync_tasks(status);
CREATE INDEX idx_sync_tasks_created_at ON sync_tasks(created_at);

-- 注释
COMMENT ON TABLE sync_tasks IS '同步任务：一次同步操作的完整记录';
COMMENT ON COLUMN sync_tasks.change_type IS '改动类型：bug_fix, feature, refactor, etc.';
```

### 6. sync_results (同步结果)

```sql
CREATE TYPE sync_result_status AS ENUM (
    'pending', 'generated', 'reviewing',
    'approved', 'rejected', 'applied', 'merged', 'failed'
);

CREATE TABLE sync_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_task_id UUID NOT NULL REFERENCES sync_tasks(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status sync_result_status NOT NULL DEFAULT 'pending',
    confidence DECIMAL(5,4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
    patch_content TEXT,
    adapted_files JSONB NOT NULL DEFAULT '[]'::jsonb,
    explanation TEXT,
    warnings JSONB DEFAULT '[]'::jsonb,
    branch_name VARCHAR(255),
    pr_url VARCHAR(500),
    commit_hash VARCHAR(40),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_sync_results_sync_task_id ON sync_results(sync_task_id);
CREATE INDEX idx_sync_results_variant_id ON sync_results(variant_id);
CREATE INDEX idx_sync_results_status ON sync_results(status);
CREATE INDEX idx_sync_results_confidence ON sync_results(confidence);

-- 注释
COMMENT ON TABLE sync_results IS '同步结果：每个变体项目的同步结果';
COMMENT ON COLUMN sync_results.adapted_files IS '适配后的文件列表：[{path, diff, explanation}]';
```

### 7. reviews (审核记录)

```sql
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE review_decision AS ENUM ('approve', 'reject', 'modify');

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_result_id UUID NOT NULL REFERENCES sync_results(id) ON DELETE CASCADE,
    reviewer_id UUID,
    status review_status NOT NULL DEFAULT 'pending',
    decision review_decision,
    feedback TEXT,
    modifications JSONB,
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_review_decision CHECK (
        (status = 'pending') OR
        (status IN ('approved', 'rejected') AND decision IS NOT NULL)
    )
);

-- 索引
CREATE INDEX idx_reviews_sync_result_id ON reviews(sync_result_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_expires_at ON reviews(expires_at) WHERE status = 'pending';

-- 注释
COMMENT ON TABLE reviews IS '审核记录：人工审核同步改动的记录';
COMMENT ON COLUMN reviews.modifications IS '用户修改的内容：{filePath, originalContent, modifiedContent}';
```

### 8. feedback_history (反馈历史)

```sql
CREATE TABLE feedback_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_result_id UUID NOT NULL REFERENCES sync_results(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
    feedback_type VARCHAR(50) NOT NULL,
    original_patch TEXT NOT NULL,
    corrected_patch TEXT,
    confidence_score DECIMAL(5,4),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_feedback_history_sync_result_id ON feedback_history(sync_result_id);
CREATE INDEX idx_feedback_history_feedback_type ON feedback_history(feedback_type);
CREATE INDEX idx_feedback_history_created_at ON feedback_history(created_at);

-- 注释
COMMENT ON TABLE feedback_history IS '反馈历史：用于 AI 模型优化的反馈数据';
COMMENT ON COLUMN feedback_history.feedback_type IS '反馈类型：accept, reject, modify';
```

### 9. users (用户)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    CONSTRAINT uk_users_email UNIQUE (email)
);

-- 索引
CREATE INDEX idx_users_email ON users(email);

-- 注释
COMMENT ON TABLE users IS '用户：系统用户信息';
```

### 10. audit_logs (审计日志)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 分区（按月）
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 注释
COMMENT ON TABLE audit_logs IS '审计日志：记录所有关键操作';
```

---

## 向量数据库设计 (Qdrant)

### Collection: code_embeddings

```json
{
  "collection_name": "code_embeddings",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "project_id": "keyword",
    "file_path": "keyword",
    "function_name": "keyword",
    "function_type": "keyword",
    "language": "keyword",
    "code_hash": "keyword",
    "start_line": "integer",
    "end_line": "integer",
    "created_at": "integer"
  }
}
```

### 索引策略

```json
{
  "indexes": {
    "project_id": { "type": "keyword" },
    "file_path": { "type": "keyword" },
    "function_name": { "type": "text" },
    "language": { "type": "keyword" }
  }
}
```

---

## Redis 数据结构

### 任务队列

```redis
# BullMQ 队列
bull:sync:analyze:wait     # 待分析任务
bull:sync:analyze:active   # 执行中任务
bull:sync:analyze:completed # 已完成任务
bull:sync:analyze:failed   # 失败任务

bull:sync:generate:wait    # 待生成任务
bull:sync:execute:wait     # 待执行任务
```

### 缓存

```redis
# 项目组缓存
cache:project_group:{id} -> JSON (TTL: 1h)

# 代码映射缓存
cache:code_mapping:{project_group_id} -> JSON (TTL: 30m)

# 用户会话
session:{session_id} -> JSON (TTL: 7d)

# 实时状态
sync:status:{sync_id} -> JSON (TTL: 24h)
```

### 计数器

```redis
# 统计计数器
counter:sync:total:{date}      # 当日同步总数
counter:sync:success:{date}    # 当日成功数
counter:review:pending:{date}  # 当日待审核数
```

---

## 迁移脚本示例

### 初始化迁移

```sql
-- migrations/001_initial_schema.sql
BEGIN;

-- 创建枚举类型
CREATE TYPE project_type AS ENUM ('base', 'variant');
CREATE TYPE diff_region_type AS ENUM ('excluded', 'customized', 'auto_detected');
CREATE TYPE sync_status AS ENUM ('pending', 'analyzing', 'generating', 'reviewing', 'executing', 'completed', 'failed', 'cancelled');
CREATE TYPE sync_result_status AS ENUM ('pending', 'generated', 'reviewing', 'approved', 'rejected', 'applied', 'merged', 'failed');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE review_decision AS ENUM ('approve', 'reject', 'modify');

-- 创建表（按依赖顺序）
CREATE TABLE project_groups (...);
CREATE TABLE projects (...);
CREATE TABLE diff_regions (...);
CREATE TABLE code_mappings (...);
CREATE TABLE sync_tasks (...);
CREATE TABLE sync_results (...);
CREATE TABLE reviews (...);
CREATE TABLE feedback_history (...);
CREATE TABLE users (...);
CREATE TABLE audit_logs (...) PARTITION BY RANGE (created_at);

-- 创建索引
-- (见上文各表索引定义)

COMMIT;
```

### 添加索引迁移

```sql
-- migrations/002_add_performance_indexes.sql
BEGIN;

-- 优化常用查询
CREATE INDEX CONCURRENTLY idx_sync_tasks_status_created
    ON sync_tasks(status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_reviews_pending
    ON reviews(expires_at)
    WHERE status = 'pending';

CREATE INDEX CONCURRENTLY idx_sync_results_variant_status
    ON sync_results(variant_id, status);

COMMIT;
```

---

## 查询示例

### 获取项目组概览

```sql
SELECT
    pg.id,
    pg.name,
    pg.sync_strategy->>'mode' as sync_mode,
    COUNT(CASE WHEN p.type = 'variant' THEN 1 END) as variant_count,
    COUNT(CASE WHEN p.type = 'variant' AND p.status = 'active' THEN 1 END) as active_variant_count,
    (
        SELECT COUNT(*)
        FROM sync_tasks st
        WHERE st.project_group_id = pg.id
        AND st.status = 'completed'
    ) as completed_syncs,
    (
        SELECT COUNT(*)
        FROM reviews r
        JOIN sync_results sr ON r.sync_result_id = sr.id
        JOIN sync_tasks st ON sr.sync_task_id = st.id
        WHERE st.project_group_id = pg.id
        AND r.status = 'pending'
    ) as pending_reviews
FROM project_groups pg
LEFT JOIN projects p ON p.project_group_id = pg.id
GROUP BY pg.id
ORDER BY pg.created_at DESC;
```

### 获取待审核列表

```sql
SELECT
    r.id as review_id,
    r.status as review_status,
    sr.confidence,
    sr.risk_level,
    sr.explanation,
    sr.warnings,
    st.change_summary,
    st.change_type,
    p.name as variant_name,
    pg.name as project_group_name,
    r.created_at,
    r.expires_at
FROM reviews r
JOIN sync_results sr ON r.sync_result_id = sr.id
JOIN sync_tasks st ON sr.sync_task_id = st.id
JOIN projects p ON sr.variant_id = p.id
JOIN project_groups pg ON st.project_group_id = pg.id
WHERE r.status = 'pending'
ORDER BY sr.confidence ASC, r.created_at ASC
LIMIT 20;
```

### 统计同步成功率

```sql
SELECT
    DATE_TRUNC('day', st.created_at) as date,
    COUNT(*) as total_syncs,
    COUNT(CASE WHEN sr.status IN ('applied', 'merged') THEN 1 END) as successful_syncs,
    ROUND(
        COUNT(CASE WHEN sr.status IN ('applied', 'merged') THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0) * 100,
        2
    ) as success_rate
FROM sync_tasks st
JOIN sync_results sr ON sr.sync_task_id = st.id
WHERE st.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', st.created_at)
ORDER BY date DESC;
```
