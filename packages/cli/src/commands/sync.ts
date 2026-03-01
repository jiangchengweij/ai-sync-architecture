import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { GitService } from '../services/git';
import { ContextCollector } from '../services/context';
import { PatchService } from '../services/patch';
import { ClaudeLLM } from '@ai-project-sync/ai-engine';
import { loadConfig } from '../utils/config';

export interface SyncOptions {
  base: string;
  variant: string;
  commit: string;
  config?: string;
  dryRun?: boolean;
}

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync code changes from base project to variant project')
    .requiredOption('-b, --base <path>', 'Path to the base project')
    .requiredOption('-v, --variant <path>', 'Path to the variant project')
    .requiredOption('-c, --commit <hash>', 'Commit hash to sync')
    .option('--config <path>', 'Path to config file')
    .option('--dry-run', 'Preview changes without applying', false)
    .action(async (options: SyncOptions) => {
      const spinner = ora('Starting sync...').start();

      try {
        const config = loadConfig(options.config);
        const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error(
            'Missing API key. Set ANTHROPIC_API_KEY env var or apiKey in .ai-sync.json'
          );
        }

        // Step 1: Extract diff
        spinner.text = 'Extracting diff from base project...';
        const git = new GitService(options.base);
        const commitDiff = git.getFullCommitDiff(options.commit);

        if (commitDiff.affectedFiles.length === 0) {
          spinner.warn('No files affected by this commit');
          return;
        }

        spinner.text = `Found ${commitDiff.affectedFiles.length} affected file(s)`;

        // Step 2: Collect variant context
        spinner.text = 'Collecting variant project context...';
        const collector = new ContextCollector(options.variant);
        const variantContext = collector.collect(commitDiff.affectedFiles);

        if (variantContext.files.length === 0) {
          spinner.warn('No matching files found in variant project');
          return;
        }

        spinner.text = `Matched ${variantContext.files.length} file(s) in variant (~${variantContext.totalTokenEstimate} tokens)`;

        // Step 3: Call AI to generate adapted patch
        spinner.text = 'Generating adapted patch via AI...';
        const llm = new ClaudeLLM(apiKey, {
          model: config.model,
          maxTokens: config.maxTokens,
        });

        const generated = await llm.generatePatch({
          baseDiff: commitDiff.diff,
          variantContext: collector.formatForPrompt(variantContext),
          commitMessage: commitDiff.message,
        });

        spinner.succeed('Patch generated successfully');

        // Step 4: Show results
        console.log('');
        console.log(chalk.bold('Commit: ') + commitDiff.message);
        console.log(chalk.bold('Confidence: ') + formatConfidence(generated.confidence));
        console.log(chalk.bold('Explanation: ') + generated.explanation);

        if (generated.risks.length > 0) {
          console.log(chalk.bold('\nRisks:'));
          generated.risks.forEach((r) => console.log(chalk.yellow(`  - ${r}`)));
        }

        // Step 5: Preview patch
        console.log(chalk.bold('\nAdapted Patch:\n'));
        const patchService = new PatchService();
        const parsed = patchService.parsePatch(generated.patch);
        console.log(patchService.previewPatch(parsed));

        // Step 6: Confirm and apply
        if (options.dryRun) {
          console.log(chalk.gray('\n(dry-run mode — patch not applied)'));
          return;
        }

        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Apply this patch to the variant project?',
            default: false,
          },
        ]);

        if (!confirmed) {
          console.log(chalk.gray('Patch not applied.'));
          return;
        }

        const results = patchService.applyPatch(options.variant, parsed);
        console.log('');
        for (const r of results) {
          if (r.status === 'failed') {
            console.log(chalk.red(`  ✗ ${r.file}: ${r.error}`));
          } else {
            console.log(chalk.green(`  ✓ ${r.file} (${r.status})`));
          }
        }

        const failed = results.filter((r: { status: string }) => r.status === 'failed');
        if (failed.length > 0) {
          console.log(chalk.yellow(`\n${failed.length} file(s) failed to patch.`));
        } else {
          console.log(chalk.green('\nAll patches applied successfully.'));
        }
      } catch (error) {
        spinner.fail('Sync failed');
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}

function formatConfidence(confidence: number): string {
  const pct = (confidence * 100).toFixed(1) + '%';
  if (confidence >= 0.9) return chalk.green(pct);
  if (confidence >= 0.7) return chalk.yellow(pct);
  return chalk.red(pct);
}
