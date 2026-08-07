import { describe, expect, it } from 'vitest';
import {
  RECORD_ONLY_ASSIGNEE,
  applyResolutionRequirementToDraft,
  applySimilarTicketGroupingToDraft,
  buildDuplicateMergePatch,
  buildApprovedTicketCreateRequest,
  ticketRequiresResolution,
} from './ticket-approved-creation';
import type { Ticket } from './ticketing-data';

describe('approved ticket creation payload', () => {
  it('targets the ticket AI edge function create path with the approved draft and context', () => {
    const draft = {
      title: 'AC not cooling in Bandra studio',
      description: 'The AC was reported as not cooling before the evening session.',
      category: 'Repair and Maintenance',
      subCategory: 'AC and HVAC Issues',
      priority: 'High' as const,
      studio: 'Supreme HQ, Bandra',
      reportedBy: 'Ops User',
      assignedTo: 'Zahur Shaikh',
      department: 'Operations',
      tags: ['ai-draft'],
    };

    expect(buildApprovedTicketCreateRequest({
      draft,
      conversationId: 'conversation-1',
      context: { clientsAffected: 'No clients affected' },
    })).toEqual({
      action: 'createTicket',
      approved: true,
      draft,
      conversationId: 'conversation-1',
      context: { clientsAffected: 'No clients affected' },
    });
  });

  it('defaults approved tickets to resolution-required routing', () => {
    expect(ticketRequiresResolution({ resolutionRequired: 'Yes' })).toBe(true);
    expect(ticketRequiresResolution({})).toBe(true);
  });

  it('marks no-resolution tickets as record-only without owner or SLA routing', () => {
    const routed = applyResolutionRequirementToDraft(
      {
        title: 'Weekend recovery class suggestion',
        description: 'Member suggested adding more weekend recovery sessions.',
        category: 'General Feedback',
        subCategory: 'Suggestion',
        priority: 'Low' as const,
        studio: 'Supreme HQ, Bandra',
        assignedTo: 'Nunu Yeptomi',
        department: 'Customer Service',
        tags: ['ai-draft'],
      },
      {
        resolutionRequired: 'No',
        department: 'Customer Service',
        assignedTo: 'Nunu Yeptomi',
      }
    );

    expect(ticketRequiresResolution({ resolutionRequired: 'No' })).toBe(false);
    expect(routed.assignedTo).toBe(RECORD_ONLY_ASSIGNEE);
    expect(routed.department).toBe('Customer Service');
    expect(routed.tags).toEqual(expect.arrayContaining(['record-only', 'no-resolution-required']));
    expect(routed.metadata).toMatchObject({
      resolution_required: false,
      no_sla: true,
      routing: {
        resolution_required: false,
        assigned_to: RECORD_ONLY_ASSIGNEE,
        owner_pool: [],
        sla_due_at: null,
      },
    });
  });

  it('builds a duplicate merge patch without changing owner, department, or SLA routing', () => {
    const existing: Ticket = {
      id: 'P57-OLD123',
      title: 'Late cancellation dispute for Anita Rao',
      description: 'Original ticket details.',
      category: 'Scheduling',
      subCategory: 'Late Arrival Policy',
      priority: 'Medium',
      status: 'New',
      studio: 'Supreme HQ, Bandra',
      memberName: 'Anita Rao',
      assignedTo: 'Imran Shaikh',
      team: 'Sales & Client Servicing',
      tags: ['ai-approved'],
      createdAt: '2026-05-20T04:00:00.000Z',
      slaDueAt: '2026-05-21T04:00:00.000Z',
      metadata: { intake_context: { sessionId: 'momence-100' } },
    };

    const patch = buildDuplicateMergePatch(
      existing,
      {
        title: 'Late cancellation dispute for Anita Rao',
        description: 'Duplicate intake with member follow-up notes.',
        category: 'Scheduling',
        subCategory: 'Late Arrival Policy',
        priority: 'High',
        studio: 'Supreme HQ, Bandra',
        tags: ['ai-draft'],
      },
      { conversationId: 'conversation-2' },
      '2026-06-02T08:00:00.000Z'
    );

    expect(patch).not.toHaveProperty('assignedTo');
    expect(patch).not.toHaveProperty('team');
    expect(patch).not.toHaveProperty('slaDueAt');
    expect(patch.description).toContain('Merged duplicate intake - 2026-06-02T08:00:00.000Z');
    expect(patch.tags).toEqual(expect.arrayContaining(['ai-approved', 'duplicate-merged']));
    expect(patch.metadata).toMatchObject({
      duplicate_merge_count: 1,
      duplicate_merges: [
        expect.objectContaining({
          conversationId: 'conversation-2',
          title: 'Late cancellation dispute for Anita Rao',
        }),
      ],
    });
  });

  it('adds similar ticket grouping metadata without marking the draft as duplicate-merged', () => {
    const grouped = applySimilarTicketGroupingToDraft(
      {
        title: 'Late cancellation dispute for another session',
        description: 'Member reported the same issue type for another session.',
        category: 'Scheduling',
        subCategory: 'Late Arrival Policy',
        priority: 'Medium' as const,
        studio: 'Supreme HQ, Bandra',
        tags: ['ai-draft'],
      },
      ['P57-OLD123', 'P57-OLD456']
    );

    expect(grouped.tags).toEqual(expect.arrayContaining(['similar-ticket-group']));
    expect(grouped.tags).not.toContain('duplicate-merged');
    expect(grouped.metadata).toMatchObject({
      similar_ticket_ids: ['P57-OLD123', 'P57-OLD456'],
      grouped_not_merged: true,
    });
  });
});
