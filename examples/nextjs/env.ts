import { z } from 'zod';

import { createNextEnv } from '../../src/adapters/nextjs';

export const env = createNextEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string().default('zod-env demo'),
  },
  runtimeEnv: process.env,
});
