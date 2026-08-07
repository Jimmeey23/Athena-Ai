import { describe, expect, it } from 'vitest';
import {
  buildRelatedTicketNotice,
  findExistingSubmittedTicket,
  findRelatedSubmittedTickets,
} from './ticket-duplicate-matching';
import { Ticket } from './ticketing-data';

const baseTicket: Ticket = {
  id: 'P57-OLD123',
  title: 'Late cancellation dispute for Anita Rao',
  description: 'Member reported a late cancellation dispute for the 8am Studio Barre 57 session.',
  category: 'Scheduling',
  subCategory: 'Late Arrival Policy',
  priority: 'Medium',
  status: 'New',
  studio: 'Supreme HQ, Bandra',
  trainer: 'Anisha Shah',
  classType: 'Studio Barre 57',
  classDateTime: '2026-05-20T08:00:00+05:30',
  memberName: 'Anita Rao',
  memberContact: 'anita@example.com',
  reportedBy: 'Front Desk',
  assignedTo: 'Akshay Rane',
  team: 'Sales & Client Servicing',
  tags: ['ai-approved'],
  createdAt: '2026-05-20T04:00:00.000Z',
  slaDueAt: '2026-05-21T04:00:00.000Z',
  sourceRef: 'approved-draft:old',
  metadata: {
    intake_context: {
      sessionId: 'momence-100',
      incidentDateTime: '2026-05-20T08:00:00+05:30',
    },
  },
};

describe('findExistingSubmittedTicket', () => {
  it('does not treat an explicit ticket ID as a duplicate unless all strict anchors match', () => {
    const result = findExistingSubmittedTicket(
      'Please update P57-OLD123 with this follow-up.',
      {
        memberName: 'Different Member',
        category: 'Repair and Maintenance',
        subCategory: 'Door Lock Issues',
        studio: 'Supreme HQ, Bandra',
        incidentDateTime: '2026-05-20T08:00:00+05:30',
      },
      [baseTicket]
    );

    expect(result).toBeNull();
  });

  it('does not match an old ticket only because the member is the same', () => {
    const result = findExistingSubmittedTicket(
      'Member reported a waitlist concern for the 5pm Barre session on 24 May.',
      {
        memberName: 'Anita Rao',
        memberContact: 'anita@example.com',
        studio: 'Supreme HQ, Bandra',
        category: 'Scheduling',
        subCategory: 'Waitlist Concerns',
        classType: 'Studio Barre 57',
        classDateTime: '2026-05-24T17:00:00+05:30',
        sessionId: 'momence-200',
      },
      [baseTicket]
    );

    expect(result).toBeNull();
  });

  it('matches only when issue type, incident minute, studio, member, and selected session match exactly', () => {
    const result = findExistingSubmittedTicket(
      'Member reported a late cancellation dispute for the 8am Studio Barre 57 session.',
      {
        memberName: 'Anita Rao',
        memberContact: 'anita@example.com',
        studio: 'Supreme HQ, Bandra',
        category: 'Scheduling',
        subCategory: 'Late Arrival Policy',
        classType: 'Studio Barre 57',
        classDateTime: '2026-05-20T08:00:00+05:30',
        incidentDateTime: '2026-05-20T08:00:00+05:30',
        sessionId: 'momence-100',
      },
      [baseTicket]
    );

    expect(result?.id).toBe('P57-OLD123');
  });

  it('rejects duplicate matching when the incident minute differs even if the issue type and member match', () => {
    const result = findExistingSubmittedTicket(
      'Member reported another late cancellation dispute for the same morning.',
      {
        memberName: 'Anita Rao',
        memberContact: 'anita@example.com',
        studio: 'Supreme HQ, Bandra',
        category: 'Scheduling',
        subCategory: 'Late Arrival Policy',
        classType: 'Studio Barre 57',
        classDateTime: '2026-05-20T08:00:00+05:30',
        incidentDateTime: '2026-05-20T08:05:00+05:30',
        sessionId: 'momence-100',
      },
      [baseTicket]
    );

    expect(result).toBeNull();
  });

  it('groups same issue types with different specifics as similar tickets without merging them', () => {
    const related = findRelatedSubmittedTickets(
      'Member reported a late cancellation dispute for a different 9am class.',
      {
        memberName: 'Anita Rao',
        memberContact: 'anita@example.com',
        studio: 'Supreme HQ, Bandra',
        category: 'Scheduling',
        subCategory: 'Late Arrival Policy',
        classType: 'Studio Barre 57',
        classDateTime: '2026-05-21T09:00:00+05:30',
        incidentDateTime: '2026-05-21T09:00:00+05:30',
        sessionId: 'momence-300',
      },
      [baseTicket]
    );

    expect(related.exactDuplicate).toBeNull();
    expect(related.similarTickets.map((ticket) => ticket.id)).toEqual(['P57-OLD123']);
  });

  it('suppresses a related-ticket notice after the same ticket group has already been shown', () => {
    const related = {
      exactDuplicate: null,
      similarTickets: [baseTicket],
    };
    const shownKeys = new Set<string>();

    const firstNotice = buildRelatedTicketNotice(related, shownKeys);
    if (firstNotice) shownKeys.add(firstNotice.key);
    const repeatedNotice = buildRelatedTicketNotice(related, shownKeys);

    expect(firstNotice?.content).toContain('Similar ticket group found: **P57-OLD123**');
    expect(repeatedNotice).toBeNull();
  });
});
