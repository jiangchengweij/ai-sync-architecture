import { ASTParser, ParsedFunction } from './parser';
import { ChangeType } from '@ai-project-sync/shared';

export interface StructuredDiff {
  addedFunctions: ParsedFunction[];
  modifiedFunctions: ModifiedFunction[];
  deletedFunctions: ParsedFunction[];
  changeType: ChangeType;
  summary: string;
}

export interface ModifiedFunction {
  oldFunc: ParsedFunction;
  newFunc: ParsedFunction;
  changeDescription: string;
}

export class DiffEngine {
  private parser: ASTParser;

  constructor() {
    this.parser = new ASTParser();
  }

  generateStructuredDiff(oldContent: string, newContent: string, filePath?: string): StructuredDiff {
    const oldParsed = this.parser.parseFile(oldContent, filePath);
    const newParsed = this.parser.parseFile(newContent, filePath);

    const oldFuncMap = new Map(oldParsed.functions.map((f) => [this.funcKey(f), f]));
    const newFuncMap = new Map(newParsed.functions.map((f) => [this.funcKey(f), f]));

    const addedFunctions: ParsedFunction[] = [];
    const modifiedFunctions: ModifiedFunction[] = [];
    const deletedFunctions: ParsedFunction[] = [];

    // Find added and modified
    for (const [key, newFunc] of newFuncMap) {
      const oldFunc = oldFuncMap.get(key);
      if (!oldFunc) {
        addedFunctions.push(newFunc);
      } else if (oldFunc.code !== newFunc.code) {
        modifiedFunctions.push({
          oldFunc,
          newFunc,
          changeDescription: this.describeChange(oldFunc, newFunc),
        });
      }
    }

    // Find deleted
    for (const [key, oldFunc] of oldFuncMap) {
      if (!newFuncMap.has(key)) {
        deletedFunctions.push(oldFunc);
      }
    }

    const changeType = this.inferChangeType(addedFunctions, modifiedFunctions, deletedFunctions);
    const summary = this.buildSummary(addedFunctions, modifiedFunctions, deletedFunctions);

    return { addedFunctions, modifiedFunctions, deletedFunctions, changeType, summary };
  }

  private funcKey(func: ParsedFunction): string {
    return func.className ? `${func.className}.${func.name}` : func.name;
  }

  private describeChange(oldFunc: ParsedFunction, newFunc: ParsedFunction): string {
    const changes: string[] = [];

    if (oldFunc.params.length !== newFunc.params.length) {
      changes.push(`params changed: ${oldFunc.params.length} → ${newFunc.params.length}`);
    }
    if (oldFunc.returnType !== newFunc.returnType) {
      changes.push(`return type: ${oldFunc.returnType} → ${newFunc.returnType}`);
    }
    if (oldFunc.isAsync !== newFunc.isAsync) {
      changes.push(newFunc.isAsync ? 'made async' : 'made sync');
    }

    const oldLines = oldFunc.endLine - oldFunc.startLine;
    const newLines = newFunc.endLine - newFunc.startLine;
    if (Math.abs(newLines - oldLines) > 2) {
      changes.push(`size: ${oldLines} → ${newLines} lines`);
    }

    return changes.length > 0 ? changes.join('; ') : 'body modified';
  }

  private inferChangeType(
    added: ParsedFunction[],
    modified: ModifiedFunction[],
    deleted: ParsedFunction[]
  ): ChangeType {
    // Mostly additions → feature
    if (added.length > 0 && deleted.length === 0 && modified.length <= 1) {
      return 'feature';
    }

    // Only modifications, small changes → bug_fix
    if (added.length === 0 && deleted.length === 0 && modified.length > 0) {
      const allSmall = modified.every((m) => {
        const oldLen = m.oldFunc.endLine - m.oldFunc.startLine;
        const newLen = m.newFunc.endLine - m.newFunc.startLine;
        return Math.abs(newLen - oldLen) <= 5;
      });
      if (allSmall) return 'bug_fix';
    }

    // Deletions + additions with similar count → refactor
    if (deleted.length > 0 && added.length > 0 && Math.abs(added.length - deleted.length) <= 1) {
      return 'refactor';
    }

    // Mostly deletions → refactor
    if (deleted.length > added.length) {
      return 'refactor';
    }

    return 'feature';
  }

  private buildSummary(
    added: ParsedFunction[],
    modified: ModifiedFunction[],
    deleted: ParsedFunction[]
  ): string {
    const parts: string[] = [];

    if (added.length > 0) {
      parts.push(`Added: ${added.map((f) => f.name).join(', ')}`);
    }
    if (modified.length > 0) {
      parts.push(`Modified: ${modified.map((m) => m.newFunc.name).join(', ')}`);
    }
    if (deleted.length > 0) {
      parts.push(`Deleted: ${deleted.map((f) => f.name).join(', ')}`);
    }

    return parts.join(' | ') || 'No structural changes detected';
  }
}
