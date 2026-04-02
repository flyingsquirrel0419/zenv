# Getting Started

## Installation

```bash
npm install zod zod-env
```

`dotenv` is bundled as a dependency, so you do not need to install it separately.

## Basic Usage

```ts
import { createEnv } from 'zod-env';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
});
```

`createEnv` throws `EnvValidationError` by default when validation fails.

## Next.js

```ts
import { createNextEnv } from 'zod-env/nextjs';
import { z } from 'zod';

export const env = createNextEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

If you want a client-only type, create a separate browser-safe env module with `isServer: false`.

## Vite

```ts
import { createViteEnv } from 'zod-env/vite';
import { z } from 'zod';

export const env = createViteEnv({
  client: {
    VITE_API_URL: z.string().url(),
  },
  runtimeEnv: import.meta.env,
  isServer: false,
});
```

## NestJS

```ts
import { Inject, Injectable, Module } from '@nestjs/common';
import { createNestEnvModule, createNestEnvToken } from 'zod-env/nestjs';
import { z } from 'zod';

type AppEnv = {
  DATABASE_URL: string;
};

const ENV_TOKEN = createNestEnvToken<AppEnv>('ENV_TOKEN');

@Module({
  imports: [
    createNestEnvModule({
      server: {
        DATABASE_URL: z.string().url(),
      },
      token: ENV_TOKEN,
      isGlobal: true,
    }),
  ],
})
export class AppModule {}

@Injectable()
export class AppService {
  constructor(@Inject(ENV_TOKEN) private readonly env: AppEnv) {}
}
```

## CI Validation

```bash
npx zod-env validate
```

## Validation Behavior

`createEnv` throws `EnvValidationError` by default. Use `exitOnValidationError: true` if you want startup-exit behavior, or `unsafeAllowInvalid: true` only when you explicitly want best-effort invalid values returned after `onValidationError`.
