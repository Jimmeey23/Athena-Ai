import { afterEach, describe, expect, it, vi } from 'vitest';
import { ticketingFunctionHeaders } from './ticketing-function-auth';
import { withTimeout } from './ticketing-functions';

vi.mock('./backend-supabase', () => ({
  backendSupabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
  ticketingFunctionsSupabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('ticketing function invocation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards the authenticated user token when invoking ticketing functions', () => {
    expect(ticketingFunctionHeaders('session-token')).toEqual({
      Authorization: 'Bearer session-token',
    });
  });

  it('omits auth headers when no user token is available', () => {
    expect(ticketingFunctionHeaders('')).toEqual(undefined);
    expect(ticketingFunctionHeaders(undefined)).toEqual(undefined);
  });

  it('rejects slow operations with a timeout error', async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      new Promise((resolve) => {
        setTimeout(() => resolve('late'), 20_000);
      }),
      15_000,
      'Athena chat response timed out'
    );

    const expectation = expect(result).rejects.toThrow('Athena chat response timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await expectation;
  });

  it('returns fast operations before the timeout', async () => {
    vi.useFakeTimers();
    const result = withTimeout(
      new Promise((resolve) => {
        setTimeout(() => resolve('fast'), 500);
      }),
      15_000,
      'Athena chat response timed out'
    );

    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBe('fast');
  });
});
