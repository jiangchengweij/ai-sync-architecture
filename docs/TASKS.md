# AI Project Sync - 任务拆解文档

> 版本: 1.0 | 最后更新: 2026-02-27
> 基于 [技术架构设计文档](./ARCHITECTURE.md) 拆解

## 概述

本文档将架构设计中的实施路线拆解为可执行的开发任务，按阶段组织，每个任务包含明确的交付物、依赖关系和验收标准。

---

## Phase 0: 验证期 (2-3 周)

**目标**: 验证核心价值，简单 Bug Fix 同步准确率 > 80%

### P0-1: CLI 脚手架搭建

- **负责模块**: `packages/cli`
- **描述**: 使用 Commander.js 搭建 CLI 基础框架，支持命令注册和参数解析
- **交付物**:
  - `packages/cli/` 目录结构
  - `ai-sync` 命令入口
  - `sync` 子命令骨架 (--base, --variant, --commit 参数)
  - 基础配置文件读取 (.ai-sync.json)
- **依赖**: 无
- **验收标准**:
  - [ ] `ai-sync --help` 正常输出
  - [ ] `ai-sync sync --base <path> --variant <path> --commit <hash>` 参数解析正确

### P0-2: Git Diff 提取模块

- **负责模块**: `packages/cli/src/services/git.ts`
- **描述**: 封装 Git 操作，提取指定 commit 的 diff 内容和受影响文件列表
- **交付物**:
  - `getCommitDiff(repoPath, commitHash)` → diff 文本
  - `getAffectedFiles(repoPath, commitHash)` → 文件路径列表
  - `getFileContent(repoPath, filePath, ref?)` → 文件内容
- **依赖**: P0-1
- **验收标准**:
  - [ ] 能正确提取单 commit 的 unified diff
  - [ ] 能列出受影响的文件路径
  - [ ] 支持读取指定 ref 的文件内容
  - [ ] 单元测试覆盖率 > 80%

### P0-3: Claude API 集成

- **负责模块**: `packages/ai-engine/src/llm/claude.ts`
- **描述**: 封装 Claude API 调用，实现 Prompt 构造和响应解析
- **交付物**:
  - `ClaudeLLM` 类实现
  - System Prompt 模板 (代码同步助手角色)
  - User Prompt 构造 (base diff + variant context + history)
  - JSON 结构化输出解析 → `{ patch, confidence, explanation, risks }`
- **依赖**: 无
- **验收标准**:
  - [ ] 能调用 Claude API 并获取结构化响应
  - [ ] 输出包含 patch / confidence / explanation / risks 四个字段
  - [ ] 异常处理：API 超时、限流、格式错误
  - [ ] Mock 测试覆盖主要场景

### P0-4: 变体项目上下文收集

- **负责模块**: `packages/cli/src/services/context.ts`
- **描述**: 根据 base diff 中涉及的文件，在变体项目中收集对应的代码上下文
- **交付物**:
  - `getVariantContext(variantDir, affectedFiles)` → 上下文文本
  - 同名文件直接读取
  - 相似文件名模糊匹配 (如 users.ts → user.service.ts)
- **依赖**: P0-2
- **验收标准**:
  - [ ] 能根据 base diff 文件路径在变体项目中定位对应文件
  - [ ] 支持同名文件和简单模糊匹配
  - [ ] 上下文长度控制在 token 限制内

### P0-5: Patch 生成与应用

- **负责模块**: `packages/cli/src/services/patch.ts`
- **描述**: 将 AI 生成的 patch 解析并应用到变体项目
- **交付物**:
  - `parsePatch(patchText)` → 结构化 patch 对象
  - `applyPatch(variantDir, patch)` → 应用结果
  - `previewPatch(patch)` → 终端彩色 diff 预览
- **依赖**: P0-3
- **验收标准**:
  - [ ] 能解析 unified diff 格式
  - [ ] 能将 patch 正确应用到目标文件
  - [ ] 应用前展示预览，用户确认后执行
  - [ ] 应用失败时给出明确错误信息

### P0-6: 端到端流程串联

- **负责模块**: `packages/cli/src/commands/sync.ts`
- **描述**: 串联 P0-2 ~ P0-5，实现完整的 CLI 同步流程
- **交付物**:
  - `ai-sync sync` 命令完整实现
  - 流程: 提取 diff → 收集上下文 → 调用 AI → 预览 patch → 用户确认 → 应用
  - 终端交互 (确认提示、进度显示)
- **依赖**: P0-2, P0-3, P0-4, P0-5
- **验收标准**:
  - [ ] 完整流程可跑通
  - [ ] 在 2-3 个真实项目组上验证
  - [ ] 简单 Bug Fix 同步准确率 > 80%

### P0-7: Prompt 策略调优

- **负责模块**: `packages/ai-engine/src/llm/prompts/`
- **描述**: 针对不同改动类型优化 Prompt，提升 AI 输出质量
- **交付物**:
  - Bug Fix 专用 Prompt 模板
  - Feature 专用 Prompt 模板
  - Refactor 专用 Prompt 模板
  - Prompt 效果评估记录
- **依赖**: P0-6
- **验收标准**:
  - [ ] Bug Fix 类型准确率 > 80%
  - [ ] Feature 类型准确率 > 60%
  - [ ] 有量化的评估数据

---

## Phase 1: 核心功能 (4-6 周)

**目标**: 多文件改动同步准确率 > 70%，支持 3+ 语言

### P1-1: AST 解析器 - TypeScript/JavaScript

- **负责模块**: `packages/ai-engine/src/ast/parser.ts`
- **描述**: 基于 Tree-sitter 实现 TS/JS 的 AST 解析，提取函数级结构信息
- **交付物**:
  - `ASTParser` 类，支持 TypeScript 和 JavaScript
  - `parseFile(content, language)` → `ParsedFunction[]`
  - `generateFingerprint(func)` → 结构指纹字符串
  - 提取信息: 函数名、参数、返回类型、起止行号、代码体
- **依赖**: 无
- **验收标准**:
  - [ ] 正确解析函数声明、箭头函数、类方法
  - [ ] 指纹对相同结构的函数生成一致结果
  - [ ] 单元测试覆盖率 > 80%

### P1-2: AST 解析器 - Python

- **负责模块**: `packages/ai-engine/src/ast/parser.ts`
- **描述**: 扩展 AST 解析器支持 Python
- **交付物**:
  - Tree-sitter Python 语法支持
  - Python 函数/类方法提取
  - Python 装饰器识别
- **依赖**: P1-1
- **验收标准**:
  - [ ] 正确解析 def / async def / class method
  - [ ] 识别装饰器信息
  - [ ] 单元测试覆盖

### P1-3: 结构化 Diff 引擎

- **负责模块**: `packages/ai-engine/src/ast/differ.ts`
- **描述**: 基于 AST 实现语义级 diff，识别函数级别的增删改
- **交付物**:
  - `generateStructuredDiff(oldContent, newContent)` → `StructuredDiff`
  - 识别: 新增函数、修改函数、删除函数、行级变更
  - 改动分类: bug_fix / feature / refactor
- **依赖**: P1-1
- **验收标准**:
  - [ ] 能区分函数级别的增删改
  - [ ] 改动分类准确率 > 70%
  - [ ] 集成测试覆盖典型场景

### P1-4: 代码嵌入系统

- **负责模块**: `packages/ai-engine/src/embedding/embedder.ts`
- **描述**: 实现函数级代码向量嵌入，支持语义相似度搜索
- **交付物**:
  - `CodeEmbedder` 类 (使用 Voyage AI 或 OpenAI Embeddings)
  - `embedFunction(code)` → `number[]`
  - `indexFunction(embedding)` → 写入 Qdrant
  - `searchSimilar(vector, projectId, limit)` → 相似函数列表
- **依赖**: 无
- **验收标准**:
  - [ ] 能生成函数级向量嵌入
  - [ ] 相似函数搜索 Top-5 命中率 > 70%
  - [ ] 支持增量索引更新

### P1-5: 代码映射引擎

- **负责模块**: `packages/ai-engine/src/mapping/`
- **描述**: 结合 AST 指纹和向量嵌入，建立 base ↔ variant 的代码映射关系
- **交付物**:
  - `CodeMapper` 类
  - `buildMapping(baseProject, variantProject)` → `CodeMapping[]`
  - 映射策略: 同名文件 → AST 指纹匹配 → 向量相似度匹配
  - 映射置信度评分
- **依赖**: P1-1, P1-4
- **验收标准**:
  - [ ] 同名同结构函数映射置信度 > 0.95
  - [ ] 重命名函数可通过向量搜索匹配
  - [ ] 映射结果可持久化到数据库

### P1-6: 多文件同步支持

- **负责模块**: `packages/cli/src/services/sync.ts`
- **描述**: 扩展同步流程支持多文件改动，处理文件间依赖
- **交付物**:
  - 多文件 diff 拆分与排序
  - 文件间依赖分析 (import/require 关系)
  - 按依赖顺序生成 patch
  - 原子性保证: 全部成功或全部回滚
- **依赖**: P1-3, P1-5, P0-6
- **验收标准**:
  - [ ] 支持跨文件改动同步
  - [ ] 依赖顺序正确
  - [ ] 部分失败时可回滚
  - [ ] 多文件同步准确率 > 70%

### P1-7: 冲突检测与处理

- **负责模块**: `packages/ai-engine/src/conflict/`
- **描述**: 检测同步过程中的潜在冲突，提供解决建议
- **交付物**:
  - `ConflictDetector` 类
  - `detectConflicts(patch, variantCode)` → `ConflictRisk[]`
  - 冲突类型: 代码冲突 / 语义冲突 / 依赖冲突
  - AI 辅助冲突解决建议
- **依赖**: P1-3
- **验收标准**:
  - [ ] 能检测直接代码冲突
  - [ ] 能识别语义级冲突 (如函数签名变更)
  - [ ] 提供可操作的解决建议

### P1-8: 基础 Web 审核界面

- **负责模块**: `packages/web`
- **描述**: 开发最小可用的 Web 审核界面，支持查看和审批同步结果
- **交付物**:
  - React + Vite 项目搭建
  - 登录页 (JWT 认证)
  - 待审核列表页
  - 审核详情页 (Monaco Editor diff 对比视图)
  - 批准/拒绝操作
- **依赖**: P2-1 (API 服务) — 可先用 Mock 数据开发
- **验收标准**:
  - [ ] 能展示待审核列表
  - [ ] diff 对比视图清晰可读
  - [ ] 批准/拒绝操作可用

---

## Phase 2: 产品化 (4-6 周)

**目标**: 可供 5+ 人团队日常使用

### P2-1: NestJS 后端服务搭建

- **负责模块**: `packages/api`
- **描述**: 搭建 NestJS 后端服务，实现核心 API 端点
- **交付物**:
  - NestJS 项目结构 (模块化架构)
  - 数据库连接 (Prisma ORM + PostgreSQL)
  - JWT 认证中间件
  - 全局异常过滤器、请求日志拦截器
  - 健康检查端点 `/health`
- **依赖**: 无
- **验收标准**:
  - [ ] 服务可启动，健康检查通过
  - [ ] JWT 认证流程完整
  - [ ] 统一错误响应格式

### P2-2: 数据库 Schema 与迁移

- **负责模块**: `packages/api/prisma/`
- **描述**: 根据数据库设计文档实现完整的 Prisma Schema 和迁移脚本
- **交付物**:
  - Prisma Schema 定义 (10 张表)
  - 初始迁移脚本 `001_initial_schema`
  - 性能索引迁移 `002_add_performance_indexes`
  - Seed 脚本 (开发测试数据)
- **依赖**: P2-1
- **验收标准**:
  - [ ] 所有表结构与 DATABASE.md 一致
  - [ ] 迁移可正向执行和回滚
  - [ ] Seed 数据可正常插入
  - [ ] 枚举类型、约束、索引完整

### P2-3: 项目组管理 API

- **负责模块**: `packages/api/src/modules/project-group/`
- **描述**: 实现项目组 CRUD 和变体项目管理 API
- **交付物**:
  - `POST /api/v1/project-groups` — 创建项目组
  - `GET /api/v1/project-groups` — 列表查询 (分页)
  - `GET /api/v1/project-groups/:id` — 详情 (含变体统计)
  - `POST /api/v1/project-groups/:id/variants` — 添加变体
  - `GET /api/v1/project-groups/:id/mapping` — 代码映射关系
  - DTO 校验、Swagger 文档
- **依赖**: P2-1, P2-2
- **验收标准**:
  - [ ] 所有端点符合 API-DESIGN.md 规范
  - [ ] 输入校验完整
  - [ ] 集成测试覆盖 CRUD 流程

### P2-4: 同步操作 API

- **负责模块**: `packages/api/src/modules/sync/`
- **描述**: 实现同步分析、生成、执行的 API 端点
- **交付物**:
  - `POST /api/v1/sync/analyze` — 分析同步可能性
  - `POST /api/v1/sync/generate` — 生成同步补丁
  - `POST /api/v1/sync/execute` — 执行同步操作
  - `GET /api/v1/sync/:id/status` — 查询同步状态
- **依赖**: P2-3, P1-5, P1-6
- **验收标准**:
  - [ ] 分析接口返回各变体的置信度和风险等级
  - [ ] 生成接口调用 AI 引擎并返回 patch
  - [ ] 执行接口创建 Git 分支和 PR
  - [ ] 状态查询实时反映任务进度

### P2-5: BullMQ 任务队列

- **负责模块**: `packages/worker`
- **描述**: 实现异步任务处理，将同步流程拆分为多阶段队列任务
- **交付物**:
  - `analyze.processor.ts` — 分析阶段处理器
  - `generate.processor.ts` — 生成阶段处理器
  - `execute.processor.ts` — 执行阶段处理器
  - 任务重试策略 (指数退避)
  - 任务状态回调 (更新数据库)
- **依赖**: P2-1, P2-2
- **验收标准**:
  - [ ] 三阶段任务串联执行
  - [ ] 失败自动重试 (最多 3 次)
  - [ ] 任务状态实时更新到数据库
  - [ ] 队列积压监控指标暴露

### P2-6: 审核管理 API

- **负责模块**: `packages/api/src/modules/review/`
- **描述**: 实现审核工作流 API
- **交付物**:
  - `GET /api/v1/reviews/pending` — 待审核列表
  - `GET /api/v1/reviews/:id` — 审核详情
  - `POST /api/v1/reviews/:id/approve` — 批准
  - `POST /api/v1/reviews/:id/reject` — 拒绝
  - `POST /api/v1/reviews/batch-approve` — 批量批准
  - 审核过期自动处理
- **依赖**: P2-2, P2-4
- **验收标准**:
  - [ ] 待审核列表按置信度排序
  - [ ] 批量批准支持置信度阈值过滤
  - [ ] 拒绝时反馈记录到 feedback_history
  - [ ] 过期审核自动标记

### P2-7: WebSocket 实时推送

- **负责模块**: `packages/api/src/modules/websocket/`
- **描述**: 实现 WebSocket 网关，推送同步状态和审核通知
- **交付物**:
  - NestJS WebSocket Gateway
  - 事件类型: sync:started / sync:progress / sync:completed / sync:failed / review:pending
  - 认证集成 (token 验证)
  - 房间管理 (按项目组订阅)
- **依赖**: P2-1
- **验收标准**:
  - [ ] 客户端可连接并接收实时事件
  - [ ] 同步任务状态变更时自动推送
  - [ ] 断线重连支持

### P2-8: Web Dashboard 完善

- **负责模块**: `packages/web`
- **描述**: 完善 Web 前端，覆盖项目管理、同步操作、统计面板
- **交付物**:
  - 项目组管理页 (CRUD、变体列表)
  - 同步操作页 (触发分析、查看结果、执行同步)
  - 审核工作台 (列表、详情、批量操作)
  - 统计面板 (同步成功率、待审核数、趋势图)
  - WebSocket 集成 (实时状态更新)
- **依赖**: P1-8, P2-3, P2-4, P2-6, P2-7
- **验收标准**:
  - [ ] 覆盖所有核心用户流程
  - [ ] 实时状态更新无延迟感
  - [ ] 响应式布局，支持移动端查看

### P2-9: Git 平台集成

- **负责模块**: `packages/api/src/modules/git-integration/`
- **描述**: 集成 GitHub/GitLab Webhook，自动触发同步
- **交付物**:
  - Webhook 接收端点
  - Push 事件处理 (自动触发分析)
  - PR 创建和管理
  - Webhook Secret 验证
- **依赖**: P2-4
- **验收标准**:
  - [ ] GitHub push 事件自动触发同步分析
  - [ ] 自动创建 PR 到变体项目
  - [ ] Webhook 签名验证安全

### P2-10: VS Code 插件

- **负责模块**: `packages/vscode-extension/`
- **描述**: 开发 VS Code 插件，支持 IDE 内直接操作同步
- **交付物**:
  - 插件基础框架 (VS Code Extension API)
  - 侧边栏面板 (项目组列表、同步状态)
  - 右键菜单 (同步当前文件改动)
  - diff 对比视图 (内嵌 VS Code diff editor)
  - 状态栏指示器 (同步状态)
- **依赖**: P2-3, P2-4
- **验收标准**:
  - [ ] 插件可安装并连接后端服务
  - [ ] 支持从 IDE 触发同步
  - [ ] diff 对比视图可用

### P2-11: 监控与告警

- **负责模块**: `infra/monitoring/`
- **描述**: 搭建 Prometheus + Grafana 监控体系
- **交付物**:
  - Prometheus 指标暴露 (API 服务 + Worker)
  - 关键指标: sync_success_rate / sync_latency_p99 / ai_api_error_rate / review_pending_count / queue_depth
  - Grafana Dashboard (同步概览、AI 性能、队列状态)
  - AlertManager 告警规则 (成功率 < 90%、延迟 > 60s、队列 > 500)
- **依赖**: P2-1, P2-5
- **验收标准**:
  - [ ] 所有关键指标可在 Grafana 查看
  - [ ] 告警规则触发后通知到指定渠道
  - [ ] Dashboard 数据实时刷新

---

## Phase 3: 智能化 (持续迭代)

**目标**: 同步准确率 > 90%，50% 以上改动可自动确认

### P3-1: 反馈学习系统

- **负责模块**: `packages/ai-engine/src/feedback/`
- **描述**: 基于审核反馈数据优化 AI 输出质量
- **交付物**:
  - 反馈数据收集 (approve/reject/modify 记录)
  - 历史成功案例检索 (Few-shot 示例)
  - 按变体项目维度的 Prompt 个性化
  - 反馈效果评估报告
- **依赖**: P2-6
- **验收标准**:
  - [ ] 反馈数据自动记录到 feedback_history
  - [ ] 历史案例作为 Few-shot 注入 Prompt
  - [ ] 有量化的准确率提升数据

### P3-2: 知识图谱构建

- **负责模块**: `packages/ai-engine/src/knowledge/`
- **描述**: 构建项目间代码关系图谱，支持智能建议
- **交付物**:
  - `KnowledgeGraph` 类
  - 代码关系图维护 (函数调用链、模块依赖)
  - 未同步改动自动发现
  - 异常差异检测 (不应存在的差异)
- **依赖**: P1-5, P1-4
- **验收标准**:
  - [ ] 能构建项目间代码关系图
  - [ ] 能主动发现遗漏的同步改动
  - [ ] 异常检测误报率 < 20%

### P3-3: 智能冲突解决

- **负责模块**: `packages/ai-engine/src/conflict/resolver.ts`
- **描述**: AI 自动解决常见冲突模式，减少人工干预
- **交付物**:
  - 常见冲突模式识别 (命名差异、参数映射、导入路径)
  - AI 自动解决策略
  - 解决方案置信度评估
  - 人工兜底机制
- **依赖**: P1-7, P3-1
- **验收标准**:
  - [ ] 命名差异类冲突自动解决率 > 80%
  - [ ] 参数映射类冲突自动解决率 > 60%
  - [ ] 低置信度自动降级为人工审核

### P3-4: 自动确认机制

- **负责模块**: `packages/api/src/modules/review/auto-approve.service.ts`
- **描述**: 基于历史数据和置信度实现渐进式自动确认
- **交付物**:
  - 自动确认策略引擎
  - 渐进式信任模型 (初始严格，逐步放宽)
  - 按变体项目 / 改动类型 / 文件路径维度的信任评分
  - 自动确认审计日志
- **依赖**: P3-1, P2-6
- **验收标准**:
  - [ ] 高置信度 (>0.95) + 历史准确率高的改动自动确认
  - [ ] 自动确认比例逐步提升至 50%+
  - [ ] 自动确认的改动无回滚记录
  - [ ] 完整审计日志可追溯

### P3-5: 跨项目代码质量分析

- **负责模块**: `packages/ai-engine/src/quality/`
- **描述**: 分析变体项目间的代码一致性和质量差异
- **交付物**:
  - 一致性评分 (变体与 base 的偏离度)
  - 代码质量对比报告
  - 技术债务识别
  - 优化建议生成
- **依赖**: P1-5, P3-2
- **验收标准**:
  - [ ] 能量化各变体与 base 的偏离程度
  - [ ] 能识别不必要的差异
  - [ ] 生成可操作的优化建议

---

## 基础设施任务 (贯穿各阶段)

### INFRA-1: Monorepo 搭建

- **描述**: 使用 Turborepo 搭建 monorepo 项目结构
- **交付物**:
  - `turbo.json` 配置
  - `packages/` 目录结构 (api, worker, web, cli, ai-engine, shared)
  - pnpm workspace 配置
  - 共享 tsconfig / eslint / prettier 配置
- **阶段**: Phase 0 前置
- **验收标准**:
  - [ ] `pnpm install` 一次安装所有依赖
  - [ ] `pnpm dev` 并行启动所有服务
  - [ ] `pnpm build` 按依赖顺序构建
  - [ ] 包间引用正常 (如 api 引用 ai-engine)

### INFRA-2: Docker 本地开发环境

- **描述**: 配置 Docker Compose 本地开发环境
- **交付物**:
  - `docker-compose.yml` (PostgreSQL + Redis + Qdrant)
  - `.env.example` 环境变量模板
  - 数据卷持久化配置
  - 健康检查配置
- **阶段**: Phase 0 前置
- **验收标准**:
  - [ ] `docker compose up -d` 一键启动依赖服务
  - [ ] 数据重启后不丢失
  - [ ] 所有服务健康检查通过

### INFRA-3: CI/CD Pipeline

- **描述**: 配置 GitHub Actions CI/CD 流水线
- **交付物**:
  - PR 检查: lint + type-check + unit test
  - 主分支: build + integration test + Docker 镜像构建
  - 发布: 自动部署到 staging / production
  - 测试覆盖率报告
- **阶段**: Phase 1
- **验收标准**:
  - [ ] PR 提交自动触发检查
  - [ ] 测试失败阻止合并
  - [ ] 主分支合并自动部署

### INFRA-4: 生产部署配置

- **描述**: 根据部署方案文档配置生产环境
- **交付物**:
  - 方案一 (自托管): Docker Compose 生产配置 + Nginx 反向代理
  - 方案二 (云原生): K8s manifests + Terraform 配置
  - SSL 证书配置
  - 备份策略实施
- **阶段**: Phase 2
- **验收标准**:
  - [ ] 至少一种方案可完整部署
  - [ ] HTTPS 访问正常
  - [ ] 数据库自动备份运行

---

## 任务依赖关系总览

```
Phase 0 (验证期)
  P0-1 CLI 脚手架
    └─ P0-2 Git Diff 提取
         └─ P0-4 上下文收集
  P0-3 Claude API 集成
    └─ P0-5 Patch 生成与应用
  P0-2 + P0-3 + P0-4 + P0-5
    └─ P0-6 端到端串联
         └─ P0-7 Prompt 调优

Phase 1 (核心功能)
  P1-1 AST 解析 (TS/JS)
    ├─ P1-2 AST 解析 (Python)
    ├─ P1-3 结构化 Diff
    │    └─ P1-7 冲突检测
    └─ P1-5 代码映射
  P1-4 代码嵌入
    └─ P1-5 代码映射
  P1-5 + P1-3 + P0-6
    └─ P1-6 多文件同步
  P1-8 Web 审核界面 (可并行)

Phase 2 (产品化)
  P2-1 NestJS 服务
    ├─ P2-2 数据库 Schema
    │    ├─ P2-3 项目组 API
    │    ├─ P2-5 BullMQ 队列
    │    └─ P2-6 审核 API
    ├─ P2-7 WebSocket
    └─ P2-11 监控
  P2-3 + P2-4 + P2-6 + P2-7
    └─ P2-8 Web Dashboard
  P2-4 → P2-9 Git 集成
  P2-3 + P2-4 → P2-10 VS Code 插件

Phase 3 (智能化)
  P3-1 反馈学习 → P3-3 智能冲突解决 → P3-4 自动确认
  P3-2 知识图谱 → P3-5 代码质量分析
```

---

## 优先级与里程碑

| 里程碑 | 时间 | 关键交付 | 成功指标 |
|--------|------|----------|----------|
| M0: MVP 验证 | 第 3 周 | CLI 工具可用 | Bug Fix 同步准确率 > 80% |
| M1: 核心引擎 | 第 9 周 | AST + 向量 + 多文件同步 | 多文件准确率 > 70%，3+ 语言 |
| M2: 产品可用 | 第 15 周 | Web + API + 审核流程 | 5+ 人团队日常使用 |
| M3: 智能化 | 持续 | 自动确认 + 知识图谱 | 准确率 > 90%，自动确认 > 50% |
