// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ticket } from '@/lib/ticketing-data';
import { TicketDetailDrawer } from './TicketDetailDrawer';

const ticketActions = vi.hoisted(() => ({
  updateTicket: vi.fn(),
  updateTicketStatus: vi.fn(),
  updateTicketResolutionPlan: vi.fn(),
  canUpdateTicketStatus: vi.fn(),
  canEditTicketResolution: vi.fn(),
  deleteTicket: vi.fn(),
}));

vi.mock('./useTickets', () => ({
  useTickets: () => ({
    ...ticketActions,
  }),
}));

vi.mock('@/lib/backend-supabase', () => ({
  backendSupabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(),
      }),
    },
  },
}));

vi.mock('./MomenceAutomationPanel', () => ({
  MomenceAutomationPanel: () => <div data-testid="momence-automation-panel" />,
}));

const baseTicket: Ticket = {
  id: 'P57-2001',
  title: 'Member reported billing concern',
  description: 'Member reported an unexpected package charge.',
  category: 'Billing',
  subCategory: 'Payment Issue',
  priority: 'Medium',
  status: 'New',
  studio: 'Supreme HQ, Bandra',
  assignedTo: 'Tahira Sayyed',
  team: 'Accounts & Finance',
  tags: ['billing'],
  createdAt: '2026-06-07T07:00:00.000Z',
  slaDueAt: '2026-06-08T07:00:00.000Z',
  metadata: {
    recommendedResolutionSteps: [
      'Review the member payment and package history.',
      'Confirm the charge source and explain the correction pathway.',
    ],
  },
};

describe('TicketDetailDrawer', () => {
  afterEach(() => {
    cleanup();
    Object.values(ticketActions).forEach((mock) => mock.mockReset());
  });

  it('saves structured resolution dropdown fields with the editable plan', async () => {
    const user = userEvent.setup();
    ticketActions.canUpdateTicketStatus.mockReturnValue(true);
    ticketActions.canEditTicketResolution.mockReturnValue(true);

    render(<TicketDetailDrawer ticket={baseTicket} onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText('Resolution stage'), 'Investigating');
    await user.selectOptions(screen.getByLabelText('Resolution pathway'), 'Billing adjustment');
    await user.selectOptions(screen.getByLabelText('Member follow-up channel'), 'WhatsApp');
    await user.selectOptions(screen.getByLabelText('Member response'), 'Member wants written response');
    await user.type(screen.getByLabelText('Owner / manager notes'), 'Finance owner to verify the package ledger.');
    await user.click(screen.getByRole('button', { name: /save resolution plan/i }));

    expect(ticketActions.updateTicketResolutionPlan).toHaveBeenCalledWith('P57-2001', expect.objectContaining({
      stage: 'Investigating',
      pathway: 'Billing adjustment',
      memberFollowUpChannel: 'WhatsApp',
      memberResponse: 'Member wants written response',
      ownerNotes: 'Finance owner to verify the package ledger.',
    }));
  });
});
