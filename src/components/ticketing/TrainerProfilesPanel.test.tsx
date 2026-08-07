// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ticket } from '@/lib/ticketing-data';
import { TrainerProfilesPanel } from './TrainerProfilesPanel';

const ticketState = vi.hoisted(() => ({
  tickets: [] as Ticket[],
}));

vi.mock('./useTickets', () => ({
  useTickets: () => ({
    tickets: ticketState.tickets,
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  RadarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Radar: () => <div />,
  PolarGrid: () => <div />,
  PolarAngleAxis: () => <div />,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

const trainerTicket: Ticket = {
  id: 'P57-TRAIN-1',
  title: 'Instructor evaluation · Anisha Shah · Barre',
  description: 'Instructor Evaluation Brief\n\nEvaluator feedback captured for coaching.',
  category: 'Trainer Feedback',
  subCategory: 'Trainer Class Assessment',
  priority: 'Low',
  status: 'New',
  studio: 'Supreme HQ, Bandra',
  trainer: 'Anisha Shah',
  classType: 'Studio Barre 57',
  classDateTime: '2026-06-01T07:30:00.000Z',
  assignedTo: 'Trainer Profile',
  team: 'Training & Client Experience',
  tags: ['trainer-profile', 'instructor-evaluation', 'profile-only'],
  createdAt: '2026-06-01T09:00:00.000Z',
  slaDueAt: '2026-06-02T09:00:00.000Z',
  sourceRef: 'athena-trainer-review:anisha:barre:june',
  metadata: {
    trainerReview: {
      id: 'review-1',
      trainer: 'Anisha Shah',
      template: 'Barre',
      studio: 'Supreme HQ, Bandra',
      classType: 'Studio Barre 57',
      reviewPeriod: '2026-06-01',
      createdAt: '2026-06-01T09:00:00.000Z',
      scores: [
        { category: 'Client attendance', weightage: 12.5, score: 10 },
        { category: 'Client feedback', weightage: 12.5, score: 11 },
      ],
      feedback: 'Strong class energy with a clear coaching opportunity around member follow-up.',
      focusPoints: 'Improve post-class follow-up consistency.',
      goals: 'Raise retention touchpoints.',
      totalWeightage: 25,
      totalScore: 21,
      scorePercent: 84,
      sourceRef: 'athena-trainer-review:anisha:barre:june',
    },
  },
};

describe('TrainerProfilesPanel', () => {
  beforeEach(() => {
    ticketState.tickets = [trainerTicket];
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens a clicked previous ticket in the ticket preview report section and scrolls it into view', async () => {
    const user = userEvent.setup();

    render(<TrainerProfilesPanel />);

    await user.click(screen.getByRole('button', { name: /P57-TRAIN-1/i }));

    await waitFor(() => {
      expect(screen.getByText('Evaluation Report')).toBeTruthy();
    });
    expect(screen.getByText('P57-TRAIN-1')).toBeTruthy();
    expect(screen.getByText('Instructor evaluation · Anisha Shah · Barre')).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
