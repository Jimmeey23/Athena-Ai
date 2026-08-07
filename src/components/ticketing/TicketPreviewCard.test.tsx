// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketPreviewCard } from './TicketPreviewCard';

type DraftProp = React.ComponentProps<typeof TicketPreviewCard>['draft'];

describe('TicketPreviewCard', () => {
  afterEach(() => cleanup());

  it('renders AI drafts when the provider omits optional tags', () => {
    const draftWithoutTags = {
      title: 'Member reported billing concern',
      description: 'Member reported an unexpected package charge.',
      category: 'Billing',
      subCategory: 'Payment Issue',
      priority: 'Medium',
      studio: 'Bandra',
    } as unknown as DraftProp;

    expect(() => {
      render(
        <TicketPreviewCard
          draft={draftWithoutTags}
          onConfirm={vi.fn()}
          onEdit={vi.fn()}
        />
      );
    }).not.toThrow();

    expect(screen.getByText('Member reported billing concern')).toBeTruthy();
  });

  it('offers a fix routing action that opens editable routing fields', async () => {
    const user = userEvent.setup();
    const draft = {
      title: 'AC issue',
      description: 'AC is not cooling in Bandra.',
      category: 'Repair and Maintenance',
      subCategory: 'AC and HVAC Issues',
      priority: 'Medium',
      studio: 'Supreme HQ, Bandra',
      tags: [],
    } as DraftProp;

    render(
      <TicketPreviewCard
        draft={draft}
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /fix routing/i }));

    expect(screen.getByLabelText('Category')).toBeTruthy();
    expect(screen.getByLabelText('Subcategory')).toBeTruthy();
    expect(screen.getByLabelText('Priority')).toBeTruthy();
  });
});
