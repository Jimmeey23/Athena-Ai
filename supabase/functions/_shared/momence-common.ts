import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const MOMENCE_BASE_URL = 'https://api.momence.com/api/v2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type TokenResponse = {
  accessToken?: string;
  access_token?: string;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

export function optionalEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return '';
}

export async function getAccessToken(): Promise<string> {
  const staticToken = Deno.env.get('MOMENCE_ACCESS_TOKEN');
  if (staticToken) return staticToken;

  const clientId = env('MOMENCE_CLIENT_ID');
  const clientSecret = env('MOMENCE_CLIENT_SECRET');
  const username = env('MOMENCE_USERNAME');
  const password = env('MOMENCE_PASSWORD');

  const form = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
  });

  const response = await fetch(`${MOMENCE_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Momence token request failed (${response.status}): ${detail}`);
  }

  const data = await response.json() as TokenResponse;
  const token = data.access_token || data.accessToken;
  if (!token) throw new Error('Momence token response did not include an access token');
  return token;
}

/**
 * Verifies that the request carries a valid Supabase user JWT.
 *
 * Every caller of the Momence proxy must be a signed-in app user. We resolve the
 * JWT from the Authorization header through the Supabase client so anonymous
 * callers (or callers that merely possess the public anon key) cannot proxy
 * allowlisted Momence requests using the service's stored credentials.
 *
 * If the Supabase env vars are unavailable (standalone deployment), a shared
 * static secret (MOMENCE_FUNCTION_SECRET) sent as `x-momence-function-secret`
 * is accepted as a fallback. If neither is configured, the request is rejected.
 */
export async function assertAuthenticated(request: Request): Promise<void> {
  const supabaseUrl = optionalEnv('SUPABASE_URL');
  const anonKey = optionalEnv('SUPABASE_ANON_KEY');
  const sharedSecret = optionalEnv('MOMENCE_FUNCTION_SECRET');

  const authorization = request.headers.get('authorization') || '';
  if (supabaseUrl && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (!userError && userData?.user) return;
  } else if (sharedSecret) {
    const requestSecret = request.headers.get('x-momence-function-secret') || '';
    if (requestSecret && requestSecret === sharedSecret) return;
  }

  throw new Error('Unauthorized');
}
