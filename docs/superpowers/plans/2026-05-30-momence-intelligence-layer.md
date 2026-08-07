# Momence Intelligence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Momence intelligence layer that summarizes member, membership, booking, notes, tag, session, and booking context for faster ticket handling.

**Architecture:** Keep raw Momence API access in `src/lib/momence-api.ts`, add pure normalization helpers that can be tested without network access, then expose one orchestration function that loads member/session data in parallel. Reuse the new context in `MomenceAutomationPanel` as a read-only insight mode while preserving existing operational actions.

**Tech Stack:** Vite, React, TypeScript, Vitest, Supabase Edge Functions, Momence API v2.

---

### Task 1: Add Momence Context Types and Normalizers

**Files:**
- Modify: `src/lib/momence-api.ts`
- Test: `src/lib/momence-api.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildMomenceInsightSummary } from './momence-api';

describe('buildMomenceInsightSummary', () => {
  it('summarizes member, memberships, bookings, notes, and tags for ticket context', () => {
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
          membership: { id: 1, name: 'Unlimited Monthly' },
          isFrozen: false,
          eventCreditsLeft: 8,
          eventCreditsTotal: 12,
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
    expect(summary.membershipOverview.activeCount).toBe(1);
    expect(summary.bookingOverview.totalLoaded).toBe(2);
    expect(summary.bookingOverview.lastVisit?.classType).toBe('Signature Barre');
    expect(summary.bookingOverview.nextBooking?.classType).toBe('Power Sculpt');
    expect(summary.noteOverview.latestNote).toBe('Prefers WhatsApp follow-up.');
    expect(summary.session?.fillRateLabel).toBe('18/20 booked');
    expect(summary.session?.matchingMemberBookingId).toBe('301');
    expect(summary.ticketContextLines).toContain('Momence member: Asha Rao');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/momence-api.test.ts`

Expected: fail because `buildMomenceInsightSummary` is not exported yet.

- [ ] **Step 3: Implement context types and pure summary builder**

Add exported types for `MomenceInsightInput`, `MomenceInsightSummary`, and a `buildMomenceInsightSummary(input)` function in `src/lib/momence-api.ts`. The function should format member identity, memberships, member booking overview, latest note, selected session, matching selected member booking, and text lines safe to inject into ticket handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/momence-api.test.ts`

Expected: pass.

### Task 2: Add Parallel Momence Context Loader

**Files:**
- Modify: `src/lib/momence-api.ts`
- Test: `src/lib/momence-api.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { loadMomenceTicketContext } from './momence-api';

it('returns an empty summary when no Momence member or session is selected', async () => {
  const context = await loadMomenceTicketContext({});
  expect(context.summary.member).toBeUndefined();
  expect(context.summary.ticketContextLines).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/momence-api.test.ts`

Expected: fail because `loadMomenceTicketContext` is not exported.

- [ ] **Step 3: Implement loader**

Add `loadMomenceTicketContext({ memberId, sessionId, includeTags })` that calls the existing Momence API helpers in parallel and returns raw data plus `buildMomenceInsightSummary(raw)`. It should skip network calls for missing IDs and return empty arrays for optional collections.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/momence-api.test.ts`

Expected: pass.

### Task 3: Surface Momence Insights in the Existing Panel

**Files:**
- Modify: `src/components/ticketing/MomenceAutomationPanel.tsx`

- [ ] **Step 1: Replace local `MomenceState` shape with `MomenceTicketContext`**

Import `loadMomenceTicketContext` and `MomenceTicketContext` from `src/lib/momence-api.ts`. Keep the existing search and action buttons unchanged.

- [ ] **Step 2: Render insight cards**

Add read-only cards for member summary, membership overview, booking overview, latest note, and selected session summary. Do not block existing actions if insight loading fails; show the existing error panel.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: pass.

### Task 4: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- src/lib/momence-api.test.ts`

Expected: pass.

- [ ] **Step 2: Run full tests**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: zero errors; existing Fast Refresh warnings may remain.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: pass.
