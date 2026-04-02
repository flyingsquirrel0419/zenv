import { createEnv } from '../createEnv';
import type { CreateEnvOptions, EnvSchema, InferEnv } from '../types';

export interface CreateViteServerEnvOptions<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
> extends Omit<CreateEnvOptions<TServer, TClient, 'server'>, 'context'> {
  clientPrefix?: string;
  isServer?: true;
}

export interface CreateViteClientEnvOptions<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
> extends Omit<CreateEnvOptions<TServer, TClient, 'client'>, 'context'> {
  clientPrefix?: string;
  isServer: false;
}

export function createViteEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: CreateViteServerEnvOptions<TServer, TClient>,
): InferEnv<TServer, TClient, 'server'>;
export function createViteEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: CreateViteClientEnvOptions<TServer, TClient>,
): InferEnv<TServer, TClient, 'client'>;
export function createViteEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: CreateViteServerEnvOptions<TServer, TClient> | CreateViteClientEnvOptions<TServer, TClient>,
) {
  const clientPrefix = options.clientPrefix ?? 'VITE_';
  validateClientPrefix(options.client ?? {}, clientPrefix);
  const { isServer, clientPrefix: _clientPrefix, ...rest } = options;

  return createEnv({
    ...(rest as CreateEnvOptions<TServer, TClient, 'server' | 'client'>),
    context: resolveIsServer(isServer) ? 'server' : 'client',
  }) as InferEnv<TServer, TClient, 'server'> | InferEnv<TServer, TClient, 'client'>;
}

function resolveIsServer(explicit?: boolean): boolean {
  return explicit ?? typeof (globalThis as { window?: unknown }).window === 'undefined';
}

function validateClientPrefix(schema: EnvSchema, prefix: string): void {
  const invalid = Object.keys(schema).filter((key) => !key.startsWith(prefix));

  if (invalid.length === 0) {
    return;
  }

  throw new Error(`Vite client variables must start with ${prefix}: ${invalid.join(', ')}`);
}
