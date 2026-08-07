import { describe, expect, it } from 'vitest';
import { getSlaState, isTicketBreached, resolveTicketAssignee, resolveTicketDepartment, type Ticket } from './ticketing-data';

describe('ticketing data routing', () => {
  it('routes billing and pricing categories to studio Sales & Client Servicing owners', () => {
    expect(resolveTicketAssignee('Billing & Membership', 'Supreme HQ, Bandra')).toBe('Imran Shaikh');
    expect(resolveTicketDepartment('Billing & Membership', 'Imran Shaikh')).toBe('Sales & Client Servicing');

    expect(resolveTicketAssignee('Pricing and Memberships', 'Kenkere House, Bengaluru')).toBe('Yashas K');
    expect(resolveTicketDepartment('Pricing and Memberships', 'Yashas K')).toBe('Sales & Client Servicing');
  });
});

describe('record-only SLA handling', () => {
  const recordOnlyTicket: Ticket = {
    id: 'P57-RECORD',
    title: 'Weekend recovery class suggestion',
    description: 'Member suggested adding more weekend recovery sessions.',
    category: 'General Feedback',
    subCategory: 'Suggestion',
    priority: 'Low',
    status: 'Closed',
    studio: 'Supreme HQ, Bandra',
    assignedTo: 'Unassigned',
    team: 'Customer Service',
    tags: ['record-only', 'no-resolution-required'],
    createdAt: '2026-06-01T08:00:00.000Z',
    slaDueAt: '2026-06-01T08:00:00.000Z',
    metadata: {
      resolution_required: false,
      no_sla: true,
    },
  };

  it('does not breach or assign an active SLA state to record-only tickets', () => {
    expect(isTicketBreached(recordOnlyTicket, new Date('2026-06-02T08:00:00.000Z').getTime())).toBe(false);
    expect(getSlaState(recordOnlyTicket, new Date('2026-06-02T08:00:00.000Z').getTime())).toBe('Not Required');
  });
});
