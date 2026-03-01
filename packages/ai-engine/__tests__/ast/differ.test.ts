import { DiffEngine } from '../../src/ast/differ';

describe('DiffEngine', () => {
  let engine: DiffEngine;

  beforeEach(() => {
    engine = new DiffEngine();
  });

  describe('generateStructuredDiff', () => {
    it('should detect added functions', () => {
      const oldCode = `
function existing() {
  return 1;
}
`;
      const newCode = `
function existing() {
  return 1;
}

function newFunc(x: number): number {
  return x * 2;
}
`;
      const diff = engine.generateStructuredDiff(oldCode, newCode);
      expect(diff.addedFunctions).toHaveLength(1);
      expect(diff.addedFunctions[0].name).toBe('newFunc');
      expect(diff.modifiedFunctions).toHaveLength(0);
      expect(diff.deletedFunctions).toHaveLength(0);
      expect(diff.changeType).toBe('feature');
    });

    it('should detect deleted functions', () => {
      const oldCode = `
function toRemove() {
  return 1;
}

function toKeep() {
  return 2;
}
`;
      const newCode = `
function toKeep() {
  return 2;
}
`;
      const diff = engine.generateStructuredDiff(oldCode, newCode);
      expect(diff.deletedFunctions).toHaveLength(1);
      expect(diff.deletedFunctions[0].name).toBe('toRemove');
    });

    it('should detect modified functions', () => {
      const oldCode = `
function calc(x: number): number {
  return x + 1;
}
`;
      const newCode = `
function calc(x: number): number {
  return x + 2;
}
`;
      const diff = engine.generateStructuredDiff(oldCode, newCode);
      expect(diff.modifiedFunctions).toHaveLength(1);
      expect(diff.modifiedFunctions[0].newFunc.name).toBe('calc');
      expect(diff.changeType).toBe('bug_fix');
    });

    it('should detect refactor when functions are replaced', () => {
      const oldCode = `
function oldWay() {
  return 1;
}
`;
      const newCode = `
function newWay() {
  return 1;
}
`;
      const diff = engine.generateStructuredDiff(oldCode, newCode);
      expect(diff.addedFunctions).toHaveLength(1);
      expect(diff.deletedFunctions).toHaveLength(1);
      expect(diff.changeType).toBe('refactor');
    });

    it('should build a summary string', () => {
      const oldCode = `function a() { return 1; }`;
      const newCode = `function a() { return 2; }\nfunction b() { return 3; }`;
      const diff = engine.generateStructuredDiff(oldCode, newCode);
      expect(diff.summary).toContain('Added: b');
      expect(diff.summary).toContain('Modified: a');
    });

    it('should handle no changes', () => {
      const code = `function same() { return 1; }`;
      const diff = engine.generateStructuredDiff(code, code);
      expect(diff.addedFunctions).toHaveLength(0);
      expect(diff.modifiedFunctions).toHaveLength(0);
      expect(diff.deletedFunctions).toHaveLength(0);
      expect(diff.summary).toBe('No structural changes detected');
    });

    it('should detect class method changes', () => {
      const oldCode = `
class Service {
  getData(): string {
    return "old";
  }
}
`;
      const newCode = `
class Service {
  getData(): string {
    return "new";
  }

  newMethod(): void {
    console.log("added");
  }
}
`;
      const diff = engine.generateStructuredDiff(oldCode, newCode);
      expect(diff.modifiedFunctions).toHaveLength(1);
      expect(diff.addedFunctions).toHaveLength(1);
      expect(diff.addedFunctions[0].name).toBe('newMethod');
    });
  });
});
