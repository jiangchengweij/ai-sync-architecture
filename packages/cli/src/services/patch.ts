import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface PatchFile {
  oldPath: string;
  newPath: string;
  hunks: PatchHunk[];
}

export interface ParsedPatch {
  files: PatchFile[];
}

export class PatchService {
  parsePatch(patchText: string): ParsedPatch {
    const files: PatchFile[] = [];
    const fileChunks = patchText.split(/^diff --git /m).filter(Boolean);

    for (const chunk of fileChunks) {
      const file = this.parseFileChunk(chunk);
      if (file) {
        files.push(file);
      }
    }

    // If no diff --git headers, try parsing as raw unified diff
    if (files.length === 0) {
      const file = this.parseRawUnifiedDiff(patchText);
      if (file) {
        files.push(file);
      }
    }

    return { files };
  }

  previewPatch(patch: ParsedPatch): string {
    const lines: string[] = [];

    for (const file of patch.files) {
      lines.push(chalk.bold(`--- ${file.oldPath}`));
      lines.push(chalk.bold(`+++ ${file.newPath}`));

      for (const hunk of file.hunks) {
        lines.push(
          chalk.cyan(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`)
        );
        for (const line of hunk.lines) {
          if (line.startsWith('+')) {
            lines.push(chalk.green(line));
          } else if (line.startsWith('-')) {
            lines.push(chalk.red(line));
          } else {
            lines.push(line);
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  applyPatch(targetDir: string, patch: ParsedPatch): ApplyResult[] {
    const results: ApplyResult[] = [];

    for (const file of patch.files) {
      const targetPath = path.join(targetDir, file.newPath);
      try {
        if (!fs.existsSync(targetPath)) {
          // New file — write all added lines
          const content = file.hunks
            .flatMap((h) => h.lines.filter((l) => !l.startsWith('-')).map((l) => l.slice(1)))
            .join('\n');
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, content + '\n', 'utf-8');
          results.push({ file: file.newPath, status: 'created' });
          continue;
        }

        const original = fs.readFileSync(targetPath, 'utf-8');
        const patched = this.applyHunks(original, file.hunks);
        fs.writeFileSync(targetPath, patched, 'utf-8');
        results.push({ file: file.newPath, status: 'patched' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ file: file.newPath, status: 'failed', error: message });
      }
    }

    return results;
  }

  private applyHunks(original: string, hunks: PatchHunk[]): string {
    const lines = original.split('\n');
    let offset = 0;

    for (const hunk of hunks) {
      const start = hunk.oldStart - 1 + offset;
      const removeCount = hunk.lines.filter((l) => l.startsWith('-') || (!l.startsWith('+') && !l.startsWith('-'))).length;
      const newLines: string[] = [];

      for (const line of hunk.lines) {
        if (line.startsWith('-')) continue;
        newLines.push(line.startsWith('+') ? line.slice(1) : line.slice(1));
      }

      lines.splice(start, hunk.oldLines, ...newLines);
      offset += newLines.length - hunk.oldLines;
    }

    return lines.join('\n');
  }

  private parseFileChunk(chunk: string): PatchFile | null {
    const pathMatch = chunk.match(/^a\/(.+?) b\/(.+)/m);
    if (!pathMatch) return null;

    const hunks = this.parseHunks(chunk);
    if (hunks.length === 0) return null;

    return {
      oldPath: pathMatch[1],
      newPath: pathMatch[2],
      hunks,
    };
  }

  private parseRawUnifiedDiff(text: string): PatchFile | null {
    const oldMatch = text.match(/^--- (?:a\/)?(.+)$/m);
    const newMatch = text.match(/^\+\+\+ (?:b\/)?(.+)$/m);
    if (!oldMatch || !newMatch) return null;

    const hunks = this.parseHunks(text);
    if (hunks.length === 0) return null;

    return {
      oldPath: oldMatch[1],
      newPath: newMatch[1],
      hunks,
    };
  }

  private parseHunks(text: string): PatchHunk[] {
    const hunks: PatchHunk[] = [];
    const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@.*$/gm;
    let match: RegExpExecArray | null;

    while ((match = hunkRegex.exec(text)) !== null) {
      const oldStart = parseInt(match[1], 10);
      const oldLines = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newLines = match[4] ? parseInt(match[4], 10) : 1;

      const afterHeader = text.slice(match.index + match[0].length);
      const nextHunk = afterHeader.search(/^@@ /m);
      const hunkBody = nextHunk >= 0 ? afterHeader.slice(0, nextHunk) : afterHeader;

      const lines = hunkBody
        .split('\n')
        .slice(1) // skip empty line after header
        .filter((l) => l.startsWith('+') || l.startsWith('-') || l.startsWith(' '));

      hunks.push({ oldStart, oldLines, newStart, newLines, lines });
    }

    return hunks;
  }
}

export interface ApplyResult {
  file: string;
  status: 'patched' | 'created' | 'failed';
  error?: string;
}
