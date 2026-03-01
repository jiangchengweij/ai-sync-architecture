# 开发指南

> 版本: 1.0 | 最后更新: 2026-02-26

## 项目结构

```
ai-project-sync/
├── packages/
│   ├── api/                    # NestJS 后端服务
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── project-group/   # 项目组管理
│   │   │   │   ├── sync/            # 同步执行
│   │   │   │   ├── review/          # 审核管理
│   │   │   │   └── ai/              # AI 引擎
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   └── interceptors/
│   │   │   └── config/
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── worker/                 # BullMQ Worker
│   │   ├── src/
│   │   │   ├── processors/
│   │   │   │   ├── analyze.processor.ts
│   │   │   │   ├── generate.processor.ts
│   │   │   │   └── execute.processor.ts
│   │   │   └── services/
│   │   └── package.json
│   │
│   ├── web/                    # React 前端
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── cli/                    # CLI 工具
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   └── services/
│   │   └── package.json
│   │
│   ├── ai-engine/              # AI 引擎核心
│   │   ├── src/
│   │   │   ├── llm/
│   │   │   │   ├── claude.ts
│   │   │   │   └── openai.ts
│   │   │   ├── ast/
│   │   │   │   ├── parser.ts
│   │   │   │   └── differ.ts
│   │   │   └── embedding/
│   │   │       └── embedder.ts
│   │   └── package.json
│   │
│   └── shared/                 # 共享代码
│       ├── types/
│       └── utils/
│
├── docs/                       # 文档
├── infra/                      # 基础设施
│   ├── docker/
│   ├── k8s/
│   └── terraform/
├── scripts/                    # 构建脚本
├── package.json                # Monorepo 根配置
├── turbo.json                  # Turborepo 配置
└── docker-compose.yml          # 本地开发环境
```

---

## 技术栈

| 领域 | 技术 |
|------|------|
| 语言 | TypeScript 5.x |
| 后端框架 | NestJS 10.x |
| 前端框架 | React 18.x + Vite 5.x |
| 任务队列 | BullMQ |
| 数据库 ORM | Prisma / TypeORM |
| AST 解析 | Tree-sitter |
| LLM SDK | @anthropic-ai/sdk |
| 测试 | Jest + Playwright |
| Monorepo | Turborepo |

---

## 环境搭建

### 前置要求

- Node.js 20.x LTS
- pnpm 8.x
- Docker Desktop
- PostgreSQL 15 (本地开发可选，推荐 Docker)
- Redis 7 (本地开发可选，推荐 Docker)

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/org/ai-project-sync.git
cd ai-project-sync

# 安装依赖
pnpm install

# 复制环境变量模板
cp .env.example .env
```

### 启动本地服务

```bash
# 启动数据库服务
docker compose up -d postgres redis qdrant

# 运行数据库迁移
pnpm --filter api prisma migrate dev

# 启动开发服务器
pnpm dev
```

### 环境变量

```bash
# .env.example

# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_project_sync"

# Redis
REDIS_URL="redis://localhost:6379"

# Qdrant
QDRANT_URL="http://localhost:6333"

# AI 服务
ANTHROPIC_API_KEY="sk-ant-xxx"
# OPENAI_API_KEY="sk-xxx"

# 应用
JWT_SECRET="dev-secret-change-in-production"
API_URL="http://localhost:3000"
WEB_URL="http://localhost:8080"
```

---

## 核心模块开发

### 1. AI 引擎模块

```typescript
// packages/ai-engine/src/llm/claude.ts
import Anthropic from '@anthropic-ai/sdk';

export interface GeneratePatchOptions {
  baseDiff: string;
  variantContext: string;
  historyExamples?: string[];
}

export interface GeneratedPatch {
  patch: string;
  confidence: number;
  explanation: string;
  risks: string[];
}

export class ClaudeLLM {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generatePatch(options: GeneratePatchOptions): Promise<GeneratedPatch> {
    const { baseDiff, variantContext, historyExamples } = options;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [{
        role: 'user',
        content: this.buildUserPrompt(baseDiff, variantContext, historyExamples)
      }]
    });

    return this.parseResponse(response.content[0].text);
  }

  private getSystemPrompt(): string {
    return `你是一个专业的代码同步助手。你的任务是根据基础项目的代码改动，
生成适配到变体项目的代码补丁。

输出要求：
1. 生成 unified diff 格式的补丁
2. 评估适配的置信度 (0-1)
3. 说明适配的原因和逻辑
4. 列出潜在的风险点

输出 JSON 格式：
{
  "patch": "unified diff content",
  "confidence": 0.95,
  "explanation": "适配说明",
  "risks": ["风险1", "风险2"]
}`;
  }

  private buildUserPrompt(
    baseDiff: string,
    variantContext: string,
    historyExamples?: string[]
  ): string {
    let prompt = `## 基础项目改动

\`\`\`diff
${baseDiff}
\`\`\`

## 变体项目相关代码

\`\`\`
${variantContext}
\`\`\`
`;

    if (historyExamples?.length) {
      prompt += `\n## 历史成功案例\n${historyExamples.join('\n\n')}`;
    }

    return prompt;
  }

  private parseResponse(text: string): GeneratedPatch {
    // 解析 JSON 响应
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }
    return JSON.parse(jsonMatch[0]);
  }
}
```

### 2. AST 解析模块

```typescript
// packages/ai-engine/src/ast/parser.ts
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

export interface ParsedFunction {
  name: string;
  startLine: number;
  endLine: number;
  params: string[];
  returnType: string;
  code: string;
}

export interface StructuredDiff {
  addedFunctions: ParsedFunction[];
  modifiedFunctions: ParsedFunction[];
  deletedFunctions: string[];
  changedLines: { start: number; end: number }[];
}

export class ASTParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
  }

  parseFile(content: string): ParsedFunction[] {
    const tree = this.parser.parse(content);
    const functions: ParsedFunction[] = [];

    this.traverseNode(tree.rootNode, content, functions);

    return functions;
  }

  private traverseNode(
    node: Parser.SyntaxNode,
    content: string,
    functions: ParsedFunction[]
  ): void {
    if (node.type === 'function_declaration' ||
        node.type === 'method_definition' ||
        node.type === 'arrow_function') {
      functions.push(this.extractFunction(node, content));
    }

    for (const child of node.children) {
      this.traverseNode(child, content, functions);
    }
  }

  private extractFunction(
    node: Parser.SyntaxNode,
    content: string
  ): ParsedFunction {
    const nameNode = node.childForFieldName('name');
    const paramsNode = node.childForFieldName('parameters');
    const returnTypeNode = node.childForFieldName('return_type');

    return {
      name: nameNode?.text || 'anonymous',
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      params: this.extractParams(paramsNode),
      returnType: returnTypeNode?.text || 'void',
      code: content.slice(node.startIndex, node.endIndex)
    };
  }

  private extractParams(paramsNode: Parser.SyntaxNode | null): string[] {
    if (!paramsNode) return [];

    return paramsNode.children
      .filter(c => c.type === 'identifier' || c.type === 'required_parameter')
      .map(c => c.text);
  }

  generateFingerprint(func: ParsedFunction): string {
    // 生成函数结构指纹
    const structure = `${func.name}:${func.params.length}:${func.returnType}`;
    return Buffer.from(structure).toString('base64');
  }
}
```

### 3. 代码嵌入模块

```typescript
// packages/ai-engine/src/embedding/embedder.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import Anthropic from '@anthropic-ai/sdk';

export interface CodeEmbedding {
  id: string;
  projectId: string;
  filePath: string;
  functionName: string;
  vector: number[];
  code: string;
}

export class CodeEmbedder {
  private anthropic: Anthropic;
  private qdrant: QdrantClient;

  constructor(anthropicKey: string, qdrantUrl: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
    this.qdrant = new QdrantClient({ url: qdrantUrl });
  }

  async embedFunction(code: string): Promise<number[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Generate a semantic embedding for this code. Output as JSON array of numbers.

\`\`\`typescript
${code}
\`\`\``
      }]
    });

    // 实际项目应使用专用 embedding API (如 Voyage)
    return JSON.parse(response.content[0].text as string);
  }

  async indexFunction(embedding: CodeEmbedding): Promise<void> {
    await this.qdrant.upsert('code_embeddings', {
      points: [{
        id: embedding.id,
        vector: embedding.vector,
        payload: {
          projectId: embedding.projectId,
          filePath: embedding.filePath,
          functionName: embedding.functionName,
          code: embedding.code
        }
      }]
    });
  }

  async searchSimilar(
    vector: number[],
    projectId: string,
    limit: number = 5
  ): Promise<CodeEmbedding[]> {
    const results = await this.qdrant.search('code_embeddings', {
      vector,
      filter: {
        must: [
          { key: 'projectId', match: { value: projectId } }
        ]
      },
      limit
    });

    return results.map(r => ({
      id: r.id as string,
      projectId: r.payload?.projectId as string,
      filePath: r.payload?.filePath as string,
      functionName: r.payload?.functionName as string,
      vector: r.vector as number[],
      code: r.payload?.code as string
    }));
  }
}
```

### 4. 同步处理器

```typescript
// packages/worker/src/processors/generate.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClaudeLLM } from '@ai-project-sync/ai-engine';
import { PrismaService } from '../services/prisma.service';

interface GenerateJobData {
  syncTaskId: string;
  variantId: string;
  baseDiff: string;
}

@Processor('sync:generate')
export class GenerateProcessor extends WorkerHost {
  private llm: ClaudeLLM;

  constructor(private prisma: PrismaService) {
    super();
    this.llm = new ClaudeLLM(process.env.ANTHROPIC_API_KEY!);
  }

  async process(job: Job<GenerateJobData>): Promise<void> {
    const { syncTaskId, variantId, baseDiff } = job.data;

    // 获取变体项目上下文
    const variant = await this.prisma.project.findUnique({
      where: { id: variantId },
      include: { projectGroup: true }
    });

    if (!variant) {
      throw new Error(`Variant project not found: ${variantId}`);
    }

    // 获取代码映射
    const mappings = await this.prisma.codeMapping.findMany({
      where: {
        variantProjectId: variantId,
        projectGroupId: variant.projectGroupId
      }
    });

    // 获取变体项目相关代码
    const variantContext = await this.getVariantContext(mappings);

    // 调用 LLM 生成适配 patch
    const result = await this.llm.generatePatch({
      baseDiff,
      variantContext,
      historyExamples: await this.getHistoryExamples(variantId)
    });

    // 保存结果
    await this.prisma.syncResult.update({
      where: {
        syncTaskId_variantId: {
          syncTaskId,
          variantId
        }
      },
      data: {
        status: 'generated',
        confidence: result.confidence,
        patchContent: result.patch,
        explanation: result.explanation,
        warnings: result.risks,
        riskLevel: this.calculateRiskLevel(result.confidence, result.risks)
      }
    });
  }

  private calculateRiskLevel(
    confidence: number,
    risks: string[]
  ): 'low' | 'medium' | 'high' {
    if (confidence >= 0.9 && risks.length === 0) return 'low';
    if (confidence >= 0.7 && risks.length <= 2) return 'medium';
    return 'high';
  }

  private async getVariantContext(mappings: any[]): Promise<string> {
    // 实现获取变体项目上下文逻辑
    return mappings.map(m => `// ${m.variantFilePath}`).join('\n');
  }

  private async getHistoryExamples(variantId: string): Promise<string[]> {
    // 获取该变体的历史成功同步案例
    const feedbacks = await this.prisma.feedbackHistory.findMany({
      where: {
        syncResult: { variantId },
        feedbackType: 'accept'
      },
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    return feedbacks.map(f => f.originalPatch);
  }
}
```

---

## 测试策略

### 单元测试

```typescript
// packages/ai-engine/src/__tests__/ast/parser.test.ts
import { ASTParser } from '../ast/parser';

describe('ASTParser', () => {
  let parser: ASTParser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('parseFile', () => {
    it('should extract all functions from TypeScript file', () => {
      const code = `
        function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }

        const add = (a: number, b: number) => a + b;
      `;

      const functions = parser.parseFile(code);

      expect(functions).toHaveLength(2);
      expect(functions[0].name).toBe('greet');
      expect(functions[0].params).toEqual(['name: string']);
      expect(functions[1].name).toBe('add');
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same function structure', () => {
      const func = {
        name: 'fetchUsers',
        startLine: 1,
        endLine: 10,
        params: ['page: number', 'size: number'],
        returnType: 'Promise<User[]>',
        code: ''
      };

      const fp1 = parser.generateFingerprint(func);
      const fp2 = parser.generateFingerprint(func);

      expect(fp1).toBe(fp2);
    });
  });
});
```

### 集成测试

```typescript
// packages/api/src/__tests__/sync/sync.service.int.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from '../../src/modules/sync/sync.service';
import { PrismaService } from '../../src/common/services/prisma.service';

describe('SyncService (Integration)', () => {
  let service: SyncService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SyncService, PrismaService]
    }).compile();

    service = module.get(SyncService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('analyze', () => {
    it('should analyze commit and return sync possibilities', async () => {
      // 准备测试数据
      const projectGroup = await prisma.projectGroup.create({
        data: {
          name: 'Test Group',
          syncStrategy: { mode: 'semi-automatic' }
        }
      });

      const baseProject = await prisma.project.create({
        data: {
          projectGroupId: projectGroup.id,
          name: 'base',
          gitUrl: 'https://github.com/test/base.git',
          type: 'base'
        }
      });

      // 执行分析
      const result = await service.analyze({
        projectGroupId: projectGroup.id,
        commitHash: 'abc123'
      });

      expect(result).toHaveProperty('syncId');
      expect(result.variants).toBeDefined();
    });
  });
});
```

### E2E 测试

```typescript
// packages/web/e2e/sync-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sync Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should complete a full sync workflow', async ({ page }) => {
    // 创建项目组
    await page.click('text=新建项目组');
    await page.fill('[name="name"]', 'E2E Test Group');
    await page.click('button:has-text("创建")');

    // 触发同步
    await page.click('text=同步');
    await page.click('text=分析最新提交');

    // 等待分析完成
    await expect(page.locator('.sync-status')).toContainText('分析完成', {
      timeout: 30000
    });

    // 审核改动
    await page.click('text=审核');
    await page.click('button:has-text("批准")');

    // 确认同步完成
    await expect(page.locator('.toast')).toContainText('同步成功');
  });
});
```

---

## 代码规范

### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件 | kebab-case | `sync-service.ts` |
| 类 | PascalCase | `SyncService` |
| 接口 | PascalCase (I 前缀可选) | `SyncOptions` / `ISyncOptions` |
| 函数 | camelCase | `generatePatch` |
| 常量 | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| 枚举 | PascalCase | `SyncStatus` |

### 目录约定

```
module/
├── dto/                 # 数据传输对象
│   ├── create-xxx.dto.ts
│   └── update-xxx.dto.ts
├── entities/            # 数据库实体
├── xxx.controller.ts    # 控制器
├── xxx.service.ts       # 服务
├── xxx.module.ts        # 模块定义
└── __tests__/           # 测试文件
```

### Commit 规范

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 重构
- `docs`: 文档
- `test`: 测试
- `chore`: 构建/工具

**Examples**:
```
feat(ai-engine): add support for Python AST parsing

fix(sync): correct confidence calculation for low-risk patches

docs(api): update OpenAPI spec for sync endpoints
```

---

## 调试技巧

### 日志级别

```typescript
// 开发环境
LOG_LEVEL=debug

// 生产环境
LOG_LEVEL=info
```

### 查看任务队列状态

```bash
# 连接 Redis
redis-cli

# 查看队列状态
LLEN bull:sync:generate:wait
LRANGE bull:sync:generate:active 0 -1
```

### 模拟 AI 响应

```typescript
// packages/ai-engine/src/__mocks__/claude.ts
export class MockClaudeLLM {
  async generatePatch(options: GeneratePatchOptions): Promise<GeneratedPatch> {
    return {
      patch: '--- a/file.ts\n+++ b/file.ts\n...',
      confidence: 0.95,
      explanation: 'Mock response for testing',
      risks: []
    };
  }
}
```

---

## 常见问题

### Q: 如何处理大型仓库？

A: 使用 shallow clone 和 sparse checkout：
```bash
git clone --depth 1 --filter=blob:none --sparse <url>
git sparse-checkout set src/
```

### Q: 如何优化 AI 调用成本？

A:
1. 使用缓存：相同 diff 不重复调用
2. 批量处理：合并相似改动
3. 模型分级：简单改动用 Haiku，复杂用 Sonnet

### Q: 如何处理多语言项目？

A: 扩展 AST 解析器支持：
```typescript
const parsers = {
  typescript: () => new Parser().setLanguage(TypeScript),
  python: () => new Parser().setLanguage(Python),
  go: () => new Parser().setLanguage(Go)
};
```
