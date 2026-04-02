import { config as loadDotenv } from 'dotenv';
import type { ZodTypeAny } from 'zod';

import { formatErrors, summarizeZodIssue } from './formatErrors';
import {
  EnvValidationError,
  type CreateEnvOptions,
  type EnvContext,
  type EnvIssue,
  type EnvRefinement,
  type EnvSchema,
  type InferEnv,
  type RuntimeEnv,
} from './types';

export function createEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
  TContext extends EnvContext = 'server',
>(
  options: CreateEnvOptions<TServer, TClient, TContext>,
): InferEnv<TServer, TClient, TContext> {
  const context = options.context ?? ('server' as TContext);
  const runtimeEnv = resolveRuntimeEnv(options.runtimeEnv);

  maybeLoadDotenv(options, runtimeEnv);

  const serverSchema = options.server ?? ({} as TServer);
  const clientSchema = options.client ?? ({} as TClient);
  const issues = findDuplicateKeyIssues(serverSchema, clientSchema, runtimeEnv);

  const clientResult = collectValues(clientSchema, runtimeEnv);
  const serverResult = context === 'server' ? collectValues(serverSchema, runtimeEnv) : emptyCollection();

  issues.push(...clientResult.issues, ...serverResult.issues);

  const merged = {
    ...clientResult.values,
    ...serverResult.values,
  } as InferEnv<TServer, TClient, TContext>;

  if (!options.skipValidation && issues.length === 0 && options.refinements?.length) {
    issues.push(...runRefinements(options.refinements as Array<EnvRefinement<Record<string, unknown>>>, merged, runtimeEnv));
  }

  if (options.skipValidation || issues.length === 0) {
    return merged;
  }

  const error = new EnvValidationError({
    context,
    issues,
  });

  error.message = formatErrors(issues);

  if (options.onValidationError) {
    options.onValidationError(error);
  }

  if (options.unsafeAllowInvalid) {
    return merged;
  }

  if (options.exitOnValidationError) {
    console.error(error.message);
    process.exit(1);
  }

  throw error;
}

interface CollectionResult {
  issues: EnvIssue[];
  values: Record<string, unknown>;
}

function emptyCollection(): CollectionResult {
  return {
    issues: [],
    values: {},
  };
}

function resolveRuntimeEnv(runtimeEnv?: RuntimeEnv): RuntimeEnv {
  return runtimeEnv ?? (process.env as RuntimeEnv);
}

function maybeLoadDotenv<
  TServer extends EnvSchema,
  TClient extends EnvSchema,
  TContext extends EnvContext,
>(
  options: CreateEnvOptions<TServer, TClient, TContext>,
  runtimeEnv: RuntimeEnv,
): void {
  if (options.dotenv === false) {
    return;
  }

  if (runtimeEnv !== process.env && options.runtimeEnv !== undefined) {
    return;
  }

  const dotenvOptions = options.dotenv === true || options.dotenv === undefined ? undefined : options.dotenv;
  loadDotenv(dotenvOptions);
}

function collectValues(schema: EnvSchema, runtimeEnv: RuntimeEnv): CollectionResult {
  const issues: EnvIssue[] = [];
  const values: Record<string, unknown> = {};

  for (const [key, validator] of Object.entries(schema)) {
    const rawValue = runtimeEnv[key];
    const result = validator.safeParse(rawValue);

    if (result.success) {
      values[key] = result.data;
      continue;
    }

    values[key] = rawValue;
    const primaryIssue = result.error.issues[0];

    if (primaryIssue) {
      issues.push(summarizeZodIssue(key, primaryIssue, validator, rawValue));
    }
  }

  return { issues, values };
}

function findDuplicateKeyIssues(server: EnvSchema, client: EnvSchema, runtimeEnv: RuntimeEnv): EnvIssue[] {
  const duplicates = Object.keys(server).filter((key) => key in client);

  return duplicates.map((key) => ({
    key,
    code: 'duplicate_key',
    message: 'Defined in both server and client schemas',
    received: runtimeEnv[key],
  }));
}

function runRefinements(
  refinements: Array<EnvRefinement<Record<string, unknown>>>,
  env: Record<string, unknown>,
  runtimeEnv: RuntimeEnv,
): EnvIssue[] {
  const issues: EnvIssue[] = [];

  for (const refinement of refinements) {
    const result = refinement(env);

    if (!result) {
      continue;
    }

    const normalized = Array.isArray(result) ? result : [result];
    for (const issue of normalized) {
      const key = issue.path[0];

      if (!key) {
        continue;
      }

      issues.push({
        key,
        code: 'custom',
        message: issue.message,
        received: runtimeEnv[key],
      });
    }
  }

  return issues;
}
