import { createEnv } from '../createEnv';
import type { CreateEnvOptions, EnvSchema, InferEnv } from '../types';

export const ZOD_ENV = 'ZOD_ENV';
export type InferNestEnv<TServer extends EnvSchema, TClient extends EnvSchema = {}> = InferEnv<TServer, TClient, 'server'>;
export type NestEnvToken<TEnv, TToken extends string | symbol = symbol> = TToken & {
  readonly __zodEnvType?: TEnv;
};

export interface ProviderLike<TToken extends string | symbol = string | symbol, TValue = unknown> {
  provide: TToken;
  useValue: TValue;
}

export interface DynamicModuleLike<TToken extends string | symbol = string | symbol, TValue = unknown> {
  module: unknown;
  global?: boolean | undefined;
  providers: Array<ProviderLike<TToken, TValue>>;
  exports: TToken[];
}

export interface CreateNestEnvModuleOptions<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
  TToken extends string | symbol = typeof ZOD_ENV,
> extends Omit<CreateEnvOptions<TServer, TClient, 'server'>, 'context'> {
  isGlobal?: boolean;
  token?: NestEnvToken<InferNestEnv<TServer, TClient>, TToken>;
}

export class ZodEnvModule {}

export function createNestEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: Omit<CreateEnvOptions<TServer, TClient, 'server'>, 'context'>,
  ) {
  return createEnv({
    ...options,
    context: 'server',
  });
}

export function createNestEnvToken<TEnv>(description = ZOD_ENV): NestEnvToken<TEnv> {
  return Symbol(description) as NestEnvToken<TEnv>;
}

export function createNestEnvModule<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
  TToken extends string | symbol = typeof ZOD_ENV,
>(
  options: CreateNestEnvModuleOptions<TServer, TClient, TToken>,
): DynamicModuleLike<NestEnvToken<InferNestEnv<TServer, TClient>, TToken>, InferNestEnv<TServer, TClient>> {
  const token = (options.token ?? ZOD_ENV) as NestEnvToken<InferNestEnv<TServer, TClient>, TToken>;
  const env = createNestEnv(options);

  return {
    module: ZodEnvModule,
    ...(options.isGlobal === undefined ? {} : { global: options.isGlobal }),
    providers: [
      {
        provide: token,
        useValue: env,
      },
    ],
    exports: [token],
  };
}
