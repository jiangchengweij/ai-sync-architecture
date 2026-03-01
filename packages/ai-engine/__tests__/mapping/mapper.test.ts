import { CodeMapper } from '../../src/mapping/mapper';

describe('CodeMapper', () => {
  let mapper: CodeMapper;

  beforeEach(() => {
    mapper = new CodeMapper(); // no embedder for unit tests
  });

  describe('buildMapping - exact name match', () => {
    it('should match functions with same file path and name', async () => {
      const baseFiles = new Map([
        ['src/utils.ts', 'function add(a: number, b: number): number { return a + b; }'],
      ]);
      const variantFiles = new Map([
        ['src/utils.ts', 'function add(a: number, b: number): number { return a + b; }'],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].matchType).toBe('exact_name');
      expect(result.mappings[0].confidence).toBe(0.98);
      expect(result.unmappedBase).toHaveLength(0);
      expect(result.unmappedVariant).toHaveLength(0);
    });

    it('should match multiple functions in same file', async () => {
      const code = `
function foo() { return 1; }
function bar() { return 2; }
`;
      const baseFiles = new Map([['a.ts', code]]);
      const variantFiles = new Map([['a.ts', code]]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.mappings).toHaveLength(2);
    });
  });

  describe('buildMapping - fingerprint match', () => {
    it('should match functions with same structure but different file paths', async () => {
      const baseFiles = new Map([
        ['src/api/users.ts', 'function fetchUsers(page: number): Promise<void> { return fetch(); }'],
      ]);
      const variantFiles = new Map([
        ['src/services/users.ts', 'function fetchUsers(page: number): Promise<void> { return api.get(); }'],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].matchType).toBe('fingerprint');
      expect(result.mappings[0].confidence).toBe(0.85);
    });
  });

  describe('buildMapping - unmapped functions', () => {
    it('should report unmapped base functions', async () => {
      const baseFiles = new Map([
        ['a.ts', 'function onlyInBase(): void {}'],
      ]);
      const variantFiles = new Map([
        ['b.ts', 'function differentFunc(x: string): string { return x; }'],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.unmappedBase).toHaveLength(1);
      expect(result.unmappedBase[0]).toContain('onlyInBase');
    });

    it('should report unmapped variant functions', async () => {
      const baseFiles = new Map<string, string>([]);
      const variantFiles = new Map([
        ['a.ts', 'function variantOnly(): void {}'],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.unmappedVariant).toHaveLength(1);
    });
  });

  describe('buildMapping - class methods', () => {
    it('should match class methods by className.methodName', async () => {
      const baseCode = `
class UserService {
  findById(id: string): void {}
}
`;
      const variantCode = `
class UserService {
  findById(id: string): void { return this.db.find(id); }
}
`;
      const baseFiles = new Map([['svc.ts', baseCode]]);
      const variantFiles = new Map([['svc.ts', variantCode]]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].baseFunctionName).toBe('findById');
      expect(result.mappings[0].matchType).toBe('exact_name');
    });
  });

  describe('buildMapping - Python files', () => {
    it('should map Python functions', async () => {
      const baseFiles = new Map([
        ['utils.py', 'def calculate(x: int, y: int) -> int:\n    return x + y\n'],
      ]);
      const variantFiles = new Map([
        ['utils.py', 'def calculate(x: int, y: int) -> int:\n    return x * y\n'],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].baseFunctionName).toBe('calculate');
    });
  });

  describe('buildMapping - sorting', () => {
    it('should sort mappings by confidence descending', async () => {
      const baseFiles = new Map([
        ['a.ts', 'function same(): void {}'],
        ['b.ts', 'function moved(): void {}'],
      ]);
      const variantFiles = new Map([
        ['a.ts', 'function same(): void {}'],
        ['c.ts', 'function moved(): void {}'],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);
      expect(result.mappings.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < result.mappings.length; i++) {
        expect(result.mappings[i - 1].confidence).toBeGreaterThanOrEqual(
          result.mappings[i].confidence
        );
      }
    });
  });
});
