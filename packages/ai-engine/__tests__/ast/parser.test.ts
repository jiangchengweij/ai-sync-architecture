import { ASTParser } from '../../src/ast/parser';

describe('ASTParser', () => {
  let parser: ASTParser;

  beforeEach(() => {
    parser = new ASTParser();
  });

  describe('supportsFile', () => {
    it('should support TS/JS files', () => {
      expect(parser.supportsFile('src/index.ts')).toBe(true);
      expect(parser.supportsFile('src/app.tsx')).toBe(true);
      expect(parser.supportsFile('src/utils.js')).toBe(true);
      expect(parser.supportsFile('src/comp.jsx')).toBe(true);
    });

    it('should not support non-TS/JS files', () => {
      expect(parser.supportsFile('main.py')).toBe(false);
      expect(parser.supportsFile('style.css')).toBe(false);
      expect(parser.supportsFile('README.md')).toBe(false);
    });
  });

  describe('parseFile - function declarations', () => {
    it('should extract named function declarations', () => {
      const code = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;
      const result = parser.parseFile(code);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('greet');
      expect(result.functions[0].kind).toBe('function');
      expect(result.functions[0].params).toEqual(['name: string']);
      expect(result.functions[0].returnType).toBe('string');
      expect(result.functions[0].isAsync).toBe(false);
    });

    it('should detect async functions', () => {
      const code = `
async function fetchUsers(page: number): Promise<User[]> {
  return await api.get('/users', { page });
}
`;
      const result = parser.parseFile(code);
      expect(result.functions[0].isAsync).toBe(true);
      expect(result.functions[0].returnType).toBe('Promise<User[]>');
    });

    it('should detect exported functions', () => {
      const code = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
      const result = parser.parseFile(code);
      expect(result.functions[0].isExported).toBe(true);
    });
  });

  describe('parseFile - arrow functions', () => {
    it('should extract arrow functions in variable declarations', () => {
      const code = `
const multiply = (a: number, b: number): number => a * b;
`;
      const result = parser.parseFile(code);
      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('multiply');
      expect(result.functions[0].kind).toBe('arrow');
      expect(result.functions[0].params).toEqual(['a: number', 'b: number']);
    });

    it('should detect exported arrow functions', () => {
      const code = `
export const handler = async (req: Request): Promise<Response> => {
  return new Response('ok');
};
`;
      const result = parser.parseFile(code);
      expect(result.functions[0].isExported).toBe(true);
      expect(result.functions[0].isAsync).toBe(true);
    });
  });

  describe('parseFile - class methods', () => {
    it('should extract class methods with className', () => {
      const code = `
class UserService {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User> {
    return this.db.find(id);
  }

  delete(id: string): void {
    this.db.remove(id);
  }
}
`;
      const result = parser.parseFile(code);
      expect(result.functions).toHaveLength(3);

      const ctor = result.functions.find((f) => f.name === 'constructor');
      expect(ctor).toBeDefined();
      expect(ctor!.kind).toBe('constructor');
      expect(ctor!.className).toBe('UserService');

      const findById = result.functions.find((f) => f.name === 'findById');
      expect(findById).toBeDefined();
      expect(findById!.kind).toBe('method');
      expect(findById!.isAsync).toBe(true);
      expect(findById!.className).toBe('UserService');

      const del = result.functions.find((f) => f.name === 'delete');
      expect(del).toBeDefined();
      expect(del!.isAsync).toBe(false);
    });
  });

  describe('parseFile - imports and exports', () => {
    it('should extract import paths', () => {
      const code = `
import { Router } from 'express';
import { UserService } from '../services/user.service';
import * as path from 'path';
`;
      const result = parser.parseFile(code);
      expect(result.imports).toEqual(['express', '../services/user.service', 'path']);
    });
  });

  describe('parseFile - line numbers', () => {
    it('should report correct start and end lines', () => {
      const code = `import { x } from 'y';

function first() {
  return 1;
}

function second() {
  return 2;
}
`;
      const result = parser.parseFile(code);
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('first');
      expect(result.functions[0].startLine).toBe(3);
      expect(result.functions[0].endLine).toBe(5);
      expect(result.functions[1].name).toBe('second');
      expect(result.functions[1].startLine).toBe(7);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same structure', () => {
      const func = {
        name: 'fetchUsers',
        kind: 'function' as const,
        startLine: 1,
        endLine: 10,
        params: ['page: number', 'size: number'],
        returnType: 'Promise<User[]>',
        code: '',
        isAsync: true,
        isExported: false,
      };

      const fp1 = parser.generateFingerprint(func);
      const fp2 = parser.generateFingerprint(func);
      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(16);
    });

    it('should generate different fingerprints for different structures', () => {
      const func1 = {
        name: 'fetchUsers',
        kind: 'function' as const,
        startLine: 1, endLine: 10,
        params: ['page: number'],
        returnType: 'void',
        code: '', isAsync: false, isExported: false,
      };
      const func2 = {
        name: 'fetchUsers',
        kind: 'function' as const,
        startLine: 1, endLine: 10,
        params: ['page: number', 'size: number'],
        returnType: 'void',
        code: '', isAsync: false, isExported: false,
      };

      expect(parser.generateFingerprint(func1)).not.toBe(parser.generateFingerprint(func2));
    });
  });

  describe('parseFile - JavaScript', () => {
    it('should parse plain JavaScript', () => {
      const code = `
function add(a, b) {
  return a + b;
}

const sub = (a, b) => a - b;
`;
      const result = parser.parseFile(code, 'utils.js');
      expect(result.language).toBe('javascript');
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('add');
      expect(result.functions[1].name).toBe('sub');
    });
  });
});
