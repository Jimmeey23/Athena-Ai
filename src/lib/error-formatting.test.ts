import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './error-formatting';

describe('getErrorMessage', () => {
  it('formats Supabase-style error objects in the existing message order', () => {
    expect(getErrorMessage({
      message: 'insert failed',
      details: 'row blocked',
      hint: 'check policy',
      code: '42501',
    }, 'fallback')).toBe('insert failed row blocked check policy Code: 42501');
  });

  it('uses fallback only when no useful error text exists', () => {
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
