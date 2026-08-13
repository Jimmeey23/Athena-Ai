import { assertAuthenticated, corsHeaders, getAccessToken, json } from '../_shared/momence-common.ts';

const MOMENCE_BASE_URL = 'https://api.momence.com/api/v2';

type SearchBody = {
  path?: string;
  method?: string;
  params?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
  body?: unknown;
};

const ALLOWED_REQUESTS: Array<{ method: string; pattern: RegExp }> = [
  { method: 'GET', pattern: /^\/host\/members$/ },
  { method: 'POST', pattern: /^\/host\/members$/ },
  { method: 'GET', pattern: /^\/host\/members\/\d+$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/name$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/email$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/phone-number$/ },
  { method: 'DELETE', pattern: /^\/host\/members\/\d+\/phone-number$/ },
  { method: 'GET', pattern: /^\/host\/members\/\d+\/appointments$/ },
  { method: 'GET', pattern: /^\/host\/members\/\d+\/bought-memberships\/active$/ },
  { method: 'GET', pattern: /^\/host\/members\/\d+\/bought-memberships$/ },
  { method: 'GET', pattern: /^\/host\/payment-transactions\/\d+$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/bought-memberships\/\d+\/credits$/ },
  { method: 'GET', pattern: /^\/host\/members\/\d+\/notes$/ },
  { method: 'GET', pattern: /^\/host\/members\/\d+\/sessions$/ },
  { method: 'GET', pattern: /^\/host\/appointments\/reservations$/ },
  { method: 'GET', pattern: /^\/host\/memberships$/ },
  { method: 'GET', pattern: /^\/host\/sales$/ },
  { method: 'POST', pattern: /^\/host\/reports$/ },
  { method: 'GET', pattern: /^\/host\/reports\/\d+$/ },
  { method: 'POST', pattern: /^\/host\/checkout$/ },
  { method: 'POST', pattern: /^\/host\/checkout\/prices$/ },
  { method: 'POST', pattern: /^\/host\/checkout\/compatible-memberships$/ },
  { method: 'GET', pattern: /^\/host\/sessions$/ },
  { method: 'GET', pattern: /^\/host\/sessions\/\d+$/ },
  { method: 'GET', pattern: /^\/host\/sessions\/\d+\/bookings$/ },
  { method: 'GET', pattern: /^\/host\/tags$/ },
  { method: 'POST', pattern: /^\/host\/members\/\d+\/tags\/\d+$/ },
  { method: 'DELETE', pattern: /^\/host\/members\/\d+\/tags\/\d+$/ },
  { method: 'POST', pattern: /^\/host\/session-bookings\/\d+\/check-in$/ },
  { method: 'DELETE', pattern: /^\/host\/session-bookings\/\d+\/check-in$/ },
  { method: 'DELETE', pattern: /^\/host\/session-bookings\/\d+$/ },
  { method: 'DELETE', pattern: /^\/host\/session-recurring-bookings\/\d+$/ },
  { method: 'POST', pattern: /^\/host\/sessions\/\d+\/bookings\/free$/ },
  { method: 'POST', pattern: /^\/host\/sessions\/\d+\/waitlist\/bookings$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/bought-memberships\/\d+\/membership-freeze$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/bought-memberships\/\d+\/membership-schedule-freeze$/ },
  { method: 'DELETE', pattern: /^\/host\/members\/\d+\/bought-memberships\/\d+\/membership-schedule-freeze$/ },
  { method: 'PUT', pattern: /^\/host\/members\/\d+\/bought-memberships\/\d+\/membership-schedule-unfreeze$/ },
  { method: 'DELETE', pattern: /^\/host\/members\/\d+\/bought-memberships\/\d+\/membership-schedule-unfreeze$/ },
];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    await assertAuthenticated(request);
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json() as SearchBody;
    const path = body.path?.startsWith('/') ? body.path : `/${body.path || ''}`;
    const method = (body.method || 'GET').toUpperCase();

    if (!ALLOWED_REQUESTS.some((request) => request.method === method && request.pattern.test(path))) {
      return json({ error: 'Unsupported Momence request' }, 400);
    }

    const url = new URL(`${MOMENCE_BASE_URL}${path}`);
    Object.entries(body.params || {}).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== '') url.searchParams.append(`${key}[]`, String(item));
        });
        return;
      }
      url.searchParams.set(key, String(value));
    });

    const token = await getAccessToken();
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body.body ? JSON.stringify(body.body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      return json({ error: `Momence request failed (${response.status})`, detail: text }, response.status);
    }

    return new Response(text, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Momence search failed' }, 500);
  }
});
