import { Ticket } from './ticketing-data';

export interface DuplicateTicketContext {
  memberName?: string | null;
  memberContact?: string | null;
  studio?: string | null;
  trainer?: string | null;
  classType?: string | null;
  classDateTime?: string | null;
  incidentDateTime?: string | null;
  category?: string | null;
  subCategory?: string | null;
  sessionId?: string | null;
}

export interface RelatedSubmittedTickets {
  exactDuplicate: Ticket | null;
  similarTickets: Ticket[];
}

export interface RelatedTicketNotice {
  key: string;
  messageIdPrefix: 'duplicate' | 'similar';
  content: string;
}

const GENERIC_ISSUE_TYPES = new Set(['', 'other', 'member reported issue', 'member-reported issue', 'general feedback']);

function normalizeComparable(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMultiValue(value?: string | null): string[] {
  return (value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function ticketCategoryFamily(category?: string | null): string {
  const value = (category || '').toLowerCase();
  if (/(billing|membership|pricing|refund|payment|charge)/.test(value)) return 'billing';
  if (/(facility|equipment|repair|amenit|safety|medical|theft|operating|tech|app)/.test(value)) return 'operations';
  if (/(trainer|instructor|class experience|progress|transformation)/.test(value)) return 'class';
  if (/(hosted|partnership|brand)/.test(value)) return 'partnership';
  if (/(booking|schedul|front desk|service|sales|consultation)/.test(value)) return 'service';
  return value || 'general';
}

function isGenericIssueType(value?: string | null): boolean {
  return GENERIC_ISSUE_TYPES.has(normalizeComparable(value));
}

function hasExactIdentityMatch(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  const memberName = ctx.memberName?.trim().toLowerCase();
  const memberContact = ctx.memberContact?.trim().toLowerCase();
  return Boolean(
    (memberName && ticket.memberName?.toLowerCase() === memberName) ||
    (memberContact && ticket.memberContact?.toLowerCase() === memberContact)
  );
}

function hasProvidedIdentity(ctx: DuplicateTicketContext): boolean {
  return Boolean(ctx.memberName?.trim() || ctx.memberContact?.trim());
}

function strictIssueTypeMatches(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  if (!ctx.category || !ticket.category) return false;
  if (ticketCategoryFamily(ctx.category) !== ticketCategoryFamily(ticket.category)) return false;
  if (!ctx.subCategory || !ticket.subCategory) return false;
  if (isGenericIssueType(ctx.subCategory) || isGenericIssueType(ticket.subCategory)) return false;
  return normalizeComparable(ctx.subCategory) === normalizeComparable(ticket.subCategory);
}

function metadataContext(ticket: Ticket): Record<string, unknown> {
  const metadata = ticket.metadata;
  if (!metadata || typeof metadata !== 'object') return {};
  const rawContext = (metadata as Record<string, unknown>).intake_context;
  return rawContext && typeof rawContext === 'object' ? rawContext as Record<string, unknown> : {};
}

function contextString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : '';
}

function localDateTimeKey(value: string, precision: 'date' | 'minute'): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateKey = `${lookup.year}-${lookup.month}-${lookup.day}`;
  return precision === 'date' ? dateKey : `${dateKey}T${lookup.hour}:${lookup.minute}`;
}

function dateKeys(value?: string | null, precision: 'date' | 'minute' = 'minute'): Set<string> {
  return new Set(
    splitMultiValue(value)
      .map((item) => localDateTimeKey(item, precision))
      .filter(Boolean) as string[]
  );
}

function hasIntersection(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function ticketSessionIds(ticket: Ticket): Set<string> {
  const rawContext = metadataContext(ticket);
  return new Set(splitMultiValue(contextString(rawContext, 'sessionId')).map((value) => value.toLowerCase()));
}

function contextSessionIds(ctx: DuplicateTicketContext): Set<string> {
  return new Set(splitMultiValue(ctx.sessionId).map((value) => value.toLowerCase()));
}

function exactStudioMatches(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  const inputStudio = normalizeComparable(ctx.studio);
  return Boolean(inputStudio && inputStudio === normalizeComparable(ticket.studio));
}

function exactIncidentMinuteMatches(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  const rawContext = metadataContext(ticket);
  const inputIncidentDates = dateKeys(ctx.incidentDateTime, 'minute');
  if (inputIncidentDates.size === 0) return false;

  const ticketIncidentDates = new Set([
    ...dateKeys(contextString(rawContext, 'incidentDateTime'), 'minute'),
  ]);
  return ticketIncidentDates.size > 0 && hasIntersection(inputIncidentDates, ticketIncidentDates);
}

function exactSessionMatches(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  const inputSessionIds = contextSessionIds(ctx);
  if (inputSessionIds.size > 0) {
    const existingSessionIds = ticketSessionIds(ticket);
    return existingSessionIds.size > 0 && hasIntersection(inputSessionIds, existingSessionIds);
  }

  const inputClassDates = dateKeys(ctx.classDateTime, 'minute');
  if (inputClassDates.size === 0) return false;

  const rawContext = metadataContext(ticket);
  const ticketClassDates = new Set([
    ...dateKeys(ticket.classDateTime, 'minute'),
    ...dateKeys(contextString(rawContext, 'classDateTime'), 'minute'),
  ]);
  if (ticketClassDates.size === 0 || !hasIntersection(inputClassDates, ticketClassDates)) return false;

  const inputClassType = normalizeComparable(ctx.classType);
  if (!inputClassType) return true;
  return inputClassType === normalizeComparable(ticket.classType);
}

function hasExactDuplicateAnchors(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  if (!strictIssueTypeMatches(ctx, ticket)) return false;
  if (!exactStudioMatches(ctx, ticket)) return false;
  if (!exactIncidentMinuteMatches(ctx, ticket)) return false;

  const hasMemberOrSessionAnchor =
    (hasProvidedIdentity(ctx) && hasExactIdentityMatch(ctx, ticket)) ||
    exactSessionMatches(ctx, ticket);

  return hasMemberOrSessionAnchor;
}

function hasSimilarIssueAnchors(ctx: DuplicateTicketContext, ticket: Ticket): boolean {
  if (!strictIssueTypeMatches(ctx, ticket)) return false;
  if (hasExactDuplicateAnchors(ctx, ticket)) return false;
  return true;
}

export function findRelatedSubmittedTickets(_text: string, ctx: DuplicateTicketContext, tickets: Ticket[]): RelatedSubmittedTickets {
  const exactDuplicate = tickets.find((ticket) => hasExactDuplicateAnchors(ctx, ticket)) || null;
  const exactDuplicateId = exactDuplicate?.id;
  const similarTickets = tickets
    .filter((ticket) => ticket.id !== exactDuplicateId && hasSimilarIssueAnchors(ctx, ticket))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return { exactDuplicate, similarTickets };
}

export function buildRelatedTicketNotice(
  relatedTickets: RelatedSubmittedTickets,
  shownNoticeKeys: ReadonlySet<string> = new Set(),
): RelatedTicketNotice | null {
  if (relatedTickets.exactDuplicate) {
    const ticket = relatedTickets.exactDuplicate;
    const key = `exact:${ticket.id}`;
    if (shownNoticeKeys.has(key)) return null;
    return {
      key,
      messageIdPrefix: 'duplicate',
      content: `Exact duplicate found: **${ticket.id}** — ${ticket.title}. I will merge this intake into that ticket automatically if you approve the draft; I will not open the ticket drawer.`,
    };
  }

  const similarTicketIds = relatedTickets.similarTickets.map((ticket) => ticket.id).filter(Boolean);
  if (similarTicketIds.length === 0) return null;

  const key = `similar:${similarTicketIds.join('|')}`;
  if (shownNoticeKeys.has(key)) return null;

  return {
    key,
    messageIdPrefix: 'similar',
    content: `Similar ticket group found: ${similarTicketIds.map((id) => `**${id}**`).join(', ')}. These will be grouped for context only, not merged, because the specifics are different.`,
  };
}

export function findExistingSubmittedTicket(text: string, ctx: DuplicateTicketContext, tickets: Ticket[]): Ticket | null {
  return findRelatedSubmittedTickets(text, ctx, tickets).exactDuplicate;
}
