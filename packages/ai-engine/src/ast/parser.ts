import * as ts from 'typescript';
import * as crypto from 'crypto';

export interface ParsedFunction {
  name: string;
  kind: 'function' | 'method' | 'arrow' | 'constructor';
  startLine: number;
  endLine: number;
  params: string[];
  returnType: string;
  code: string;
  className?: string;
  isAsync: boolean;
  isExported: boolean;
}

export interface ParsedFile {
  functions: ParsedFunction[];
  imports: string[];
  exports: string[];
  language: 'typescript' | 'javascript';
}

export class ASTParser {
  private supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  supportsFile(filePath: string): boolean {
    return this.supportedExtensions.some((ext) => filePath.endsWith(ext));
  }

  parseFile(content: string, filePath?: string): ParsedFile {
    const isTS = !filePath || filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const scriptKind = filePath?.endsWith('.tsx') || filePath?.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : isTS ? ts.ScriptKind.TS : ts.ScriptKind.JS;

    const sourceFile = ts.createSourceFile(
      filePath || 'source.ts',
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );

    const functions: ParsedFunction[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    this.visitNode(sourceFile, sourceFile, content, functions, imports, exports);

    return {
      functions,
      imports,
      exports,
      language: isTS ? 'typescript' : 'javascript',
    };
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

  private visitNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    content: string,
    functions: ParsedFunction[],
    imports: string[],
    exports: string[],
    className?: string
  ): void {
    // Import declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpec = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpec)) {
        imports.push(moduleSpec.text);
      }
    }

    // Export declarations
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        exports.push(node.moduleSpecifier.text);
      }
    }

    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(this.extractFunction(node, sourceFile, content, 'function'));
    }

    // Class declarations
    if (ts.isClassDeclaration(node)) {
      const clsName = node.name?.getText(sourceFile);
      if (clsName) {
        exports.push(clsName);
      }
      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
          const kind = ts.isConstructorDeclaration(member) ? 'constructor' : 'method';
          functions.push(this.extractFunction(member, sourceFile, content, kind, clsName));
        }
      });
      return; // Don't recurse into class — already handled members
    }

    // Variable declarations with arrow functions
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isArrowFunction(decl.initializer) && ts.isIdentifier(decl.name)) {
          functions.push(
            this.extractArrowFunction(decl, decl.initializer, sourceFile, content, node)
          );
        }
      }
      return;
    }

    ts.forEachChild(node, (child) =>
      this.visitNode(child, sourceFile, content, functions, imports, exports, className)
    );
  }

  private extractFunction(
    node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ConstructorDeclaration,
    sourceFile: ts.SourceFile,
    content: string,
    kind: ParsedFunction['kind'],
    className?: string
  ): ParsedFunction {
    const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    let name: string;
    if (ts.isConstructorDeclaration(node)) {
      name = 'constructor';
    } else {
      name = node.name?.getText(sourceFile) || 'anonymous';
    }

    const params = node.parameters.map((p) => p.getText(sourceFile));
    const returnType = node.type?.getText(sourceFile) || 'void';
    const isAsync = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    ) || false;

    return {
      name,
      kind,
      startLine: startPos.line + 1,
      endLine: endPos.line + 1,
      params,
      returnType,
      code: content.slice(node.getStart(sourceFile), node.getEnd()),
      className,
      isAsync,
      isExported,
    };
  }

  private extractArrowFunction(
    decl: ts.VariableDeclaration,
    arrow: ts.ArrowFunction,
    sourceFile: ts.SourceFile,
    content: string,
    statement: ts.VariableStatement
  ): ParsedFunction {
    const startPos = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
    const endPos = sourceFile.getLineAndCharacterOfPosition(statement.getEnd());

    const name = (decl.name as ts.Identifier).text;
    const params = arrow.parameters.map((p) => p.getText(sourceFile));
    const returnType = arrow.type?.getText(sourceFile) || 'void';
    const isAsync = arrow.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = statement.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    ) || false;

    return {
      name,
      kind: 'arrow',
      startLine: startPos.line + 1,
      endLine: endPos.line + 1,
      params,
      returnType,
      code: content.slice(statement.getStart(sourceFile), statement.getEnd()),
      isAsync,
      isExported,
    };
  }
}
