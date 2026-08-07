import { describe, expect, it } from 'vitest';
import {
  buildTicketEmailAutomationJobs,
  ticketEmailAutomationEventKey,
  TicketEmailAutomationTicket,
} from '../../supabase/functions/_shared/ticket-email-automation.ts';

const baseTicket: TicketEmailAutomationTicket = {
  id: 'P57-NEW001',
  assigned_to: 'Imran Shaikh',
  created_at: '2026-05-25T03:30:00.000Z',
  updated_at: '2026-05-25T03:30:00.000Z',
  sla_due_at: '2026-05-25T12:00:00.000Z',
  status: 'New',
};

describe('ticket email automation dispatch rules', () => {
  it('selects only idempotent assignment jobs for new tickets', () => {
    const jobs = buildTicketEmailAutomationJobs({
      tickets: [baseTicket],
      existingEventKeys: new Set(),
      now: new Date('2026-05-25T04:00:00.000Z'),
      timeZone: 'Asia/Kolkata',
    });

    expect(jobs).toEqual([
      {
        eventType: 'ticket_assigned',
        eventKey: 'ticket_assigned:P57-NEW001:Imran Shaikh:2026-05-25T03:30:00.000Z',
        ticketId: 'P57-NEW001',
      },
    ]);
  });

  it('skips jobs that already have audit event keys', () => {
    const assignedKey = ticketEmailAutomationEventKey('ticket_assigned', baseTicket);

    const jobs = buildTicketEmailAutomationJobs({
      tickets: [baseTicket],
      existingEventKeys: new Set([assignedKey]),
      now: new Date('2026-05-25T04:00:00.000Z'),
      timeZone: 'Asia/Kolkata',
    });

    expect(jobs).toEqual([]);
  });

  it('does not select lifecycle jobs for resolved or closed tickets', () => {
    const jobs = buildTicketEmailAutomationJobs({
      tickets: [
        { ...baseTicket, id: 'P57-RESOLVED', status: 'Resolved' },
        { ...baseTicket, id: 'P57-CLOSED', status: 'Closed' },
      ],
      existingEventKeys: new Set(),
      now: new Date('2026-05-25T04:00:00.000Z'),
      timeZone: 'Asia/Kolkata',
    });

    expect(jobs).toEqual([]);
  });

  it('limits assignment jobs to the recent-created candidate set without creating due-today jobs', () => {
    const olderDueToday = { ...baseTicket, id: 'P57-OLDER001', created_at: '2026-05-20T03:30:00.000Z' };

    const jobs = buildTicketEmailAutomationJobs({
      tickets: [baseTicket, olderDueToday],
      assignmentTicketIds: new Set([baseTicket.id]),
      existingEventKeys: new Set(),
      now: new Date('2026-05-25T04:00:00.000Z'),
      timeZone: 'Asia/Kolkata',
    });

    expect(jobs.map((job) => job.eventKey)).toEqual([
      'ticket_assigned:P57-NEW001:Imran Shaikh:2026-05-25T03:30:00.000Z',
    ]);
  });
});
