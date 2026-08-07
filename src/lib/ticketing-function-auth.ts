export function ticketingFunctionHeaders(accessToken?: string | null): { Authorization: string } | undefined {
  const token = accessToken?.trim();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
