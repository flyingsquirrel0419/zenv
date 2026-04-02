import { z, type ZodIssue, type ZodTypeAny } from 'zod';

import type { EnvIssue } from './types';

const INDENT = '  ';
const URL_HINT = 'valid URL (e.g. postgresql://user:pass@host/db)';
const PROBE_VALUES: unknown[] = [
  'not-a-url',
  'not-an-email',
  '',
  'x'.repeat(256),
  -1,
  0,
  Number.MAX_SAFE_INTEGER,
  0.5,
  false,
  new Date('invalid'),
  [],
  {},
];

type FlexibleIssue = ZodIssue & {
  code: string;
  expected?: string;
  format?: string;
  validation?: string;
  origin?: string;
  type?: string;
  options?: unknown[];
  values?: unknown[];
  minimum?: number | bigint;
  maximum?: number | bigint;
  multipleOf?: number;
  message?: string;
};

export function formatErrors(issues: EnvIssue[]): string {
  const longestKey = issues.reduce((max, issue) => Math.max(max, issue.key.length), 0);
  const body = issues
    .map((issue) => {
      const got = issue.receivedDescription ?? describeReceived(issue.received);
      const expected = issue.expected ? `\n${INDENT}${' '.repeat(longestKey + 4)}Expected: ${issue.expected}` : '';

      return `${INDENT}${issue.key.padEnd(longestKey)}  -> ${issue.message} (got: ${got})${expected}`;
    })
    .join('\n\n');

  return `❌ Invalid environment variables:\n\n${body}\n\nFix the above variables in your .env file and restart the server.`;
}

export function describeReceived(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' && Number.isNaN(value)) {
    return 'NaN';
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function describeSchema(schema: ZodTypeAny): string | undefined {
  if (!schema || typeof (schema as { safeParse?: unknown }).safeParse !== 'function') {
    return undefined;
  }

  const directDescription = describeSchemaByPublicType(schema);
  if (directDescription) {
    return directDescription;
  }

  const stringRange = describeRangeByProbing(schema, 'string');
  if (stringRange) {
    return stringRange;
  }

  const numberRange = describeRangeByProbing(schema, 'number');
  if (numberRange) {
    return numberRange;
  }

  for (const probe of PROBE_VALUES) {
    const result = schema.safeParse(probe);

    if (!result.success) {
      const expected = describeExpectation(result.error.issues[0]);
      if (expected) {
        return expected;
      }
    }
  }

  return undefined;
}

export function summarizeZodIssue(
  key: string,
  issue: ZodIssue,
  schema: ZodTypeAny,
  received: unknown,
): EnvIssue {
  const flexibleIssue = issue as FlexibleIssue;
  const code = flexibleIssue.code as string;
  const schemaExpectation = describeSchema(schema);
  const issueExpectation = describeExpectation(flexibleIssue);
  const expected = code === 'invalid_type'
    ? schemaExpectation ?? issueExpectation
    : issueExpectation ?? schemaExpectation;

  switch (code) {
    case 'invalid_type':
      if (received === undefined) {
        return {
          key,
          code,
          expected,
          message: 'Required',
          received,
        };
      }

      if (flexibleIssue.expected === 'number') {
        return {
          key,
          code,
          expected,
          message: 'Invalid number',
          received,
        };
      }

      return {
        key,
        code,
        expected,
        message: 'Invalid type',
        received,
      };
    case 'invalid_string':
    case 'invalid_format':
      return {
        key,
        code,
        expected,
        message: resolveFormatMessage(flexibleIssue),
        received,
      };
    case 'invalid_enum_value':
    case 'invalid_value':
      return {
        key,
        code,
        expected,
        message: 'Invalid value',
        received,
      };
    case 'too_small':
      if (resolveIssueType(flexibleIssue) === 'string') {
        const value = typeof received === 'string' ? `, length: ${received.length}` : '';
        return {
          key,
          code,
          expected,
          message: 'Too short',
          received,
          receivedDescription: `${describeReceived(received)}${value}`,
        };
      }

      return {
        key,
        code,
        expected,
        message: 'Too small',
        received,
      };
    case 'too_big':
      if (resolveIssueType(flexibleIssue) === 'string') {
        const value = typeof received === 'string' ? `, length: ${received.length}` : '';
        return {
          key,
          code,
          expected,
          message: 'Too long',
          received,
          receivedDescription: `${describeReceived(received)}${value}`,
        };
      }

      return {
        key,
        code,
        expected,
        message: 'Too large',
        received,
      };
    case 'custom':
      return {
        key,
        code,
        expected,
        message: flexibleIssue.message || 'Invalid value',
        received,
      };
    default:
      return {
        key,
        code,
        expected,
        message: flexibleIssue.message || 'Invalid value',
        received,
      };
  }
}

function describeSchemaByPublicType(schema: ZodTypeAny): string | undefined {
  if (schema instanceof z.ZodBoolean) {
    return 'boolean';
  }

  if (schema instanceof z.ZodNumber) {
    const result = schema.safeParse(0.5);
    if (!result.success && (result.error.issues[0] as FlexibleIssue | undefined)?.expected === 'int') {
      return 'integer';
    }

    return undefined;
  }

  if (schema instanceof z.ZodDate) {
    return 'valid date';
  }

  if (schema instanceof z.ZodObject) {
    return 'object';
  }

  if (schema instanceof z.ZodRecord) {
    return 'record';
  }

  if (schema instanceof z.ZodArray) {
    const element = (schema as unknown as { element?: unknown }).element;
    const elementDescription =
      element && typeof (element as { safeParse?: unknown }).safeParse === 'function'
        ? describeSchema(element as ZodTypeAny)
        : undefined;
    return elementDescription ? `array of ${elementDescription}` : 'array';
  }

  if (schema instanceof z.ZodEnum) {
    return formatOneOf(schema.options);
  }

  if (schema instanceof z.ZodLiteral) {
    return `literal ${JSON.stringify((schema as { value?: unknown }).value)}`;
  }

  if (schema instanceof z.ZodUnion) {
    const options = ((schema as unknown as { options?: readonly ZodTypeAny[] }).options ?? [])
      .map((option) => describeSchema(option))
      .filter(Boolean) as string[];

    if (options.length > 0) {
      return truncateExpectation(options.join(' or '));
    }
  }

  return undefined;
}

function describeRangeByProbing(schema: ZodTypeAny, target: 'string' | 'number'): string | undefined {
  let minimum: number | bigint | undefined;
  let maximum: number | bigint | undefined;

  for (const probe of PROBE_VALUES) {
    const result = schema.safeParse(probe);
    if (result.success) {
      continue;
    }

    const issue = result.error.issues[0] as FlexibleIssue | undefined;
    if (!issue || issue.code !== 'too_small' && issue.code !== 'too_big') {
      continue;
    }

    if (resolveIssueType(issue) !== target) {
      continue;
    }

    if (issue.code === 'too_small') {
      minimum = issue.minimum;
    }

    if (issue.code === 'too_big') {
      maximum = issue.maximum;
    }
  }

  if (target === 'string') {
    if (minimum !== undefined && maximum !== undefined) {
      return `string with length between ${minimum} and ${maximum} characters`;
    }

    if (minimum !== undefined) {
      return `string with minimum ${minimum} characters`;
    }

    if (maximum !== undefined) {
      return `string with maximum ${maximum} characters`;
    }
  }

  if (target === 'number') {
    if (minimum !== undefined && maximum !== undefined) {
      return `number between ${minimum} and ${maximum}`;
    }

    if (minimum !== undefined) {
      return `number greater than or equal to ${minimum}`;
    }

    if (maximum !== undefined) {
      return `number less than or equal to ${maximum}`;
    }
  }

  return undefined;
}

function describeExpectation(issue: FlexibleIssue | undefined): string | undefined {
  if (!issue) {
    return undefined;
  }

  switch (issue.code as string) {
    case 'invalid_type':
      return describeExpectedType(issue.expected);
    case 'invalid_string':
    case 'invalid_format': {
      const format = issue.validation ?? issue.format;
      if (format === 'url') {
        return URL_HINT;
      }

      if (format === 'email') {
        return 'valid email address';
      }

      return describeExpectedType('string');
    }
    case 'invalid_enum_value':
    case 'invalid_value': {
      const values = issue.options ?? issue.values;
      if (Array.isArray(values) && values.length > 0) {
        return formatOneOf(values);
      }

      return undefined;
    }
    case 'invalid_literal':
      return 'specific literal value';
    case 'too_small': {
      const type = resolveIssueType(issue);
      if (type === 'string') {
        return `string with minimum ${issue.minimum} characters`;
      }

      if (type === 'number') {
        return `number greater than or equal to ${issue.minimum}`;
      }

      if (type === 'array') {
        return `array with at least ${issue.minimum} items`;
      }

      return undefined;
    }
    case 'too_big': {
      const type = resolveIssueType(issue);
      if (type === 'string') {
        return `string with maximum ${issue.maximum} characters`;
      }

      if (type === 'number') {
        return `number less than or equal to ${issue.maximum}`;
      }

      if (type === 'array') {
        return `array with at most ${issue.maximum} items`;
      }

      return undefined;
    }
    case 'not_multiple_of':
      return `number divisible by ${issue.multipleOf}`;
    default:
      return undefined;
  }
}

function describeExpectedType(expected: string | undefined): string | undefined {
  switch (expected) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'int':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'valid date';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    case 'bigint':
      return 'bigint';
    default:
      return expected;
  }
}

function resolveFormatMessage(issue: FlexibleIssue): string {
  const format = issue.validation ?? issue.format;

  if (format === 'url') {
    return 'Invalid URL';
  }

  if (format === 'email') {
    return 'Invalid email';
  }

  return 'Invalid string';
}

function resolveIssueType(issue: FlexibleIssue): string | undefined {
  return issue.type ?? issue.origin ?? issue.expected;
}

function formatOneOf(values: unknown[]): string {
  const rendered = values.map((value) => JSON.stringify(value));
  return truncateExpectation(`one of: ${rendered.join(', ')}`);
}

function truncateExpectation(value: string, limit = 120): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}
