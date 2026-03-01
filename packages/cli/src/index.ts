import { Command } from 'commander';
import { registerSyncCommand } from './commands/sync';
import { loadConfig } from './utils/config';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('ai-sync')
    .description('AI-powered code sync tool for variant projects')
    .version('0.1.0');

  registerSyncCommand(program);

  return program;
}

export { loadConfig };
