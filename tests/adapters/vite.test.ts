import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createViteEnv } from '../../src/adapters/vite';

describe('createViteEnv', () => {
  it('supports the default VITE_ prefix', () => {
    const env = createViteEnv({
      client: {
        VITE_API_URL: z.string().url(),
      },
      runtimeEnv: {
        VITE_API_URL: 'https://vite.example.com',
      },
      isServer: false,
      dotenv: false,
    });

    expect(env.VITE_API_URL).toBe('https://vite.example.com');
  });

  it('supports a custom prefix', () => {
    const env = createViteEnv({
      client: {
        PUBLIC_API_URL: z.string().url(),
      },
      clientPrefix: 'PUBLIC_',
      runtimeEnv: {
        PUBLIC_API_URL: 'https://vite.example.com',
      },
      isServer: false,
      dotenv: false,
    });

    expect(env.PUBLIC_API_URL).toBe('https://vite.example.com');
  });

  it('rejects invalid client prefixes', () => {
    expect(() =>
      createViteEnv({
        client: {
          API_URL: z.string().url(),
        },
        runtimeEnv: {
          API_URL: 'https://vite.example.com',
        },
        isServer: false,
        dotenv: false,
      }),
    ).toThrow('VITE_');
  });

  it('defaults to server mode when isServer is omitted in Node', () => {
    const env = createViteEnv({
      server: {
        DATABASE_URL: z.string().url(),
      },
      client: {
        VITE_API_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
        VITE_API_URL: 'https://vite.example.com',
      },
      dotenv: false,
    });

    expect(env.DATABASE_URL).toBe('https://db.example.com');
  });

  it('allows server-only schemas without client variables', () => {
    const env = createViteEnv({
      server: {
        DATABASE_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
      },
      dotenv: false,
    });

    expect(env.DATABASE_URL).toBe('https://db.example.com');
  });
});
