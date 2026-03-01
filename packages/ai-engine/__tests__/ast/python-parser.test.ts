import { PythonParser } from '../../src/ast/python-parser';

describe('PythonParser', () => {
  let parser: PythonParser;

  beforeEach(() => {
    parser = new PythonParser();
  });

  describe('supportsFile', () => {
    it('should support .py files', () => {
      expect(parser.supportsFile('main.py')).toBe(true);
      expect(parser.supportsFile('src/utils.py')).toBe(true);
    });

    it('should not support non-Python files', () => {
      expect(parser.supportsFile('index.ts')).toBe(false);
      expect(parser.supportsFile('style.css')).toBe(false);
    });
  });

  describe('parseFile - functions', () => {
    it('should extract top-level functions', () => {
      const code = `def greet(name: str) -> str:
    return f"Hello, {name}!"

def add(a: int, b: int) -> int:
    return a + b
`;
      const result = parser.parseFile(code);
      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('greet');
      expect(result.functions[0].kind).toBe('function');
      expect(result.functions[0].params).toEqual(['name: str']);
      expect(result.functions[0].returnType).toBe('str');
      expect(result.functions[1].name).toBe('add');
    });

    it('should detect async functions', () => {
      const code = `async def fetch_users(page: int) -> list:
    return await db.query(page)
`;
      const result = parser.parseFile(code);
      expect(result.functions[0].isAsync).toBe(true);
      expect(result.functions[0].name).toBe('fetch_users');
    });

    it('should filter out self/cls params', () => {
      const code = `class Foo:
    def bar(self, x: int) -> None:
        pass

    @classmethod
    def create(cls, data: dict) -> None:
        pass
`;
      const result = parser.parseFile(code);
      const bar = result.functions.find((f) => f.name === 'bar');
      expect(bar!.params).toEqual(['x: int']);
      const create = result.functions.find((f) => f.name === 'create');
      expect(create!.params).toEqual(['data: dict']);
    });
  });

  describe('parseFile - class methods', () => {
    it('should extract methods with className', () => {
      const code = `class UserService:
    def __init__(self, db):
        self.db = db

    async def find_by_id(self, user_id: str) -> dict:
        return await self.db.find(user_id)
`;
      const result = parser.parseFile(code);
      expect(result.functions).toHaveLength(2);

      const init = result.functions.find((f) => f.name === 'constructor');
      expect(init).toBeDefined();
      expect(init!.kind).toBe('constructor');
      expect(init!.className).toBe('UserService');

      const find = result.functions.find((f) => f.name === 'find_by_id');
      expect(find).toBeDefined();
      expect(find!.kind).toBe('method');
      expect(find!.isAsync).toBe(true);
      expect(find!.className).toBe('UserService');
    });
  });

  describe('parseFile - imports', () => {
    it('should extract import paths', () => {
      const code = `import os
from pathlib import Path
from typing import List, Optional
`;
      const result = parser.parseFile(code);
      expect(result.imports).toContain('os');
      expect(result.imports).toContain('pathlib');
      expect(result.imports).toContain('typing');
    });
  });

  describe('parseFile - exports', () => {
    it('should treat non-underscore functions and classes as exports', () => {
      const code = `class PublicClass:
    pass

def public_func():
    pass

def _private_func():
    pass
`;
      const result = parser.parseFile(code);
      expect(result.exports).toContain('PublicClass');
      expect(result.exports).toContain('public_func');
      expect(result.exports).not.toContain('_private_func');
    });
  });

  describe('generateFingerprint', () => {
    it('should be consistent for same structure', () => {
      const func = {
        name: 'fetch', kind: 'function' as const,
        startLine: 1, endLine: 5, params: ['url: str'],
        returnType: 'dict', code: '', isAsync: true, isExported: true,
      };
      expect(parser.generateFingerprint(func)).toBe(parser.generateFingerprint(func));
    });
  });
});
