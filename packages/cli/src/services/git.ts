import { execSync } from 'child_process';
import * as path from 'path';
import { AffectedFile, CommitDiff } from '@ai-project-sync/shared';

export class GitService {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
    this.validateRepo();
  }

  private validateRepo(): void {
    try {
      this.exec('git rev-parse --is-inside-work-tree');
    } catch {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }
  }

  private exec(command: string): string {
    return execSync(command, {
      cwd: this.repoPath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  }

  getCommitDiff(commitHash: string): string {
    try {
      return this.exec(
        `git show ${commitHash} --format="" --patch`
      );
    } catch {
      throw new Error(`Failed to get diff for commit: ${commitHash}`);
    }
  }

  getCommitMessage(commitHash: string): string {
    try {
      return this.exec(
        `git log -1 --format="%s" ${commitHash}`
      );
    } catch {
      throw new Error(`Failed to get commit message: ${commitHash}`);
    }
  }

  getAffectedFiles(commitHash: string): AffectedFile[] {
    try {
      const output = this.exec(
        `git show ${commitHash} --format="" --numstat`
      );

      if (!output) return [];

      return output.split('\n').filter(Boolean).map((line) => {
        const [added, removed, filePath] = line.split('\t');
        const linesAdded = added === '-' ? 0 : parseInt(added, 10);
        const linesRemoved = removed === '-' ? 0 : parseInt(removed, 10);

        return {
          path: filePath,
          changeType: this.inferChangeType(linesAdded, linesRemoved, filePath),
          linesAdded,
          linesRemoved,
        };
      });
    } catch {
      throw new Error(`Failed to get affected files for commit: ${commitHash}`);
    }
  }

  getFileContent(filePath: string, ref?: string): string {
    try {
      if (ref) {
        return this.exec(`git show ${ref}:${filePath}`);
      }
      const fullPath = path.join(this.repoPath, filePath);
      const fs = require('fs');
      return fs.readFileSync(fullPath, 'utf-8');
    } catch {
      throw new Error(
        `Failed to read file: ${filePath}${ref ? ` at ref ${ref}` : ''}`
      );
    }
  }

  getFullCommitDiff(commitHash: string): CommitDiff {
    return {
      commitHash,
      message: this.getCommitMessage(commitHash),
      diff: this.getCommitDiff(commitHash),
      affectedFiles: this.getAffectedFiles(commitHash),
    };
  }

  getCurrentBranch(): string {
    return this.exec('git rev-parse --abbrev-ref HEAD');
  }

  getLatestCommitHash(): string {
    return this.exec('git rev-parse HEAD');
  }

  private inferChangeType(
    added: number,
    removed: number,
    filePath: string
  ): AffectedFile['changeType'] {
    if (filePath.includes('=>')) return 'renamed';
    if (removed === 0 && added > 0) return 'added';
    if (added === 0 && removed > 0) return 'deleted';
    return 'modified';
  }
}
