// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInterface } from './ChatInterface';

vi.mock('./useTickets', () => ({
  useTickets: () => ({
    createApprovedTicket: vi.fn(),
    tickets: [],
    setSelectedTicket: vi.fn(),
  }),
}));

vi.mock('@/contexts/useBackendAuth', () => ({
  useBackendAuth: () => ({ user: null }),
}));

vi.mock('@/components/InteractiveRobotSpline', () => ({
  default: () => <div data-testid="robot" />,
}));

vi.mock('./TicketPreviewCard', () => ({
  TicketPreviewCard: () => <div />, 
}));

vi.mock('./ContextPicker', () => ({
  ContextPicker: () => <div />, 
}));

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('ChatInterface', () => {
  it('calls onHome when the app logo is clicked', async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();

    render(<ChatInterface onHome={onHome} />);

    await user.click(screen.getByRole('button', { name: /go to home/i }));

    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
