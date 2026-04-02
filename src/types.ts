import type { config as dotenvConfig } from 'dotenv';
import type { z } from 'zod';

export type EnvSchema = Record<string, z.ZodTypeAny>;
export type RuntimeEnv = Record<string, unknown>;
export type EnvContext = 'server' | 'client';

export type InferSchema<TSchema extends EnvSchema> = {
  [TKey in keyof TSchema]: z.infer<TSchema[TKey]>;
};

export type MergeEnvs<TLeft, TRight> = Omit<TLeft, keyof TRight> & TRight;

export type InferEnv<
  TServer extends EnvSchema,
  TClient extends EnvSchema,
  TContext extends EnvContext,
> = TContext extends 'client'
  ? InferSchema<TClient>
  : MergeEnvs<InferSchema<TClient>, InferSchema<TServer>>;

export interface RefinementIssue<TPath extends string = string> {
  message: string;
  path: readonly [TPath, ...string[]] | readonly string[];
}

export type EnvRefinement<TEnv> = (
  env: TEnv,
) => void | RefinementIssue<Extract<keyof TEnv, string>> | Array<RefinementIssue<Extract<keyof TEnv, string>>>;

export interface EnvIssue {
  key: string;
  message: string;
  expected?: string | undefined;
  received: unknown;
  receivedDescription?: string | undefined;
  code: string;
}

export interface EnvValidationErrorOptions {
  issues: EnvIssue[];
  context: EnvContext;
}

export class EnvValidationError extends Error {
  readonly issues: EnvIssue[];
  readonly context: EnvContext;

  constructor({ issues, context }: EnvValidationErrorOptions) {
    super('');
    this.name = 'EnvValidationError';
    this.issues = issues;
    this.context = context;
  }
}

export interface CreateEnvOptions<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
  TContext extends EnvContext = 'server',
> {
  server?: TServer;
  client?: TClient;
  runtimeEnv?: RuntimeEnv;
  context?: TContext;
  dotenv?: boolean | Parameters<typeof dotenvConfig>[0];
  skipValidation?: boolean;
  exitOnValidationError?: boolean;
  refinements?: Array<EnvRefinement<InferEnv<TServer, TClient, TContext>>>;
  onValidationError?: (
    error: EnvValidationError,
  ) => void;
  unsafeAllowInvalid?: boolean;
}
