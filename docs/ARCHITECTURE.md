# AI Project Sync - 技术架构设计文档

> 版本: 1.0 | 最后更新: 2026-02-26

## 目录

1. [系统定位](#系统定位)
2. [设计原则](#设计原则)
3. [核心架构](#核心架构)
4. [数据流](#数据流)
5. [模块设计](#模块设计)
6. [AI 引擎](#ai-引擎)
7. [技术选型](#技术选型)
8. [API 设计](#api-设计)
9. [部署方案](#部署方案)
10. [实施路线](#实施路线)

---

## 系统定位

**AI Project Sync** 是一款面向外包团队和多项目管理场景的 AI 辅助代码同步工具。

### 核心问题

当一个基础项目衍生出多个定制化变体项目后，如何在变更共享代码时，智能地将改动同步到所有变体项目中。

### 适用场景

| 场景 | 描述 |
|------|------|
| 外包定制 | 外包团队为不同客户定制的同源项目 |
| SaaS 私有化 | SaaS 产品的多租户私有化部署版本 |
| 白标产品 | 白标产品的多品牌变体 |
| 多地区版本 | 多地区/多语言版本的应用 |

---

## 设计原则

### 1. AI 辅助，人工兜底
AI 负责分析和生成，人工负责审核确认。任何同步操作都必须经过确认才能应用。

### 2. 渐进式信任
根据历史准确率动态调整审核粒度。高置信度改动可批量确认，低置信度需逐行审核。

### 3. 最小侵入
不要求改变现有开发工作流。通过 Git Hook、CLI、IDE 插件等方式无缝接入。

### 4. 可回滚安全
所有同步操作都生成独立的 Git 分支和 PR，出问题随时回滚。

---

## 核心架构

### 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│  客户端层 (Client Layer)                                      │
│  ┌─────────┐  ┌──────────────┐  ┌──────────┐                │
│  │ CLI 工具 │  │ Web Dashboard│  │ IDE 插件 │                │
│  └────┬────┘  └──────┬───────┘  └────┬─────┘                │
└───────┼──────────────┼───────────────┼───────────────────────┘
        │              │               │
        └──────────────┼───────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  网关层 (Gateway Layer)                                       │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    API Gateway                           ││
│  │  • 统一认证  • 限流  • 路由  • WebSocket 推送             ││
│  └──────────────────────────────────────────────────────────┘│
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│  服务层 (Service Layer)                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │ 项目管理   │ │ Diff 分析 │ │ 同步执行  │ │  审核服务  │    │
│  │  服务     │ │   服务    │ │   服务    │ │           │    │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────────┘    │
└────────┼─────────────┼─────────────┼─────────────────────────┘
         │             │             │
         └─────────────┼─────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  AI 层 (AI Layer)                                             │
│  ┌───────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │ AST 解析器 │ │   AI 引擎     │ │   代码嵌入    │          │
│  │           │ │ (LLM + Claude)│ │   (Embedding) │          │
│  └───────────┘ └───────────────┘ └───────────────┘          │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│  数据层 (Data Layer)                                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │PostgreSQL │ │   Redis   │ │  Git 仓库 │ │  向量数据库 │    │
│  │  (元数据)  │ │  (缓存)   │ │   (代码)  │ │  (嵌入)   │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 组件 | 职责 |
|------|------|------|
| **客户端层** | CLI / Web / IDE | 提供多种接入方式，覆盖不同使用偏好 |
| **网关层** | API Gateway | 统一认证、限流、路由，支持 WebSocket 推送同步状态 |
| **服务层** | 四大核心服务 | 项目管理、Diff 分析、同步执行、审核管理（解耦部署） |
| **AI 层** | LLM + AST + Embedding | 提供语义级代码理解能力 |
| **数据层** | DB + Cache + Git + Vector | PostgreSQL 存储元数据，Redis 缓存，Git 管理代码，向量库存储嵌入 |

---

## 数据流

### 核心同步流程

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 1.检测  │───▶│ 2.语义  │───▶│ 3.映射  │───▶│ 4.适配  │───▶│ 5.审核  │───▶│ 6.同步  │
│  改动   │    │  分析   │    │  定位   │    │  生成   │    │  确认   │    │  应用   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼              ▼
 Git Hook/     AST + AI       在变体项目      AI 生成       人工 Review     批量提交
  Watch        理解意图         中定位        适配代码                       到各变体
```

### 各阶段详解

| Phase | 名称 | 输入 | 输出 | 说明 |
|-------|------|------|------|------|
| 1 | 变更检测 | Git commit | diff patch, affected files | Git Hook 或文件 Watch 触发 |
| 2 | 语义分析 | diff patch | 改动类型、影响范围、适用性 | AST 解析 + AI 意图理解 |
| 3 | 映射定位 | 变体项目 | 文件 + 行号定位 | 代码嵌入向量 + AST 结构比对 |
| 4 | 适配生成 | 变体上下文 | adapted_patch, confidence | AI 根据变体上下文生成适配代码 |
| 5 | 人工审核 | adapted_patch | approve/reject | 高置信度可批量确认，低置信度逐个审核 |
| 6 | 批量提交 | 审核结果 | Git branches | 每个变体独立 sync/* 分支 |

---

## 模块设计

### 1. 项目注册中心

负责项目组管理和差异标注。

```typescript
interface ProjectGroup {
  id: string;
  baseProject: Project;
  variants: VariantProject[];
  syncStrategy: SyncStrategy;
}

interface VariantProject {
  id: string;
  projectId: string;
  diffRegions: DiffRegion[];      // 与基础项目的差异区域
  syncConfig: SyncConfig;          // 同步策略配置
  codeFingerprint: string;         // 代码结构指纹
}
```

**核心功能**：
- 项目组管理：创建项目组，关联基础项目与变体
- 差异标注：自动检测 + 手动标注差异区域
- 同步策略配置：自动/半自动/手动，按文件/目录粒度
- 项目指纹：生成并维护代码结构指纹

### 2. 智能 Diff 引擎

负责语义级代码差异分析。

```typescript
interface SemanticDiff {
  changeType: 'bug_fix' | 'feature' | 'refactor';
  affectedScope: AffectedFile[];
  conflictPrediction: ConflictRisk[];
  changeCategory: 'universal' | 'conditional' | 'exclusive';
}
```

**核心功能**：
- 语义 Diff：理解代码改动的语义意图
- 影响范围分析：分析改动影响哪些变体项目
- 冲突预测：预测可能的冲突点
- 改动分类：通用改动/条件改动/专属改动

### 3. 同步执行器

负责代码映射和适配生成。

```typescript
interface SyncExecutor {
  mapCode(diff: Diff, variant: VariantProject): CodeLocation[];
  generateAdaptation(diff: Diff, context: VariantContext): AdaptedPatch;
  executeBatch(syncTasks: SyncTask[]): Promise<SyncResult[]>;
}
```

**核心功能**：
- 代码映射：在变体项目中定位对应代码
- 适配生成：AI 生成适配后的代码改动
- 批量执行：并行处理多个变体项目
- 原子提交：独立 Git 分支提交

### 4. 审核系统

负责分级审核和反馈学习。

```typescript
interface ReviewSystem {
  getPendingReviews(): Promise<Review[]>;
  approve(reviewId: string): Promise<void>;
  reject(reviewId: string, reason: string): Promise<void>;
  batchApprove(confidenceThreshold: number): Promise<void>;
}
```

**核心功能**：
- 分级审核：根据 AI 置信度决定审核粒度
- 对比视图：原始改动 vs 适配后改动
- 批量操作：高置信度改动一键确认
- 反馈学习：审核结果持续优化 AI

### 5. 知识图谱

负责代码关系和历史学习。

```typescript
interface KnowledgeGraph {
  codeRelationGraph: CodeRelation[];
  historyPatterns: SyncPattern[];
  suggestions: SyncSuggestion[];
  anomalies: Anomaly[];
}
```

**核心功能**：
- 代码关系图：维护项目间代码对应关系
- 历史学习：从历史同步记录学习定制模式
- 智能建议：主动发现未同步改动
- 异常检测：发现不应存在的差异

---

## AI 引擎

### 架构组成

```
┌─────────────────────────────────────────────────────────────┐
│                      AI 引擎架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LLM 代码理解引擎                         │   │
│  │  • Claude API (主模型) / GPT-4                       │   │
│  │  • DeepSeek Coder (快速预筛)                         │   │
│  │  • Chain-of-Thought 多轮推理                         │   │
│  │  • 结构化 JSON 输出                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AST 结构分析器                           │   │
│  │  • Tree-sitter (多语言支持)                          │   │
│  │  • TypeScript Compiler API                           │   │
│  │  • 结构化 Diff 生成                                   │   │
│  │  • 代码指纹 + 依赖图                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              代码向量嵌入系统                         │   │
│  │  • Voyage Code / OpenAI Embeddings                   │   │
│  │  • 函数级嵌入粒度                                     │   │
│  │  • 增量更新机制                                       │   │
│  │  • 语义相似度搜索                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AI 调用链

```
Step 1 │ AST 解析 base diff → 提取 changed_functions[]
Step 2 │ 向量搜索 → 在 variant_project 中匹配 similar_functions[]
Step 3 │ AST 比对 → 确认 matched_locations[] + diff_context
Step 4 │ LLM.generate(base_diff + variant_context + history) → adapted_patch
Step 5 │ LLM.verify(adapted_patch + variant_code) → confidence_score
Step 6 │ 输出 { patch, confidence, risks, explanation }
```

### LLM Prompt 策略

采用多轮 Chain-of-Thought，将复杂任务分解为：
1. **意图理解** → 分析改动目的和类型
2. **上下文收集** → 组装相关代码和历史
3. **代码生成** → 生成适配后的 patch
4. **自检验证** → 验证生成结果的正确性

### 输出格式

```json
{
  "patch": "unified diff format",
  "confidence": 0.95,
  "change_type": "bug_fix",
  "risks": ["函数签名有差异"],
  "explanation": "修复用户列表分页 Bug，适配 client-alpha 项目..."
}
```

---

## 技术选型

### 后端核心

| 技术 | 用途 | 选型理由 |
|------|------|----------|
| Node.js / TypeScript | 运行时 | 与前端技术栈统一，AST 工具链生态好 |
| NestJS | 框架 | 企业级，模块化架构，依赖注入 |
| Bull / BullMQ | 任务队列 | 处理异步同步任务 |

### AI & 分析

| 技术 | 用途 | 选型理由 |
|------|------|----------|
| Claude API / OpenAI API | LLM | 代码理解和生成的主力模型 |
| Tree-sitter | AST 解析 | 多语言支持，WASM 版可嵌入 Node.js |
| Voyage AI / OpenAI Embeddings | 向量嵌入 | 代码专用嵌入模型 |

### 数据存储

| 技术 | 用途 | 选型理由 |
|------|------|----------|
| PostgreSQL | 关系数据库 | 项目元数据、映射关系、审核记录 |
| Redis | 缓存 | 任务队列、缓存、实时状态 |
| Qdrant / Pinecone | 向量数据库 | 代码向量存储和相似度搜索 |
| libgit2 / isomorphic-git | Git 操作 | 直接操作 Git 仓库 |

### 前端 & 客户端

| 技术 | 用途 | 选型理由 |
|------|------|----------|
| React + Vite | Web 应用 | Web Dashboard，审核界面 |
| Monaco Editor | 代码编辑 | 代码对比视图，类 VS Code 体验 |
| Commander.js / Ink | CLI | 命令行工具开发 |
| VS Code Extension API | IDE 插件 | IDE 内直接操作 |

### 基础设施

| 技术 | 用途 | 选型理由 |
|------|------|----------|
| Docker + K8s | 容器化 | 容器化部署，服务编排 |
| GitHub/GitLab Webhooks | 集成 | 集成现有 Git 平台 |
| Prometheus + Grafana | 监控 | 监控同步成功率、AI 准确率等指标 |

---

## API 设计

详见 [API 设计文档](./api/API-DESIGN.md)

### 核心 API 概览

| Method | Path | 描述 |
|--------|------|------|
| POST | `/api/v1/project-groups` | 创建项目组 |
| POST | `/api/v1/project-groups/:id/variants` | 添加变体项目 |
| GET | `/api/v1/project-groups/:id/mapping` | 获取代码映射关系 |
| POST | `/api/v1/sync/analyze` | 分析同步可能性 |
| POST | `/api/v1/sync/generate` | 生成同步补丁 |
| POST | `/api/v1/sync/execute` | 执行同步操作 |
| GET | `/api/v1/sync/:id/status` | 查询同步状态 |
| GET | `/api/v1/reviews/pending` | 获取待审核列表 |
| POST | `/api/v1/reviews/:id/approve` | 批准改动 |
| POST | `/api/v1/reviews/:id/reject` | 拒绝改动 |
| WS | `/ws/sync-events` | 实时状态推送 |

---

## 部署方案

详见 [部署方案文档](./deployment/DEPLOYMENT.md)

### 方案对比

| 方案 | 适用规模 | 最低配置 | 预估成本 |
|------|----------|----------|----------|
| 自托管 | 5-20 变体项目 | 4C8G 云服务器 | ¥200-500/月 + API 费用 |
| 云原生 | 20+ 变体项目 | K8s 集群 | 按需扩展 |
| MVP 验证 | 快速验证 | 仅需 CLI + API Key | API 费用即可 |

### MVP 快速验证方案

最小可行产品只需：
- 一个 CLI 工具（Node.js）
- 一个 Claude API Key
- Git 本地操作（无需服务端）

```
流程：CLI 读取 base commit diff → 构造 prompt → 调用 Claude → 输出 patch → 用户确认 → 应用到变体项目
```

---

## 实施路线

### Phase 0: 验证期 (2-3 周)

**目标**：验证核心价值，简单 Bug Fix 同步准确率 > 80%

**任务**：
- [ ] 搭建 CLI 原型，实现单文件级别 diff → AI 适配 → patch 生成
- [ ] 测试不同类型改动的 AI 准确率（Bug Fix / Feature / Refactor）
- [ ] 在 2-3 个真实项目组上做端到端验证
- [ ] 确定 AI 模型选择和 Prompt 策略

### Phase 1: 核心功能 (4-6 周)

**目标**：多文件改动同步准确率 > 70%，支持 3+ 语言

**任务**：
- [ ] 实现 AST 解析器，支持 TS/JS/Python
- [ ] 构建代码嵌入系统和向量搜索
- [ ] 实现多文件级别的同步和冲突处理
- [ ] 开发基础 Web 审核界面

### Phase 2: 产品化 (4-6 周)

**目标**：可供 5+ 人团队日常使用

**任务**：
- [ ] 完整的项目组管理和配置系统
- [ ] Git 平台集成（GitHub/GitLab Webhook）
- [ ] 审核工作流完善（分级审核、批量操作）
- [ ] VS Code 插件开发
- [ ] 监控和统计面板

### Phase 3: 智能化 (持续迭代)

**目标**：同步准确率 > 90%，50% 以上改动可自动确认

**任务**：
- [ ] 知识图谱构建，自动发现未同步改动
- [ ] 基于反馈数据的模型微调
- [ ] 智能冲突解决和自动分类
- [ ] 跨项目代码质量分析和一致性检查

---

## 相关文档

- [API 设计文档](./api/API-DESIGN.md)
- [部署方案文档](./deployment/DEPLOYMENT.md)
- [数据库设计](./database/DATABASE.md)
- [开发指南](./development/DEVELOPMENT.md)
