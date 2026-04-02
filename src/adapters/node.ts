import { createEnv } from '../createEnv';
import type { CreateEnvOptions, EnvSchema } from '../types';

export function createNodeEnv<
  TServer extends EnvSchema = {},
  TClient extends EnvSchema = {},
>(
  options: Omit<CreateEnvOptions<TServer, TClient, 'server'>, 'context'>,
) {
  const { exitOnValidationError = true, ...rest } = options;

  return createEnv({
    ...rest,
    context: 'server',
    exitOnValidationError,
  });
}
