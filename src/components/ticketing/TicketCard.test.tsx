// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ticket } from '@/lib/ticketing-data';
import { TicketCard } from './TicketCard';

const baseTicket: Ticket = {
  id: 'P57-1001',
  title: 'AC cooling issue in Supreme HQ Studio 1',
  description: '- Member reported the studio felt too warm during class.\n- Front desk confirmed the AC was not cooling properly.',
  category: 'Repair and Maintenance',
  subCategory: 'AC and HVAC Issues',
  priority: 'High',
  status: 'In Progress',
  studio: 'Supreme HQ, Bandra',
  trainer: 'Rohan Dahima',
  classType: 'Studio Mat 57',
  classDateTime: '2026-06-06T10:30:00.000Z',
  memberName: 'Priya Shah',
  memberContact: 'priya@example.com',
  reportedBy: 'Jimmeey Gondaa',
  assignedTo: 'Zahur Shaikh',
  team: 'Operations & Maintenance',
  tags: ['ai-approved', 'facility'],
  createdAt: '2026-06-06T09:00:00.000Z',
  slaDueAt: '2026-06-06T17:00:00.000Z',
  sentiment: 'Negative',
};

describe('TicketCard', () => {
  afterEach(() => cleanup());

  it('shows rich ticket context without requiring hover', () => {
    render(<TicketCard ticket={baseTicket} />);

    expect(screen.getByText('P57-1001')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getByText('AC cooling issue in Supreme HQ Studio 1')).toBeTruthy();
    expect(screen.getByText(/Member reported the studio felt too warm during class/)).toBeTruthy();
    expect(screen.getByText('Priya Shah')).toBeTruthy();
    expect(screen.getAllByText('Zahur Shaikh').length).toBeGreaterThan(0);
    expect(screen.getByText('Supreme HQ, Bandra')).toBeTruthy();
    expect(screen.getByText('Operations & Maintenance')).toBeTruthy();
    expect(screen.getByText('Repair and Maintenance')).toBeTruthy();
    expect(screen.getByText('AC and HVAC Issues')).toBeTruthy();
    expect(screen.getByText(/Instructor: Rohan Dahima/)).toBeTruthy();
    expect(screen.getByText(/Class: Studio Mat 57/)).toBeTruthy();
  });

  it('keeps the existing click-to-open behavior', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<TicketCard ticket={baseTicket} onClick={onClick} />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
