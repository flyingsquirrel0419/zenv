import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createNodeEnv } from '../../src/adapters/node';

describe('createNodeEnv', () => {
  it('creates a server-only environment', () => {
    const env = createNodeEnv({
      server: {
        PORT: z.coerce.number().default(3000),
      },
      runtimeEnv: {
        PORT: '4000',
      },
      dotenv: false,
    });

    expect(env.PORT).toBe(4000);
  });

  it('exits by default on validation errors', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });

    expect(() =>
      createNodeEnv({
        server: {
          DATABASE_URL: z.string().url(),
        },
        runtimeEnv: {},
        dotenv: false,
      }),
    ).toThrow('exit:1');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
