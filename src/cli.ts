import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createEnv } from './createEnv';
import { EnvValidationError } from './types';
import type { CreateEnvOptions, EnvSchema } from './types';

type Io = Pick<typeof console, 'error' | 'log'>;

const DEFAULT_CONFIG_FILES = [
  'zenv.config.mjs',
  'zenv.config.js',
  'zenv.config.cjs',
];

interface CliModuleExport {
  default?: unknown;
  config?: unknown;
  createEnvOptions?: unknown;
}

export async function runCli(argv = process.argv.slice(2), io: Io = console): Promise<number> {
  const [command, configPathArg] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    io.log(getHelpText());
    return 0;
  }

  if (command !== 'validate') {
    io.error(`Unknown command: ${command}`);
    io.log(getHelpText());
    return 1;
  }

  const configPath = configPathArg ? path.resolve(configPathArg) : await findConfigPath(process.cwd());

  if (!configPath) {
    io.error('No config file found. Pass a path or create zenv.config.mjs/js/cjs.');
    return 1;
  }

  try {
    const module = (await import(pathToFileURL(configPath).href)) as CliModuleExport;
    const config = await resolveConfig(module);

    createEnv({
      ...config,
      runtimeEnv: config.runtimeEnv ?? process.env,
    });

    io.log(`Environment validation passed using ${path.relative(process.cwd(), configPath) || path.basename(configPath)}.`);
    return 0;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      io.error(error.message);
      return 1;
    }

    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function getHelpText(): string {
  return [
    'Usage:',
    '  zenv validate [config-path]',
    '',
    'Config module exports:',
    '  - default export with createEnv options',
    '  - named export `config` with createEnv options',
    '  - named export `createEnvOptions` with createEnv options',
  ].join('\n');
}

async function findConfigPath(cwd: string): Promise<string | undefined> {
  for (const candidate of DEFAULT_CONFIG_FILES) {
    const fullPath = path.join(cwd, candidate);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}

async function fileExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolveConfig(module: CliModuleExport): Promise<CreateEnvOptions<EnvSchema, EnvSchema, 'server'>> {
  const exported = module.default ?? module.config ?? module.createEnvOptions;
  const resolved = typeof exported === 'function' ? await exported() : exported;

  if (!resolved || typeof resolved !== 'object') {
    throw new Error('Config module must export a createEnv options object.');
  }

  return resolved as CreateEnvOptions<EnvSchema, EnvSchema, 'server'>;
}

/* c8 ignore start */
const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  void runCli().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
/* c8 ignore stop */
