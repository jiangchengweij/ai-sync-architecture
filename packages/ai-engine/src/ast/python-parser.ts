import { ParsedFunction, ParsedFile } from './parser';
import * as crypto from 'crypto';

export class PythonParser {
  private supportedExtensions = ['.py'];

  supportsFile(filePath: string): boolean {
    return this.supportedExtensions.some((ext) => filePath.endsWith(ext));
  }

  parseFile(content: string): ParsedFile {
    const lines = content.split('\n');
    const functions: ParsedFunction[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Imports
      const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
      if (importMatch) {
        imports.push(importMatch[1] || importMatch[2].split(',')[0].trim());
        i++;
        continue;
      }

      // Decorators + function/method definitions
      const decorators: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('@')) {
        decorators.push(lines[i].trim());
        i++;
      }

      if (i >= lines.length) break;

      const funcMatch = lines[i].match(
        /^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+))?\s*:/
      );

      if (funcMatch) {
        const indent = funcMatch[1].length;
        const isAsync = !!funcMatch[2];
        const name = funcMatch[3];
        const paramsStr = funcMatch[4];
        const returnType = funcMatch[5]?.trim() || 'None';
        const startLine = i + 1 - decorators.length;

        // Determine if it's a method (indented inside a class)
        const className = this.findEnclosingClass(lines, i);
        const kind = className ? (name === '__init__' ? 'constructor' : 'method') : 'function';

        // Find end of function body
        const endLine = this.findBlockEnd(lines, i, indent);

        const params = paramsStr
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p && p !== 'self' && p !== 'cls');

        const codeLines = lines.slice(i - decorators.length, endLine);
        const code = codeLines.join('\n');

        functions.push({
          name: name === '__init__' ? 'constructor' : name,
          kind,
          startLine,
          endLine,
          params,
          returnType,
          code,
          className: className || undefined,
          isAsync,
          isExported: !name.startsWith('_'),
        });

        // Track top-level functions as exports
        if (indent === 0 && !name.startsWith('_')) {
          exports.push(name);
        }

        i = endLine;
        continue;
      }

      // Class definitions — track as exports
      const classMatch = lines[i].match(/^class\s+(\w+)/);
      if (classMatch && !classMatch[1].startsWith('_')) {
        exports.push(classMatch[1]);
      }

      i++;
    }

    return { functions, imports, exports, language: 'javascript' as any };
  }

  generateFingerprint(func: ParsedFunction): string {
    const structure = [
      func.kind,
      func.name,
      func.params.length.toString(),
      func.returnType,
      func.isAsync ? 'async' : 'sync',
    ].join(':');
    return crypto.createHash('sha256').update(structure).digest('hex').slice(0, 16);
  }

  private findEnclosingClass(lines: string[], funcLineIndex: number): string | null {
    const funcIndent = this.getIndent(lines[funcLineIndex]);
    if (funcIndent === 0) return null;

    for (let i = funcLineIndex - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.trim() === '' || line.trimStart().startsWith('#') || line.trimStart().startsWith('@')) {
        continue;
      }
      const lineIndent = this.getIndent(line);
      if (lineIndent < funcIndent) {
        const classMatch = line.match(/^\s*class\s+(\w+)/);
        if (classMatch) return classMatch[1];
        return null;
      }
    }
    return null;
  }

  private findBlockEnd(lines: string[], startIndex: number, baseIndent: number): number {
    let i = startIndex + 1;
    while (i < lines.length) {
      const line = lines[i];
      // Skip blank lines and comments
      if (line.trim() === '' || line.trimStart().startsWith('#')) {
        i++;
        continue;
      }
      const indent = this.getIndent(line);
      if (indent <= baseIndent) {
        return i;
      }
      i++;
    }
    return i;
  }

  private getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }
}
