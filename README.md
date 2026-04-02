# zenv

**Validate your environment variables with Zod. Break loudly at startup, not silently at runtime.**

```
❌ Invalid environment variables:

  DATABASE_URL  -> Required (got: undefined)
                  Expected: valid URL (e.g. postgresql://user:pass@host/db)

  JWT_SECRET    -> Too short (got: "secret123", length: 9)
                  Expected: string with minimum 32 characters

  PORT          -> Invalid number (got: "not-a-number")
                  Expected: number between 1000 and 65535

Fix the above variables in your .env file and restart the server.
```

[![CI](https://github.com/flyingsquirrel0419/zenv/actions/workflows/ci.yml/badge.svg)](https://github.com/flyingsquirrel0419/zenv/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## Why

You're already using Zod for everything else. Your environment variables shouldn't be the exception.

`dotenv` gives you strings with zero type safety. `envalid` has its own schema DSL that doesn't compose with anything. `t3-env` is close, but error messages are sparse and it requires extra wiring.

`zenv` lets you define your environment schema once with Zod, get **full TypeScript inference** across your entire codebase, and see **human-readable errors** that tell you exactly what's wrong and what to fix — before your server ever starts.

---

## Features

- **Zod v3 and v4** — both supported, no workarounds needed
- **Full TypeScript inference** — `env.PORT` is `number`, not `string | undefined`
- **Human-readable startup errors** — tells you what's missing, what's wrong, and how to fix it
- **`server` / `client` split** — prevent accidental secret leaks to the browser
- **Cross-field refinements** — validate relationships between variables
- **`dotenv` auto-loading** — reads `.env` automatically in Node.js
- **Framework adapters** — Next.js, Vite, NestJS, plain Node.js
- **`zenv validate` CLI** — validate in CI before deploying
- **Escape hatches** — `skipValidation`, `onValidationError`, `exitOnValidationError`

---

## Install

```bash
npm install zod
npm install github:flyingsquirrel0419/zenv
```

> `zenv` is not published under the unscoped npm name yet, so the install example uses the GitHub source directly. `dotenv` is included. No separate install needed.

---

## Quick Start

```ts
// env.ts
import { createEnv } from 'zenv';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT:         z.coerce.number().min(1000).max(65535).default(3000),
    NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
    JWT_SECRET:   z.string().min(32),
    REDIS_URL:    z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_API_URL:  z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string().default('My App'),
  },
  runtimeEnv: process.env,
});
```

Import `env` anywhere in your app. Every property is fully typed:

```ts
import { env } from './env';

env.PORT          // number
env.DATABASE_URL  // string
env.REDIS_URL     // string | undefined
env.NODE_ENV      // "development" | "production" | "test"
```

If any variable is missing or invalid, `zenv` throws with a detailed error message before your server boots. No more `Cannot read properties of undefined` buried somewhere deep in your logs.

---

## Framework Adapters

### Next.js

```ts
import { createNextEnv } from 'zenv/nextjs';
import { z } from 'zod';

export const env = createNextEnv({
  server: {
    DATABASE_URL: z.string().url(),
    JWT_SECRET:   z.string().min(32),
  },
  client: {
    // Client variables must start with NEXT_PUBLIC_
    NEXT_PUBLIC_API_URL:  z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string().default('My App'),
  },
  runtimeEnv: process.env,
});
```

If you create a client-only env with `isServer: false`, server keys disappear from the returned type. For shared `env.ts` files, keep client code importing a client-safe env module rather than relying on runtime detection alone.

### Vite

```ts
import { createViteEnv } from 'zenv/vite';
import { z } from 'zod';

export const env = createViteEnv({
  client: {
    // Client variables must start with VITE_
    VITE_API_URL: z.string().url(),
  },
  runtimeEnv: import.meta.env,
  isServer: false,
});
```

### NestJS

```ts
import { Inject, Injectable, Module } from '@nestjs/common';
import { createNestEnvModule, createNestEnvToken } from 'zenv/nestjs';
import { z } from 'zod';

type AppEnv = {
  DATABASE_URL: string;
  PORT: number;
};

export const ENV_TOKEN = createNestEnvToken<AppEnv>('ENV_TOKEN');

@Module({
  imports: [
    createNestEnvModule({
      server: {
        DATABASE_URL: z.string().url(),
        PORT: z.coerce.number().default(3000),
      },
      isGlobal: true,
      token: ENV_TOKEN,
    }),
  ],
})
export class AppModule {}

@Injectable()
export class AppService {
  constructor(@Inject(ENV_TOKEN) private readonly env: AppEnv) {}
}
```

### Plain Node.js

```ts
import { createNodeEnv } from 'zenv/node';
import { z } from 'zod';

export const env = createNodeEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
  },
});
```

---

## Cross-Field Refinements

Some variables only matter when others are set. Express that directly:

```ts
export const env = createEnv({
  server: {
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
  },
  refinements: [
    (env) => {
      if (env.SMTP_HOST && !env.SMTP_USER) {
        return { message: 'SMTP_USER is required when SMTP_HOST is set', path: ['SMTP_USER'] };
      }
    },
    (env) => {
      if (env.SMTP_HOST && !env.SMTP_PASS) {
        return { message: 'SMTP_PASS is required when SMTP_HOST is set', path: ['SMTP_PASS'] };
      }
    },
  ],
  runtimeEnv: process.env,
});
```

---

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | `Record<string, ZodType>` | `{}` | Server-only schema |
| `client` | `Record<string, ZodType>` | `{}` | Client-safe schema |
| `runtimeEnv` | `Record<string, unknown>` | `process.env` | Environment source |
| `dotenv` | `boolean \| DotenvConfigOptions` | `true` | Auto-load `.env` file |
| `refinements` | `EnvRefinement[]` | `[]` | Cross-field validation rules |
| `skipValidation` | `boolean` | `false` | Skip all validation (e.g. in tests) |
| `onValidationError` | `(error: EnvValidationError) => void` | — | Custom error handler |
| `exitOnValidationError` | `boolean` | `false` | Call `process.exit(1)` on error instead of throwing |
| `unsafeAllowInvalid` | `boolean` | `false` | Return values even if validation fails (use with `onValidationError`) |
| `context` | `'server' \| 'client'` | `'server'` | Override context detection |

---

## Escape Hatches

### Skip validation in tests

```ts
export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  runtimeEnv: process.env,
  skipValidation: process.env.NODE_ENV === 'test',
});
```

### Custom error handling

```ts
export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  runtimeEnv: process.env,
  onValidationError: (error) => {
    // Send to your error tracker, log differently, etc.
    Sentry.captureException(error);
    console.error(error.message);
  },
  unsafeAllowInvalid: true, // still return values after the handler
});
```

### Exit on error (classic behavior)

```ts
export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  runtimeEnv: process.env,
  exitOnValidationError: true, // process.exit(1) instead of throw
});
```

---

## CLI

Validate your environment in CI before it reaches production:

```bash
npx zenv validate
# or with an explicit config path
npx zenv validate ./config/env.config.mjs
```

Create a config file that exports your `createEnv` options:

```js
// zenv.config.mjs
import { z } from 'zod';

export default {
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
  },
};
```

Add it to your CI pipeline:

```yaml
- name: Validate environment
  run: npx zenv validate
```

---

## How It Compares

|  | dotenv | envalid | t3-env | **zenv** |
|--|--------|---------|--------|-------------|
| TypeScript inference | ❌ | △ | ✅ | ✅ |
| Zod v3 | ❌ | ❌ | ✅ | ✅ |
| Zod v4 | ❌ | ❌ | ❌ | ✅ |
| Error message quality | ❌ | △ | △ | ✅ |
| Cross-field validation | ❌ | ❌ | ❌ | ✅ |
| Next.js adapter | ❌ | ❌ | ✅ | ✅ |
| Vite adapter | ❌ | ❌ | ✅ | ✅ |
| NestJS adapter | ❌ | ❌ | ❌ | ✅ |
| CLI validation | ❌ | ❌ | ❌ | ✅ |

> Third-party rows are directional, not contractual. Re-check upstream docs before publishing feature comparisons.

---

## License

MIT
