import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { describeReceived, describeSchema, formatErrors, summarizeZodIssue } from '../src/formatErrors';

function getFirstIssue(result: { success: boolean; error?: { issues: unknown[] } }) {
  if (result.success) {
    throw new Error('Expected parse to fail');
  }

  return result.error!.issues[0] as Parameters<typeof summarizeZodIssue>[1];
}

describe('formatErrors', () => {
  it('formats readable validation output', () => {
    const message = formatErrors([
      {
        key: 'DATABASE_URL',
        code: 'invalid_string',
        message: 'Invalid URL',
        received: 'postgres',
        expected: 'valid URL (e.g. postgresql://user:pass@host/db)',
      },
      {
        key: 'JWT_SECRET',
        code: 'too_small',
        message: 'Too short',
        received: 'secret',
        receivedDescription: '"secret", length: 6',
        expected: 'string with minimum 32 characters',
      },
    ]);

    expect(message).toContain('❌ Invalid environment variables:');
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('Expected: valid URL');
    expect(message).toContain('JWT_SECRET');
    expect(message).toContain('length: 6');
  });

  it('describes common schema shapes', () => {
    expect(describeSchema(z.string().url())).toContain('valid URL');
    expect(describeSchema(z.coerce.number().min(1000).max(65535))).toBe('number between 1000 and 65535');
    expect(describeSchema(z.enum(['development', 'production']))).toContain('"development"');
  });

  it('covers additional schema descriptions', () => {
    expect(describeSchema(z.string())).toBe('string');
    expect(describeSchema(z.string().email())).toBe('valid email address');
    expect(describeSchema(z.string().min(2).max(5))).toBe('string with length between 2 and 5 characters');
    expect(describeSchema(z.string().min(2))).toBe('string with minimum 2 characters');
    expect(describeSchema(z.string().max(5))).toBe('string with maximum 5 characters');
    expect(describeSchema(z.coerce.number().min(1))).toBe('number greater than or equal to 1');
    expect(describeSchema(z.coerce.number().max(9))).toBe('number less than or equal to 9');
    expect(describeSchema(z.number().int())).toBe('integer');
    expect(describeSchema(z.boolean())).toBe('boolean');
    expect(describeSchema(z.literal('on'))).toBe('literal "on"');
    expect(describeSchema(z.union([z.string(), z.number()]))).toBe('string or number');
    expect(describeSchema(z.array(z.string()))).toBe('array of string');
    expect(describeSchema(z.string().brand<'UserId'>())).toBe('string');
    expect(describeSchema({} as never)).toBeUndefined();
  });

  it('describes received values consistently', () => {
    expect(describeReceived(undefined)).toBe('undefined');
    expect(describeReceived('value')).toBe('"value"');
    expect(describeReceived(Number.NaN)).toBe('NaN');
    expect(describeReceived(null)).toBe('null');
    expect(describeReceived(true)).toBe('true');
    expect(describeReceived(10n)).toBe('10');
    expect(describeReceived({ ok: true })).toBe('{"ok":true}');

    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(describeReceived(circular)).toContain('[object Object]');
  });

  it('summarizes multiple zod issue types', () => {
    const invalidTypeIssue = z.number().safeParse('nope');
    const invalidUrlIssue = z.string().url().safeParse('nope');
    const invalidStringIssue = z.string().email().safeParse('nope');
    const invalidEnumIssue = z.enum(['a', 'b']).safeParse('c');
    const tooSmallNumber = z.number().min(3).safeParse(1);
    const tooLongString = z.string().max(2).safeParse('toolong');
    const tooBigNumber = z.number().max(3).safeParse(10);
    const customIssue = z.string().superRefine((value, ctx) => {
      if (value !== 'ok') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'custom issue',
        });
      }
    }).safeParse('bad');
    const literalIssue = z.literal('ok').safeParse('bad');
    const invalidBoolean = z.boolean().safeParse('bad');

    expect(invalidTypeIssue.success).toBe(false);
    expect(invalidUrlIssue.success).toBe(false);
    expect(invalidStringIssue.success).toBe(false);
    expect(invalidEnumIssue.success).toBe(false);
    expect(tooSmallNumber.success).toBe(false);
    expect(tooLongString.success).toBe(false);
    expect(tooBigNumber.success).toBe(false);
    expect(customIssue.success).toBe(false);
    expect(literalIssue.success).toBe(false);
    expect(invalidBoolean.success).toBe(false);

    expect(summarizeZodIssue('PORT', getFirstIssue(invalidTypeIssue), z.number(), 'nope').message).toBe('Invalid number');
    expect(summarizeZodIssue('URL', getFirstIssue(invalidUrlIssue), z.string().url(), 'nope').message).toBe('Invalid URL');
    expect(summarizeZodIssue('EMAIL', getFirstIssue(invalidStringIssue), z.string().email(), 'nope').message).toBe('Invalid email');
    expect(summarizeZodIssue('MODE', getFirstIssue(invalidEnumIssue), z.enum(['a', 'b']), 'c').message).toBe('Invalid value');
    expect(summarizeZodIssue('COUNT', getFirstIssue(tooSmallNumber), z.number().min(3), 1).message).toBe('Too small');
    expect(summarizeZodIssue('NAME', getFirstIssue(tooLongString), z.string().max(2), 'toolong').message).toBe('Too long');
    expect(summarizeZodIssue('COUNT', getFirstIssue(tooBigNumber), z.number().max(3), 10).message).toBe('Too large');
    expect(summarizeZodIssue('CUSTOM', getFirstIssue(customIssue), z.string(), 'bad').message).toBe('custom issue');
    expect(summarizeZodIssue('LITERAL', getFirstIssue(literalIssue), z.literal('ok'), 'bad').message).toBeTruthy();
    expect(summarizeZodIssue('FLAG', getFirstIssue(invalidBoolean), z.boolean(), 'bad').message).toBe('Invalid type');
  });

  it('covers string minimum issues and effect schemas', () => {
    const tooShortString = z.string().min(4).safeParse('bad');

    expect(tooShortString.success).toBe(false);
    expect(
      summarizeZodIssue('SECRET', getFirstIssue(tooShortString), z.string().min(4), 'bad').receivedDescription,
    ).toContain('length: 3');
    expect(describeSchema(z.string().transform((value) => value.trim()))).toBe('string');
  });

  it('falls back gracefully for manual issue objects', () => {
    const tooSmall = summarizeZodIssue(
      'NAME',
      {
        code: z.ZodIssueCode.too_small,
        origin: 'string',
        minimum: 4,
        inclusive: true,
        exact: false,
        message: 'too small',
        path: [],
      } as never,
      z.string().min(4),
      10,
    );
    const tooBig = summarizeZodIssue(
      'NAME',
      {
        code: z.ZodIssueCode.too_big,
        origin: 'string',
        maximum: 2,
        inclusive: true,
        exact: false,
        message: 'too big',
        path: [],
      } as never,
      z.string().max(2),
      10,
    );
    const custom = summarizeZodIssue(
      'CUSTOM',
      {
        code: z.ZodIssueCode.custom,
        message: '',
        path: [],
      } as never,
      z.string(),
      'bad',
    );
    const fallback = summarizeZodIssue(
      'DATE',
      {
        code: z.ZodIssueCode.invalid_union,
        message: '',
        path: [],
      } as never,
      z.date(),
      'bad',
    );

    expect(tooSmall.receivedDescription).toBe('10');
    expect(tooBig.receivedDescription).toBe('10');
    expect(custom.message).toBe('Invalid value');
    expect(fallback.message).toBe('Invalid value');
  });
});
