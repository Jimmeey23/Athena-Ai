import { describe, expect, it } from 'vitest';
import { buildTicketReviewInsights } from './ticket-review';
import { Ticket } from './ticketing-data';

const duplicateTicket: Ticket = {
  id: 'P57-DUP1',
  title: 'Late cancellation dispute for Asha Rao',
  description: 'Member reported a late cancellation dispute for the 8am session.',
  category: 'Scheduling',
  subCategory: 'Late Arrival Policy',
  priority: 'Medium',
  status: 'New',
  studio: 'Bandra',
  trainer: 'Mira Kapoor',
  classType: 'Power Sculpt',
  classDateTime: '2026-06-01T04:30:00.000Z',
  memberName: 'Asha Rao',
  memberContact: 'asha@example.com',
  reportedBy: 'Front Desk',
  assignedTo: 'Client Success',
  team: 'Client Success',
  tags: ['ai-approved'],
  createdAt: '2026-05-30T04:00:00.000Z',
  slaDueAt: '2026-05-31T04:00:00.000Z',
};

describe('buildTicketReviewInsights', () => {
  it('builds confidence scores, rationale, Momence chips, and duplicate warning', () => {
    const review = buildTicketReviewInsights({
      draft: {
        title: 'Late cancellation dispute for Asha Rao',
        description: 'Member reported a late cancellation dispute and requested WhatsApp follow-up.',
        category: 'Scheduling',
        subCategory: 'Late Arrival Policy',
        priority: 'High',
        studio: 'Bandra',
        trainer: 'Mira Kapoor',
        classType: 'Power Sculpt',
        classDateTime: '2026-06-01T04:30:00.000Z',
        memberName: 'Asha Rao',
        memberContact: 'asha@example.com',
        reportedBy: 'Front Desk',
        assignedTo: 'Client Success',
        department: 'Client Success',
        tags: ['ai-approved'],
        sentiment: 'Member Expressed Frustration/Anger',
      },
      context: {
        memberId: '42',
        sessionId: '202',
        desiredResolution: 'Member wants a WhatsApp update.',
      },
      momenceSummary: {
        member: {
          id: '42',
          name: 'Asha Rao',
          email: 'asha@example.com',
          phoneNumber: '+919900000000',
          tags: ['VIP', 'Retention Risk'],
        },
        membershipOverview: {
          activeCount: 1,
          frozenCount: 0,
          memberships: [{ id: '11', name: 'Unlimited Monthly', status: 'Active', creditsLabel: '8/12 credits left' }],
        },
        bookingOverview: {
          totalLoaded: 2,
          checkedInCount: 1,
          cancelledCount: 0,
          lastVisit: { id: '101', classType: 'Signature Barre', startsAt: '2026-05-28T04:30:00.000Z', checkedIn: true },
          nextBooking: { id: '102', classType: 'Power Sculpt', startsAt: '2026-06-01T04:30:00.000Z' },
          recentBookings: [],
        },
        noteOverview: { count: 1, latestNote: 'Prefers WhatsApp follow-up.' },
        session: {
          id: '202',
          classType: 'Power Sculpt',
          startsAt: '2026-06-01T04:30:00.000Z',
          trainer: 'Mira Kapoor',
          studio: 'Bandra',
          fillRateLabel: '18/20 booked',
          matchingMemberBookingId: '301',
          matchingMemberCheckedIn: false,
        },
        availableTagCount: 6,
        ticketContextLines: ['Momence member: Asha Rao'],
      },
      duplicateTicket,
    });

    expect(review.confidence.map((item) => item.label)).toEqual(['Classification', 'Priority', 'Routing', 'SLA', 'Momence']);
    expect(review.confidence.find((item) => item.label === 'Momence')?.score).toBe(100);
    expect(review.routingRationale).toContain('Department routed to Client Success.');
    expect(review.momenceChips).toContain('VIP');
    expect(review.momenceChips).toContain('18/20 booked');
    expect(review.duplicateWarning?.ticketId).toBe('P57-DUP1');
    expect(review.riskSignals).toContain('Retention risk: frustration/refund/cancellation signal needs proactive follow-up.');
    expect(review.riskSignals).toContain('SLA risk: High priority ticket should be published promptly to start the 8h SLA clock.');
    expect(review.riskSignals).toContain('Exact duplicate: existing ticket P57-DUP1 will be merged automatically on approval.');
    expect(review.sections.find((section) => section.title === 'Client details')?.items).toContain('Asha Rao');
  });

  it('lowers confidence when important routing and Momence details are missing', () => {
    const review = buildTicketReviewInsights({
      draft: {
        title: 'General member issue',
        description: '',
        category: 'Other',
        subCategory: '',
        priority: 'Medium',
        studio: '',
        tags: [],
      },
    });

    expect(review.confidence.find((item) => item.label === 'Classification')?.score).toBeLessThan(70);
    expect(review.confidence.find((item) => item.label === 'Momence')?.score).toBe(0);
    expect(review.routingRationale).toContain('Owner will auto-route if no owner is selected.');
    expect(review.duplicateWarning).toBeUndefined();
  });
});
