import { CompositeCodeMapper } from '../../src/mapping/strategies/composite-mapper';
import { FileFunction, createMappingContext } from '../../src/mapping/strategies/types';

function makeFileFunction(overrides: Partial<FileFunction> = {}): FileFunction {
  return {
    filePath: 'src/utils.ts',
    func: {
      name: 'doSomething',
      kind: 'function',
      params: ['a: string'],
      returnType: 'void',
      startLine: 1,
      endLine: 5,
      isAsync: false,
      isExported: true,
      code: 'function doSomething(a: string) {}',
    },
    fingerprint: 'abc123',
    key: 'src/utils.ts:doSomething',
    ...overrides,
  };
}

describe('CompositeCodeMapper', () => {
  describe('constructor', () => {
    test('creates mapper with default strategies', () => {
        const mapper = new CompositeCodeMapper();
        expect(mapper).toBeDefined();
      });
  });

  describe('buildMapping', () => {
    test('maps identical functions', async () => {
        const mapper = new CompositeCodeMapper();

        const baseFiles = new Map([
        ['src/utils.ts', `
          export function helper() { return 1; }
          export function process(data: string) { return data; }
        `],
      ]);

        const variantFiles = new Map([
        ['src/utils.ts', `
          export function helper() { return 1; }
          export function process(data: string) { return data; }
        `],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);

      expect(result.mappings).toHaveLength(2);
      // Exact name matches should have high confidence
      expect(result.mappings.every((m) => m.confidence >= 0.85)).toBe(true);
    });

    test('maps renamed functions with same fingerprint', async () => {
        const mapper = new CompositeCodeMapper();

        const baseFiles = new Map([
        ['src/a.ts', `export function helper() { return 1; }`],
      ]);

        const variantFiles = new Map([
        ['src/b.ts', `export function helper() { return 1; }`],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);

      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].matchType).toBe('fingerprint');
    });

    test('returns unmapped functions', async () => {
        const mapper = new CompositeCodeMapper();

        const baseFiles = new Map([
        ['src/a.ts', `
          export function funcA() { return 1; }
          export function funcB() { return 2; }
        `],
      ]);

        const variantFiles = new Map([
        ['src/b.ts', `export function funcX() { return 1; }`],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);

      // At least one function should be unmapped
      expect(result.unmappedBase.length + result.unmappedVariant.length).toBeGreaterThan(0);
    });

    test('handles empty inputs', async () => {
        const mapper = new CompositeCodeMapper();

        const result = await mapper.buildMapping(new Map(), new Map());

        expect(result.mappings).toHaveLength(0);
        expect(result.unmappedBase).toHaveLength(0);
        expect(result.unmappedVariant).toHaveLength(0);
    });

    test('sorts mappings by confidence descending', async () => {
        const mapper = new CompositeCodeMapper();

        const baseFiles = new Map([
        ['src/a.ts', `
          export function exact() { return 1; }
          export function similar() { return 2; }
        `],
      ]);

        const variantFiles = new Map([
        ['src/a.ts', `
          export function exact() { return 1; }
          export function similar() { return 2; }
        `],
      ]);

      const result = await mapper.buildMapping(baseFiles, variantFiles);

      // All should have same high confidence since exact matches
      const confidences = result.mappings.map((m) => m.confidence);
      expect(confidences).toEqual([...confidences].sort((a, b) => b - a));
    });
  });

  describe('backward compatibility', () => {
    test('maintains same API as original CodeMapper', async () => {
        const mapper = new CompositeCodeMapper();

        // Verify mapper has buildMapping method
        expect(typeof mapper.buildMapping).toBe('function');
      });
  });
});
