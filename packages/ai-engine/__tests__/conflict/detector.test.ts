import { ConflictDetector } from '../../src/conflict/detector';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('detect - code conflicts', () => {
    it('should detect when removed lines do not exist in variant', () => {
      const patchContent = `--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,3 @@
-  return oldValue;
+  return newValue;
`;
      const variantCode = new Map([
        ['src/utils.ts', 'function test() {\n  return differentValue;\n}'],
      ]);

      const report = detector.detect('', variantCode, patchContent);
      expect(report.conflicts.length).toBeGreaterThan(0);
      expect(report.conflicts[0].type).toBe('code_conflict');
      expect(report.conflicts[0].severity).toBe('high');
    });

    it('should not flag conflicts when lines match', () => {
      const patchContent = `--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,3 @@
-  return oldValue;
+  return newValue;
`;
      const variantCode = new Map([
        ['src/utils.ts', 'function test() {\n  return oldValue;\n}'],
      ]);

      const report = detector.detect('', variantCode, patchContent);
      const codeConflicts = report.conflicts.filter((c) => c.type === 'code_conflict');
      expect(codeConflicts).toHaveLength(0);
    });
  });

  describe('detect - dependency conflicts', () => {
    it('should detect new relative imports', () => {
      const baseDiff = `
+import { helper } from './utils/helper';
`;
      const variantCode = new Map([
        ['src/index.ts', 'const x = 1;'],
      ]);

      const report = detector.detect(baseDiff, variantCode, '');
      const depConflicts = report.conflicts.filter((c) => c.type === 'dependency_conflict');
      expect(depConflicts.length).toBeGreaterThan(0);
      expect(depConflicts[0].severity).toBe('medium');
    });

    it('should detect new package imports with low severity', () => {
      const baseDiff = `
+import lodash from 'lodash';
`;
      const variantCode = new Map([
        ['src/index.ts', 'const x = 1;'],
      ]);

      const report = detector.detect(baseDiff, variantCode, '');
      const depConflicts = report.conflicts.filter((c) => c.type === 'dependency_conflict');
      expect(depConflicts.length).toBeGreaterThan(0);
      expect(depConflicts[0].severity).toBe('low');
    });
  });

  describe('detect - overall risk', () => {
    it('should return low risk when no conflicts', () => {
      const report = detector.detect('', new Map(), '');
      expect(report.overallRisk).toBe('low');
      expect(report.canAutoResolve).toBe(true);
    });

    it('should return high risk when high severity conflicts exist', () => {
      const patchContent = `--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,3 @@
-  return missingLine;
+  return newValue;
`;
      const variantCode = new Map([
        ['src/utils.ts', 'function test() {\n  return somethingElse;\n}'],
      ]);

      const report = detector.detect('', variantCode, patchContent);
      expect(report.overallRisk).toBe('high');
      expect(report.canAutoResolve).toBe(false);
    });
  });

  describe('detect - canAutoResolve', () => {
    it('should allow auto-resolve for only low severity and dependency conflicts', () => {
      const baseDiff = `+import axios from 'axios';`;
      const variantCode = new Map([['a.ts', 'const x = 1;']]);

      const report = detector.detect(baseDiff, variantCode, '');
      expect(report.canAutoResolve).toBe(true);
    });
  });

  describe('detect - semantic conflicts', () => {
    it('should detect param count change when variant calls the modified function', () => {
      // Diff removes old signature, adds new one with different param count
      const baseDiff = `
-function process(data: string) {}
+function process(data: string, options: Options) {}
`;
      // Variant calls process() — will be affected by the new param
      const variantCode = new Map([
        ['src/handler.ts', `
function handleRequest() {
  process(rawData);
}
`],
      ]);

      const report = detector.detect(baseDiff, variantCode, '');
      const semantic = report.conflicts.filter((c) => c.type === 'semantic_conflict');
      expect(semantic.length).toBeGreaterThan(0);
      expect(semantic[0].severity).toBe('high');
      expect(semantic[0].description).toContain('process');
    });

    it('should detect case-change rename when variant still uses old name', () => {
      // extractSignatureChanges links removed/added by case-insensitive name equality,
      // so it detects renames like getData → GetData (case change), not getData → fetchData
      const baseDiff = `
-function getData(id: string) {}
+function GetData(id: string) {}
`;
      const variantCode = new Map([
        ['src/service.ts', `
function loadUser() {
  return getData(userId);
}
`],
      ]);

      const report = detector.detect(baseDiff, variantCode, '');
      const semantic = report.conflicts.filter((c) => c.type === 'semantic_conflict');
      expect(semantic.length).toBeGreaterThan(0);
      expect(semantic[0].severity).toBe('medium');
      expect(semantic[0].description).toContain('getData');
    });

    it('should not create conflict when variant does not call the changed function', () => {
      const baseDiff = `
-function internalHelper(x: string) {}
+function internalHelper(x: string, y: number) {}
`;
      // Variant does not call internalHelper at all
      const variantCode = new Map([
        ['src/other.ts', 'function doSomethingElse() { return 42; }'],
      ]);

      const report = detector.detect(baseDiff, variantCode, '');
      const semantic = report.conflicts.filter((c) => c.type === 'semantic_conflict');
      expect(semantic).toHaveLength(0);
    });
  });
});
