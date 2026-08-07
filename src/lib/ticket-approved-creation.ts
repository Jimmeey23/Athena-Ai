export interface ApprovedTicketCreateRequestInput<TDraft extends Record<string, unknown>> {
  draft: TDraft;
  conversationId?: string | null;
  context?: Record<string, unknown>;
}

export const RECORD_ONLY_ASSIGNEE = 'Unassigned';
export const RECORD_ONLY_TAGS = ['record-only', 'no-resolution-required'] as const;
const DUPLICATE_MERGED_TAG = 'duplicate-merged';
const SIMILAR_TICKET_GROUP_TAG = 'similar-ticket-group';

function normalizedResolutionRequiredValue(context?: Record<string, unknown>): string {
  const value = context?.resolutionRequired;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function ticketRequiresResolution(context?: Record<string, unknown>): boolean {
  return normalizedResolutionRequiredValue(context) !== 'no';
}

export function applyResolutionRequirementToDraft<TDraft extends Record<string, unknown>>(
  draft: TDraft,
  context: Record<string, unknown> = {},
): TDraft & Record<string, unknown> {
  if (ticketRequiresResolution(context)) return draft;

  const tags = Array.from(new Set([
    ...((Array.isArray(draft.tags) ? draft.tags : []) as string[]),
    ...RECORD_ONLY_TAGS,
  ]));
  const department = typeof context.department === 'string' && context.department.trim()
    ? context.department.trim()
    : typeof context.team === 'string' && context.team.trim()
      ? context.team.trim()
      : typeof draft.department === 'string' && draft.department.trim()
        ? draft.department.trim()
        : '';
  const metadata = {
    ...((draft.metadata && typeof draft.metadata === 'object' && !Array.isArray(draft.metadata) ? draft.metadata : {}) as Record<string, unknown>),
    resolution_required: false,
    no_sla: true,
    routing: {
      department,
      assigned_to: RECORD_ONLY_ASSIGNEE,
      owner_pool: [],
      next_escalation: null,
      resolution_required: false,
      sla_due_at: null,
      routing_source: 'record_only',
    },
  };

  return {
    ...draft,
    assignedTo: RECORD_ONLY_ASSIGNEE,
    department,
    tags,
    metadata,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function buildDuplicateMergePatch<TDraft extends Record<string, unknown>, TTicket extends object>(
  existingTicket: TTicket,
  draft: TDraft,
  context: Record<string, unknown> = {},
  mergedAt = new Date().toISOString(),
): Partial<TTicket> & Record<string, unknown> {
  const existing = existingTicket as Record<string, unknown>;
  const existingDescription = typeof existing.description === 'string' ? existing.description : '';
  const draftDescription = typeof draft.description === 'string' ? draft.description.trim() : '';
  const mergeNote = [
    `Merged duplicate intake - ${mergedAt}`,
    typeof draft.title === 'string' && draft.title.trim() ? `Title: ${draft.title.trim()}` : '',
    draftDescription ? `Details: ${draftDescription}` : '',
  ].filter(Boolean).join('\n');
  const metadata = objectRecord(existing.metadata);
  const duplicateMerges = Array.isArray(metadata.duplicate_merges) ? metadata.duplicate_merges : [];
  const nextDuplicateMerges = [
    ...duplicateMerges,
    {
      mergedAt,
      title: typeof draft.title === 'string' ? draft.title : '',
      description: draftDescription,
      conversationId: typeof context.conversationId === 'string' ? context.conversationId : undefined,
      context,
    },
  ];

  return {
    description: [existingDescription, mergeNote].filter(Boolean).join('\n\n'),
    conversationSummary: [typeof existing.conversationSummary === 'string' ? existing.conversationSummary : '', mergeNote].filter(Boolean).join('\n\n'),
    tags: Array.from(new Set([...stringArray(existing.tags), DUPLICATE_MERGED_TAG])),
    metadata: {
      ...metadata,
      duplicate_merge_count: nextDuplicateMerges.length,
      duplicate_merges: nextDuplicateMerges,
    },
  } as unknown as Partial<TTicket> & Record<string, unknown>;
}

export function applySimilarTicketGroupingToDraft<TDraft extends Record<string, unknown>>(
  draft: TDraft,
  similarTicketIds: string[],
): TDraft & Record<string, unknown> {
  const uniqueIds = Array.from(new Set(similarTicketIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return draft;

  return {
    ...draft,
    tags: Array.from(new Set([...stringArray(draft.tags), SIMILAR_TICKET_GROUP_TAG])),
    metadata: {
      ...objectRecord(draft.metadata),
      similar_ticket_ids: uniqueIds,
      grouped_not_merged: true,
    },
  };
}

export function buildApprovedTicketCreateRequest<TDraft extends Record<string, unknown>>({
  draft,
  conversationId,
  context = {},
}: ApprovedTicketCreateRequestInput<TDraft>) {
  const routedDraft = applyResolutionRequirementToDraft(draft, context);
  return {
    action: 'createTicket' as const,
    approved: true,
    draft: routedDraft,
    conversationId,
    context,
  };
}
