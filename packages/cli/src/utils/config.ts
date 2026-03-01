import * as fs from 'fs';
import * as path from 'path';

export interface AiSyncConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  confidenceThreshold?: number;
  excludedPaths?: string[];
}

const DEFAULT_CONFIG: AiSyncConfig = {
  model: 'claude-sonnet-4-6-20250514',
  maxTokens: 4096,
  confidenceThreshold: 0.85,
  excludedPaths: [],
};

const CONFIG_FILENAME = '.ai-sync.json';

export function loadConfig(configPath?: string): AiSyncConfig {
  const filePath = configPath || findConfigFile();

  if (!filePath) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const userConfig: Partial<AiSyncConfig> = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function findConfigFile(): string | null {
  let dir = process.cwd();

  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  // Check home directory
  const homeConfig = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    CONFIG_FILENAME
  );
  if (fs.existsSync(homeConfig)) {
    return homeConfig;
  }

  return null;
}
