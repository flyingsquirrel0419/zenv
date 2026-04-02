import { z } from 'zod';

import { createNodeEnv } from '../../src/adapters/node';

export const env = createNodeEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  runtimeEnv: process.env,
});
