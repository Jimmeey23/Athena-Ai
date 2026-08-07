import { backendSupabase } from './backend-supabase';

async function momenceUserAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await backendSupabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const MOMENCE_BASE_URL = 'https://api.momence.com/api/v2';
const DEFAULT_PAGE_SIZE = 20;
const SESSION_RESULT_LIMIT = 120;
const SESSION_LOOKAHEAD_DAYS = 0;
const SESSION_LOOKBACK_DAYS = 3650;
const SESSION_PAGE_SIZE = 40;
const SESSION_MAX_PAGES = 12;

interface PaginatedMomenceResponse<T> {
  payload?: T[];
  data?: T[];
  items?: T[];
}

interface MomenceMember {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  firstSeen?: string;
  lastSeen?: string;
}

interface MomenceSession {
  id: number;
  name?: string;
  startsAt?: string;
  endsAt?: string;
  type?: string;
  teacher?: {
    id?: number;
    firstName?: string;
    lastName?: string;
  } | null;
  inPersonLocation?: {
    id?: number;
    name?: string;
  } | null;
  isCancelled?: boolean;
  bookingCount?: number;
  capacity?: number | null;
  waitlistBookingCount?: number | null;
  waitlistCapacity?: number | null;
}

interface MomenceHostMembership {
  id: number;
  name?: string;
  disabled?: boolean;
}

export interface MomenceMemberDetail extends MomenceMember {
  customerTags?: MomenceTag[];
}

export interface MomenceMembership {
  id: number;
  type?: string;
  startDate?: string | null;
  endDate?: string | null;
  isFrozen?: boolean;
  eventCreditsLeft?: number | null;
  eventCreditsTotal?: number | null;
  moneyCreditsLeft?: number | null;
  moneyCreditsTotal?: number | null;
  usedSessions?: number | null;
  usageLimitForSessions?: number | null;
  usedAppointments?: number | null;
  usageLimitForAppointments?: number | null;
  combinedUsage?: number | null;
  combinedUsageLimit?: number | null;
  usageLimitStartDate?: string | null;
  usageLimitEndDate?: string | null;
  freeze?: {
    freezedAt?: string | null;
    unfreezedScheduledAt?: string | null;
    unfrozenAt?: string | null;
    remainingFreezedMinutes?: number | null;
    scheduledFreezeAt?: string | null;
  } | null;
  declinedRenewal?: {
    declinedAt?: string;
    cardLast4?: string | null;
  } | null;
  membership?: {
    id?: number;
    name?: string;
  } | null;
}

export interface MomenceMemberBooking {
  id: number;
  createdAt?: string;
  checkedIn?: boolean;
  cancelledAt?: string | null;
  session?: MomenceSession;
}

export interface MomenceMemberNote {
  id: number;
  createdAt?: string;
  modifiedAt?: string;
  type?: string;
  note?: string;
}

export interface MomenceSessionDetail extends MomenceSession {
  waitlistCapacity?: number | null;
  waitlistBookingCount?: number | null;
}

export interface MomenceSessionBooking {
  id: number;
  member?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string | null;
  };
  checkedIn?: boolean;
  createdAt?: string;
  isRecurring?: boolean;
  recurringBookingId?: number | null;
  cancelledAt?: string | null;
}

export interface MomenceTag {
  id: number;
  name: string;
  isCustomerBadge?: boolean;
  badgeLabel?: string | null;
  badgeColor?: string | null;
}

export interface MomenceSale {
  id: number;
  createdAt?: string;
  member?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string | null;
  };
  items?: Array<{
    id?: number;
    type?: string;
    name?: string;
    amountInCurrency?: number;
    amountInCurrencyWithoutTax?: number;
  }>;
  paymentMethod?: string;
  amountInCurrency?: number;
  currency?: string;
}

export interface MomenceAppointmentReservation {
  id: number;
  startsAt?: string;
  endsAt?: string;
  cancelledAt?: string | null;
  member?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  service?: {
    id?: number;
    name?: string;
  };
}

export interface MomenceReportRun {
  id?: number;
  status?: string;
  parameters?: Record<string, unknown>;
  data?: unknown;
}

export interface MomenceMemberOption {
  id: string;
  label: string;
  description: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  firstSeen?: string;
  lastSeen?: string;
}

export interface MomenceSessionOption {
  id: string;
  label: string;
  description: string;
  classType: string;
  trainer?: string;
  studio?: string;
  startsAt?: string;
  endsAt?: string;
  bookingCount?: number;
  capacity?: number | null;
  waitlistBookingCount?: number | null;
  waitlistCapacity?: number | null;
}

export interface MomenceInsightInput {
  member?: MomenceMemberDetail;
  memberships?: MomenceMembership[];
  memberBookings?: MomenceMemberBooking[];
  notes?: MomenceMemberNote[];
  session?: MomenceSessionDetail;
  sessionBookings?: MomenceSessionBooking[];
  tags?: MomenceTag[];
}

export interface MomenceMemberInsight {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  firstSeen?: string;
  lastSeen?: string;
  tags: string[];
}

export interface MomenceMembershipInsight {
  id: string;
  name: string;
  type?: string;
  status: 'Active' | 'Frozen';
  creditsLabel?: string;
  moneyCreditsLabel?: string;
  usageLabel?: string;
  usagePeriodLabel?: string;
  validUntil?: string | null;
  freezeLabel?: string;
  scheduledFreezeAt?: string | null;
  scheduledUnfreezeAt?: string | null;
  declinedRenewalLabel?: string;
}

export interface MomenceBookingInsight {
  id: string;
  sessionId?: string;
  classType: string;
  startsAt?: string;
  trainer?: string;
  studio?: string;
  checkedIn?: boolean;
  cancelled?: boolean;
}

export interface MomenceSessionInsight {
  id: string;
  classType: string;
  startsAt?: string;
  endsAt?: string;
  trainer?: string;
  studio?: string;
  fillRateLabel?: string;
  waitlistLabel?: string;
  matchingMemberBookingId?: string;
  matchingMemberCheckedIn?: boolean;
}

export interface MomenceInsightSummary {
  member?: MomenceMemberInsight;
  membershipOverview: {
    activeCount: number;
    frozenCount: number;
    memberships: MomenceMembershipInsight[];
  };
  bookingOverview: {
    totalLoaded: number;
    checkedInCount: number;
    cancelledCount: number;
    lastVisit?: MomenceBookingInsight;
    nextBooking?: MomenceBookingInsight;
    recentBookings: MomenceBookingInsight[];
  };
  noteOverview: {
    count: number;
    latestNote?: string;
    latestModifiedAt?: string;
  };
  session?: MomenceSessionInsight;
  availableTagCount: number;
  ticketContextLines: string[];
}

export interface MomenceTicketContext extends MomenceInsightInput {
  memberships: MomenceMembership[];
  memberBookings: MomenceMemberBooking[];
  notes: MomenceMemberNote[];
  sessionBookings: MomenceSessionBooking[];
  tags: MomenceTag[];
  summary: MomenceInsightSummary;
}

export interface LoadMomenceTicketContextOptions {
  memberId?: string | number | null;
  sessionId?: string | number | null;
  includeTags?: boolean;
}

export interface SearchMomenceSessionsOptions {
  types?: string[];
}

export interface ListMomenceMembersOptions {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'lastSeenAt' | 'firstName' | 'lastName' | 'email';
  sortOrder?: 'ASC' | 'DESC';
  filterPreset?: 'with-active-membership';
  staticSegmentId?: string | number;
}

interface MomenceSessionPageResponse extends PaginatedMomenceResponse<MomenceSession> {
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

interface MomenceSessionPageResult {
  sessions: MomenceSessionOption[];
  hasMore: boolean;
}

type MomenceParamValue = string | number | boolean | Array<string | number | boolean> | undefined;

interface MomenceRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, MomenceParamValue>;
  body?: unknown;
}

function compact(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' ');
}

function fullName(value?: { firstName?: string; lastName?: string } | null): string {
  return compact([value?.firstName, value?.lastName]);
}

function stripHtml(value?: string): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatCreditLabel(membership: MomenceMembership): string | undefined {
  if (membership.eventCreditsLeft != null && membership.eventCreditsTotal != null) {
    return `${membership.eventCreditsLeft}/${membership.eventCreditsTotal} credits left`;
  }
  if (membership.eventCreditsLeft != null) return `${membership.eventCreditsLeft} credits left`;
  if (membership.usedSessions != null && membership.usageLimitForSessions != null) {
    return `${membership.usedSessions}/${membership.usageLimitForSessions} sessions used`;
  }
  return undefined;
}

function formatMoneyCreditLabel(membership: MomenceMembership): string | undefined {
  if (membership.moneyCreditsLeft != null && membership.moneyCreditsTotal != null) {
    return `${membership.moneyCreditsLeft}/${membership.moneyCreditsTotal} money credits left`;
  }
  if (membership.moneyCreditsLeft != null) return `${membership.moneyCreditsLeft} money credits left`;
  return undefined;
}

function formatUsageLabel(membership: MomenceMembership): string | undefined {
  if (membership.combinedUsage != null && membership.combinedUsageLimit != null) {
    return `${membership.combinedUsage}/${membership.combinedUsageLimit} combined usage`;
  }
  const parts = [
    membership.usedSessions != null && membership.usageLimitForSessions != null
      ? `${membership.usedSessions}/${membership.usageLimitForSessions} sessions used`
      : undefined,
    membership.usedAppointments != null && membership.usageLimitForAppointments != null
      ? `${membership.usedAppointments}/${membership.usageLimitForAppointments} appointments used`
      : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(' | ') : undefined;
}

function formatUsagePeriodLabel(membership: MomenceMembership): string | undefined {
  if (!membership.usageLimitStartDate && !membership.usageLimitEndDate) return undefined;
  return `Usage window ${membership.usageLimitStartDate || 'open'} to ${membership.usageLimitEndDate || 'open'}`;
}

function formatFreezeLabel(membership: MomenceMembership): string | undefined {
  if (!membership.freeze) return membership.isFrozen ? 'Frozen' : undefined;
  if (membership.freeze.scheduledFreezeAt) return `Scheduled freeze ${membership.freeze.scheduledFreezeAt}`;
  if (membership.isFrozen || membership.freeze.freezedAt) return 'Frozen now';
  return undefined;
}

function formatDeclinedRenewalLabel(membership: MomenceMembership): string | undefined {
  if (!membership.declinedRenewal?.declinedAt) return undefined;
  return compact([
    `Renewal declined ${membership.declinedRenewal.declinedAt}`,
    membership.declinedRenewal.cardLast4 ? `card ${membership.declinedRenewal.cardLast4}` : undefined,
  ]);
}

function sessionName(session?: MomenceSession | null): string {
  if (!session) return 'Unknown session';
  return session.name || session.type || `Momence session #${session.id}`;
}

function bookingInsight(booking: MomenceMemberBooking): MomenceBookingInsight {
  const session = booking.session;
  return {
    id: String(booking.id),
    sessionId: session?.id != null ? String(session.id) : undefined,
    classType: sessionName(session),
    startsAt: session?.startsAt,
    trainer: fullName(session?.teacher) || undefined,
    studio: session?.inPersonLocation?.name,
    checkedIn: booking.checkedIn,
    cancelled: Boolean(booking.cancelledAt),
  };
}

function getBookingTime(booking: MomenceMemberBooking): number {
  const value = booking.session?.startsAt || booking.createdAt;
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function latestNote(notes: MomenceMemberNote[]): MomenceMemberNote | undefined {
  return [...notes]
    .filter((note) => stripHtml(note.note))
    .sort((a, b) => {
      const aTime = new Date(a.modifiedAt || a.createdAt || '').getTime();
      const bTime = new Date(b.modifiedAt || b.createdAt || '').getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })[0];
}

function buildTicketContextLines(summary: Omit<MomenceInsightSummary, 'ticketContextLines'>): string[] {
  const lines: string[] = [];
  if (summary.member) {
    lines.push(`Momence member: ${summary.member.name}`);
    if (summary.member.email || summary.member.phoneNumber) {
      lines.push(`Momence contact: ${compact([summary.member.email, summary.member.phoneNumber])}`);
    }
    if (summary.member.tags.length) lines.push(`Momence tags: ${summary.member.tags.join(', ')}`);
  }
  if (summary.membershipOverview.memberships.length) {
    lines.push(`Active memberships: ${summary.membershipOverview.memberships.map((item) => compact([
      item.name,
      item.type,
      item.status === 'Frozen' ? '(Frozen)' : undefined,
      item.creditsLabel,
      item.moneyCreditsLabel,
      item.usageLabel,
      item.freezeLabel,
      item.declinedRenewalLabel,
    ])).join(' | ')}`);
  }
  if (summary.bookingOverview.lastVisit) {
    lines.push(`Last Momence visit: ${compact([summary.bookingOverview.lastVisit.classType, summary.bookingOverview.lastVisit.startsAt, summary.bookingOverview.lastVisit.checkedIn ? 'checked in' : undefined])}`);
  }
  if (summary.bookingOverview.nextBooking) {
    lines.push(`Next Momence booking: ${compact([summary.bookingOverview.nextBooking.classType, summary.bookingOverview.nextBooking.startsAt])}`);
  }
  if (summary.session) {
    lines.push(`Selected Momence session: ${compact([summary.session.classType, summary.session.startsAt, summary.session.trainer, summary.session.studio])}`);
    if (summary.session.fillRateLabel) lines.push(`Selected session capacity: ${summary.session.fillRateLabel}`);
    if (summary.session.waitlistLabel) lines.push(`Selected session waitlist: ${summary.session.waitlistLabel}`);
  }
  if (summary.bookingOverview.recentBookings.length) {
    lines.push(`Recent attendance history: ${summary.bookingOverview.recentBookings.map((booking) => compact([
      booking.classType,
      booking.startsAt,
      booking.checkedIn ? 'checked in' : booking.cancelled ? 'cancelled' : 'not checked in',
    ])).join(' | ')}`);
  }
  if (summary.noteOverview.count) {
    lines.push(`Momence notes loaded: ${summary.noteOverview.count}`);
  }
  if (summary.noteOverview.latestNote) lines.push(`Latest Momence note: ${summary.noteOverview.latestNote}`);
  return lines;
}

function normalizeSearchValue(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sessionMatchesSearch(haystack: string, query: string): boolean {
  if (!query) return true;
  if (haystack.includes(query)) return true;
  const compactHaystack = haystack.replace(/\s+/g, '');
  const compactQuery = query.replace(/\s+/g, '');
  if (compactHaystack.includes(compactQuery)) return true;
  const tokens = query.split(' ').filter((token) => token.length > 1 && token !== '57');
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token) || compactHaystack.includes(token));
}

function payloadFrom<T>(response: PaginatedMomenceResponse<T> | T[]): T[] {
  if (Array.isArray(response)) return response;
  return response.payload || response.data || response.items || [];
}

function resolveSessionFunctionUrl(): string | undefined {
  const explicitUrl = import.meta.env.VITE_MOMENCE_SESSION_FUNCTION_URL as string | undefined;
  return explicitUrl || undefined;
}

function resolveSessionFunctionAnonKey(): string | undefined {
  return (
    import.meta.env.VITE_MOMENCE_SESSION_FUNCTION_ANON_KEY ||
    import.meta.env.VITE_MOMENCE_FUNCTION_ANON_KEY
  ) as string | undefined;
}

function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

function appendMomenceParams(url: URL, params: Record<string, MomenceParamValue>) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== '') url.searchParams.append(`${key}[]`, String(item));
      });
      return;
    }
    url.searchParams.set(key, String(value));
  });
}

async function callMomence<T>(path: string, options: MomenceRequestOptions = {}) {
  const method = options.method || 'GET';
  const params = options.params || {};
  const functionUrl = import.meta.env.VITE_MOMENCE_FUNCTION_URL as string | undefined;
  const functionAnonKey = import.meta.env.VITE_MOMENCE_FUNCTION_ANON_KEY as string | undefined;
  const proxyUrl = import.meta.env.VITE_MOMENCE_PROXY_URL as string | undefined;
  const accessToken = import.meta.env.VITE_MOMENCE_ACCESS_TOKEN as string | undefined;

  if (functionUrl) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (functionAnonKey) {
      headers.apikey = functionAnonKey;
    }

    Object.assign(headers, await momenceUserAuthHeaders());

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path, method, params, body: options.body }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Momence function returned ${response.status}: ${detail}`);
    }
    return parseResponse<T>(response);
  }

  if (proxyUrl) {
    const url = new URL(path.replace(/^\/api\/v2\//, ''), proxyUrl.endsWith('/') ? proxyUrl : `${proxyUrl}/`);
    appendMomenceParams(url, params);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Momence proxy returned ${response.status}`);
    return parseResponse<T>(response);
  }

  if (accessToken) {
    const url = new URL(`${MOMENCE_BASE_URL}${path}`);
    appendMomenceParams(url, params);
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) throw new Error(`Momence API returned ${response.status}`);
    return parseResponse<T>(response);
  }

  const { data, error } = await backendSupabase.functions.invoke('momence-search', {
    body: { path, method, params, body: options.body },
  });
  if (error) throw error;
  return data as T;
}

export function buildMomenceInsightSummary(input: MomenceInsightInput): MomenceInsightSummary {
  const memberships = input.memberships || [];
  const memberBookings = input.memberBookings || [];
  const notes = input.notes || [];
  const sessionBookings = input.sessionBookings || [];
  const tags = input.tags || [];
  const now = Date.now();

  const memberName = fullName(input.member) || (input.member ? `Momence member #${input.member.id}` : '');
  const memberTags = (input.member?.customerTags || [])
    .map((tag) => tag.name)
    .filter(Boolean);

  const member = input.member
    ? {
        id: String(input.member.id),
        name: memberName,
        email: input.member.email,
        phoneNumber: input.member.phoneNumber || undefined,
        firstSeen: input.member.firstSeen,
        lastSeen: input.member.lastSeen,
        tags: memberTags,
      }
    : undefined;

  const membershipInsights = memberships.map((membership) => ({
    id: String(membership.id),
    name: membership.membership?.name || membership.type || `Membership #${membership.id}`,
    type: membership.type,
    status: membership.isFrozen ? 'Frozen' as const : 'Active' as const,
    creditsLabel: formatCreditLabel(membership),
    moneyCreditsLabel: formatMoneyCreditLabel(membership),
    usageLabel: formatUsageLabel(membership),
    usagePeriodLabel: formatUsagePeriodLabel(membership),
    validUntil: membership.endDate,
    freezeLabel: formatFreezeLabel(membership),
    scheduledFreezeAt: membership.freeze?.scheduledFreezeAt,
    scheduledUnfreezeAt: membership.freeze?.unfreezedScheduledAt,
    declinedRenewalLabel: formatDeclinedRenewalLabel(membership),
  }));

  const sortedBookings = [...memberBookings].sort((a, b) => {
    const bTime = getBookingTime(b);
    const aTime = getBookingTime(a);
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
  const lastVisit = sortedBookings.find((booking) => {
    const time = getBookingTime(booking);
    return Number.isFinite(time) && time <= now && !booking.cancelledAt;
  });
  const nextBooking = [...memberBookings]
    .filter((booking) => {
      const time = getBookingTime(booking);
      return Number.isFinite(time) && time > now && !booking.cancelledAt;
    })
    .sort((a, b) => getBookingTime(a) - getBookingTime(b))[0];
  const note = latestNote(notes);

  const matchingSessionBooking = member && input.session
    ? sessionBookings.find((booking) => String(booking.member?.id) === member.id && !booking.cancelledAt)
    : undefined;
  const session = input.session
    ? {
        id: String(input.session.id),
        classType: sessionName(input.session),
        startsAt: input.session.startsAt,
        endsAt: input.session.endsAt,
        trainer: fullName(input.session.teacher) || undefined,
        studio: input.session.inPersonLocation?.name,
        fillRateLabel: input.session.capacity != null
          ? `${input.session.bookingCount || 0}/${input.session.capacity} booked`
          : input.session.bookingCount != null
            ? `${input.session.bookingCount} booked`
            : undefined,
        waitlistLabel: input.session.waitlistBookingCount != null
          ? `${input.session.waitlistBookingCount}/${input.session.waitlistCapacity ?? 'unlimited'} waitlisted`
          : undefined,
        matchingMemberBookingId: matchingSessionBooking ? String(matchingSessionBooking.id) : undefined,
        matchingMemberCheckedIn: matchingSessionBooking?.checkedIn,
      }
    : undefined;

  const summaryWithoutLines = {
    member,
    membershipOverview: {
      activeCount: membershipInsights.filter((membership) => membership.status === 'Active').length,
      frozenCount: membershipInsights.filter((membership) => membership.status === 'Frozen').length,
      memberships: membershipInsights,
    },
    bookingOverview: {
      totalLoaded: memberBookings.length,
      checkedInCount: memberBookings.filter((booking) => booking.checkedIn).length,
      cancelledCount: memberBookings.filter((booking) => booking.cancelledAt).length,
      lastVisit: lastVisit ? bookingInsight(lastVisit) : undefined,
      nextBooking: nextBooking ? bookingInsight(nextBooking) : undefined,
      recentBookings: sortedBookings.slice(0, 5).map(bookingInsight),
    },
    noteOverview: {
      count: notes.length,
      latestNote: note ? stripHtml(note.note).slice(0, 240) : undefined,
      latestModifiedAt: note?.modifiedAt || note?.createdAt,
    },
    session,
    availableTagCount: tags.length,
  };

  return {
    ...summaryWithoutLines,
    ticketContextLines: buildTicketContextLines(summaryWithoutLines),
  };
}

export async function searchMomenceMembers(query: string): Promise<MomenceMemberOption[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  return listMomenceMembers({ query: normalizedQuery });
}

function momenceMemberOptionFromMember(member: MomenceMember): MomenceMemberOption {
  const name = compact([member.firstName, member.lastName]) || `Momence member #${member.id}`;
  const contact = compact([member.email, member.phoneNumber && `+${member.phoneNumber.replace(/^\+/, '')}`]);
  return {
    id: String(member.id),
    label: name,
    description: contact || 'No contact details returned by Momence',
    name,
    email: member.email,
    phoneNumber: member.phoneNumber || undefined,
    firstSeen: member.firstSeen,
    lastSeen: member.lastSeen,
  };
}

export async function listMomenceMembers(options: ListMomenceMembersOptions = {}): Promise<MomenceMemberOption[]> {
  const normalizedQuery = options.query?.trim();
  const params: Record<string, MomenceParamValue> = {
    page: options.page ?? 0,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    sortBy: options.sortBy || 'lastSeenAt',
    sortOrder: options.sortOrder || 'DESC',
  };
  if (normalizedQuery) params.query = normalizedQuery;
  if (options.filterPreset) params.filterPreset = options.filterPreset;
  if (options.staticSegmentId != null && options.staticSegmentId !== '') params.staticSegmentId = options.staticSegmentId;

  const response = await callMomence<PaginatedMomenceResponse<MomenceMember>>('/host/members', {
    params,
  });

  return payloadFrom(response).map(momenceMemberOptionFromMember);
}

function momenceSessionOptionsFromResponse(
  response: PaginatedMomenceResponse<MomenceSession> | MomenceSession[],
  normalizedQuery: string,
): MomenceSessionOption[] {
  const now = Date.now();
  return payloadFrom(response)
    .filter((session) => {
      if (session.startsAt) {
        const startsAtTime = new Date(session.startsAt).getTime();
        if (Number.isFinite(startsAtTime) && startsAtTime > now) return false;
      }
      if (!normalizedQuery) return true;
      const teacher = compact([session.teacher?.firstName, session.teacher?.lastName]);
      const haystack = normalizeSearchValue(compact([
        session.name,
        teacher,
        session.inPersonLocation?.name,
        session.startsAt,
        session.type,
      ]));
      return sessionMatchesSearch(haystack, normalizedQuery);
    })
    .map((session) => {
      const trainer = compact([session.teacher?.firstName, session.teacher?.lastName]) || undefined;
      const studio = session.inPersonLocation?.name;
      const dateLabel = formatDateTime(session.startsAt);
      const classType = session.name || session.type || `Momence session #${session.id}`;
      const booked = session.bookingCount ?? 0;
      const spotsLeft = session.capacity != null ? Math.max(session.capacity - booked, 0) : undefined;
      return {
        id: String(session.id),
        label: compact([classType, dateLabel && `- ${dateLabel}`]),
        description: compact([
          trainer,
          studio,
          session.capacity != null ? `${booked} booked` : undefined,
          spotsLeft != null ? `${spotsLeft} spots left` : undefined,
          session.waitlistBookingCount != null ? `${session.waitlistBookingCount} waitlisted` : undefined,
        ]),
        classType,
        trainer,
        studio,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        bookingCount: session.bookingCount,
        capacity: session.capacity,
        waitlistBookingCount: session.waitlistBookingCount,
        waitlistCapacity: session.waitlistCapacity,
      };
    });
}

async function searchMomenceSessionPage(
  query: string,
  options: SearchMomenceSessionsOptions = {},
  page = 0,
): Promise<MomenceSessionPageResult> {
  const now = new Date();
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - SESSION_LOOKBACK_DAYS);
  const lookahead = new Date(now);
  lookahead.setDate(lookahead.getDate() + SESSION_LOOKAHEAD_DAYS);
  const sessionFunctionUrl = resolveSessionFunctionUrl();
  const sessionFunctionAnonKey = resolveSessionFunctionAnonKey();
  const normalizedQuery = normalizeSearchValue(query);
  const sessionTypes = options.types?.map((type) => type.trim()).filter(Boolean);
  const requestedSessionTypes = sessionTypes?.length ? sessionTypes : undefined;

  let response: MomenceSessionPageResponse;
  if (sessionFunctionUrl) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionFunctionAnonKey) {
      headers.apikey = sessionFunctionAnonKey;
    }
    Object.assign(headers, await momenceUserAuthHeaders());
    const raw = await fetch(sessionFunctionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        pastDays: SESSION_LOOKBACK_DAYS,
        futureDays: SESSION_LOOKAHEAD_DAYS,
        pageSize: SESSION_PAGE_SIZE,
        includeCancelled: false,
        types: requestedSessionTypes,
        page,
        maxPages: 1,
      }),
    });
    if (!raw.ok) {
      const detail = await raw.text();
      throw new Error(`Momence session function returned ${raw.status}: ${detail}`);
    }
    response = await parseResponse<MomenceSessionPageResponse>(raw);
  } else {
    response = await callMomence<MomenceSessionPageResponse>('/host/sessions', {
      params: {
        page,
        pageSize: SESSION_PAGE_SIZE,
        sortBy: 'startsAt',
        sortOrder: 'DESC',
        includeCancelled: false,
        startAfter: lookback.toISOString(),
        startBefore: lookahead.toISOString(),
        ...(requestedSessionTypes ? { types: requestedSessionTypes } : {}),
      },
    });
  }

  const rawPayload = payloadFrom(response);
  const hasMore = typeof response.hasMore === 'boolean' ? response.hasMore : rawPayload.length >= SESSION_PAGE_SIZE;
  return {
    sessions: momenceSessionOptionsFromResponse(rawPayload, normalizedQuery),
    hasMore,
  };
}

function dedupeMomenceSessionOptions(options: MomenceSessionOption[]): MomenceSessionOption[] {
  const byKey = new Map<string, MomenceSessionOption>();
  for (const option of options) {
    byKey.set(option.id || `${option.label}__${option.startsAt || ''}`, option);
  }
  return Array.from(byKey.values());
}

export async function loadMomenceSessionsProgressively(
  query: string,
  options: SearchMomenceSessionsOptions = {},
  onPage?: (sessions: MomenceSessionOption[], page: number) => void,
): Promise<MomenceSessionOption[]> {
  const collected: MomenceSessionOption[] = [];
  for (let page = 0; page < SESSION_MAX_PAGES && collected.length < SESSION_RESULT_LIMIT; page += 1) {
    const result = await searchMomenceSessionPage(query, options, page);
    const nextPage = result.sessions.slice(0, Math.max(0, SESSION_RESULT_LIMIT - collected.length));
    collected.push(...nextPage);
    const deduped = dedupeMomenceSessionOptions(collected).slice(0, SESSION_RESULT_LIMIT);
    onPage?.(nextPage, page);
    if (!result.hasMore || deduped.length >= SESSION_RESULT_LIMIT) return deduped;
  }
  return dedupeMomenceSessionOptions(collected).slice(0, SESSION_RESULT_LIMIT);
}

export async function searchMomenceSessions(query: string, options: SearchMomenceSessionsOptions = {}): Promise<MomenceSessionOption[]> {
  return loadMomenceSessionsProgressively(query, options);
}

export async function getMomenceMember(memberId: string | number) {
  return callMomence<MomenceMemberDetail>(`/host/members/${memberId}`);
}

export async function updateMomenceMemberName(memberId: string | number, firstName: string, lastName: string) {
  return callMomence(`/host/members/${memberId}/name`, {
    method: 'PUT',
    body: { firstName: firstName.trim(), lastName: lastName.trim() },
  });
}

export async function updateMomenceMemberEmail(memberId: string | number, email: string) {
  return callMomence(`/host/members/${memberId}/email`, {
    method: 'PUT',
    body: { email: email.trim() },
  });
}

export async function updateMomenceMemberPhoneNumber(memberId: string | number, phoneNumber: string) {
  return callMomence(`/host/members/${memberId}/phone-number`, {
    method: 'PUT',
    body: { phoneNumber: phoneNumber.trim() },
  });
}

export async function deleteMomenceMemberPhoneNumbers(memberId: string | number) {
  return callMomence(`/host/members/${memberId}/phone-number`, { method: 'DELETE' });
}

export async function listMomenceHostMembershipOptions(): Promise<string[]> {
  const response = await callMomence<PaginatedMomenceResponse<MomenceHostMembership>>('/host/memberships', {
    params: {
      page: 0,
      pageSize: 200,
      sortBy: 'name',
      sortOrder: 'ASC',
      includeDisabled: false,
    },
  });

  return Array.from(new Set(
    payloadFrom(response)
      .filter((membership) => membership.disabled !== true)
      .map((membership) => membership.name?.trim() || '')
      .filter(Boolean)
  ));
}

export async function loadMomenceTicketContext({
  memberId,
  sessionId,
  includeTags = false,
}: LoadMomenceTicketContextOptions): Promise<MomenceTicketContext> {
  const normalizedMemberId = memberId == null || memberId === '' ? undefined : memberId;
  const normalizedSessionId = sessionId == null || sessionId === '' ? undefined : sessionId;

  const [
    member,
    memberships,
    memberBookings,
    notes,
    session,
    sessionBookings,
    tags,
  ] = await Promise.all([
    normalizedMemberId ? getMomenceMember(normalizedMemberId) : Promise.resolve(undefined),
    normalizedMemberId ? getMomenceMemberMemberships(normalizedMemberId) : Promise.resolve([]),
    normalizedMemberId ? getMomenceMemberBookings(normalizedMemberId) : Promise.resolve([]),
    normalizedMemberId ? getMomenceMemberNotes(normalizedMemberId) : Promise.resolve([]),
    normalizedSessionId ? getMomenceSession(normalizedSessionId) : Promise.resolve(undefined),
    normalizedSessionId ? getMomenceSessionBookings(normalizedSessionId) : Promise.resolve([]),
    includeTags ? listMomenceTags() : Promise.resolve([]),
  ]);

  const raw = {
    member,
    memberships,
    memberBookings,
    notes,
    session,
    sessionBookings,
    tags,
  };

  return {
    ...raw,
    summary: buildMomenceInsightSummary(raw),
  };
}

export async function getMomenceMemberMemberships(memberId: string | number) {
  const response = await callMomence<PaginatedMomenceResponse<MomenceMembership>>(
    `/host/members/${memberId}/bought-memberships/active`,
    { params: { page: 0, pageSize: 20 } }
  );
  return payloadFrom(response);
}

export async function getMomenceMemberBookings(memberId: string | number) {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 90);
  const future = new Date(now);
  future.setDate(future.getDate() + 45);

  const response = await callMomence<PaginatedMomenceResponse<MomenceMemberBooking>>(
    `/host/members/${memberId}/sessions`,
    {
      params: {
        page: 0,
        pageSize: 20,
        sortBy: 'startsAt',
        sortOrder: 'DESC',
        includeCancelled: true,
        startAfter: past.toISOString(),
        startBefore: future.toISOString(),
      },
    }
  );
  return payloadFrom(response);
}

export async function getMomenceMemberNotes(memberId: string | number) {
  const response = await callMomence<PaginatedMomenceResponse<MomenceMemberNote>>(
    `/host/members/${memberId}/notes`,
    { params: { page: 0, pageSize: 5, sortBy: 'modifiedAt', sortOrder: 'DESC' } }
  );
  return payloadFrom(response);
}

export async function getMomenceMemberAppointments(memberId: string | number) {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 90);
  const future = new Date(now);
  future.setDate(future.getDate() + 45);

  const response = await callMomence<PaginatedMomenceResponse<MomenceAppointmentReservation>>(
    `/host/members/${memberId}/appointments`,
    {
      params: {
        page: 0,
        pageSize: 20,
        sortBy: 'startsAt',
        sortOrder: 'DESC',
        includeCancelled: true,
        startAfter: past.toISOString(),
        startBefore: future.toISOString(),
      },
    }
  );
  return payloadFrom(response);
}

export async function getMomenceSession(sessionId: string | number) {
  return callMomence<MomenceSessionDetail>(`/host/sessions/${sessionId}`);
}

export async function getMomenceSessionBookings(sessionId: string | number) {
  const response = await callMomence<PaginatedMomenceResponse<MomenceSessionBooking>>(
    `/host/sessions/${sessionId}/bookings`,
    { params: { page: 0, pageSize: 50, sortBy: 'createdAt', sortOrder: 'DESC', includeCancelled: true } }
  );
  return payloadFrom(response);
}

export async function listMomenceTags() {
  const response = await callMomence<PaginatedMomenceResponse<MomenceTag>>('/host/tags', {
    params: { page: 0, pageSize: 100, sortBy: 'name', sortOrder: 'ASC' },
  });
  return payloadFrom(response);
}

export async function addMomenceMemberToSessionForFree(memberId: string | number, sessionId: string | number) {
  return callMomence<{ sessionBookingId?: number; sessionRecurringBookingId?: number }>(
    `/host/sessions/${sessionId}/bookings/free`,
    { method: 'POST', body: { memberId: Number(memberId), createRecurringBooking: false } }
  );
}

export async function addMomenceMemberToWaitlist(memberId: string | number, sessionId: string | number) {
  return callMomence<{ waitlistBookingId?: number }>(`/host/sessions/${sessionId}/waitlist/bookings`, {
    method: 'POST',
    body: { memberId: Number(memberId) },
  });
}

export async function freezeMomenceMembership(
  memberId: string | number,
  boughtMembershipId: string | number,
  options: { freezeAt?: string | null; unfreezeAt?: string | null; reason?: string | null } = {}
) {
  return callMomence(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-freeze`, {
    method: 'PUT',
    body: {
      freezeType: options.freezeAt ? 'scheduled' : 'now',
      freezeAt: options.freezeAt || null,
      unfreezeType: options.unfreezeAt ? 'scheduled' : 'not_set',
      unfreezeAt: options.unfreezeAt || null,
      reason: options.reason?.trim() || null,
    },
  });
}

export async function updateMomenceMembershipCredits(
  memberId: string | number,
  boughtMembershipId: string | number,
  credits: { eventCreditsLeft?: number | null; moneyCreditsLeft?: number | null }
) {
  const body: Record<string, number> = {};
  if (credits.eventCreditsLeft != null) body.eventCreditsLeft = credits.eventCreditsLeft;
  if (credits.moneyCreditsLeft != null) body.moneyCreditsLeft = credits.moneyCreditsLeft;
  return callMomence(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/credits`, {
    method: 'PUT',
    body,
  });
}

export async function scheduleMomenceMembershipFreeze(
  memberId: string | number,
  boughtMembershipId: string | number,
  freezeAt: string
) {
  return callMomence(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-freeze`, {
    method: 'PUT',
    body: {
      freezeType: 'scheduled',
      freezeAt,
    },
  });
}

export async function unfreezeMomenceMembership(memberId: string | number, boughtMembershipId: string | number) {
  return callMomence(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-freeze`, {
    method: 'DELETE',
  });
}

export async function scheduleMomenceMembershipUnfreeze(
  memberId: string | number,
  boughtMembershipId: string | number,
  unfreezeAt: string
) {
  return callMomence(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-unfreeze`, {
    method: 'PUT',
    body: {
      unfreezeType: 'scheduled',
      unfreezeAt,
    },
  });
}

export async function removeScheduledMomenceMembershipUnfreeze(memberId: string | number, boughtMembershipId: string | number) {
  return callMomence(`/host/members/${memberId}/bought-memberships/${boughtMembershipId}/membership-schedule-unfreeze`, {
    method: 'DELETE',
  });
}

export async function checkInMomenceBooking(bookingId: string | number) {
  return callMomence(`/host/session-bookings/${bookingId}/check-in`, { method: 'POST' });
}

export async function removeMomenceBookingCheckIn(bookingId: string | number) {
  return callMomence(`/host/session-bookings/${bookingId}/check-in`, { method: 'DELETE' });
}

export async function cancelMomenceBooking(
  bookingId: string | number,
  options: { refund?: boolean; disableNotifications?: boolean; isLateCancellation?: boolean } = {}
) {
  return callMomence(`/host/session-bookings/${bookingId}`, {
    method: 'DELETE',
    body: {
      refund: options.refund ?? false,
      disableNotifications: options.disableNotifications ?? false,
      isLateCancellation: options.isLateCancellation ?? false,
    },
  });
}

export async function cancelMomenceRecurringBooking(
  bookingId: string | number,
  options: { afterSessionId?: string | number | null } = {}
) {
  return callMomence(`/host/session-recurring-bookings/${bookingId}`, {
    method: 'DELETE',
    body: options.afterSessionId ? { afterSessionId: Number(options.afterSessionId) } : {},
  });
}

export async function assignMomenceTag(memberId: string | number, tagId: string | number) {
  return callMomence(`/host/members/${memberId}/tags/${tagId}`, { method: 'POST' });
}

export async function unassignMomenceTag(memberId: string | number, tagId: string | number) {
  return callMomence(`/host/members/${memberId}/tags/${tagId}`, { method: 'DELETE' });
}

export async function listMomenceSales(page = 0, pageSize = 20) {
  const response = await callMomence<PaginatedMomenceResponse<MomenceSale>>('/host/sales', {
    params: { page, pageSize, sortBy: 'createdAt', sortOrder: 'DESC' },
  });
  return payloadFrom(response);
}

export async function listMomenceAppointmentReservations(page = 0, pageSize = 20) {
  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + 45);
  const response = await callMomence<PaginatedMomenceResponse<MomenceAppointmentReservation>>('/host/appointments/reservations', {
    params: {
      page,
      pageSize,
      sortBy: 'startsAt',
      sortOrder: 'DESC',
      includeCancelled: true,
      startAfter: now.toISOString(),
      startBefore: future.toISOString(),
    },
  });
  return payloadFrom(response);
}

export async function createMomenceReportRun(parameters: Record<string, unknown>) {
  return callMomence<MomenceReportRun>('/host/reports', {
    method: 'POST',
    body: { parameters },
  });
}

export async function getMomenceReportRun(reportRunId: string | number) {
  return callMomence<MomenceReportRun>(`/host/reports/${reportRunId}`);
}

export async function getMomenceCheckoutPrices(body: Record<string, unknown>) {
  return callMomence('/host/checkout/prices', { method: 'POST', body });
}

export async function getMomenceCompatibleMemberships(body: Record<string, unknown>) {
  return callMomence('/host/checkout/compatible-memberships', { method: 'POST', body });
}

export async function performMomenceCheckout(body: Record<string, unknown>) {
  return callMomence('/host/checkout', { method: 'POST', body });
}
