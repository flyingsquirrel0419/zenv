import { createEnv } from '../createEnv';
import type { CreateEnvOptions, EnvSchema, InferEnv } from '../types';

export interface CreateNextServerEnvOptions<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
> extends Omit<CreateEnvOptions<TServer, TClient, 'server'>, 'context'> {
  isServer?: true;
}

export interface CreateNextClientEnvOptions<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
> extends Omit<CreateEnvOptions<TServer, TClient, 'client'>, 'context'> {
  isServer: false;
}

export function createNextEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: CreateNextServerEnvOptions<TServer, TClient>,
): InferEnv<TServer, TClient, 'server'>;
export function createNextEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: CreateNextClientEnvOptions<TServer, TClient>,
): InferEnv<TServer, TClient, 'client'>;
export function createNextEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: CreateNextServerEnvOptions<TServer, TClient> | CreateNextClientEnvOptions<TServer, TClient>,
) {
  validateClientPrefix(options.client ?? {}, 'NEXT_PUBLIC_', 'Next.js');
  const { isServer, ...rest } = options;

  return createEnv({
    ...(rest as CreateEnvOptions<TServer, TClient, 'server' | 'client'>),
    context: resolveIsServer(isServer) ? 'server' : 'client',
  }) as InferEnv<TServer, TClient, 'server'> | InferEnv<TServer, TClient, 'client'>;
}

function resolveIsServer(explicit?: boolean): boolean {
  return explicit ?? typeof (globalThis as { window?: unknown }).window === 'undefined';
}

function validateClientPrefix(schema: EnvSchema, prefix: string, runtimeName: string): void {
  const invalid = Object.keys(schema).filter((key) => !key.startsWith(prefix));

  if (invalid.length === 0) {
    return;
  }

  throw new Error(`${runtimeName} client variables must start with ${prefix}: ${invalid.join(', ')}`);
}
