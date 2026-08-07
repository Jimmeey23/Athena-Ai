import { assertAuthenticated, corsHeaders, getAccessToken, json } from '../_shared/momence-common.ts';

const MOMENCE_BASE_URL = 'https://api.momence.com/api/v2';
const DEFAULT_PAST_DAYS = 180;
const DEFAULT_FUTURE_DAYS = 45;
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGES = 12;

type SearchBody = {
  query?: string;
  pastDays?: number;
  futureDays?: number;
  pageSize?: number;
  page?: number;
  maxPages?: number;
  includeCancelled?: boolean;
  type?: string;
  types?: string[];
};

function clampDays(value: unknown, fallback: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(max, Math.round(number)));
}

function clampPageSize(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_PAGE_SIZE;
  return Math.max(10, Math.min(200, Math.round(number)));
}

function clampPage(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.round(number));
}

function clampMaxPages(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : MAX_PAGES;
  return Math.max(1, Math.min(MAX_PAGES, Math.round(number)));
}

function resolveSessionTypes(body: SearchBody): string[] {
  if (Array.isArray(body.types)) {
    return body.types
      .filter((type): type is string => typeof type === 'string' && Boolean(type.trim()))
      .map((type) => type.trim());
  }
  if (typeof body.type === 'string' && body.type.trim()) return [body.type.trim()];
  return [];
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  const value = data as Record<string, unknown>;
  for (const key of ['payload', 'data', 'items', 'content', 'results', 'sessions']) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = extractItems(candidate);
      if (nested.length) return nested;
    }
  }

  return [];
}

function normalizeSearchValue(value: unknown): string {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]s\b/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchValue(value: string): string {
  return value.replace(/\s+/g, '');
}

function getPathValue(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function searchableSessionText(session: unknown): string {
  return normalizeSearchValue([
    getPathValue(session, ['name']),
    getPathValue(session, ['type']),
    getPathValue(session, ['startsAt']),
    getPathValue(session, ['teacher', 'firstName']),
    getPathValue(session, ['teacher', 'lastName']),
    getPathValue(session, ['inPersonLocation', 'name']),
  ].filter(Boolean).join(' '));
}

function matchesQuery(session: unknown, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const haystack = searchableSessionText(session);
  if (haystack.includes(normalizedQuery)) return true;
  const compactHaystack = compactSearchValue(haystack);
  const compactQuery = compactSearchValue(normalizedQuery);
  if (compactHaystack.includes(compactQuery)) return true;
  const tokens = normalizedQuery
    .split(' ')
    .filter((token) => token.length > 1 && token !== '57');
  return tokens.length > 0 && tokens.every((token) => (
    haystack.includes(token) || compactHaystack.includes(token)
  ));
}

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
    const body = await request.json().catch(() => ({})) as SearchBody;
    const now = new Date();
    const startAfter = new Date(now);
    const startBefore = new Date(now);
    const pastDays = clampDays(body.pastDays, DEFAULT_PAST_DAYS, 730);
    const futureDays = clampDays(body.futureDays, DEFAULT_FUTURE_DAYS, 365);
    const pageSize = clampPageSize(body.pageSize);
    const startPage = clampPage(body.page);
    const maxPages = clampMaxPages(body.maxPages);
    const sessionTypes = resolveSessionTypes(body);

    startAfter.setDate(now.getDate() - pastDays);
    startBefore.setDate(now.getDate() + futureDays);

    const token = await getAccessToken();
    const pages: unknown[] = [];
    let lastPageItemCount = 0;
    let lastFetchedPage = startPage;
    let responseContentType = 'application/json';

    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const page = startPage + pageOffset;
      const url = new URL(`${MOMENCE_BASE_URL}/host/sessions`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('sortBy', 'startsAt');
      url.searchParams.set('sortOrder', 'DESC');
      url.searchParams.set('includeCancelled', String(body.includeCancelled ?? false));
      url.searchParams.set('startAfter', startAfter.toISOString());
      url.searchParams.set('startBefore', startBefore.toISOString());
      for (const sessionType of sessionTypes) {
        url.searchParams.append('types[]', sessionType);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();
      if (!response.ok) {
        return json({ error: `Momence session request failed (${response.status})`, detail: text }, response.status);
      }

      responseContentType = response.headers.get('Content-Type') || responseContentType;
      const data = JSON.parse(text);
      const items = extractItems(data);
      lastPageItemCount = items.length;
      lastFetchedPage = page;
      pages.push(...items);
      if (!Array.isArray(items) || items.length < pageSize) break;
    }

    const normalizedQuery = normalizeSearchValue(body.query);
    const filteredPages = normalizedQuery
      ? pages.filter((session) => matchesQuery(session, normalizedQuery))
      : pages;

    return new Response(JSON.stringify({
      payload: filteredPages,
      page: startPage,
      lastFetchedPage,
      pageSize,
      hasMore: lastPageItemCount >= pageSize,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': responseContentType,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Momence session search failed' }, 500);
  }
});
