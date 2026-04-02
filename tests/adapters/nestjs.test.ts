import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZOD_ENV, createNestEnvModule, createNestEnvToken } from '../../src/adapters/nestjs';

describe('createNestEnvModule', () => {
  it('returns a Nest-compatible dynamic module object', () => {
    const module = createNestEnvModule({
      server: {
        DATABASE_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
      },
      isGlobal: true,
      dotenv: false,
    });

    expect(module.global).toBe(true);
    expect(module.exports).toEqual([ZOD_ENV]);
    expect(module.providers[0]?.useValue).toEqual({
      DATABASE_URL: 'https://db.example.com',
    });
  });

  it('omits the global flag when not requested and respects a custom token', () => {
    const token = createNestEnvToken<{ DATABASE_URL: string }>('env');
    const module = createNestEnvModule({
      server: {
        DATABASE_URL: z.string().url(),
      },
      runtimeEnv: {
        DATABASE_URL: 'https://db.example.com',
      },
      token,
      dotenv: false,
    });

    expect('global' in module).toBe(false);
    expect(module.exports[0]).not.toBe(ZOD_ENV);
    expect(typeof module.exports[0]).toBe('symbol');
  });
});
