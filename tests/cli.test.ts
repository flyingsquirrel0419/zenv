import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCli } from '../src/cli';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runCli', () => {
  it('prints help text', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const code = await runCli([], { log, error });

    expect(code).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('zenv validate'));
    expect(error).not.toHaveBeenCalled();
  });

  it('returns an error for an unknown command', async () => {
    const log = vi.fn();
    const error = vi.fn();

    const code = await runCli(['unknown'], { log, error });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith('Unknown command: unknown');
  });

  it('loads the default config file and validates it', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'zenv-cli-'));
    const workingDir = path.join(tempRoot, 'workspace');
    const configPath = path.join(workingDir, 'zenv.config.mjs');
    const log = vi.fn();
    const error = vi.fn();

    await mkdir(workingDir, { recursive: true });
    await writeFile(
      configPath,
      [
        "import { z } from 'zod';",
        'export default {',
        '  server: { CLI_URL: z.string().url() },',
        "  runtimeEnv: { CLI_URL: 'https://cli.example.com' },",
        '  dotenv: false,',
        '};',
      ].join('\n'),
      'utf8',
    );

    const previousCwd = process.cwd();
    process.chdir(workingDir);

    try {
      const code = await runCli(['validate'], { log, error });

      expect(code).toBe(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Environment validation passed'));
      expect(error).not.toHaveBeenCalled();
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('returns an error when no config file can be found', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'zenv-empty-'));
    const log = vi.fn();
    const error = vi.fn();
    const previousCwd = process.cwd();
    process.chdir(tempRoot);

    try {
      const code = await runCli(['validate'], { log, error });

      expect(code).toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('No config file found'));
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('supports named config exports and async factories', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'zenv-config-'));
    const configPath = path.join(tempRoot, 'named-config.mjs');
    const log = vi.fn();
    const error = vi.fn();

    await writeFile(
      configPath,
      [
        "import { z } from 'zod';",
        'export const config = async () => ({',
        '  server: { CLI_URL: z.string().url() },',
        "  runtimeEnv: { CLI_URL: 'https://named.example.com' },",
        '  dotenv: false,',
        '});',
      ].join('\n'),
      'utf8',
    );

    const code = await runCli(['validate', configPath], { log, error });

    expect(code).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('returns an error when the config module does not export an options object', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'zenv-invalid-'));
    const configPath = path.join(tempRoot, 'invalid-config.mjs');
    const log = vi.fn();
    const error = vi.fn();

    await writeFile(configPath, 'export default 123;', 'utf8');

    const code = await runCli(['validate', configPath], { log, error });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith('Config module must export a createEnv options object.');
  });

  it('supports createEnvOptions exports and falls back to process.env', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'zenv-export-'));
    const configPath = path.join(tempRoot, 'exported-config.mjs');
    const log = vi.fn();
    const error = vi.fn();

    process.env.CLI_PROCESS_URL = 'https://process.example.com';

    await writeFile(
      configPath,
      [
        "import { z } from 'zod';",
        'export const createEnvOptions = {',
        '  server: { CLI_PROCESS_URL: z.string().url() },',
        '  dotenv: false,',
        '};',
      ].join('\n'),
      'utf8',
    );

    try {
      const code = await runCli(['validate', configPath], { log, error });

      expect(code).toBe(0);
      expect(error).not.toHaveBeenCalled();
    } finally {
      delete process.env.CLI_PROCESS_URL;
    }
  });
});
