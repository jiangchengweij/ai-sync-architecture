import { detectChangeType, getPromptTemplate, TEMPLATES } from '../../src/prompts/templates';

describe('detectChangeType', () => {
  it('should detect bug_fix from conventional commit prefix', () => {
    expect(detectChangeType('fix: resolve pagination bug', '')).toBe('bug_fix');
    expect(detectChangeType('fix(api): null pointer', '')).toBe('bug_fix');
  });

  it('should detect feature from conventional commit prefix', () => {
    expect(detectChangeType('feat: add user export', '')).toBe('feature');
    expect(detectChangeType('feat(auth): add OAuth support', '')).toBe('feature');
  });

  it('should detect refactor from conventional commit prefix', () => {
    expect(detectChangeType('refactor: extract utils', '')).toBe('refactor');
    expect(detectChangeType('refactor(core): simplify logic', '')).toBe('refactor');
  });

  it('should detect docs from conventional commit prefix', () => {
    expect(detectChangeType('docs: update README', '')).toBe('docs');
    expect(detectChangeType('docs(api): add endpoint docs', '')).toBe('docs');
  });

  it('should detect test from conventional commit prefix', () => {
    expect(detectChangeType('test: add unit tests', '')).toBe('test');
    expect(detectChangeType('test(sync): integration tests', '')).toBe('test');
  });

  it('should detect chore from conventional commit prefix', () => {
    expect(detectChangeType('chore: update deps', '')).toBe('chore');
    expect(detectChangeType('ci: fix pipeline', '')).toBe('chore');
  });

  it('should detect bug_fix from keyword in message', () => {
    expect(detectChangeType('resolve critical bug in login', '')).toBe('bug_fix');
  });

  it('should detect test from diff content when message is ambiguous', () => {
    expect(detectChangeType('update code', 'src/utils.spec.ts')).toBe('test');
  });

  it('should detect docs from diff content when message is ambiguous', () => {
    expect(detectChangeType('update content', 'README.md')).toBe('docs');
  });

  it('should default to feature for ambiguous messages', () => {
    expect(detectChangeType('update user module', 'src/user.ts')).toBe('feature');
  });
});

describe('getPromptTemplate', () => {
  it('should return correct template for each change type', () => {
    const types = Object.keys(TEMPLATES) as Array<keyof typeof TEMPLATES>;
    for (const type of types) {
      const template = getPromptTemplate(type);
      expect(template.system).toBeTruthy();
      expect(template.userPrefix).toBeTruthy();
      expect(template.system).toContain('JSON');
    }
  });

  it('should have bug_fix template focused on fix correctness', () => {
    const template = getPromptTemplate('bug_fix');
    expect(template.system).toContain('Bug 修复');
  });

  it('should have feature template focused on module adaptation', () => {
    const template = getPromptTemplate('feature');
    expect(template.system).toContain('新功能');
  });

  it('should have refactor template focused on semantic equivalence', () => {
    const template = getPromptTemplate('refactor');
    expect(template.system).toContain('重构');
  });
});
