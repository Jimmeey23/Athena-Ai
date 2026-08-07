export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const parts = [
      typeof value.message === 'string' ? value.message : '',
      typeof value.details === 'string' ? value.details : '',
      typeof value.hint === 'string' ? value.hint : '',
      typeof value.code === 'string' ? `Code: ${value.code}` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(' ');
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}
