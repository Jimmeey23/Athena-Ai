import { MomenceInsightSummary } from './momence-api';
import { PRIORITY_SLA, Ticket } from './ticketing-data';

export interface ReviewDraftTicket {
  title: string;
  description: string;
  category: string;
  subCategory: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  studio: string;
  trainer?: string | null;
  classType?: string | null;
  classDateTime?: string | null;
  memberName?: string | null;
  memberContact?: string | null;
  reportedBy?: string | null;
  assignedTo?: string | null;
  department?: string | null;
  tags: string[];
  sentiment?: string;
  conversationSummary?: string;
}

export interface TicketReviewContext {
  memberId?: string | null;
  sessionId?: string | null;
  desiredResolution?: string | null;
  clientsAffected?: string | null;
  incidentDateTime?: string | null;
}

export interface TicketReviewConfidence {
  label: 'Classification' | 'Priority' | 'Routing' | 'SLA' | 'Momence';
  score: number;
  detail: string;
}

export interface TicketReviewSection {
  title: string;
  items: string[];
}

export interface TicketReviewInsights {
  confidence: TicketReviewConfidence[];
  routingRationale: string[];
  momenceChips: string[];
  riskSignals: string[];
  duplicateWarning?: {
    ticketId: string;
    title: string;
    status: string;
  };
  sections: TicketReviewSection[];
}

export interface BuildTicketReviewInsightsInput {
  draft: ReviewDraftTicket;
  context?: TicketReviewContext;
  momenceSummary?: MomenceInsightSummary;
  duplicateTicket?: Ticket | null;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function present(value?: string | null): boolean {
  return Boolean(value && value.trim());
}

function compact(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' · ');
}

function scoreFromChecks(checks: boolean[], base = 30): number {
  const passed = checks.filter(Boolean).length;
  return clampScore(base + (passed / checks.length) * (100 - base));
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

export function buildTicketReviewInsights({
  draft,
  context = {},
  momenceSummary,
  duplicateTicket,
}: BuildTicketReviewInsightsInput): TicketReviewInsights {
  const classificationScore = scoreFromChecks([
    present(draft.category),
    present(draft.subCategory),
    draft.category !== 'Other',
    present(draft.description),
  ], 20);
  const priorityScore = scoreFromChecks([
    Boolean(PRIORITY_SLA[draft.priority]),
    present(draft.priority),
    Boolean(draft.sentiment || context.clientsAffected),
  ], 45);
  const routingScore = scoreFromChecks([
    present(draft.department),
    present(draft.assignedTo),
    present(draft.studio),
    present(draft.reportedBy),
  ], 35);
  const slaScore = PRIORITY_SLA[draft.priority]
    ? clampScore(82 + (draft.priority === 'Critical' || draft.priority === 'High' ? 10 : 0))
    : 35;
  const momenceScore = momenceSummary
    ? scoreFromChecks([
        Boolean(momenceSummary.member || context.memberId),
        Boolean(momenceSummary.session || context.sessionId),
        Boolean(momenceSummary.membershipOverview.memberships.length || momenceSummary.bookingOverview.totalLoaded),
      ], 40)
    : 0;

  const routingRationale = [
    draft.department
      ? `Department routed to ${draft.department}.`
      : 'Department will auto-route if no department is selected.',
    draft.assignedTo
      ? `Owner set to ${draft.assignedTo}.`
      : 'Owner will auto-route if no owner is selected.',
    draft.priority
      ? `${draft.priority} priority maps to ${PRIORITY_SLA[draft.priority]?.hours ?? PRIORITY_SLA.Medium.hours}h SLA after publish.`
      : 'SLA will use default priority handling.',
    draft.studio
      ? `Studio context anchors this ticket to ${draft.studio}.`
      : 'Studio is missing, so cross-studio routing may be less precise.',
  ];

  const momenceChips = momenceSummary
    ? unique([
        momenceSummary.member?.name,
        ...((momenceSummary.member?.tags || []).slice(0, 3)),
        momenceSummary.membershipOverview.memberships[0]?.name,
        momenceSummary.membershipOverview.memberships[0]?.status === 'Frozen' ? 'Membership frozen' : undefined,
        momenceSummary.membershipOverview.memberships[0]?.creditsLabel,
        momenceSummary.membershipOverview.memberships[0]?.moneyCreditsLabel,
        momenceSummary.membershipOverview.memberships[0]?.usageLabel,
        momenceSummary.membershipOverview.memberships[0]?.freezeLabel,
        momenceSummary.bookingOverview.lastVisit ? `Last: ${momenceSummary.bookingOverview.lastVisit.classType}` : undefined,
        momenceSummary.bookingOverview.nextBooking ? `Next: ${momenceSummary.bookingOverview.nextBooking.classType}` : undefined,
        momenceSummary.session?.fillRateLabel,
        momenceSummary.session?.matchingMemberBookingId ? 'Member booked in selected session' : undefined,
        momenceSummary.noteOverview.latestNote ? 'Momence note available' : undefined,
      ])
    : [];

  const combinedRiskText = [
    draft.title,
    draft.description,
    draft.category,
    draft.subCategory,
    draft.sentiment,
    context.desiredResolution,
    ...(momenceSummary?.member?.tags || []),
    momenceSummary?.noteOverview.latestNote,
  ].filter(Boolean).join(' ').toLowerCase();
  const slaHours = PRIORITY_SLA[draft.priority]?.hours ?? PRIORITY_SLA.Medium.hours;
  const riskSignals = unique([
    /frustrat|anger|angry|refund|cancel|unhappy|dissatisf|retention|churn|not renew|renewal/.test(combinedRiskText)
      ? 'Retention risk: frustration/refund/cancellation signal needs proactive follow-up.'
      : undefined,
    draft.priority === 'Critical' || draft.priority === 'High'
      ? `SLA risk: ${draft.priority} priority ticket should be published promptly to start the ${slaHours}h SLA clock.`
      : undefined,
    duplicateTicket
      ? `Exact duplicate: existing ticket ${duplicateTicket.id} will be merged automatically on approval.`
      : undefined,
  ]);

  const sections: TicketReviewSection[] = [
    {
      title: 'Client details',
      items: unique([
        draft.memberName || 'No member selected',
        draft.memberContact || undefined,
        draft.sentiment || undefined,
        draft.description || 'No issue summary captured yet',
      ]),
    },
    {
      title: 'Routing',
      items: unique([
        compact([draft.category, draft.subCategory]),
        draft.department || 'Auto-route department',
        draft.assignedTo || 'Auto-route owner',
        draft.reportedBy ? `Documented by ${draft.reportedBy}` : undefined,
      ]),
    },
    {
      title: 'SLA',
      items: unique([
        `${draft.priority} priority`,
        `${PRIORITY_SLA[draft.priority]?.hours ?? PRIORITY_SLA.Medium.hours}h target after publish`,
        context.incidentDateTime ? `Incident: ${context.incidentDateTime}` : undefined,
      ]),
    },
    {
      title: 'Follow-up',
      items: unique([
        context.desiredResolution || 'No requested resolution captured',
        context.clientsAffected || undefined,
        momenceSummary?.noteOverview.latestNote ? `Momence note: ${momenceSummary.noteOverview.latestNote}` : undefined,
      ]),
    },
  ];

  return {
    confidence: [
      { label: 'Classification', score: classificationScore, detail: 'Category, subcategory and summary completeness' },
      { label: 'Priority', score: priorityScore, detail: 'Priority, sentiment and impact signals' },
      { label: 'Routing', score: routingScore, detail: 'Department, owner, studio and reporter readiness' },
      { label: 'SLA', score: slaScore, detail: 'Priority-to-SLA mapping readiness' },
      { label: 'Momence', score: momenceScore, detail: 'Live member/session context coverage' },
    ],
    routingRationale,
    momenceChips,
    riskSignals,
    duplicateWarning: duplicateTicket
      ? {
          ticketId: duplicateTicket.id,
          title: duplicateTicket.title,
          status: duplicateTicket.status,
        }
      : undefined,
    sections,
  };
}
