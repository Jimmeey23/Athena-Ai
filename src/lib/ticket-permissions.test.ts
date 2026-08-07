import { describe, expect, it } from 'vitest';
import { canAccessTicket, canEditTicketResolution, canUpdateTicketStatus } from './ticket-permissions';

describe('ticket status permissions', () => {
  it('does not allow admins to update resolver status unless they own or supervise the owner', () => {
    expect(
      canUpdateTicketStatus({
        accessRole: 'admin',
        identityValues: new Set(['frontdesk@physique57india.com']),
        ticket: { assignedTo: 'Anisha Shah' },
      })
    ).toBe(false);
  });

  it('allows the assigned owner to update status by name', () => {
    expect(
      canUpdateTicketStatus({
        accessRole: 'executive',
        identityValues: new Set(['anisha shah']),
        ticket: { assignedTo: 'Anisha Shah' },
      })
    ).toBe(true);
  });

  it('allows the assigned owner to update status by employee email', () => {
    expect(
      canUpdateTicketStatus({
        accessRole: 'executive',
        identityValues: new Set(['anisha@physique57india.com']),
        ticket: { assignedTo: 'Anisha Shah' },
      })
    ).toBe(true);
  });

  it('allows the assigned owner immediate supervisor to update resolver status', () => {
    expect(
      canUpdateTicketStatus({
        accessRole: 'manager',
        identityValues: new Set(['jimmeey gondaa']),
        ticket: { assignedTo: 'Imran Shaikh' },
      })
    ).toBe(true);
  });

  it('blocks executive users who are not the assigned owner', () => {
    expect(
      canUpdateTicketStatus({
        accessRole: 'executive',
        identityValues: new Set(['operations@physique57india.com', 'zahur shaikh']),
        ticket: { assignedTo: 'Anisha Shah' },
      })
    ).toBe(false);
  });
});

describe('ticket visibility permissions', () => {
  it('allows admins to see every ticket', () => {
    expect(
      canAccessTicket({
        accessRole: 'admin',
        identityValues: new Set(['frontdesk@physique57india.com']),
        ticket: { createdBy: 'someone-else', assignedTo: 'Anisha Shah', reportedBy: 'Someone Else' },
      })
    ).toBe(true);
  });

  it('allows executive users to see tickets they created', () => {
    expect(
      canAccessTicket({
        accessRole: 'executive',
        identityValues: new Set(['user-123']),
        ticket: { createdBy: 'user-123', assignedTo: 'Anisha Shah' },
      })
    ).toBe(true);
  });

  it('allows executive users to see tickets assigned to their employee email', () => {
    expect(
      canAccessTicket({
        accessRole: 'executive',
        identityValues: new Set(['anisha@physique57india.com']),
        ticket: { assignedTo: 'Anisha Shah' },
      })
    ).toBe(true);
  });

  it('blocks unrelated executive users', () => {
    expect(
      canAccessTicket({
        accessRole: 'executive',
        identityValues: new Set(['operations@physique57india.com']),
        ticket: { createdBy: 'user-123', assignedTo: 'Anisha Shah', reportedBy: 'Priya' },
      })
    ).toBe(false);
  });

  it('allows managers to see tickets assigned to their direct team members inside their department', () => {
    expect(
      canAccessTicket({
        accessRole: 'manager',
        identityValues: new Set(['pushyank nahar']),
        teamMemberIdentityValues: new Set(['mrigakshi jaiswal', 'mrigakshi@physique57mumbai.com']),
        departmentValues: new Set(['Training']),
        ticket: { assignedTo: 'Mrigakshi Jaiswal', team: 'Training' },
      })
    ).toBe(true);
  });

  it('blocks managers from seeing team-member tickets outside their department scope', () => {
    expect(
      canAccessTicket({
        accessRole: 'manager',
        identityValues: new Set(['pushyank nahar']),
        teamMemberIdentityValues: new Set(['mrigakshi jaiswal', 'mrigakshi@physique57mumbai.com']),
        departmentValues: new Set(['Training']),
        ticket: { assignedTo: 'Mrigakshi Jaiswal', team: 'Sales & Client Servicing' },
      })
    ).toBe(false);
  });
});

describe('ticket resolution plan permissions', () => {
  it('allows the escalation manager to edit the resolution plan', () => {
    expect(
      canEditTicketResolution({
        accessRole: 'executive',
        identityValues: new Set(['saachi shetty']),
        ticket: { assignedTo: 'Zahur Shaikh' },
      })
    ).toBe(true);
  });

  it('blocks unrelated executive users from editing the resolution plan', () => {
    expect(
      canEditTicketResolution({
        accessRole: 'executive',
        identityValues: new Set(['frontdesk@physique57india.com']),
        ticket: { assignedTo: 'Zahur Shaikh' },
      })
    ).toBe(false);
  });

  it('blocks admins who are neither owner nor immediate supervisor from editing the resolution plan', () => {
    expect(
      canEditTicketResolution({
        accessRole: 'admin',
        identityValues: new Set(['admin@physique57india.com']),
        ticket: { assignedTo: 'Zahur Shaikh' },
      })
    ).toBe(false);
  });
});
