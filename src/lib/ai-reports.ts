import {
  getSlaState,
  isClosedTicket,
  isTicketBreached,
  Ticket,
} from './ticketing-data';

export type ReportId =
  | 'executive_operations_summary'
  | 'ticket_volume_trend'
  | 'sla_health_breach_risk'
  | 'resolution_performance'
  | 'status_funnel_backlog_aging'
  | 'priority_critical_incident_mix'
  | 'category_driver_analysis'
  | 'recurring_subcategory_analysis'
  | 'studio_space_performance'
  | 'owner_workload_accountability'
  | 'department_routing_load'
  | 'escalation_handoff_report'
  | 'member_feedback_sentiment_report'
  | 'complaint_retention_risk_report'
  | 'request_membership_service_report'
  | 'hosted_class_partnership_intelligence'
  | 'sales_consultation_conversion_signals'
  | 'instructor_class_experience_feedback'
  | 'trainer_performance_consolidated'
  | 'trainer_scorecard_trend'
  | 'trainer_member_feedback_consolidated'
  | 'trainer_coaching_priority_report'
  | 'facility_studio_tools_environment_issues'
  | 'data_quality_intake_completeness';

export interface ReportPeriod {
  from: string;
  to: string;
}

export type ReportSourceType = 'all' | 'live' | 'historic';

export interface ReportFilters {
  studio: string;
  category: string;
  priority: string;
  status: string;
  owner: string;
  sla: string;
  sentiment: string;
  sourceType: ReportSourceType;
  tag: string;
  query: string;
}

export interface TicketReportEvent {
  id: string;
  ticketId: string;
  eventType: string;
  actor?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReportDefinition {
  id: ReportId;
  title: string;
  group: 'Leadership' | 'Operations' | 'Client Feedback' | 'Revenue' | 'Trainer Performance' | 'Quality';
  description: string;
  bestFor: string;
  chart: 'trend' | 'category' | 'status' | 'priority' | 'studio' | 'owner' | 'sla' | 'sentiment' | 'trainer' | 'completeness';
  match: 'all' | 'category' | 'subcategory' | 'studio' | 'owner' | 'sla' | 'resolution' | 'events' | 'sentiment' | 'search' | 'trainer' | 'quality';
  categories?: string[];
  keywords?: RegExp;
}

export interface ReportMetric {
  id: string;
  label: string;
  value: string | number;
  numericValue?: number;
  unit?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  description?: string;
}

export interface ReportRow {
  name: string;
  value: number;
  secondaryValue?: number | string;
  percent?: number;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export interface ReportSection {
  id: string;
  title: string;
  kind: 'bar' | 'line' | 'donut' | 'table' | 'ranked';
  description?: string;
  rows: ReportRow[];
}

export interface ReportSourceRow {
  ticketId: string;
  title: string;
  status: string;
  priority: Ticket['priority'];
  slaState: string;
  sourceType: 'Live' | 'Historic';
  category: string;
  subCategory: string;
  studio: string;
  owner: string;
  team: string;
  memberName: string;
  createdAt: string;
  ageHours: number;
}

export interface ReportNarrative {
  summary: string;
  findings: string[];
  risks: string[];
  recommendedActions: string[];
  dataQualityNotes: string[];
  generatedByAi?: boolean;
}

export interface GeneratedReport {
  definition: ReportDefinition;
  period: ReportPeriod;
  filters: ReportFilters;
  generatedAt: string;
  allTicketsInPeriod: number;
  reportTickets: number;
  metrics: ReportMetric[];
  sections: ReportSection[];
  sourceRows: ReportSourceRow[];
  assumptions: string[];
  dataQualityNotes: string[];
  narrative?: ReportNarrative;
}

export interface ReportExportPayload {
  brand: {
    name: string;
    product: string;
    context: string;
  };
  exportedAt: string;
  document: {
    title: string;
    subtitle: string;
    footer: string;
  };
  report: {
    id: ReportId;
    title: string;
    period: ReportPeriod;
    filters: ReportFilters;
  };
  metrics: ReportMetric[];
  sections: ReportSection[];
  sourceRows: ReportSourceRow[];
  narrative?: ReportNarrative;
  assumptions: string[];
  dataQualityNotes: string[];
}

export interface ReportPaginationResult<T> {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  startRow: number;
  endRow: number;
  rows: T[];
}

export interface ReportNarrativeRequestPayload {
  action: 'generateReportNarrative';
  reportId: ReportId;
  period: ReportPeriod;
  filters: ReportFilters;
  metrics: ReportMetric[];
  topRows: Array<Omit<ReportSourceRow, 'memberName' | 'ageHours'>>;
  sections: Array<{
    title: string;
    rows: ReportRow[];
  }>;
  dataQualityNotes: string[];
  assumptions: string[];
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  studio: 'All',
  category: 'All',
  priority: 'All',
  status: 'All',
  owner: 'All',
  sla: 'All',
  sentiment: 'All',
  sourceType: 'all',
  tag: '',
  query: '',
};

export const REPORT_BRAND = {
  name: 'Physique 57 India',
  product: 'P57 Reporting Engine',
  context: 'Internal Operations Intelligence',
  footer: 'Generated by P57 Reporting Engine from deterministic ticket data. Source rows remain the operational system of record.',
} as const;

export const ALL_REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'executive_operations_summary',
    title: 'Executive Operations Summary',
    group: 'Leadership',
    description: 'Board-ready view of ticket volume, open risk, resolution throughput, and priority load.',
    bestFor: 'Daily leadership standups and weekly operating reviews',
    chart: 'trend',
    match: 'all',
  },
  {
    id: 'ticket_volume_trend',
    title: 'Ticket Volume Trend',
    group: 'Operations',
    description: 'Ticket creation trend across the selected reporting period.',
    bestFor: 'Spotting demand spikes and operational seasonality',
    chart: 'trend',
    match: 'all',
  },
  {
    id: 'sla_health_breach_risk',
    title: 'SLA Health & Breach Risk',
    group: 'Operations',
    description: 'Breached, at-risk, on-track, and closed SLA distribution.',
    bestFor: 'Escalation reviews and owner follow-up prioritization',
    chart: 'sla',
    match: 'sla',
  },
  {
    id: 'resolution_performance',
    title: 'Resolution Performance',
    group: 'Operations',
    description: 'Resolution rate and time-to-resolution from status events and resolution metadata.',
    bestFor: 'Measuring service recovery speed',
    chart: 'status',
    match: 'resolution',
  },
  {
    id: 'status_funnel_backlog_aging',
    title: 'Status Funnel & Backlog Aging',
    group: 'Operations',
    description: 'Open backlog distribution, aging bands, and blocked awaiting-member items.',
    bestFor: 'Backlog management and aging review',
    chart: 'status',
    match: 'all',
  },
  {
    id: 'priority_critical_incident_mix',
    title: 'Priority & Critical Incident Mix',
    group: 'Operations',
    description: 'Priority profile with critical and high-severity ticket concentration.',
    bestFor: 'Risk-weighted operations planning',
    chart: 'priority',
    match: 'all',
  },
  {
    id: 'category_driver_analysis',
    title: 'Category Driver Analysis',
    group: 'Client Feedback',
    description: 'Top client feedback categories driving ticket creation.',
    bestFor: 'Identifying operational themes to fix upstream',
    chart: 'category',
    match: 'category',
  },
  {
    id: 'recurring_subcategory_analysis',
    title: 'Recurring Subcategory Analysis',
    group: 'Client Feedback',
    description: 'Recurring touchpoints and subcategory patterns.',
    bestFor: 'Reducing repeat issues and tightening SOPs',
    chart: 'category',
    match: 'subcategory',
  },
  {
    id: 'studio_space_performance',
    title: 'Studio Performance',
    group: 'Operations',
    description: 'Ticket load and risk distribution by studio.',
    bestFor: 'Studio-level operating reviews',
    chart: 'studio',
    match: 'studio',
  },
  {
    id: 'owner_workload_accountability',
    title: 'Owner Workload & Accountability',
    group: 'Operations',
    description: 'Owner-level workload, open exposure, and breach concentration.',
    bestFor: 'Team capacity and accountability conversations',
    chart: 'owner',
    match: 'owner',
  },
  {
    id: 'department_routing_load',
    title: 'Department Routing Load',
    group: 'Operations',
    description: 'Ticket demand by routed department/team.',
    bestFor: 'Routing configuration and staffing calibration',
    chart: 'owner',
    match: 'all',
  },
  {
    id: 'escalation_handoff_report',
    title: 'Escalation & Handoff Report',
    group: 'Operations',
    description: 'Assignment changes, escalations, and tickets with handoff risk.',
    bestFor: 'Reducing dropped ownership and handoff loops',
    chart: 'owner',
    match: 'events',
  },
  {
    id: 'member_feedback_sentiment_report',
    title: 'Client Sentiment Report',
    group: 'Client Feedback',
    description: 'Sentiment distribution and emotionally charged client feedback.',
    bestFor: 'Member experience recovery and retention reviews',
    chart: 'sentiment',
    match: 'sentiment',
  },
  {
    id: 'complaint_retention_risk_report',
    title: 'Complaint & Retention Risk Report',
    group: 'Client Feedback',
    description: 'Complaint patterns, refund risk, anger signals, and unresolved high-priority items.',
    bestFor: 'Retention protection and service recovery',
    chart: 'category',
    match: 'search',
    keywords: /complaint|refund|cancel|angry|frustrat|retention|renewal|unhappy|not resolved|dissatisfaction/i,
  },
  {
    id: 'request_membership_service_report',
    title: 'Request / Membership Service Report',
    group: 'Revenue',
    description: 'Freeze, rollover, billing, package, renewal, and refund service requests.',
    bestFor: 'Membership administration and revenue operations',
    chart: 'category',
    match: 'search',
    categories: ['Pricing and Memberships', 'Billing & Membership'],
    keywords: /membership|package|freeze|roll\s?over|extension|billing|payment|refund|renewal|credit/i,
  },
  {
    id: 'hosted_class_partnership_intelligence',
    title: 'Hosted Class & Partnership Intelligence',
    group: 'Revenue',
    description: 'Partnership experience feedback and prospect conversion signals.',
    bestFor: 'Partnership ROI and hosted class follow-up',
    chart: 'category',
    match: 'category',
    categories: ['Hosted Class & Partnerships'],
    keywords: /hosted|partner|influencer|prospect|conversion|drop-in|lead/i,
  },
  {
    id: 'sales_consultation_conversion_signals',
    title: 'Sales & Consultation Conversion Signals',
    group: 'Revenue',
    description: 'Prospect objections, lead quality, competitor mentions, and conversion readiness.',
    bestFor: 'Sales coaching and pipeline recovery',
    chart: 'category',
    match: 'search',
    categories: ['Sales & Consultation'],
    keywords: /sales|consultation|lead|prospect|trial|competitor|price|drop-in|conversion|join/i,
  },
  {
    id: 'instructor_class_experience_feedback',
    title: 'Instructor & Class Experience Feedback',
    group: 'Quality',
    description: 'Instructor, class format, music, intensity, pacing, and correction feedback.',
    bestFor: 'Training team QA and method consistency',
    chart: 'category',
    match: 'search',
    categories: ['Trainer Feedback', 'Class Experience', 'Instructor & Class Quality'],
    keywords: /trainer|instructor|class|music|cue|correction|form|intensity|pacing|session/i,
  },
  {
    id: 'trainer_performance_consolidated',
    title: 'Trainer Performance Consolidated',
    group: 'Trainer Performance',
    description: 'Consolidated instructor scorecards, member feedback, coaching focus, class context, and source ticket drilldowns.',
    bestFor: 'Monthly trainer performance reviews and leadership coaching calibration',
    chart: 'trainer',
    match: 'trainer',
  },
  {
    id: 'trainer_scorecard_trend',
    title: 'Trainer Scorecard Trend',
    group: 'Trainer Performance',
    description: 'Weighted trainer evaluation score trends across Barre, PowerCycle, and Strength/Fit review templates.',
    bestFor: 'Tracking score progression, criterion consistency, and review coverage',
    chart: 'trainer',
    match: 'trainer',
  },
  {
    id: 'trainer_member_feedback_consolidated',
    title: 'Trainer Member Feedback Consolidated',
    group: 'Trainer Performance',
    description: 'Member-reported compliments, concerns, sentiment, class feedback, and recurring trainer touchpoints.',
    bestFor: 'Connecting member feedback to instructor experience and retention signals',
    chart: 'trainer',
    match: 'trainer',
  },
  {
    id: 'trainer_coaching_priority_report',
    title: 'Trainer Coaching Priority Report',
    group: 'Trainer Performance',
    description: 'Lower-scoring criteria, negative member feedback, high-risk trainer feedback, and recommended coaching focus areas.',
    bestFor: 'Prioritizing instructor coaching follow-up and next observation plans',
    chart: 'trainer',
    match: 'trainer',
  },
  {
    id: 'facility_studio_tools_environment_issues',
    title: 'Facility, Equipment & Environment Issues',
    group: 'Quality',
    description: 'Equipment, cleanliness, amenity, AC, locker, lighting, sound, and safety facility issues.',
    bestFor: 'Facilities and studio readiness reviews',
    chart: 'studio',
    match: 'search',
    categories: ['Facility & Equipment', 'Studio Amenities and Facilities', 'Repair and Maintenance'],
    keywords: /facility|equipment|clean|locker|washroom|ac|temperature|lighting|audio|amenity|repair|maintenance/i,
  },
  {
    id: 'data_quality_intake_completeness',
    title: 'Data Quality & Intake Completeness',
    group: 'Quality',
    description: 'Completeness of member, studio, owner, sentiment, class/session, and context fields.',
    bestFor: 'Improving Athena intake accuracy and reporting confidence',
    chart: 'completeness',
    match: 'quality',
  },
];

interface BuildReportInput {
  reportId: ReportId;
  tickets: Ticket[];
  events: TicketReportEvent[];
  period: ReportPeriod;
  filters: ReportFilters;
  generatedAt?: string;
}

interface FilterInput {
  from: string;
  to: string;
  filters: ReportFilters;
}

function parseDate(value: string): number {
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function startOfLocalDay(value: string): number {
  return parseDate(`${value}T00:00:00.000Z`);
}

function endOfLocalDay(value: string): number {
  return parseDate(`${value}T23:59:59.999Z`);
}

function normalizeFilterValue(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function ticketTags(ticket: Partial<Pick<Ticket, 'tags'>>): string[] {
  return Array.isArray(ticket.tags) ? ticket.tags : [];
}

export function isHistoricTicket(ticket: Ticket): boolean {
  return ticketTags(ticket).includes('historic') || ticket.studio === 'Historic Import';
}

export function sourceTypeForTicket(ticket: Ticket): 'Live' | 'Historic' {
  return isHistoricTicket(ticket) ? 'Historic' : 'Live';
}

export function filterTicketsForReport(tickets: Ticket[], input: FilterInput): Ticket[] {
  const from = startOfLocalDay(input.from);
  const to = endOfLocalDay(input.to);
  const filters = input.filters;
  const query = normalizeFilterValue(filters.query);
  const tag = normalizeFilterValue(filters.tag);

  return tickets.filter((ticket) => {
    const created = parseDate(ticket.createdAt);
    if (created < from || created > to) return false;
    if (filters.sourceType === 'live' && isHistoricTicket(ticket)) return false;
    if (filters.sourceType === 'historic' && !isHistoricTicket(ticket)) return false;
    if (filters.studio !== 'All' && ticket.studio !== filters.studio) return false;
    if (filters.category !== 'All' && ticket.category !== filters.category) return false;
    if (filters.priority !== 'All' && ticket.priority !== filters.priority) return false;
    if (filters.status !== 'All' && ticket.status !== filters.status) return false;
    if (filters.owner !== 'All' && ticket.assignedTo !== filters.owner) return false;
    if (filters.sla !== 'All' && getSlaState(ticket) !== filters.sla) return false;
    if (filters.sentiment !== 'All' && (ticket.sentiment || 'Unspecified') !== filters.sentiment) return false;
    if (tag && !ticketTags(ticket).some((ticketTag) => normalizeFilterValue(ticketTag).includes(tag))) return false;

    if (query) {
      const haystack = [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.conversationSummary,
        ticket.category,
        ticket.subCategory,
        ticket.studio,
        ticket.trainer,
        ticket.classType,
        ticket.memberName,
        ticket.assignedTo,
        ticket.team,
        ticketTags(ticket).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function eventsForTicket(ticket: Ticket, events: TicketReportEvent[]): TicketReportEvent[] {
  return events
    .filter((event) => event.ticketId === ticket.id)
    .sort((a, b) => parseDate(a.createdAt) - parseDate(b.createdAt));
}

export function getResolvedAt(ticket: Ticket, events: TicketReportEvent[]): string | null {
  const statusEvent = eventsForTicket(ticket, events).find((event) => (
    event.eventType === 'status_change' &&
    (event.toValue === 'Resolved' || event.toValue === 'Closed')
  ));
  if (statusEvent) return statusEvent.createdAt;

  const history = Array.isArray(ticket.metadata?.resolutionHistory)
    ? ticket.metadata?.resolutionHistory
    : [];
  const latest = ticket.metadata?.latestResolution || history[0];
  if (latest?.createdAt) return latest.createdAt;
  if (isClosedTicket(ticket)) return ticket.slaDueAt || ticket.createdAt;
  return null;
}

function hoursBetween(from: string, to: string): number {
  return Math.max(0, Math.round((parseDate(to) - parseDate(from)) / 36e5));
}

function ticketAgeHours(ticket: Ticket, now: string): number {
  return hoursBetween(ticket.createdAt, now);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function textForTicket(ticket: Ticket): string {
  return [
    ticket.title,
    ticket.description,
    ticket.conversationSummary,
    ticket.category,
    ticket.subCategory,
    ticketTags(ticket).join(' '),
  ].filter(Boolean).join(' ');
}

type TrainerReviewSnapshot = {
  trainer: string;
  scorePercent: number;
  totalScore: number;
  totalWeightage: number;
  createdAt: string;
  reviewPeriod?: string;
  template?: string;
  focusPoints?: string;
  goals?: string;
  scores: Array<{ category: string; weightage: number; score: number }>;
};

const TRAINER_REPORT_IDS = new Set<ReportId>([
  'trainer_performance_consolidated',
  'trainer_scorecard_trend',
  'trainer_member_feedback_consolidated',
  'trainer_coaching_priority_report',
]);

export function isTrainerReportId(reportId: ReportId): boolean {
  return TRAINER_REPORT_IDS.has(reportId);
}

function cleanNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function trainerReviewFromTicket(ticket: Ticket): TrainerReviewSnapshot | null {
  const review = ticket.metadata?.trainerReview;
  if (!review || typeof review !== 'object' || Array.isArray(review)) return null;
  const record = review as Record<string, unknown>;
  const scores = Array.isArray(record.scores)
    ? record.scores.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const category = String(row.category || '').trim();
        if (!category) return [];
        return [{
          category,
          weightage: cleanNumber(row.weightage),
          score: cleanNumber(row.score),
        }];
      })
    : [];
  const totalWeightage = cleanNumber(record.totalWeightage) || scores.reduce((sum, item) => sum + item.weightage, 0);
  const totalScore = cleanNumber(record.totalScore) || scores.reduce((sum, item) => sum + item.score, 0);
  const scorePercent = cleanNumber(record.scorePercent) || (totalWeightage ? Math.round((totalScore / totalWeightage) * 100) : 0);
  const trainer = String(record.trainer || ticket.trainer || '').trim();
  if (!trainer) return null;

  return {
    trainer,
    scorePercent,
    totalScore,
    totalWeightage,
    createdAt: String(record.createdAt || ticket.createdAt),
    reviewPeriod: typeof record.reviewPeriod === 'string' ? record.reviewPeriod : ticket.classDateTime,
    template: typeof record.template === 'string' ? record.template : undefined,
    focusPoints: typeof record.focusPoints === 'string' ? record.focusPoints : undefined,
    goals: typeof record.goals === 'string' ? record.goals : undefined,
    scores,
  };
}

function isTrainerEvaluationTicket(ticket: Ticket): boolean {
  return Boolean(trainerReviewFromTicket(ticket)) ||
    (ticket.category === 'Trainer Feedback' && ticketTags(ticket).includes('trainer-profile')) ||
    ticketTags(ticket).includes('instructor-evaluation');
}

function isTrainerMemberFeedbackTicket(ticket: Ticket): boolean {
  const text = textForTicket(ticket).toLowerCase();
  return Boolean(ticket.trainer) ||
    ['Trainer Feedback', 'Class Experience', 'Instructor & Class Quality'].includes(ticket.category) ||
    /trainer|instructor|cue|correction|music|class flow|pacing|form|energy|member feedback|compliment/.test(text);
}

function isTrainerCoachingPriorityTicket(ticket: Ticket): boolean {
  const review = trainerReviewFromTicket(ticket);
  if (review) return review.scorePercent > 0 && review.scorePercent < 80;
  return isTrainerMemberFeedbackTicket(ticket) && (
    ticket.sentiment === 'Negative' ||
    ticket.sentiment === 'Angry' ||
    ticket.priority === 'Critical' ||
    ticket.priority === 'High' ||
    /complaint|concern|poor|late|frustrat|unhappy|unsafe|correction|music|pacing|intensity/i.test(textForTicket(ticket))
  );
}

function matchesTrainerReport(ticket: Ticket, definition: ReportDefinition): boolean {
  if (definition.id === 'trainer_scorecard_trend') return Boolean(trainerReviewFromTicket(ticket));
  if (definition.id === 'trainer_member_feedback_consolidated') return isTrainerMemberFeedbackTicket(ticket) && !isTrainerEvaluationTicket(ticket);
  if (definition.id === 'trainer_coaching_priority_report') return isTrainerCoachingPriorityTicket(ticket);
  return Boolean(trainerReviewFromTicket(ticket)) || isTrainerMemberFeedbackTicket(ticket);
}

function matchesDefinition(ticket: Ticket, definition: ReportDefinition): boolean {
  if (definition.match === 'all' || definition.match === 'quality') return true;
  if (definition.match === 'sla') return getSlaState(ticket) !== 'Closed' || isTicketBreached(ticket);
  if (definition.match === 'resolution') return isClosedTicket(ticket);
  if (definition.match === 'events') return true;
  if (definition.match === 'sentiment') return Boolean(ticket.sentiment);
  if (definition.match === 'trainer') return matchesTrainerReport(ticket, definition);
  if (definition.match === 'studio') return Boolean(ticket.studio);
  if (definition.match === 'owner') return Boolean(ticket.assignedTo);
  if (definition.match === 'category') {
    if (!definition.categories?.length) return true;
    return definition.categories.includes(ticket.category);
  }
  if (definition.match === 'subcategory') return Boolean(ticket.subCategory);

  const categoryMatch = definition.categories?.includes(ticket.category) || false;
  const keywordMatch = definition.keywords?.test(textForTicket(ticket)) || false;
  return categoryMatch || keywordMatch;
}

function reportTicketsForDefinition(tickets: Ticket[], definition: ReportDefinition): { tickets: Ticket[]; usedFallback: boolean } {
  const matched = tickets.filter((ticket) => matchesDefinition(ticket, definition));
  if (matched.length > 0) return { tickets: matched, usedFallback: false };
  return { tickets, usedFallback: true };
}

function countBy(tickets: Ticket[], selector: (ticket: Ticket) => string | undefined, limit = 10): ReportRow[] {
  const counts = tickets.reduce<Record<string, number>>((acc, ticket) => {
    const key = selector(ticket) || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function addPercents(rows: ReportRow[], total: number): ReportRow[] {
  return rows.map((row) => ({ ...row, percent: percent(row.value, total) }));
}

function dailyTrendRows(tickets: Ticket[], period: ReportPeriod): ReportRow[] {
  const from = new Date(`${period.from}T00:00:00`);
  const to = new Date(`${period.to}T00:00:00`);
  const buckets: ReportRow[] = [];
  for (const date = new Date(from); date.getTime() <= to.getTime(); date.setDate(date.getDate() + 1)) {
    buckets.push({
      name: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      value: 0,
    });
  }
  const byIsoDay = new Map<string, ReportRow>();
  for (const row of buckets) {
    const parts = row.name.split(' ');
    byIsoDay.set(parts.join(' '), row);
  }
  for (const ticket of tickets) {
    const label = new Date(ticket.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const bucket = byIsoDay.get(label);
    if (bucket) bucket.value += 1;
  }
  return buckets;
}

function agingRows(tickets: Ticket[], generatedAt: string): ReportRow[] {
  const open = tickets.filter((ticket) => !isClosedTicket(ticket));
  const buckets = [
    { name: '0-24h', value: 0 },
    { name: '1-3d', value: 0 },
    { name: '4-7d', value: 0 },
    { name: '8d+', value: 0 },
  ];
  for (const ticket of open) {
    const age = ticketAgeHours(ticket, generatedAt);
    if (age <= 24) buckets[0].value += 1;
    else if (age <= 72) buckets[1].value += 1;
    else if (age <= 168) buckets[2].value += 1;
    else buckets[3].value += 1;
  }
  return buckets;
}

function completenessRows(tickets: Ticket[]): ReportRow[] {
  const fields: Array<{ name: string; present: (ticket: Ticket) => boolean }> = [
    { name: 'Member linked', present: (ticket) => Boolean(ticket.memberName || ticket.memberContact) },
    { name: 'Studio captured', present: (ticket) => Boolean(ticket.studio && ticket.studio !== 'Unspecified Studio') },
    { name: 'Owner assigned', present: (ticket) => Boolean(ticket.assignedTo && ticket.assignedTo !== 'Unassigned') },
    { name: 'Team routed', present: (ticket) => Boolean(ticket.team) },
    { name: 'Sentiment captured', present: (ticket) => Boolean(ticket.sentiment) },
    { name: 'Summary captured', present: (ticket) => Boolean(ticket.conversationSummary || ticket.description) },
    { name: 'Tags captured', present: (ticket) => ticketTags(ticket).length > 0 },
  ];
  return fields.map((field) => {
    const value = tickets.filter(field.present).length;
    return {
      name: field.name,
      value,
      percent: percent(value, tickets.length),
      secondaryValue: `${percent(value, tickets.length)}%`,
    };
  });
}

function handoffRows(tickets: Ticket[], events: TicketReportEvent[]): ReportRow[] {
  const rows = tickets.map((ticket) => {
    const handoffs = eventsForTicket(ticket, events).filter((event) => event.eventType === 'assignment_change');
    return {
      name: ticket.assignedTo || 'Unassigned',
      value: handoffs.length,
      secondaryValue: ticket.title,
      tone: handoffs.length > 1 ? 'warning' as const : 'neutral' as const,
    };
  });
  return rows
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function trainerReviews(tickets: Ticket[]): TrainerReviewSnapshot[] {
  return tickets
    .map(trainerReviewFromTicket)
    .filter((review): review is TrainerReviewSnapshot => Boolean(review));
}

function trainerNameForTicket(ticket: Ticket): string {
  return ticket.trainer || trainerReviewFromTicket(ticket)?.trainer || 'Unspecified Instructor';
}

function trainerScoreTrendRows(tickets: Ticket[]): ReportRow[] {
  return trainerReviews(tickets)
    .sort((a, b) => parseDate(a.createdAt) - parseDate(b.createdAt))
    .slice(-12)
    .map((review) => ({
      name: `${new Date(review.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · ${review.trainer}`,
      value: review.scorePercent,
      secondaryValue: [
        review.template,
        review.focusPoints ? `Focus: ${review.focusPoints}` : '',
      ].filter(Boolean).join(' · '),
      tone: review.scorePercent < 65 ? 'danger' : review.scorePercent < 80 ? 'warning' : 'success',
    }));
}

function trainerScoreDistributionRows(tickets: Ticket[]): ReportRow[] {
  const rows = [
    { name: '90%+', value: 0, tone: 'success' as const },
    { name: '80-89%', value: 0, tone: 'success' as const },
    { name: '65-79%', value: 0, tone: 'warning' as const },
    { name: '<65%', value: 0, tone: 'danger' as const },
  ];
  for (const review of trainerReviews(tickets)) {
    if (review.scorePercent >= 90) rows[0].value += 1;
    else if (review.scorePercent >= 80) rows[1].value += 1;
    else if (review.scorePercent >= 65) rows[2].value += 1;
    else rows[3].value += 1;
  }
  return rows;
}

function trainerMemberFeedbackRows(tickets: Ticket[]): ReportRow[] {
  const memberFeedbackTickets = tickets.filter((ticket) => isTrainerMemberFeedbackTicket(ticket) && !isTrainerEvaluationTicket(ticket));
  return addPercents(countBy(memberFeedbackTickets, trainerNameForTicket, 12), memberFeedbackTickets.length);
}

function trainerCriterionGapRows(tickets: Ticket[]): ReportRow[] {
  const gaps = new Map<string, { value: number; secondary: string[] }>();
  for (const review of trainerReviews(tickets)) {
    for (const score of review.scores) {
      const percentValue = score.weightage ? Math.round((score.score / score.weightage) * 100) : 0;
      if (percentValue >= 70 || percentValue <= 0) continue;
      const current = gaps.get(score.category) || { value: 0, secondary: [] };
      current.value += 1;
      current.secondary.push(`${review.trainer}: ${percentValue}%`);
      gaps.set(score.category, current);
    }
  }
  return Array.from(gaps.entries())
    .map(([name, row]) => ({
      name,
      value: row.value,
      secondaryValue: row.secondary.slice(0, 3).join(' · '),
      tone: 'warning' as const,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 12);
}

function trainerCoachingPriorityRows(tickets: Ticket[]): ReportRow[] {
  const rows = new Map<string, { value: number; secondary: string[]; danger: boolean }>();
  for (const ticket of tickets.filter(isTrainerCoachingPriorityTicket)) {
    const review = trainerReviewFromTicket(ticket);
    const trainer = trainerNameForTicket(ticket);
    const current = rows.get(trainer) || { value: 0, secondary: [], danger: false };
    current.value += 1;
    current.danger = current.danger || ticket.priority === 'Critical' || ticket.priority === 'High' || (review?.scorePercent || 100) < 65;
    current.secondary.push(review
      ? `${review.scorePercent}% score${review.focusPoints ? ` · ${review.focusPoints}` : ''}`
      : `${ticket.sentiment || 'Member feedback'} · ${ticket.title}`
    );
    rows.set(trainer, current);
  }
  return Array.from(rows.entries())
    .map(([name, row]) => ({
      name,
      value: row.value,
      secondaryValue: row.secondary.slice(0, 3).join(' · '),
      tone: row.danger ? 'danger' as const : 'warning' as const,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, 12);
}

function reportSections(definition: ReportDefinition, tickets: Ticket[], events: TicketReportEvent[], period: ReportPeriod, generatedAt: string): ReportSection[] {
  const total = tickets.length;
  const categoryRows = addPercents(countBy(tickets, (ticket) => ticket.category, 12), total);
  const subCategoryRows = addPercents(countBy(tickets, (ticket) => ticket.subCategory, 12), total);
  const studioRows = addPercents(countBy(tickets, (ticket) => ticket.studio, 12), total);
  const ownerRows = addPercents(countBy(tickets, (ticket) => ticket.assignedTo, 12), total);
  const teamRows = addPercents(countBy(tickets, (ticket) => ticket.team, 12), total);
  const statusRows = addPercents(countBy(tickets, (ticket) => ticket.status, 8), total);
  const priorityRows = addPercents(countBy(tickets, (ticket) => ticket.priority, 8), total);
  const slaRows = addPercents(countBy(tickets, (ticket) => getSlaState(ticket), 8), total);
  const sentimentRows = addPercents(countBy(tickets, (ticket) => ticket.sentiment || 'Unspecified', 8), total);
  const trendRows = dailyTrendRows(tickets, period);
  const ageRows = agingRows(tickets, generatedAt);
  const handoffs = handoffRows(tickets, events);
  const completeness = completenessRows(tickets);

  if (definition.chart === 'trainer') {
    const scoreTrend = trainerScoreTrendRows(tickets);
    const memberFeedback = trainerMemberFeedbackRows(tickets);
    const coachingPriorities = trainerCoachingPriorityRows(tickets);
    const criterionGaps = trainerCriterionGapRows(tickets);
    const scoreDistribution = trainerScoreDistributionRows(tickets);

    if (definition.id === 'trainer_scorecard_trend') {
      return [
        { id: 'trainer_score_trend', title: 'Trainer Score Trend', kind: 'line', rows: scoreTrend.length ? scoreTrend : [{ name: 'No scorecards captured', value: 0 }] },
        { id: 'trainer_score_distribution', title: 'Score Distribution', kind: 'bar', rows: scoreDistribution },
        { id: 'trainer_criterion_gaps', title: 'Criterion Gaps', kind: 'ranked', rows: criterionGaps.length ? criterionGaps : [{ name: 'No criterion gaps captured', value: 0 }] },
      ];
    }
    if (definition.id === 'trainer_member_feedback_consolidated') {
      return [
        { id: 'trainer_member_feedback', title: 'Member Feedback By Trainer', kind: 'bar', rows: memberFeedback.length ? memberFeedback : [{ name: 'No trainer member feedback tickets captured', value: 0 }] },
        { id: 'trainer_sentiment_mix', title: 'Trainer Feedback Sentiment', kind: 'donut', rows: sentimentRows },
        { id: 'trainer_feedback_touchpoints', title: 'Trainer Feedback Touchpoints', kind: 'ranked', rows: subCategoryRows },
      ];
    }
    if (definition.id === 'trainer_coaching_priority_report') {
      return [
        { id: 'trainer_coaching_priorities', title: 'Trainer Coaching Priorities', kind: 'ranked', rows: coachingPriorities.length ? coachingPriorities : [{ name: 'No coaching priority signals captured', value: 0 }] },
        { id: 'trainer_criterion_gaps', title: 'Criterion Gaps', kind: 'ranked', rows: criterionGaps.length ? criterionGaps : [{ name: 'No criterion gaps captured', value: 0 }] },
        { id: 'trainer_member_feedback', title: 'Member Feedback By Trainer', kind: 'bar', rows: memberFeedback.length ? memberFeedback : [{ name: 'No trainer member feedback tickets captured', value: 0 }] },
      ];
    }
    return [
      { id: 'trainer_score_trend', title: 'Trainer Score Trend', kind: 'line', rows: scoreTrend.length ? scoreTrend : [{ name: 'No scorecards captured', value: 0 }] },
      { id: 'trainer_member_feedback', title: 'Member Feedback By Trainer', kind: 'bar', rows: memberFeedback.length ? memberFeedback : [{ name: 'No trainer member feedback tickets captured', value: 0 }] },
      { id: 'trainer_coaching_priorities', title: 'Trainer Coaching Priorities', kind: 'ranked', rows: coachingPriorities.length ? coachingPriorities : [{ name: 'No coaching priority signals captured', value: 0 }] },
      { id: 'trainer_criterion_gaps', title: 'Criterion Gaps', kind: 'ranked', rows: criterionGaps.length ? criterionGaps : [{ name: 'No criterion gaps captured', value: 0 }] },
    ];
  }

  if (definition.chart === 'trend') {
    return [
      { id: 'created_trend', title: 'Created Trend', kind: 'line', rows: trendRows },
      { id: 'category_mix', title: 'Category Mix', kind: 'bar', rows: categoryRows },
      { id: 'source_mix', title: 'Live vs Historic Source Mix', kind: 'donut', rows: addPercents(countBy(tickets, sourceTypeForTicket, 4), total) },
    ];
  }
  if (definition.chart === 'sla') {
    return [
      { id: 'sla_health', title: 'SLA Health', kind: 'donut', rows: slaRows },
      { id: 'breach_owners', title: 'Breached / At-Risk Owners', kind: 'ranked', rows: addPercents(countBy(tickets.filter((ticket) => ['Breached', 'At Risk'].includes(getSlaState(ticket))), (ticket) => ticket.assignedTo, 10), total) },
      { id: 'aging', title: 'Open Backlog Aging', kind: 'bar', rows: ageRows },
    ];
  }
  if (definition.chart === 'status') {
    return [
      { id: 'status_funnel', title: 'Status Funnel', kind: 'donut', rows: statusRows },
      { id: 'resolution_by_owner', title: 'Resolved Tickets By Owner', kind: 'ranked', rows: addPercents(countBy(tickets.filter(isClosedTicket), (ticket) => ticket.assignedTo, 10), total) },
      { id: 'aging', title: 'Open Backlog Aging', kind: 'bar', rows: ageRows },
    ];
  }
  if (definition.chart === 'priority') {
    return [
      { id: 'priority_mix', title: 'Priority Mix', kind: 'donut', rows: priorityRows },
      { id: 'critical_categories', title: 'Critical / High Categories', kind: 'ranked', rows: addPercents(countBy(tickets.filter((ticket) => ['Critical', 'High'].includes(ticket.priority)), (ticket) => ticket.category, 10), total) },
      { id: 'sla_health', title: 'SLA Health For Priority Mix', kind: 'bar', rows: slaRows },
    ];
  }
  if (definition.chart === 'studio') {
    return [
      { id: 'studio_load', title: 'Studio Load', kind: 'bar', rows: studioRows },
      { id: 'studio_risk', title: 'High Priority By Studio', kind: 'ranked', rows: addPercents(countBy(tickets.filter((ticket) => ['Critical', 'High'].includes(ticket.priority)), (ticket) => ticket.studio, 10), total) },
      { id: 'category_mix', title: 'Category Mix', kind: 'bar', rows: categoryRows },
    ];
  }
  if (definition.chart === 'owner') {
    return [
      { id: 'owner_load', title: 'Owner Load', kind: 'bar', rows: ownerRows },
      { id: 'department_load', title: 'Department Routing Load', kind: 'bar', rows: teamRows },
      { id: 'handoffs', title: 'Assignment Handoffs', kind: 'ranked', rows: handoffs.length ? handoffs : [{ name: 'No assignment handoffs recorded', value: 0 }] },
    ];
  }
  if (definition.chart === 'sentiment') {
    return [
      { id: 'sentiment_mix', title: 'Sentiment Mix', kind: 'donut', rows: sentimentRows },
      { id: 'negative_categories', title: 'Negative / Angry Categories', kind: 'ranked', rows: addPercents(countBy(tickets.filter((ticket) => ticket.sentiment === 'Negative' || ticket.sentiment === 'Angry'), (ticket) => ticket.category, 10), total) },
      { id: 'status_funnel', title: 'Status Funnel', kind: 'bar', rows: statusRows },
    ];
  }
  if (definition.chart === 'completeness') {
    return [
      { id: 'field_completeness', title: 'Field Completeness', kind: 'bar', rows: completeness },
      { id: 'missing_member_context', title: 'Tickets Missing Member Context By Category', kind: 'ranked', rows: addPercents(countBy(tickets.filter((ticket) => !ticket.memberName && !ticket.memberContact), (ticket) => ticket.category, 10), total) },
      { id: 'source_mix', title: 'Source Mix', kind: 'donut', rows: addPercents(countBy(tickets, sourceTypeForTicket, 4), total) },
    ];
  }

  return [
    { id: 'category_mix', title: 'Category Mix', kind: 'bar', rows: categoryRows },
    { id: 'subcategory_mix', title: 'Recurring Touchpoints', kind: 'ranked', rows: subCategoryRows },
    { id: 'status_funnel', title: 'Status Funnel', kind: 'donut', rows: statusRows },
  ];
}

function resolutionHours(tickets: Ticket[], events: TicketReportEvent[]): number[] {
  return tickets
    .map((ticket) => {
      const resolvedAt = getResolvedAt(ticket, events);
      return resolvedAt ? hoursBetween(ticket.createdAt, resolvedAt) : null;
    })
    .filter((value): value is number => value != null);
}

function buildTrainerMetrics(tickets: Ticket[]): ReportMetric[] {
  const reviews = trainerReviews(tickets);
  const memberFeedback = tickets.filter((ticket) => isTrainerMemberFeedbackTicket(ticket) && !isTrainerEvaluationTicket(ticket));
  const coachingPriorities = tickets.filter(isTrainerCoachingPriorityTicket);
  const trainerNames = new Set([
    ...reviews.map((review) => review.trainer),
    ...memberFeedback.map(trainerNameForTicket),
  ].filter((name) => name && name !== 'Unspecified Instructor'));
  const averageScore = reviews.length
    ? Math.round(reviews.reduce((sum, review) => sum + review.scorePercent, 0) / reviews.length)
    : 0;
  const lowScores = reviews.filter((review) => review.scorePercent > 0 && review.scorePercent < 80).length;
  const positiveFeedback = memberFeedback.filter((ticket) => ticket.sentiment === 'Positive').length;
  const negativeFeedback = memberFeedback.filter((ticket) => ticket.sentiment === 'Negative' || ticket.sentiment === 'Angry').length;

  return [
    {
      id: 'trainer_count',
      label: 'Trainers',
      value: trainerNames.size,
      numericValue: trainerNames.size,
      tone: 'info',
      description: 'Unique instructors represented in scorecards or member feedback.',
    },
    {
      id: 'trainer_review_count',
      label: 'Scorecards',
      value: reviews.length,
      numericValue: reviews.length,
      tone: reviews.length ? 'info' : 'warning',
      description: 'Structured instructor evaluation records included in this report.',
    },
    {
      id: 'trainer_average_score',
      label: 'Avg Trainer Score',
      value: `${averageScore}%`,
      numericValue: averageScore,
      unit: '%',
      tone: averageScore >= 80 ? 'success' : averageScore >= 65 ? 'warning' : 'danger',
      description: 'Average weighted score across included trainer scorecards.',
    },
    {
      id: 'trainer_member_feedback_count',
      label: 'Member Feedback',
      value: memberFeedback.length,
      numericValue: memberFeedback.length,
      tone: memberFeedback.length ? 'info' : 'neutral',
      description: 'Trainer or class feedback tickets that are not structured scorecards.',
    },
    {
      id: 'trainer_positive_feedback',
      label: 'Positive Feedback',
      value: positiveFeedback,
      numericValue: positiveFeedback,
      tone: 'success',
    },
    {
      id: 'trainer_negative_feedback',
      label: 'Negative Feedback',
      value: negativeFeedback,
      numericValue: negativeFeedback,
      tone: negativeFeedback ? 'warning' : 'success',
    },
    {
      id: 'trainer_low_scorecards',
      label: '<80% Scorecards',
      value: lowScores,
      numericValue: lowScores,
      tone: lowScores ? 'warning' : 'success',
    },
    {
      id: 'trainer_coaching_priority_count',
      label: 'Coaching Priority Signals',
      value: coachingPriorities.length,
      numericValue: coachingPriorities.length,
      tone: coachingPriorities.length ? 'warning' : 'success',
    },
  ];
}

function buildMetrics(tickets: Ticket[], events: TicketReportEvent[], generatedAt: string, definition?: ReportDefinition): ReportMetric[] {
  const open = tickets.filter((ticket) => !isClosedTicket(ticket));
  const resolved = tickets.filter(isClosedTicket);
  const breached = tickets.filter(isTicketBreached);
  const atRisk = tickets.filter((ticket) => getSlaState(ticket) === 'At Risk');
  const highPriority = tickets.filter((ticket) => ticket.priority === 'Critical' || ticket.priority === 'High');
  const avgAge = average(open.map((ticket) => ticketAgeHours(ticket, generatedAt)));
  const avgResolution = average(resolutionHours(resolved, events));
  const handoffs = events.filter((event) => event.eventType === 'assignment_change').length;

  const baseMetrics: ReportMetric[] = [
    { id: 'ticket_count', label: 'Tickets', value: tickets.length, numericValue: tickets.length, tone: 'info', description: 'Tickets matching this report and global filters.' },
    { id: 'open_count', label: 'Open', value: open.length, numericValue: open.length, tone: open.length ? 'warning' : 'success' },
    { id: 'resolved_rate', label: 'Resolved / Closed', value: `${percent(resolved.length, tickets.length)}%`, numericValue: percent(resolved.length, tickets.length), unit: '%', tone: 'success' },
    { id: 'sla_breached', label: 'SLA Breached', value: breached.length, numericValue: breached.length, tone: breached.length ? 'danger' : 'success' },
    { id: 'sla_at_risk', label: 'SLA At Risk', value: atRisk.length, numericValue: atRisk.length, tone: atRisk.length ? 'warning' : 'success' },
    { id: 'high_priority', label: 'Critical / High', value: highPriority.length, numericValue: highPriority.length, tone: highPriority.length ? 'danger' : 'neutral' },
    { id: 'avg_open_age', label: 'Avg Open Age', value: `${avgAge}h`, numericValue: avgAge, unit: 'hours', tone: avgAge > 72 ? 'warning' : 'neutral' },
    { id: 'avg_resolution_time', label: 'Avg Resolution Time', value: `${avgResolution}h`, numericValue: avgResolution, unit: 'hours', tone: avgResolution > 48 ? 'warning' : 'neutral' },
    { id: 'handoffs', label: 'Owner Handoffs', value: handoffs, numericValue: handoffs, tone: handoffs ? 'info' : 'neutral' },
  ];
  return definition?.chart === 'trainer'
    ? [...buildTrainerMetrics(tickets), ...baseMetrics]
    : baseMetrics;
}

function sourceRows(tickets: Ticket[], generatedAt: string): ReportSourceRow[] {
  const riskScore = (ticket: Ticket) => {
    const priority = { Critical: 4, High: 3, Medium: 2, Low: 1 }[ticket.priority] || 1;
    const sla = getSlaState(ticket) === 'Breached' ? 4 : getSlaState(ticket) === 'At Risk' ? 3 : 1;
    return priority + sla + (isClosedTicket(ticket) ? 0 : 1);
  };

  return [...tickets]
    .sort((a, b) => riskScore(b) - riskScore(a) || parseDate(b.createdAt) - parseDate(a.createdAt))
    .map((ticket) => ({
      ticketId: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      slaState: getSlaState(ticket),
      sourceType: sourceTypeForTicket(ticket),
      category: ticket.category,
      subCategory: ticket.subCategory,
      studio: ticket.studio || 'Unspecified Studio',
      owner: ticket.assignedTo || 'Unassigned',
      team: ticket.team || 'Unspecified',
      memberName: ticket.memberName || '',
      createdAt: ticket.createdAt,
      ageHours: ticketAgeHours(ticket, generatedAt),
    }));
}

function qualityNotes(tickets: Ticket[], events: TicketReportEvent[], usedFallback: boolean, definition?: ReportDefinition): string[] {
  const notes: string[] = [];
  const historic = tickets.filter(isHistoricTicket).length;
  const missingMember = tickets.filter((ticket) => !ticket.memberName && !ticket.memberContact).length;
  const missingSentiment = tickets.filter((ticket) => !ticket.sentiment).length;
  const eventCoverage = tickets.length ? percent(new Set(events.map((event) => event.ticketId)).size, tickets.length) : 0;

  notes.push(`${tickets.length} tickets matched the report after period and global filters.`);
  if (historic) notes.push(`${historic} historic tickets are included; lifecycle event coverage may be limited for imports.`);
  if (missingMember) notes.push(`${missingMember} tickets do not have member identity context captured.`);
  if (missingSentiment) notes.push(`${missingSentiment} tickets do not include a sentiment value.`);
  if (eventCoverage < 50) notes.push(`Ticket event coverage is ${eventCoverage}%; lifecycle metrics use resolution metadata fallback where available.`);
  if (definition?.chart === 'trainer') {
    const reviews = trainerReviews(tickets).length;
    const feedback = tickets.filter((ticket) => isTrainerMemberFeedbackTicket(ticket) && !isTrainerEvaluationTicket(ticket)).length;
    notes.push(`${reviews} trainer evaluation scorecards and ${feedback} trainer member feedback tickets are included in this trainer report.`);
    notes.push('Trainer performance scorecards and member feedback are labeled separately so structured evaluation scores are not conflated with operational feedback.');
  }
  if (usedFallback) notes.push('No report-specific tickets matched, so the report shows the full filtered period as a fallback.');
  return notes;
}

function assumptions(period: ReportPeriod): string[] {
  return [
    `The main reporting period uses ticket created date from ${period.from} through ${period.to}, inclusive.`,
    'Live and historic tickets are labeled separately when both are included.',
    'Lifecycle timing uses ticket_events first, then ticket resolution metadata as fallback.',
    'Management summary content is generated from deterministic metrics and should be reviewed against the source register.',
  ];
}

export function buildReport(input: BuildReportInput): GeneratedReport {
  const definition = ALL_REPORT_DEFINITIONS.find((item) => item.id === input.reportId) || ALL_REPORT_DEFINITIONS[0];
  const generatedAt = input.generatedAt || new Date().toISOString();
  const scopedTickets = filterTicketsForReport(input.tickets, {
    from: input.period.from,
    to: input.period.to,
    filters: input.filters,
  });
  const { tickets: reportTickets, usedFallback } = reportTicketsForDefinition(scopedTickets, definition);
  const reportTicketIds = new Set(reportTickets.map((ticket) => ticket.id));
  const events = input.events.filter((event) => reportTicketIds.has(event.ticketId));
  const dataQualityNotes = qualityNotes(reportTickets, events, usedFallback, definition);

  return {
    definition,
    period: input.period,
    filters: input.filters,
    generatedAt,
    allTicketsInPeriod: scopedTickets.length,
    reportTickets: reportTickets.length,
    metrics: buildMetrics(reportTickets, events, generatedAt, definition),
    sections: reportSections(definition, reportTickets, events, input.period, generatedAt),
    sourceRows: sourceRows(reportTickets, generatedAt),
    assumptions: assumptions(input.period),
    dataQualityNotes,
  };
}

export function buildReportExportPayload(report: GeneratedReport): ReportExportPayload {
  return {
    brand: {
      name: REPORT_BRAND.name,
      product: REPORT_BRAND.product,
      context: REPORT_BRAND.context,
    },
    exportedAt: new Date().toISOString(),
    document: {
      title: `${report.definition.title} - ${REPORT_BRAND.product}`,
      subtitle: `${report.period.from} to ${report.period.to} - ${report.reportTickets} report tickets`,
      footer: REPORT_BRAND.footer,
    },
    report: {
      id: report.definition.id,
      title: report.definition.title,
      period: report.period,
      filters: report.filters,
    },
    metrics: report.metrics,
    sections: report.sections,
    sourceRows: report.sourceRows,
    narrative: report.narrative,
    assumptions: report.assumptions,
    dataQualityNotes: report.dataQualityNotes,
  };
}

export function paginateReportRows<T>(rows: T[], page: number, pageSize: number): ReportPaginationResult<T> {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const totalRows = safeRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const safePage = Number.isFinite(page) ? Math.floor(page) : 1;
  const clampedPage = Math.min(Math.max(safePage, 1), totalPages);
  const startIndex = (clampedPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalRows);

  return {
    page: clampedPage,
    pageSize: safePageSize,
    totalRows,
    totalPages,
    startRow: totalRows ? startIndex + 1 : 0,
    endRow: totalRows ? endIndex : 0,
    rows: safeRows.slice(startIndex, endIndex),
  };
}

function safeRecordArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) as T[];
}

function safeStringArray(value: unknown, limit = 12): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, limit)
    : [];
}

function cleanNarrativeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function reportRuntimeErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : typeof error === 'string'
        ? error
        : '';
  const message = raw.trim();

  if (!message) return fallback;
  if (/failed to fetch|fetch failed|load failed|networkerror/i.test(message)) return fallback;

  return message;
}

export function fallbackNarrativeForReport(report: GeneratedReport): ReportNarrative {
  const metrics = safeRecordArray<ReportMetric>(report.metrics);
  const breached = metrics.find((metric) => metric.id === 'sla_breached')?.numericValue || 0;
  const high = metrics.find((metric) => metric.id === 'high_priority')?.numericValue || 0;
  const dataQualityNotes = safeStringArray(report.dataQualityNotes, 20);

  return {
    summary: `${report.definition.title} covers ${report.reportTickets} tickets from ${report.period.from} to ${report.period.to}.`,
    findings: metrics.slice(0, 4).map((metric) => `${metric.label}: ${metric.value}`),
    risks: [
      breached ? `${breached} tickets are SLA breached.` : 'No SLA breaches in the generated report.',
      high ? `${high} tickets are Critical or High priority.` : 'Critical and High priority exposure is low for this report.',
    ],
    recommendedActions: [
      'Review the top ranked source tickets before sharing the report.',
      'Use the data-quality notes to improve ticket intake consistency.',
    ],
    dataQualityNotes,
    generatedByAi: false,
  };
}

export function reportPayloadForNarrative(report: GeneratedReport): ReportNarrativeRequestPayload {
  const metrics = safeRecordArray<ReportMetric>(report.metrics);
  const sourceRows = safeRecordArray<ReportSourceRow>(report.sourceRows);
  const sections = safeRecordArray<ReportSection>(report.sections);

  return {
    action: 'generateReportNarrative',
    reportId: report.definition.id,
    period: report.period,
    filters: report.filters,
    metrics,
    topRows: sourceRows.slice(0, 12).map((row) => ({
      ticketId: row.ticketId,
      title: row.title,
      status: row.status,
      priority: row.priority,
      slaState: row.slaState,
      sourceType: row.sourceType,
      category: row.category,
      subCategory: row.subCategory,
      studio: row.studio,
      owner: row.owner,
      team: row.team,
      createdAt: row.createdAt,
    })),
    sections: sections.map((section) => ({
      title: section.title,
      rows: Array.isArray(section.rows) ? section.rows.slice(0, 8) : [],
    })),
    dataQualityNotes: safeStringArray(report.dataQualityNotes, 20),
    assumptions: safeStringArray(report.assumptions, 20),
  };
}

export function normalizeReportNarrativeResponse(data: unknown, report: GeneratedReport): ReportNarrative {
  const fallback = fallbackNarrativeForReport(report);
  const envelope = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const rawNarrative = envelope.narrative && typeof envelope.narrative === 'object' && !Array.isArray(envelope.narrative)
    ? envelope.narrative as Record<string, unknown>
    : envelope;
  const findings = safeStringArray(rawNarrative.findings);
  const risks = safeStringArray(rawNarrative.risks);
  const recommendedActions = safeStringArray(rawNarrative.recommendedActions);
  const dataQualityNotes = safeStringArray(rawNarrative.dataQualityNotes, 20);
  const generatedByAi = typeof rawNarrative.generatedByAi === 'boolean'
    ? rawNarrative.generatedByAi
    : true;

  return {
    summary: cleanNarrativeText(rawNarrative.summary, fallback.summary),
    findings: findings.length ? findings : fallback.findings,
    risks: risks.length ? risks : fallback.risks,
    recommendedActions: recommendedActions.length ? recommendedActions : fallback.recommendedActions,
    dataQualityNotes: dataQualityNotes.length ? dataQualityNotes : fallback.dataQualityNotes,
    generatedByAi,
  };
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvForReport(report: GeneratedReport): string {
  const lines: string[] = [];
  lines.push([REPORT_BRAND.name].map(csvEscape).join(','));
  lines.push([REPORT_BRAND.product].map(csvEscape).join(','));
  lines.push(['Report', report.definition.title].map(csvEscape).join(','));
  lines.push(['Period', `${report.period.from} to ${report.period.to}`].map(csvEscape).join(','));
  lines.push(['Generated At', report.generatedAt].map(csvEscape).join(','));
  lines.push(['Report Tickets', report.reportTickets].map(csvEscape).join(','));
  lines.push(['Period Tickets', report.allTicketsInPeriod].map(csvEscape).join(','));
  lines.push('');
  lines.push(['Source Ticket Register'].map(csvEscape).join(','));
  lines.push(['Ticket ID', 'Title', 'Status', 'Priority', 'SLA', 'Source', 'Category', 'Subcategory', 'Studio', 'Owner', 'Team', 'Member', 'Created At', 'Age Hours'].map(csvEscape).join(','));
  for (const row of report.sourceRows) {
    lines.push([
      row.ticketId,
      row.title,
      row.status,
      row.priority,
      row.slaState,
      row.sourceType,
      row.category,
      row.subCategory,
      row.studio,
      row.owner,
      row.team,
      row.memberName,
      row.createdAt,
      row.ageHours,
    ].map(csvEscape).join(','));
  }
  lines.push('');
  lines.push(['Metrics And Analysis'].map(csvEscape).join(','));
  lines.push(['Section', 'Name', 'Value', 'Secondary', 'Percent'].map(csvEscape).join(','));
  for (const metric of report.metrics) {
    lines.push(['Metric', metric.label, metric.value, metric.unit || '', metric.numericValue ?? ''].map(csvEscape).join(','));
  }
  for (const section of report.sections) {
    for (const row of section.rows) {
      lines.push([section.title, row.name, row.value, row.secondaryValue || '', row.percent ?? ''].map(csvEscape).join(','));
    }
  }
  lines.push('');
  lines.push([REPORT_BRAND.footer].map(csvEscape).join(','));
  return lines.join('\n');
}

export function jsonForReport(report: GeneratedReport): string {
  return JSON.stringify(buildReportExportPayload(report), null, 2);
}

function htmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlList(items: string[]): string {
  if (!items.length) return '<li>No items generated for this section.</li>';
  return items.map((item) => `<li>${htmlEscape(item)}</li>`).join('');
}

export function htmlForReport(report: GeneratedReport): string {
  const narrative = report.narrative || fallbackNarrativeForReport(report);
  const metricCards = report.metrics.map((metric) => `
    <article class="metric">
      <div class="metric-label">${htmlEscape(metric.label)}</div>
      <div class="metric-value">${htmlEscape(metric.value)}</div>
      ${metric.description ? `<p>${htmlEscape(metric.description)}</p>` : ''}
    </article>
  `).join('');
  const sectionTables = report.sections.map((section) => `
    <section class="block">
      <h2>${htmlEscape(section.title)}</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Value</th><th>Secondary</th><th>Percent</th></tr>
        </thead>
        <tbody>
          ${section.rows.map((row) => `
            <tr>
              <td>${htmlEscape(row.name)}</td>
              <td>${htmlEscape(row.value)}</td>
              <td>${htmlEscape(row.secondaryValue || '')}</td>
              <td>${row.percent == null ? '' : `${htmlEscape(row.percent)}%`}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `).join('');
  const sourceRows = report.sourceRows.map((row) => `
    <tr>
      <td><strong>${htmlEscape(row.ticketId)}</strong><br><span>${htmlEscape(row.title)}</span></td>
      <td>${htmlEscape(row.status)}</td>
      <td>${htmlEscape(row.priority)}</td>
      <td>${htmlEscape(row.slaState)}</td>
      <td>${htmlEscape(row.sourceType)}</td>
      <td>${htmlEscape(row.category)}<br><span>${htmlEscape(row.subCategory)}</span></td>
      <td>${htmlEscape(row.studio)}</td>
      <td>${htmlEscape(row.owner)}</td>
      <td>${htmlEscape(new Date(row.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }))}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(report.definition.title)} - ${REPORT_BRAND.product}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    :root { color-scheme: light; --ink: #0f172a; --muted: #64748b; --line: #d7dee8; --rose: #9f1239; --paper: #ffffff; --wash: #f8fafc; --head: #eef2f7; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--wash); color: var(--ink); font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif; }
    .page { max-width: 1180px; margin: 0 auto; padding: 36px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid var(--ink); padding-bottom: 22px; }
    .brand { font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: var(--rose); }
    h1 { margin: 8px 0; font-size: 34px; line-height: 1.05; letter-spacing: -0.02em; }
    .subtitle, .meta, p, li { color: var(--muted); font-size: 13px; line-height: 1.65; }
    .meta { text-align: right; white-space: nowrap; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .metric, .block { background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 16px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06); }
    .metric-label { color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .metric-value { margin-top: 8px; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .block { margin: 16px 0; break-inside: avoid; }
    .source-register { break-inside: auto; page-break-inside: auto; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; background: var(--paper); border: 1px solid var(--line); table-layout: fixed; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th { background: var(--head); color: #334155; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; text-align: left; }
    th, td { border-bottom: 1px solid var(--line); padding: 9px 10px; font-size: 11px; line-height: 1.45; vertical-align: top; }
    td span { color: var(--muted); }
    footer { margin-top: 28px; border-top: 1px solid var(--line); padding-top: 16px; color: var(--muted); font-size: 11px; display: flex; justify-content: space-between; gap: 20px; }
    @media print {
      body { background: white; }
      .page { max-width: none; padding: 0; }
      .metric, .block { box-shadow: none; }
      .metrics { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
      .metric { padding: 10px; }
      .metric-value { font-size: 22px; }
      .source-register { break-inside: auto; page-break-inside: auto; }
      .source-register table { font-size: 10px; }
      footer { position: running(reportFooter); }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <div class="brand">${REPORT_BRAND.name}</div>
        <h1>${htmlEscape(report.definition.title)}</h1>
        <div class="subtitle">${htmlEscape(report.definition.description)}</div>
      </div>
      <div class="meta">
        <strong>${REPORT_BRAND.product}</strong><br>
        ${htmlEscape(report.period.from)} to ${htmlEscape(report.period.to)}<br>
        Generated ${htmlEscape(new Date(report.generatedAt).toLocaleString('en-IN'))}<br>
        ${htmlEscape(report.reportTickets)} report tickets
      </div>
    </header>

    <section class="block source-register">
      <h2>Source Ticket Register</h2>
      <table>
        <colgroup>
          <col style="width: 22%">
          <col style="width: 10%">
          <col style="width: 8%">
          <col style="width: 9%">
          <col style="width: 8%">
          <col style="width: 18%">
          <col style="width: 10%">
          <col style="width: 9%">
          <col style="width: 6%">
        </colgroup>
        <thead>
          <tr><th>Ticket</th><th>Status</th><th>Priority</th><th>SLA</th><th>Source</th><th>Category</th><th>Studio</th><th>Owner</th><th>Created</th></tr>
        </thead>
        <tbody>${sourceRows}</tbody>
      </table>
    </section>

    <section class="metrics">${metricCards}</section>

    <section class="block">
      <h2>Management Summary</h2>
      <p>${htmlEscape(narrative.summary)}</p>
      <div class="grid">
        <div><h2>Findings</h2><ul>${htmlList(narrative.findings)}</ul></div>
        <div><h2>Recommended Actions</h2><ul>${htmlList(narrative.recommendedActions)}</ul></div>
      </div>
    </section>

    ${sectionTables}

    <footer>
      <span>${htmlEscape(REPORT_BRAND.footer)}</span>
      <span>${htmlEscape(REPORT_BRAND.context)}</span>
    </footer>
  </main>
</body>
</html>`;
}

export function reportFileSlug(report: Pick<GeneratedReport, 'definition' | 'period'>): string {
  return `${report.definition.id}-${report.period.from}-to-${report.period.to}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}
