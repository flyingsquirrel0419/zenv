import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createEnv, EnvValidationError } from '../src';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createEnv', () => {
  it('parses valid environment variables', () => {
    const env = createEnv({
      server: {
        PORT: z.coerce.number().min(1000).max(65535),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      },
      client: {
        NEXT_PUBLIC_API_URL: z.string().url(),
      },
      runtimeEnv: {
        PORT: '8080',
        NEXT_PUBLIC_API_URL: 'https://example.com',
      },
      dotenv: false,
    });

    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('development');
    expect(env.NEXT_PUBLIC_API_URL).toBe('https://example.com');
  });

  it('throws an EnvValidationError by default when required variables are missing', () => {
    expect.hasAssertions();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });

    try {
      createEnv({
        server: {
          DATABASE_URL: z.string().url(),
        },
        runtimeEnv: {},
        dotenv: false,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).message).toContain('valid URL');
    }

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('returns defaults even when runtime values are absent', () => {
    const env = createEnv({
      server: {
        PORT: z.coerce.number().default(3000),
      },
      runtimeEnv: {},
      dotenv: false,
    });

    expect(env.PORT).toBe(3000);
  });

  it('falls back to process.env when runtimeEnv is omitted', () => {
    process.env.TEST_PROCESS_ENV = 'https://process.example.com';

    const env = createEnv({
      server: {
        TEST_PROCESS_ENV: z.string().url(),
      },
      dotenv: false,
    });

    expect(env.TEST_PROCESS_ENV).toBe('https://process.example.com');
    delete process.env.TEST_PROCESS_ENV;
  });

  it('skips validation and returns best-effort values when requested', () => {
    const env = createEnv({
      server: {
        PORT: z.coerce.number().default(3000),
        DATABASE_URL: z.string().url(),
      },
      runtimeEnv: {
        PORT: 'not-a-number',
      },
      skipValidation: true,
      dotenv: false,
    });

    expect(env.PORT).toBe('not-a-number');
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('can opt in to unsafe invalid returns after invoking a custom handler', () => {
    const handler = vi.fn();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });

    const env = createEnv({
      server: {
        DATABASE_URL: z.string().url(),
        PORT: z.coerce.number().default(3000),
      },
      runtimeEnv: {
        DATABASE_URL: 'invalid',
      },
      onValidationError: handler,
      unsafeAllowInvalid: true,
      dotenv: false,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(EnvValidationError);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe('invalid');
  });

  it('runs cross-field refinements', () => {
    const handler = vi.fn();

    const env = createEnv({
      server: {
        SMTP_HOST: z.string().optional(),
        SMTP_USER: z.string().optional(),
      },
      runtimeEnv: {
        SMTP_HOST: 'smtp.example.com',
      },
      refinements: [
        (parsed) => {
          if (parsed.SMTP_HOST && !parsed.SMTP_USER) {
            return {
              message: 'SMTP_USER is required when SMTP_HOST is set',
              path: ['SMTP_USER'],
            };
          }
        },
      ],
      onValidationError: handler,
      unsafeAllowInvalid: true,
      dotenv: false,
    });

    const error = handler.mock.calls[0]?.[0] as EnvValidationError;

    expect(env.SMTP_HOST).toBe('smtp.example.com');
    expect(error.issues[0]?.key).toBe('SMTP_USER');
    expect(error.message).toContain('SMTP_USER is required when SMTP_HOST is set');
  });

  it('ignores empty refinement results and issues without a path', () => {
    const handler = vi.fn();

    const env = createEnv({
      server: {
        SMTP_HOST: z.string().optional(),
      },
      runtimeEnv: {
        SMTP_HOST: 'smtp.example.com',
      },
      refinements: [
        () => undefined,
        () => ({
          message: 'ignored',
          path: [],
        }),
      ],
      onValidationError: handler,
      dotenv: false,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(env.SMTP_HOST).toBe('smtp.example.com');
  });

  it('loads dotenv values when requested against process.env', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'zenv-'));
    const dotenvPath = path.join(tempDir, '.env');
    const key = 'TEST_DOTENV_URL';

    await writeFile(dotenvPath, `${key}=https://dotenv.example.com\n`, 'utf8');
    delete process.env[key];

    const env = createEnv({
      server: {
        [key]: z.string().url(),
      },
      runtimeEnv: process.env,
      dotenv: {
        path: dotenvPath,
      },
    });

    expect(env[key as keyof typeof env]).toBe('https://dotenv.example.com');

    delete process.env[key];
  });

  it('does not load dotenv into a custom runtime env object', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'zenv-'));
    const dotenvPath = path.join(tempDir, '.env');
    const key = 'TEST_CUSTOM_RUNTIME';

    await writeFile(dotenvPath, `${key}=https://dotenv.example.com\n`, 'utf8');
    delete process.env[key];

    const env = createEnv({
      server: {
        PORT: z.coerce.number().default(3000),
      },
      runtimeEnv: {},
      dotenv: {
        path: dotenvPath,
      },
    });

    expect(env.PORT).toBe(3000);
    expect(process.env[key]).toBeUndefined();
  });

  it('accepts arrays of refinement issues', () => {
    const handler = vi.fn();

    createEnv({
      server: {
        SMTP_HOST: z.string().optional(),
        SMTP_USER: z.string().optional(),
        SMTP_PASS: z.string().optional(),
      },
      runtimeEnv: {
        SMTP_HOST: 'smtp.example.com',
      },
      refinements: [
        () => [
          {
            message: 'SMTP_USER missing',
            path: ['SMTP_USER'],
          },
          {
            message: 'SMTP_PASS missing',
            path: ['SMTP_PASS'],
          },
        ],
      ],
      onValidationError: handler,
      unsafeAllowInvalid: true,
      dotenv: false,
    });

    const error = handler.mock.calls[0]?.[0] as EnvValidationError;
    expect(error.issues).toHaveLength(2);
  });

  it('supports dotenv:true shorthand', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'zenv-'));
    const previousCwd = process.cwd();
    const key = 'TEST_DOTENV_TRUE';

    await writeFile(path.join(tempDir, '.env'), `${key}=https://dotenv-true.example.com\n`, 'utf8');
    delete process.env[key];
    process.chdir(tempDir);

    try {
      const env = createEnv({
        server: {
          [key]: z.string().url(),
        },
        dotenv: true,
      });

      expect(env[key as keyof typeof env]).toBe('https://dotenv-true.example.com');
    } finally {
      delete process.env[key];
      process.chdir(previousCwd);
    }
  });

  it('rejects duplicate keys across server and client schemas', () => {
    const handler = vi.fn();

    createEnv({
      server: {
        SHARED_KEY: z.string(),
      },
      client: {
        SHARED_KEY: z.string(),
      },
      runtimeEnv: {
        SHARED_KEY: 'value',
      },
      onValidationError: handler,
      unsafeAllowInvalid: true,
      dotenv: false,
    });

    const error = handler.mock.calls[0]?.[0] as EnvValidationError;
    expect(error.message).toContain('Defined in both server and client schemas');
  });

  it('supports exit-on-error as an explicit opt-in', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      createEnv({
        server: {
          DATABASE_URL: z.string().url(),
        },
        runtimeEnv: {},
        exitOnValidationError: true,
        dotenv: false,
      }),
    ).toThrow('exit:1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
  });
});
