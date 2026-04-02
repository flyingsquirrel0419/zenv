import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createNextEnv } from '../../src/adapters/nextjs';

describe('createNextEnv', () => {
  it('returns both server and client variables on the server', () => {
    const env = createNextEnv({
      server: {
        DATABASE_URL: z.string().url(),
      },
      client: {
        NEXT_PUBLIC_SITE_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
        NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
      },
      isServer: true,
      dotenv: false,
    });

    expect(env.DATABASE_URL).toBe('https://db.example.com');
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://app.example.com');
  });

  it('returns only client variables in the browser context', () => {
    const env = createNextEnv({
      server: {
        DATABASE_URL: z.string().url(),
      },
      client: {
        NEXT_PUBLIC_SITE_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
        NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
      },
      isServer: false,
      dotenv: false,
    });

    expect(env).toEqual({
      NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
    });
  });

  it('requires the Next.js client prefix', () => {
    expect(() =>
      createNextEnv({
        client: {
          API_URL: z.string().url(),
        },
        runtimeEnv: {
          API_URL: 'https://app.example.com',
        },
        isServer: false,
        dotenv: false,
      }),
    ).toThrow('NEXT_PUBLIC_');
  });

  it('defaults to server mode when isServer is omitted in Node', () => {
    const env = createNextEnv({
      server: {
        DATABASE_URL: z.string().url(),
      },
      client: {
        NEXT_PUBLIC_SITE_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
        NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
      },
      dotenv: false,
    });

    expect(env.DATABASE_URL).toBe('https://db.example.com');
  });

  it('allows server-only schemas without client variables', () => {
    const env = createNextEnv({
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
