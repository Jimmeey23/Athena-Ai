// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInterface } from './ChatInterface';

const hoisted = vi.hoisted(() => ({
  invokeTicketingFunction: vi.fn(),
}));

vi.mock('./useTickets', () => ({
  useTickets: () => ({
    createApprovedTicket: vi.fn(),
    tickets: [],
    setSelectedTicket: vi.fn(),
  }),
}));

vi.mock('@/contexts/useBackendAuth', () => ({
  useBackendAuth: () => ({
    user: {
      email: 'jimmeey@example.com',
      user_metadata: {
        full_name: 'Jimmeey',
      },
    },
  }),
}));

vi.mock('@/lib/ticketing-functions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ticketing-functions')>('@/lib/ticketing-functions');
  return {
    ...actual,
    invokeTicketingFunction: hoisted.invokeTicketingFunction,
  };
});

vi.mock('@/components/InteractiveRobotSpline', () => ({
  default: () => <div data-testid="athena-robot" />,
}));

describe('ChatInterface intake flow', () => {
  beforeEach(() => {
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
    hoisted.invokeTicketingFunction.mockReset();
  });

  it('optimizes rough chat input when the optimize icon is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Tell me what happened…") as HTMLTextAreaElement;
    await user.type(input, 'CLIENT SMITA MODI WANTS A REFUND');
    await user.click(screen.getByLabelText('Optimise prompt for Athena'));

    expect(input.value).toBe('Client Smita Modi requested a refund.');
    expect(hoisted.invokeTicketingFunction).not.toHaveBeenCalled();
  });

  it('shows the AI draft instead of forcing a local description form when the AI returns a ticket', async () => {
    const completeRefundResponse = {
      data: {
        conversationId: 'conversation-1',
        needsMoreInfo: false,
        reply: 'Drafting the ticket now with the provided details.',
        detailForm: null,
        inferredContext: {
          intakeRoute: 'Request',
          category: 'Pricing and Memberships',
          subCategory: 'Refund and Cancellation Policy Issue',
          membership: 'Studio 3 Month Unlimited Membership',
          desiredResolution: 'Member requested a refund review and WhatsApp follow-up.',
          memberSentiment: 'Member Expressed Dissatisfaction',
          priority: 'High',
          resolutionRequired: 'Yes',
        },
        ticket: {
          title: 'Refund request for Smita Modi',
          description: 'Client Smita Modi wants a refund.',
          category: 'Pricing and Memberships',
          subCategory: 'Refund and Cancellation Policy Issue',
          priority: 'High',
          studio: 'Supreme HQ, Bandra',
          memberName: 'Smita Modi',
          memberContact: 'smita.modi@ymail.com',
          reportedBy: 'Jimmeey',
          tags: ['ai-draft'],
          sentiment: 'Member Expressed Dissatisfaction',
        },
        suggestedChips: [],
        missingFields: [],
        publishable: true,
      },
      error: null,
    };
    hoisted.invokeTicketingFunction.mockResolvedValueOnce(completeRefundResponse);

    const user = userEvent.setup();
    const { container } = render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Tell me what happened…");
    await user.type(input, 'CLIENT SMITA MODI WANTS A REFUND');
    const sendButton = container.querySelector('svg.lucide-send')?.closest('button');
    expect(sendButton).toBeTruthy();
    await user.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(hoisted.invokeTicketingFunction).toHaveBeenCalledTimes(1);
    });

    await waitFor(
      () => {
        expect(screen.getAllByText(/Draft ready/i).length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
    expect(screen.queryByText(/Just a couple more details and we'll have a clean draft ready/i)).toBeNull();
    expect(screen.queryByText(/were any clients affected/i)).toBeNull();
    expect(screen.queryByText(/Momence purchase\/payment context/i)).toBeNull();
  });

  it('does not draft a named membership refund after only the resolution answer is present', async () => {
    hoisted.invokeTicketingFunction.mockResolvedValue({
      data: {
        conversationId: 'conversation-2',
        needsMoreInfo: false,
        reply: 'I drafted the ticket below. Please review it before publishing.',
        detailForm: null,
        inferredContext: {
          intakeRoute: 'Request',
          category: 'Pricing and Memberships',
          subCategory: 'Refund and Cancellation Policy Issue',
          priority: 'High',
          resolutionRequired: 'Yes',
        },
        ticket: {
          title: 'Request · Refund and Cancellation Policy Issue',
          description: 'Smita Patil is asking for a refund of her membership fees.',
          category: 'Pricing and Memberships',
          subCategory: 'Refund and Cancellation Policy Issue',
          priority: 'High',
          studio: 'Unspecified Studio',
          reportedBy: 'Jimmeey',
          tags: ['ai-draft'],
        },
        suggestedChips: [],
        missingFields: [],
        publishable: true,
      },
      error: null,
    });

    const user = userEvent.setup();
    const { container } = render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Tell me what happened…");
    await user.type(input, 'SMITA PATIL IS ASKING FOR A REFUND OF HER MEMBERSHIP FEES.');
    const sendButton = container.querySelector('svg.lucide-send')?.closest('button');
    expect(sendButton).toBeTruthy();
    await user.click(sendButton as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText(/were any clients affected/i)).toBeTruthy();
    });
    expect(screen.queryByText(/I drafted the ticket below/i)).toBeNull();
    expect(screen.queryByText(/Draft ready/i)).toBeNull();
  });
});
