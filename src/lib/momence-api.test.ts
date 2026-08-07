import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backendSupabase } from './backend-supabase';
import {
  buildMomenceInsightSummary,
  freezeMomenceMembership,
  listMomenceMembers,
  listMomenceHostMembershipOptions,
  loadMomenceTicketContext,
  loadMomenceSessionsProgressively,
  scheduleMomenceMembershipUnfreeze,
  searchMomenceSessions,
  unfreezeMomenceMembership,
} from './momence-api';

vi.mock('./backend-supabase', () => ({
  backendSupabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'test-access-token' } },
      })),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('buildMomenceInsightSummary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('summarizes member, memberships, bookings, notes, and tags for ticket context', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'));

    const summary = buildMomenceInsightSummary({
      member: {
        id: 42,
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'asha@example.com',
        phoneNumber: '+919900000000',
        firstSeen: '2025-01-01T10:00:00.000Z',
        lastSeen: '2026-05-29T07:30:00.000Z',
        customerTags: [{ id: 7, name: 'VIP' }, { id: 8, name: 'Retention Risk' }],
      },
      memberships: [
        {
          id: 11,
          type: 'package-events',
          membership: { id: 1, name: 'Unlimited Monthly' },
          isFrozen: true,
          eventCreditsLeft: 8,
          eventCreditsTotal: 12,
          moneyCreditsLeft: 5000,
          moneyCreditsTotal: 10000,
          usageLimitStartDate: '2026-05-01T00:00:00.000Z',
          usageLimitEndDate: '2026-05-31T23:59:59.000Z',
          freeze: {
            freezedAt: '2026-05-15T00:00:00.000Z',
            unfreezedScheduledAt: '2026-05-25T00:00:00.000Z',
            unfrozenAt: null,
            remainingFreezedMinutes: 1440,
            scheduledFreezeAt: null,
          },
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-31T23:59:59.000Z',
        },
      ],
      memberBookings: [
        {
          id: 101,
          checkedIn: true,
          session: {
            id: 201,
            name: 'Signature Barre',
            startsAt: '2026-05-28T04:30:00.000Z',
            teacher: { firstName: 'Nina', lastName: 'Shah' },
            inPersonLocation: { name: 'Bandra' },
          },
        },
        {
          id: 102,
          checkedIn: false,
          session: {
            id: 202,
            name: 'Power Sculpt',
            startsAt: '2026-06-01T04:30:00.000Z',
            teacher: { firstName: 'Mira', lastName: 'Kapoor' },
            inPersonLocation: { name: 'Bandra' },
          },
        },
      ],
      notes: [{ id: 501, note: '<p>Prefers WhatsApp follow-up.</p>', modifiedAt: '2026-05-20T09:00:00.000Z' }],
      session: {
        id: 202,
        name: 'Power Sculpt',
        startsAt: '2026-06-01T04:30:00.000Z',
        endsAt: '2026-06-01T05:30:00.000Z',
        capacity: 20,
        bookingCount: 18,
        waitlistBookingCount: 2,
        teacher: { firstName: 'Mira', lastName: 'Kapoor' },
        inPersonLocation: { name: 'Bandra' },
      },
      sessionBookings: [
        { id: 301, member: { id: 42, firstName: 'Asha', lastName: 'Rao' }, checkedIn: false },
        { id: 302, member: { id: 99, firstName: 'Priya', lastName: 'Mehta' }, checkedIn: true },
      ],
      tags: [],
    });

    expect(summary.member?.name).toBe('Asha Rao');
    expect(summary.member?.tags).toEqual(['VIP', 'Retention Risk']);
    expect(summary.membershipOverview.activeCount).toBe(0);
    expect(summary.membershipOverview.frozenCount).toBe(1);
    expect(summary.membershipOverview.memberships[0]).toMatchObject({
      id: '11',
      type: 'package-events',
      status: 'Frozen',
      moneyCreditsLabel: '5000/10000 money credits left',
      freezeLabel: 'Frozen now',
      scheduledUnfreezeAt: '2026-05-25T00:00:00.000Z',
      usagePeriodLabel: 'Usage window 2026-05-01T00:00:00.000Z to 2026-05-31T23:59:59.000Z',
    });
    expect(summary.bookingOverview.totalLoaded).toBe(2);
    expect(summary.bookingOverview.lastVisit?.classType).toBe('Signature Barre');
    expect(summary.bookingOverview.nextBooking?.classType).toBe('Power Sculpt');
    expect(summary.noteOverview.latestNote).toBe('Prefers WhatsApp follow-up.');
    expect(summary.session?.fillRateLabel).toBe('18/20 booked');
    expect(summary.session?.matchingMemberBookingId).toBe('301');
    expect(summary.ticketContextLines).toContain('Momence member: Asha Rao');
  });
});

describe('Momence session progressive loading', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requests a small first session page so dropdown options become available quickly', async () => {
    vi.stubEnv('VITE_MOMENCE_SESSION_FUNCTION_URL', 'http://localhost/session-search');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      payload: [{ id: 1, title: 'Barre 57', startsAt: '2026-06-06T10:00:00.000Z' }],
      hasMore: false,
    }), { status: 200 })));

    await loadMomenceSessionsProgressively('', undefined, vi.fn());

    const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body.page).toBe(0);
    expect(body.maxPages).toBe(1);
    expect(body.pageSize).toBeLessThanOrEqual(50);
  });
});

describe('Momence membership freeze actions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MOMENCE_FUNCTION_URL', 'http://localhost/momence-search');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('freezes bought memberships through the host membership-freeze endpoint', async () => {
    await freezeMomenceMembership('42', '11', {
      freezeAt: '2026-06-01T00:00:00.000Z',
      unfreezeAt: '2026-06-10T00:00:00.000Z',
      reason: 'Medical travel',
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost/momence-search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        path: '/host/members/42/bought-memberships/11/membership-freeze',
        method: 'PUT',
        params: {},
        body: {
          freezeType: 'scheduled',
          freezeAt: '2026-06-01T00:00:00.000Z',
          unfreezeType: 'scheduled',
          unfreezeAt: '2026-06-10T00:00:00.000Z',
          reason: 'Medical travel',
        },
      }),
    }));
  });

  it('unfreezes bought memberships by deleting membership-schedule-freeze', async () => {
    await unfreezeMomenceMembership('42', '11');

    expect(fetch).toHaveBeenCalledWith('http://localhost/momence-search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        path: '/host/members/42/bought-memberships/11/membership-schedule-freeze',
        method: 'DELETE',
        params: {},
        body: undefined,
      }),
    }));
  });

  it('schedules membership unfreezes through membership-schedule-unfreeze', async () => {
    await scheduleMomenceMembershipUnfreeze('42', '11', '2026-06-15T00:00:00.000Z');

    expect(fetch).toHaveBeenCalledWith('http://localhost/momence-search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        path: '/host/members/42/bought-memberships/11/membership-schedule-unfreeze',
        method: 'PUT',
        params: {},
        body: {
          unfreezeType: 'scheduled',
          unfreezeAt: '2026-06-15T00:00:00.000Z',
        },
      }),
    }));
  });
});

describe('Momence host membership options', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MOMENCE_FUNCTION_URL', 'http://localhost/momence-search');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('loads available membership names from the host memberships endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      payload: [
        { id: 1, name: 'Studio 8 Class Package', disabled: false },
        { id: 2, name: 'Studio 8 Class Package', disabled: false },
        { id: 3, name: 'Disabled Legacy Package', disabled: true },
        { id: 4, name: 'Studio Annual Unlimited Membership', disabled: false },
      ],
    }), { status: 200 })));

    await expect(listMomenceHostMembershipOptions()).resolves.toEqual([
      'Studio 8 Class Package',
      'Studio Annual Unlimited Membership',
    ]);

    expect(fetch).toHaveBeenCalledWith('http://localhost/momence-search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        path: '/host/memberships',
        method: 'GET',
        params: {
          page: 0,
          pageSize: 200,
          sortBy: 'name',
          sortOrder: 'ASC',
          includeDisabled: false,
        },
        body: undefined,
      }),
    }));
  });
});

describe('Momence member listing', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MOMENCE_FUNCTION_URL', 'http://localhost/momence-search');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('loads the first host members page without requiring a search query', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      payload: [
        { id: 42, firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', phoneNumber: '+919900000000' },
      ],
    }), { status: 200 })));

    await expect(listMomenceMembers()).resolves.toEqual([
      expect.objectContaining({
        id: '42',
        label: 'Asha Rao',
        email: 'asha@example.com',
      }),
    ]);

    expect(fetch).toHaveBeenCalledWith('http://localhost/momence-search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        path: '/host/members',
        method: 'GET',
        params: {
          page: 0,
          pageSize: 20,
          sortBy: 'lastSeenAt',
          sortOrder: 'DESC',
        },
        body: undefined,
      }),
    }));
  });
});

describe('Momence session search', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MOMENCE_SESSION_FUNCTION_URL', 'http://localhost/momence-session-search');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requests private Momence sessions for hosted class session options', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      payload: [{
        id: 501,
        name: 'Studio Hosted Class',
        startsAt: '2026-06-02T05:00:00.000Z',
        teacher: { firstName: 'Anisha', lastName: 'Shah' },
        inPersonLocation: { name: 'Kwality House, Kemps Corner' },
        bookingCount: 12,
        capacity: 20,
      }],
    }), { status: 200 })));

    const sessions = await searchMomenceSessions('', { types: ['private'] });

    expect(sessions[0]).toMatchObject({
      id: '501',
      classType: 'Studio Hosted Class',
      trainer: 'Anisha Shah',
      studio: 'Kwality House, Kemps Corner',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost/momence-session-search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        query: '',
        pastDays: 3650,
        futureDays: 0,
        pageSize: 40,
        includeCancelled: false,
        types: ['private'],
        page: 0,
        maxPages: 1,
      }),
    }));
  });

  it('emits the first session page before later pages finish loading', async () => {
    const { loadMomenceSessionsProgressively } = await import('./momence-api');
    let resolveSecondPage: (value: Response) => void = () => undefined;
    const secondPage = new Promise<Response>((resolve) => {
      resolveSecondPage = resolve;
    });
    const onPage = vi.fn();
    vi.stubGlobal('fetch', vi.fn((_, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      if (body.page === 0) {
        return Promise.resolve(new Response(JSON.stringify({
          payload: [{ id: 501, name: 'First Page Class' }],
          hasMore: true,
        }), { status: 200 }));
      }
      return secondPage;
    }));

    const loading = loadMomenceSessionsProgressively('', {}, onPage);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onPage.mock.calls[0][0][0]).toMatchObject({ id: '501', classType: 'First Page Class' });

    resolveSecondPage(new Response(JSON.stringify({
      payload: [{ id: 502, name: 'Second Page Class' }],
      hasMore: false,
    }), { status: 200 }));

    const sessions = await loading;
    expect(onPage).toHaveBeenCalledTimes(2);
    expect(sessions.map((session) => session.id)).toEqual(['501', '502']);
  });
});

describe('Momence session search configuration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the configured generic Momence function when no dedicated session function is provided', async () => {
    vi.stubEnv('VITE_MOMENCE_FUNCTION_URL', 'http://localhost/functions/v1/momence-search');
    vi.stubEnv('VITE_MOMENCE_SESSION_FUNCTION_URL', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      payload: [{
        id: 701,
        name: 'Signature Barre',
        startsAt: '2026-06-07T05:00:00.000Z',
        teacher: { firstName: 'Anisha', lastName: 'Shah' },
        inPersonLocation: { name: 'Bandra' },
      }],
      hasMore: false,
    }), { status: 200 })));

    const sessions = await searchMomenceSessions('barre');

    expect(sessions[0]).toMatchObject({
      id: '701',
      classType: 'Signature Barre',
      trainer: 'Anisha Shah',
      studio: 'Bandra',
    });
    expect(fetch).toHaveBeenCalledWith('http://localhost/functions/v1/momence-search', expect.objectContaining({
      method: 'POST',
    }));
    const body = JSON.parse(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body).toMatchObject({
      path: '/host/sessions',
      method: 'GET',
      params: {
        page: 0,
        pageSize: 40,
        sortBy: 'startsAt',
        sortOrder: 'DESC',
        includeCancelled: false,
        startAfter: expect.any(String),
        startBefore: expect.any(String),
      },
    });
    expect(body.params.types).toBeUndefined();
    expect(body.body).toBeUndefined();
  });

  it('filters future sessions out of returned Momence session options', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T08:00:00.000Z'));
    vi.stubEnv('VITE_MOMENCE_SESSION_FUNCTION_URL', 'http://localhost/momence-session-search');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      payload: [
        { id: 801, name: 'Past Barre', startsAt: '2026-06-29T07:30:00.000Z' },
        { id: 802, name: 'Future Barre', startsAt: '2026-06-29T08:30:00.000Z' },
        { id: 803, name: 'Tomorrow Barre', startsAt: '2026-06-30T04:30:00.000Z' },
      ],
      hasMore: false,
    }), { status: 200 })));

    const sessions = await searchMomenceSessions('');

    expect(sessions.map((session) => session.id)).toEqual(['801']);
  });

  it('does not let the dedicated session edge function default to private session types', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/functions/momence-session-search/index.ts'), 'utf8');
    const genericProxySource = readFileSync(resolve(process.cwd(), 'supabase/functions/momence-search/index.ts'), 'utf8');

    expect(source).not.toContain("const DEFAULT_SESSION_TYPE = 'private'");
    expect(source).not.toContain(': [typeof body.type');
    expect(source).toContain('const sessionTypes = resolveSessionTypes(body);');
    expect(source).toContain("url.searchParams.append('types[]', sessionType);");
    expect(genericProxySource).toContain('url.searchParams.append(`${key}[]`, String(item));');
  });
});

describe('loadMomenceTicketContext', () => {
  it('returns an empty summary when no Momence member or session is selected', async () => {
    const context = await loadMomenceTicketContext({});

    expect(context.summary.member).toBeUndefined();
    expect(context.summary.ticketContextLines).toEqual([]);
  });
});
