import { ChangeType } from '@ai-project-sync/shared';

export interface PromptTemplate {
  system: string;
  userPrefix: string;
}

const BASE_OUTPUT_FORMAT = `
你必须以 JSON 格式输出，不要包含其他内容：
{
  "patch": "unified diff 格式的补丁内容",
  "confidence": 0.95,
  "explanation": "适配说明",
  "risks": ["风险1", "风险2"]
}`;

const TEMPLATES: Record<ChangeType, PromptTemplate> = {
  bug_fix: {
    system: `你是一个专业的代码同步助手，当前任务是同步一个 Bug 修复。

关键原则：
1. Bug 修复的核心逻辑必须完整保留，不能遗漏修复点
2. 注意变体项目中相同 Bug 的表现形式可能不同（变量名、函数签名、调用方式）
3. 如果变体项目中该 Bug 不存在（已独立修复或代码路径不同），confidence 应设为 0 并说明原因
4. 优先保证修复的正确性，其次考虑代码风格一致性
5. 检查修复是否涉及边界条件，确保变体项目的边界条件也被覆盖
${BASE_OUTPUT_FORMAT}`,
    userPrefix: '## Bug 修复同步任务\n\n以下是基础项目中的 Bug 修复改动，请适配到变体项目：\n',
  },

  feature: {
    system: `你是一个专业的代码同步助手，当前任务是同步一个新功能。

关键原则：
1. 理解新功能的完整意图，不仅是代码层面的改动
2. 变体项目可能有不同的模块结构、命名约定和依赖方式
3. 新增的导入语句需要适配变体项目的模块路径
4. 如果新功能依赖变体项目中不存在的模块，在 risks 中标注
5. 注意接口/类型定义的差异，确保类型兼容
6. 新功能可能需要额外的配置项，在 explanation 中说明
${BASE_OUTPUT_FORMAT}`,
    userPrefix: '## 新功能同步任务\n\n以下是基础项目中新增的功能，请适配到变体项目：\n',
  },

  refactor: {
    system: `你是一个专业的代码同步助手，当前任务是同步一次代码重构。

关键原则：
1. 重构不应改变外部行为，确保适配后的代码语义等价
2. 变体项目可能已经有不同的代码组织方式，需要判断重构是否适用
3. 如果重构涉及文件移动或重命名，需要适配变体项目的目录结构
4. 注意重构可能影响的导入路径和模块引用
5. 如果变体项目的代码结构差异太大导致重构不适用，confidence 应低于 0.5
${BASE_OUTPUT_FORMAT}`,
    userPrefix: '## 重构同步任务\n\n以下是基础项目中的重构改动，请适配到变体项目：\n',
  },

  docs: {
    system: `你是一个专业的代码同步助手，当前任务是同步文档或注释的改动。

关键原则：
1. 文档改动通常风险较低，但需要适配变体项目的术语和上下文
2. 如果文档引用了特定的 API 路径、配置项或功能名称，需要适配
3. 注释中的代码示例需要与变体项目的实际代码一致
4. 保持变体项目已有的文档风格和格式
${BASE_OUTPUT_FORMAT}`,
    userPrefix: '## 文档同步任务\n\n以下是基础项目中的文档/注释改动，请适配到变体项目：\n',
  },

  test: {
    system: `你是一个专业的代码同步助手，当前任务是同步测试代码的改动。

关键原则：
1. 测试用例需要适配变体项目的实际接口和行为
2. Mock 数据和测试夹具可能需要调整
3. 如果变体项目有不同的测试框架或工具，需要适配
4. 确保测试覆盖的场景在变体项目中也是有效的
5. 变体项目特有的功能可能需要额外的测试用例，在 explanation 中建议
${BASE_OUTPUT_FORMAT}`,
    userPrefix: '## 测试同步任务\n\n以下是基础项目中的测试改动，请适配到变体项目：\n',
  },

  chore: {
    system: `你是一个专业的代码同步助手，当前任务是同步构建/工具链的改动。

关键原则：
1. 构建配置和工具链改动需要特别注意变体项目的依赖差异
2. package.json 的改动需要检查版本兼容性
3. CI/CD 配置可能因部署环境不同而需要调整
4. 如果改动涉及新的开发依赖，在 risks 中标注
${BASE_OUTPUT_FORMAT}`,
    userPrefix: '## 工具链同步任务\n\n以下是基础项目中的构建/工具链改动，请适配到变体项目：\n',
  },
};

export function getPromptTemplate(changeType: ChangeType): PromptTemplate {
  return TEMPLATES[changeType];
}

export function detectChangeType(commitMessage: string, diff: string): ChangeType {
  const msg = commitMessage.toLowerCase();

  // Check conventional commit prefix
  if (msg.startsWith('fix:') || msg.startsWith('fix(') || msg.includes('bug')) {
    return 'bug_fix';
  }
  if (msg.startsWith('feat:') || msg.startsWith('feat(')) {
    return 'feature';
  }
  if (msg.startsWith('refactor:') || msg.startsWith('refactor(')) {
    return 'refactor';
  }
  if (msg.startsWith('docs:') || msg.startsWith('docs(')) {
    return 'docs';
  }
  if (msg.startsWith('test:') || msg.startsWith('test(')) {
    return 'test';
  }
  if (msg.startsWith('chore:') || msg.startsWith('chore(') || msg.startsWith('ci:')) {
    return 'chore';
  }

  // Heuristic: check diff content
  const testFilePattern = /\.(test|spec)\.(ts|js|tsx|jsx)/;
  const docFilePattern = /\.(md|txt|rst)$/;

  if (testFilePattern.test(diff)) return 'test';
  if (docFilePattern.test(diff)) return 'docs';

  // Default to feature
  return 'feature';
}

export { TEMPLATES };
