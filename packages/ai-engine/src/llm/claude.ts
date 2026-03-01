import Anthropic from '@anthropic-ai/sdk';
import { GeneratedPatch, ChangeType } from '@ai-project-sync/shared';
import { getPromptTemplate, detectChangeType } from '../prompts/templates';

export interface GeneratePatchOptions {
  baseDiff: string;
  variantContext: string;
  historyExamples?: string[];
  changeType?: ChangeType;
  commitMessage?: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeLLM {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;

  constructor(apiKey: string, options?: { model?: string; maxTokens?: number }) {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = options?.model || 'claude-sonnet-4-6-20250514';
    this.defaultMaxTokens = options?.maxTokens || 4096;
  }

  async generatePatch(options: GeneratePatchOptions): Promise<GeneratedPatch> {
    const {
      baseDiff,
      variantContext,
      historyExamples,
      commitMessage = '',
      model = this.defaultModel,
      maxTokens = this.defaultMaxTokens,
    } = options;

    const changeType = options.changeType || detectChangeType(commitMessage, baseDiff);
    const template = getPromptTemplate(changeType);

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: template.system,
      messages: [
        {
          role: 'user',
          content: this.buildUserPrompt(template.userPrefix, baseDiff, variantContext, historyExamples),
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseResponse(text);
  }

  private buildUserPrompt(
    prefix: string,
    baseDiff: string,
    variantContext: string,
    historyExamples?: string[]
  ): string {
    let prompt = `${prefix}
## 基础项目改动

\`\`\`diff
${baseDiff}
\`\`\`

## 变体项目相关代码

\`\`\`
${variantContext}
\`\`\`
`;

    if (historyExamples?.length) {
      prompt += `\n## 历史成功案例\n\n以下是该变体项目之前成功的同步案例，请参考其适配模式：\n\n`;
      historyExamples.forEach((example, i) => {
        prompt += `### 案例 ${i + 1}\n\`\`\`\n${example}\n\`\`\`\n\n`;
      });
    }

    prompt += `\n请生成适配后的补丁，以 JSON 格式输出。`;
    return prompt;
  }

  private parseResponse(text: string): GeneratedPatch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response does not contain valid JSON');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      if (typeof parsed.patch !== 'string') {
        throw new Error('Missing "patch" field in AI response');
      }
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error('Invalid "confidence" field in AI response');
      }

      return {
        patch: parsed.patch,
        confidence: parsed.confidence,
        explanation: parsed.explanation || '',
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
      }
      throw error;
    }
  }
}
