# AI Engine

AI 同步架构的核心引擎，负责代码分析、冲突检测、质量分析和知识图谱管理。

## 目录结构

```
src/
├── ast/              # AST 解析与代码分析
├── conflict/         # 冲突检测与解决
│   ├── types.ts           # 冲突类型定义
│   ├── resolver-config.ts # 解决器配置常量
│   └── strategies/        # 策略模式实现
│       ├── semantic-strategy.ts    # 语义冲突 (重命名/参数变更)
│       ├── dependency-strategy.ts  # 依赖冲突 (导入路径/包)
│       ├── code-strategy.ts        # 代码冲突
│       └── composite-resolver.ts   # 组合解决器
├── embedding/        # 代码嵌入向量生成
├── feedback/         # 反馈学习系统
├── knowledge/        # 知识图谱
│   ├── graph.ts           # 不可变知识图谱
│   └── builder.ts         # 流式构建器
├── llm/              # LLM 集成
├── mapping/          # 代码映射
│   └── strategies/        # 映射策略
│       ├── exact-name-strategy.ts     # 精确名称匹配 (优先级1, 置信度0.98)
│       ├── fingerprint-strategy.ts    # 指纹匹配 (优先级2, 置信度0.85)
│       ├── vector-similarity-strategy.ts # 向量相似度 (优先级3)
│       └── composite-mapper.ts        # 组合映射器
├── prompts/          # Prompt 模板
└── quality/          # 质量分析
    ├── config.ts          # 配置常量
    ├── signature-matcher.ts # 签名匹配工具
    └── drift-detector.ts   # 漂移检测
```

## 核心模块

### 冲突解决 (Conflict Resolution)

采用策略模式，支持可扩展的冲突解决算法：

```typescript
import { CompositeConflictResolver } from './conflict/strategies';

const resolver = new CompositeConflictResolver({
  importPathMappings: { '@old': '@new' },
  nameMappings: { oldFunc: 'newFunc' },
  autoResolveThreshold: 0.8
});

const result = resolver.resolve(conflict);
```

### 知识图谱 (Knowledge Graph)

不可变设计，支持流式构建：

```typescript
import { KnowledgeGraph, KnowledgeGraphBuilder } from './knowledge';

// 方式1: 链式调用
const graph = KnowledgeGraph.empty()
  .withNode(node1)
  .withNode(node2)
  .withEdge(edge);

// 方式2: Builder 模式 (批量操作)
const graph = new KnowledgeGraphBuilder()
  .addNodes([node1, node2])
  .addEdge(edge)
  .build();

// 方式3: 工厂方法
const graph = KnowledgeGraph.fromArrays(nodes, edges);
```

### 代码映射 (Code Mapping)

三级映射策略，按优先级链式执行：

1. **ExactNameMappingStrategy** (P1, 0.98) - 同路径同名称精确匹配
2. **FingerprintMappingStrategy** (P2, 0.85) - 结构指纹匹配（处理重命名/移动）
3. **VectorSimilarityStrategy** (P3, 0.70-1.0) - 语义向量相似度

```typescript
import { CompositeCodeMapper } from './mapping/strategies';

const mapper = new CompositeCodeMapper();
const result = await mapper.buildMapping(baseFuncs, variantFuncs, embedder);
```

### 质量分析 (Quality Analysis)

```typescript
import { QualityAnalyzer } from './quality';

const analyzer = new QualityAnalyzer();
const report = analyzer.analyze(baseFunctions, variantFunctions);
```

## 设计模式

| 模式 | 应用场景 |
|------|----------|
| 策略模式 | 冲突解决、代码映射的可扩展算法 |
| Builder 模式 | 知识图谱的流式构建 |
| 不可变数据 | KnowledgeGraph 的 withNode/withEdge |
| 工厂方法 | KnowledgeGraph.empty(), fromArrays() |

## 测试

```bash
# 运行测试
npx jest

# 带覆盖率
npx jest --coverage
```

当前覆盖率: **95.79%** (280 tests)

## 配置

关键配置文件：
- `conflict/resolver-config.ts` - 冲突解决阈值和映射
- `quality/config.ts` - 质量分析权重和阈值

## License

MIT
