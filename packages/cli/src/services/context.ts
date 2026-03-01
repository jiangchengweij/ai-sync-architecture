import * as fs from 'fs';
import * as path from 'path';
import { AffectedFile } from '@ai-project-sync/shared';

export interface VariantContext {
  files: VariantFileContext[];
  totalTokenEstimate: number;
}

export interface VariantFileContext {
  basePath: string;
  variantPath: string;
  content: string;
  matchType: 'exact' | 'fuzzy';
}

const MAX_CONTEXT_CHARS = 12000;

export class ContextCollector {
  private variantDir: string;

  constructor(variantDir: string) {
    this.variantDir = path.resolve(variantDir);
  }

  collect(affectedFiles: AffectedFile[]): VariantContext {
    const files: VariantFileContext[] = [];
    let totalChars = 0;

    for (const file of affectedFiles) {
      if (totalChars >= MAX_CONTEXT_CHARS) break;

      const match = this.findMatchingFile(file.path);
      if (!match) continue;

      const content = fs.readFileSync(
        path.join(this.variantDir, match.variantPath),
        'utf-8'
      );

      const truncated = this.truncateContent(content, MAX_CONTEXT_CHARS - totalChars);
      totalChars += truncated.length;

      files.push({
        basePath: file.path,
        variantPath: match.variantPath,
        content: truncated,
        matchType: match.matchType,
      });
    }

    return {
      files,
      totalTokenEstimate: Math.ceil(totalChars / 4),
    };
  }

  formatForPrompt(context: VariantContext): string {
    return context.files
      .map((f) => {
        const header = `// File: ${f.variantPath} (matched from: ${f.basePath}, type: ${f.matchType})`;
        return `${header}\n${f.content}`;
      })
      .join('\n\n---\n\n');
  }

  private findMatchingFile(
    basePath: string
  ): { variantPath: string; matchType: 'exact' | 'fuzzy' } | null {
    // 1. Exact path match
    const exactPath = path.join(this.variantDir, basePath);
    if (fs.existsSync(exactPath)) {
      return { variantPath: basePath, matchType: 'exact' };
    }

    // 2. Fuzzy match by filename
    const basename = path.basename(basePath);
    const fuzzyMatch = this.searchByFilename(basename);
    if (fuzzyMatch) {
      return { variantPath: fuzzyMatch, matchType: 'fuzzy' };
    }

    // 3. Fuzzy match by stem (e.g. users.ts -> user.service.ts)
    const stem = this.extractStem(basename);
    const stemMatch = this.searchByStem(stem, path.extname(basename));
    if (stemMatch) {
      return { variantPath: stemMatch, matchType: 'fuzzy' };
    }

    return null;
  }

  private searchByFilename(filename: string): string | null {
    const results = this.walkDir(this.variantDir)
      .filter((f) => path.basename(f) === filename);

    if (results.length === 1) {
      return path.relative(this.variantDir, results[0]);
    }
    return null;
  }

  private searchByStem(stem: string, ext: string): string | null {
    const results = this.walkDir(this.variantDir)
      .filter((f) => {
        const name = path.basename(f);
        return name.endsWith(ext) && this.extractStem(name).includes(stem);
      });

    if (results.length === 1) {
      return path.relative(this.variantDir, results[0]);
    }
    return null;
  }

  private extractStem(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '')       // remove extension
      .replace(/\.(service|controller|module|spec|test)$/, '') // remove common suffixes
      .replace(/[-_]/g, '')           // normalize separators
      .toLowerCase();
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      if (entry.isDirectory()) {
        results.push(...this.walkDir(fullPath));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) return content;
    const truncated = content.slice(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n');
    return (lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated) +
      '\n// ... (truncated)';
  }
}
