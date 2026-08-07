import { backendSupabase, ticketingFunctionsSupabase } from './backend-supabase';
import { ticketingFunctionHeaders } from './ticketing-function-auth';

export { ticketingFunctionHeaders } from './ticketing-function-auth';

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function invokeTicketingFunction<T>(
  functionName: string,
  options: { body?: unknown } = {}
) {
  const { data } = await backendSupabase.auth.getSession();

  return ticketingFunctionsSupabase.functions.invoke<T>(functionName, {
    ...options,
    headers: ticketingFunctionHeaders(data.session?.access_token),
  });
}
