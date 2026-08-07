import { getSlaState, isClosedTicket, isRecordOnlyTicket, PRIORITY_SLA, Ticket } from './ticketing-data';

export type SmartRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SmartQuickAction {
  label: string;
  prompt: string;
}

export interface SmartResolutionPlaybook {
  title: string;
  owner: string;
  steps: string[];
  suggestedReply: string;
}

export interface SmartTicketIntelligence {
  riskScore: number;
  riskLevel: SmartRiskLevel;
  urgencyExplanation: string;
  nextBestQuestions: string[];
  playbook: SmartResolutionPlaybook;
  quickActions: SmartQuickAction[];
}

export interface BuildSmartTicketIntelligenceInput {
  draft: Pick<Ticket, 'title' | 'description' | 'category' | 'subCategory' | 'priority' | 'studio' | 'assignedTo' | 'sentiment' | 'memberName' | 'memberContact' | 'classType' | 'classDateTime'>;
  similarTickets?: Ticket[];
}

export interface SmartOpsBriefing {
  topRisks: Array<{ ticketId: string; title: string; score: number; reason: string }>;
  repeatedPatterns: string[];
  studioHotspots: string[];
  ownerWarnings: string[];
  nextActions: string[];
}

export interface NaturalLanguageAnalyticsAnswer {
  title: string;
  lines: string[];
  sourceTicketIds: string[];
}

export interface SmartIntakeCopilotInput {
  context: Partial<Pick<Ticket, 'title' | 'description' | 'category' | 'subCategory' | 'priority' | 'studio' | 'memberName' | 'memberContact' | 'classType' | 'classDateTime' | 'sentiment'>>;
  currentText?: string;
  pendingFieldLabel?: string;
}

export interface SmartIntakeCopilotState {
  title: string;
  completionScore: number;
  nextQuestion: string;
  missingItems: string[];
  suggestions: string[];
  confidenceNotes: string[];
}

export interface DuplicatePatternInsights {
  exactDuplicateIds: string[];
  similarTicketIds: string[];
  patternSummary: string;
  memberRepeatSummary: string;
  recommendedAction: string;
}

export interface ResolutionAssistant {
  title: string;
  owner: string;
  slaState: ReturnType<typeof getSlaState>;
  priorityReason: string;
  suggestedMemberReply: string;
  nextActions: string[];
  closureChecklist: string[];
}

export type RecommendedResolutionDraft = Pick<Ticket, 'title' | 'description' | 'category' | 'subCategory' | 'priority' | 'studio'> & Partial<Pick<Ticket, 'assignedTo' | 'memberName' | 'memberContact' | 'classType' | 'classDateTime' | 'sentiment'>>;

function textOf(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(' ').toLowerCase();
}

function normalizeComparableText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function optimizeIntakePromptForAthena(text: string): string {
  const report = text.trim().replace(/\s+/g, ' ');
  if (!report) return '';

  const namedMemberRequest = report.match(/^(client|member)\s+(.+?)\s+wants\s+(?:a\s+)?(refund|call|whatsapp(?:\s+follow-?up)?)$/i);
  if (namedMemberRequest) {
    const [, role, rawName, rawRequest] = namedMemberRequest;
    const actor = role.toLowerCase() === 'client' ? 'Client' : 'Member';
    const name = rawName
      .toLowerCase()
      .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    const normalizedRequest = rawRequest.toLowerCase();
    const request = normalizedRequest.includes('whatsapp')
      ? 'requested a WhatsApp follow-up'
      : normalizedRequest === 'call'
        ? 'requested a call'
        : 'requested a refund';
    return `${actor} ${name} ${request}.`;
  }

  const replacements: Array<[RegExp, string]> = [
    // Studios
    [/\b(?:kemps|kemps corner|kc|kwality|kwality house)\b/gi, 'Kwality House, Kemps Corner'],
    [/\b(?:bandra|supreme|supreme hq|hq)\b/gi, 'Supreme HQ, Bandra'],
    [/\b(?:kenkere|blr|bangalore|bengaluru)\b/gi, 'Kenkere House, Bengaluru'],
    [/\b(?:copper|cloves|copper and cloves|copper & cloves)\b/gi, 'the Studio by Copper & Cloves, Bengaluru'],
    // Class types
    [/\b(?:mat|mat57|mat\s*57)\b(?:\s+(?:class|session))?/gi, 'Studio Mat 57 class'],
    [/\b(?:barre|barre57|barre\s*57|signature)\b(?:\s+(?:class|session))?/gi, 'Studio Barre 57 class'],
    [/\b(?:pc|power\s*cycle|powercycle|cycle|spin)\b(?:\s+(?:class|session|room|studio))?/gi, 'Studio PowerCycle class'],
    [/\b(?:bb|bbb|back\s*body|back\s*body\s*blaze)\b(?:\s+(?:class|session))?/gi, 'Studio Back Body Blaze class'],
    [/\b(?:strength|strength\s*lab|sl)\b(?:\s+(?:class|session))?/gi, 'Studio Strength Lab class'],
    [/\b(?:hiit)\b(?:\s+(?:class|session))?/gi, 'Studio HIIT class'],
    [/\b(?:fit)\b(?:\s+(?:class|session))?/gi, 'Studio FIT class'],
    // Staff / roles
    [/\b(?:fd|front desk|frontdesk)\b/gi, 'front desk'],
    [/\b(?:instr|instuctor|instructr)\b/gi, 'instructor'],
    [/\b(?:trn|trnr)\b/gi, 'trainer'],
    [/\b(?:mgr|mgmt)\b/gi, 'manager'],
    [/\b(?:csr|cs team)\b/gi, 'client success team'],
    [/\b(?:ops)\b/gi, 'operations'],
    // Abbreviations
    [/\bac\b/gi, 'AC'],
    [/\bw\/o\b/gi, 'without'],
    [/\bw\/ ?/gi, 'with '],
    [/\basap\b/gi, 'as soon as possible'],
    [/\bpls\b/gi, 'please'],
    [/\bplz\b/gi, 'please'],
    [/\btks\b/gi, 'thanks'],
    [/\bthx\b/gi, 'thanks'],
    [/\bappt\b/gi, 'appointment'],
    [/\bpkg\b/gi, 'package'],
    [/\bpmt\b|\bpaymt\b/gi, 'payment'],
    [/\brefnd\b/gi, 'refund'],
    [/\bcmplt\b|\bcomplnt\b/gi, 'complaint'],
    [/\bcnfm\b|\bconfm\b/gi, 'confirm'],
    [/\bwapp\b|\bwa\b(?=\s)/gi, 'WhatsApp'],
    [/\bmb\b(?=\s)/gi, 'member'],
    [/\bcls\b(?=\s)/gi, 'class'],
    [/\bsess\b(?=\s)/gi, 'session'],
    [/\binfo\b/gi, 'information'],
    [/\bavail\b/gi, 'available'],
    [/\bunavail\b/gi, 'unavailable'],
    [/\besc\b(?=\s|$)/gi, 'escalated'],
    [/\bfwd\b(?=\s|$)/gi, 'forwarded'],
    [/\bchkd\b/gi, 'checked'],
    [/\brecvd\b|\brcvd\b/gi, 'received'],
    [/\bdoc\b(?=\s|$)/gi, 'documented'],
    // Actions & states
    [/\bwants\s+(?:a\s+)?call\b/gi, 'requested a call'],
    [/\bwants\s+(?:a\s+)?whatsapp(?:\s+follow.?up)?\b/gi, 'requested a WhatsApp follow-up'],
    [/\bwants\s+(?:a\s+)?refund\b/gi, 'requested a refund'],
    [/\bwants\s+(?:a\s+)?callback\b/gi, 'requested a callback'],
    [/\bwants\s+(?:a\s+)?email\b/gi, 'requested an email follow-up'],
    [/\bneeds\s+(?:a\s+)?call\b/gi, 'needs a call'],
    [/\bask(?:ing|ed)?\s+for\s+refund\b/gi, 'requested a refund'],
    [/\btoo packed\b/gi, 'overcrowded'],
    [/\btoo hot\b/gi, 'uncomfortably hot'],
    [/\btoo cold\b/gi, 'uncomfortably cold'],
    [/\btoo loud\b/gi, 'too loud'],
    [/\btoo dark\b/gi, 'insufficiently lit'],
    [/\bsmells bad\b|\bbad smell\b/gi, 'has an unpleasant odor'],
    [/\bwas\s+not\s+working\b/gi, 'was not functioning'],
    [/\bnot\s+working\b/gi, 'not functioning'],
    [/\bbroken\b/gi, 'not functioning'],
    [/\bnot\s+cooling\b/gi, 'not cooling properly'],
    [/\bnot\s+clean\b/gi, 'not sufficiently clean'],
    [/\bdirty\b/gi, 'unclean'],
    [/\bmember says\b/gi, 'member reported'],
    [/\bclient says\b/gi, 'client reported'],
    [/\bmember mentioned\b/gi, 'member reported'],
    [/\bsaid\b/gi, 'reported'],
    [/\btold\b/gi, 'reported'],
    [/\bwasnt\b|\bwas not\b/gi, "was not"],
    [/\bcant\b|\bcannot\b/gi, "cannot"],
    [/\bdidnt\b|\bdid not\b/gi, "did not"],
    [/\bisnt\b|\bis not\b/gi, "is not"],
    [/\bwont\b|\bwill not\b/gi, "will not"],
  ];
  let optimized = replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), report);
  optimized = optimized
    .replace(/\bclass\s+class\b/gi, 'class')
    .replace(/\bsession\s+class\b/gi, 'session')
    .replace(/\bat\s+at\b/gi, 'at')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[.!?]$/.test(optimized)) optimized += '.';
  return optimized.charAt(0).toUpperCase() + optimized.slice(1);
}

function countBy<T>(items: T[], selector: (item: T) => string): Array<{ name: string; value: number }> {
  return Object.entries(items.reduce<Record<string, number>>((acc, item) => {
    const key = selector(item) || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function priorityWeight(priority: Ticket['priority']): number {
  if (priority === 'Critical') return 38;
  if (priority === 'High') return 28;
  if (priority === 'Medium') return 14;
  return 5;
}

function riskLevel(score: number): SmartRiskLevel {
  if (score >= 92) return 'Critical';
  if (score >= 72) return 'High';
  if (score >= 42) return 'Medium';
  return 'Low';
}

function ticketRiskScore(ticket: Pick<Ticket, 'title' | 'description' | 'category' | 'subCategory' | 'priority' | 'sentiment'>, similarCount = 0): number {
  const combined = textOf(ticket.title, ticket.description, ticket.category, ticket.subCategory, ticket.sentiment);
  let score = priorityWeight(ticket.priority);
  if (/refund|cancel|cancellation|not renew|renewal|churn|retention|charge|billing|payment/.test(combined)) score += 24;
  if (/angry|frustrat|upset|dissatisf|unhappy|complaint|escalat/.test(combined)) score += 18;
  if (/injur|safety|medical|theft|harass|security|fire|access/.test(combined)) score += 30;
  if (ticket.sentiment === 'Angry' || ticket.sentiment === 'Negative') score += 10;
  if (similarCount > 0) score += Math.min(16, similarCount * 8);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPlaybook(input: BuildSmartTicketIntelligenceInput, score: number): SmartResolutionPlaybook {
  const { draft } = input;
  const combined = textOf(draft.title, draft.description, draft.category, draft.subCategory);
  if (/refund|cancel|not renew|retention|angry|frustrat|dissatisf/.test(combined) || score >= 72) {
    return {
      title: 'Retention recovery',
      owner: draft.assignedTo || 'Client Success',
      steps: [
        'Acknowledge the stated concern before proposing a fix.',
        'Confirm the member requested outcome, package impact, and preferred follow-up channel.',
        'Offer one concrete next step with an owner and response deadline.',
      ],
      suggestedReply: 'Thank you for sharing this. We are reviewing the concern with the relevant team and will follow up with the next step and timeline.',
    };
  }
  if (/facility|equipment|studio|temperature|clean|maintenance|ac|tool|bike/.test(combined)) {
    return {
      title: 'Studio operations check',
      owner: draft.assignedTo || 'Operations',
      steps: [
        'Confirm the exact studio space, tool, or environmental condition reported.',
        'Route to the studio owner with the affected session and member impact.',
        'Close the loop with the member once the issue is checked or fixed.',
      ],
      suggestedReply: 'We have logged this with the studio team and will confirm once the space or tool has been checked.',
    };
  }
  return {
    title: 'Service follow-up',
    owner: draft.assignedTo || 'Studio Management',
    steps: [
      'Confirm the member feedback is captured in third-person documentation language.',
      'Check whether a Momence member and session are attached.',
      'Route the ticket with a clear next action and response owner.',
    ],
    suggestedReply: 'We have documented the feedback and routed it to the right team for follow-up.',
  };
}

export function buildRecommendedResolutionSteps(draft: RecommendedResolutionDraft): string[] {
  const riskScore = ticketRiskScore({
    title: draft.title,
    description: draft.description,
    category: draft.category,
    subCategory: draft.subCategory,
    priority: draft.priority,
    sentiment: draft.sentiment,
  });
  const playbook = buildPlaybook({ draft: draft as BuildSmartTicketIntelligenceInput['draft'] }, riskScore);
  const steps = [
    ...playbook.steps,
    draft.memberName || draft.memberContact
      ? 'Verify the linked Momence member record, active package, and preferred follow-up channel before taking action.'
      : 'Attach or explicitly mark the Momence member context unavailable before closure.',
    draft.classType || draft.classDateTime
      ? 'Confirm the selected Momence session, booking status, and class impact details are accurate.'
      : 'Attach the relevant Momence session if the issue affected a specific class, booking, or instructor touchpoint.',
    draft.priority === 'Critical' || riskScore >= 72
      ? 'Escalate same day with the owner, escalation manager, member-facing response owner, and response timeline.'
      : 'Log the owner action, internal note, and member-facing update before moving the ticket to Resolved.',
  ];

  return Array.from(new Set(steps.map((step) => step.trim()).filter(Boolean))).slice(0, 6);
}

function intakeSuggestionsFor(context: SmartIntakeCopilotInput['context'], pendingFieldLabel?: string): string[] {
  const label = String(pendingFieldLabel || '').toLowerCase();
  const combined = textOf(context.title, context.description, context.category, context.subCategory, label);
  if (/resolution|outcome|action|follow/.test(combined)) {
    return [
      'Member requested a follow-up call with the studio team.',
      'Member asked for the next available resolution timeline.',
      'Client expressed that a written update on WhatsApp would be preferred.',
    ];
  }
  if (/facility|equipment|studio|temperature|clean|maintenance|tool/.test(combined)) {
    return [
      'Member reported that the studio space affected their practice experience.',
      'Member noted the concern during their class or session.',
      'Client expressed that the studio team should inspect the space before the next visit.',
    ];
  }
  return [
    'Member reported the concern after their studio session.',
    'Member shared that this affected their overall Physique 57 experience.',
    'Client expressed a preference for follow-up through WhatsApp.',
  ];
}

export function buildIntakeCopilotState(input: SmartIntakeCopilotInput): SmartIntakeCopilotState {
  const { context } = input;
  const combined = textOf(context.title, context.description, context.category, context.subCategory, input.currentText);
  const isSessionRelated = /class|session|instructor|trainer|barre|studio|practice/.test(combined);
  const missingItems: string[] = [];
  if (!context.memberName && !context.memberContact) missingItems.push('Momence member');
  if (isSessionRelated && !context.classType && !context.classDateTime) missingItems.push('Momence session');
  if (!context.category) missingItems.push('Feedback category');
  if (!context.subCategory) missingItems.push('Specific feedback type');
  if (!context.priority) missingItems.push('Priority');
  if (!context.description && !input.currentText?.trim()) missingItems.push('Member feedback');
  const totalSignals = 6;
  const completionScore = Math.max(8, Math.min(100, Math.round(((totalSignals - missingItems.length) / totalSignals) * 100)));
  const nextQuestion = missingItems.includes('Momence member')
    ? 'Use live Momence context when member details are available.'
    : missingItems.includes('Momence session')
      ? 'Which fetched Momence session should this feedback be attached to?'
      : missingItems.includes('Member feedback')
        ? 'What did the member say in their own words?'
        : missingItems.length
          ? `Please confirm: ${missingItems[0]}.`
          : 'Ready for review. Add any verbatim member quote if available.';
  const confidenceNotes = [
    context.memberName || context.memberContact ? 'Momence member context is linked.' : 'Momence member context is still missing.',
    context.classType || context.classDateTime ? 'Momence session context is linked.' : 'Use the fetched Momence sessions field for class context.',
    isSessionRelated ? 'This appears to be session-related feedback.' : 'No strong session signal detected yet.',
  ];
  return {
    title: 'AI Intake Copilot',
    completionScore,
    nextQuestion,
    missingItems,
    suggestions: intakeSuggestionsFor(context, input.pendingFieldLabel),
    confidenceNotes,
  };
}

export function buildDuplicatePatternInsights(ticket: Ticket, tickets: Ticket[]): DuplicatePatternInsights {
  const currentTitle = normalizeComparableText(ticket.title);
  const currentDescription = normalizeComparableText(ticket.description);
  const comparableTickets = tickets.filter((candidate) => candidate.id !== ticket.id);
  const exactDuplicateIds = comparableTickets
    .filter((candidate) => normalizeComparableText(candidate.title) === currentTitle && normalizeComparableText(candidate.description) === currentDescription)
    .map((candidate) => candidate.id);
  const similarTicketIds = comparableTickets
    .filter((candidate) => {
      if (exactDuplicateIds.includes(candidate.id)) return false;
      const sameIssue = candidate.category === ticket.category && candidate.subCategory === ticket.subCategory;
      const sameMember = Boolean(ticket.memberName && candidate.memberName && normalizeComparableText(ticket.memberName) === normalizeComparableText(candidate.memberName));
      const sameStudio = Boolean(ticket.studio && candidate.studio === ticket.studio);
      const sharedWords = normalizeComparableText(`${ticket.title} ${ticket.description}`)
        .split(' ')
        .filter((word) => word.length > 4 && normalizeComparableText(`${candidate.title} ${candidate.description}`).includes(word));
      return sameIssue && (sameMember || sameStudio || sharedWords.length >= 2);
    })
    .map((candidate) => candidate.id);
  const samePatternCount = comparableTickets.filter((candidate) => candidate.category === ticket.category && candidate.subCategory === ticket.subCategory).length + 1;
  const sameMemberCount = ticket.memberName
    ? comparableTickets.filter((candidate) => normalizeComparableText(candidate.memberName) === normalizeComparableText(ticket.memberName)).length + 1
    : 0;
  const patternSummary = `${ticket.category} / ${ticket.subCategory}: ${samePatternCount} related ticket${samePatternCount === 1 ? '' : 's'} in the current set.`;
  const memberRepeatSummary = sameMemberCount
    ? `${ticket.memberName}: ${sameMemberCount} ticket${sameMemberCount === 1 ? '' : 's'} in the current set.`
    : 'No linked Momence member repeat pattern available.';
  const recommendedAction = exactDuplicateIds.length
    ? `Merge or update existing ticket ${exactDuplicateIds[0]} before creating another case.`
    : similarTicketIds.length
      ? `Link ${similarTicketIds.length} similar ticket${similarTicketIds.length === 1 ? '' : 's'} and review for a repeated issue.`
      : samePatternCount > 2
        ? 'Review this as an emerging operational pattern before assigning only as a one-off ticket.'
        : 'No duplicate action required. Continue normal routing.';
  return { exactDuplicateIds, similarTicketIds, patternSummary, memberRepeatSummary, recommendedAction };
}

export function buildResolutionAssistant(ticket: Ticket, now = Date.now()): ResolutionAssistant {
  const riskScore = ticketRiskScore(ticket);
  const level = riskLevel(riskScore);
  const slaState = getSlaState(ticket, now);
  const playbook = buildPlaybook({ draft: ticket }, riskScore);
  const memberLabel = ticket.memberName || 'the member';
  const priorityReason = `${ticket.priority} priority is ${slaState.toLowerCase()} with ${level.toLowerCase()} smart risk.`;
  const suggestedMemberReply = `${memberLabel}, thank you for sharing this with us. We have documented the concern and ${ticket.assignedTo || playbook.owner} is reviewing the next step for ${ticket.subCategory || ticket.category}.`;
  const nextActions = buildRecommendedResolutionSteps(ticket).slice(0, 5);
  const closureChecklist = [
    'Member outcome or requested resolution is documented.',
    'Owner, department, priority, and SLA rationale are clear.',
    'Momence member context is linked or explicitly marked unavailable.',
    'Momence session context is linked when session information is involved.',
    'Final member-facing response is logged before moving to Closed.',
  ];
  return {
    title: 'AI Resolution Assistant',
    owner: ticket.assignedTo || playbook.owner,
    slaState,
    priorityReason,
    suggestedMemberReply,
    nextActions,
    closureChecklist,
  };
}

export function buildSmartTicketIntelligence(input: BuildSmartTicketIntelligenceInput): SmartTicketIntelligence {
  const similarCount = input.similarTickets?.length || 0;
  const riskScore = ticketRiskScore(input.draft, similarCount);
  const level = riskLevel(riskScore);
  const slaHours = PRIORITY_SLA[input.draft.priority]?.hours ?? PRIORITY_SLA.Medium.hours;
  const missing: string[] = [];
  if (!input.draft.memberName && !input.draft.memberContact) missing.push('Which Momence member should this be attached to?');
  if (!input.draft.classType && /class|session|instructor|trainer|studio/.test(textOf(input.draft.title, input.draft.description, input.draft.category))) {
    missing.push('Which Momence session does this feedback relate to?');
  }
  if (!/resolution|refund|call|email|whatsapp|follow up|follow-up|outcome/.test(textOf(input.draft.description))) {
    missing.push('What outcome did the member request?');
  }
  const nextBestQuestions = missing.length ? missing : ['Is there any member verbatim feedback that should be added before publishing?'];
  const urgencyExplanation = `${input.draft.priority} priority maps to a ${slaHours}h SLA. Smart risk is ${level.toLowerCase()} because of sentiment, issue family, duplicate/similar context, and operational impact.`;
  return {
    riskScore,
    riskLevel: level,
    urgencyExplanation,
    nextBestQuestions,
    playbook: buildPlaybook(input, riskScore),
    quickActions: [
      { label: 'Ask next question', prompt: nextBestQuestions[0] },
      { label: 'Suggest reply', prompt: buildPlaybook(input, riskScore).suggestedReply },
      { label: 'Show similar tickets', prompt: similarCount ? `${similarCount} similar ticket(s) found.` : 'No similar tickets found in the current set.' },
      { label: 'Explain priority', prompt: urgencyExplanation },
      { label: 'Create follow-up', prompt: `Follow up with ${input.draft.memberName || 'the member'} about ${input.draft.subCategory || input.draft.category}.` },
    ],
  };
}

export function buildSmartOpsBriefing(tickets: Ticket[], now = Date.now()): SmartOpsBriefing {
  const active = tickets.filter((ticket) => !isClosedTicket(ticket));
  const scored = active
    .map((ticket) => ({
      ticket,
      score: ticketRiskScore(ticket) + (getSlaState(ticket, now) === 'Breached' ? 25 : getSlaState(ticket, now) === 'At Risk' ? 12 : 0),
    }))
    .sort((a, b) => b.score - a.score || new Date(a.ticket.slaDueAt).getTime() - new Date(b.ticket.slaDueAt).getTime());
  const patterns = countBy(active, (ticket) => `${ticket.category} / ${ticket.subCategory}`)
    .filter((row) => row.value > 1)
    .slice(0, 4)
    .map((row) => `${row.name}: ${row.value} open tickets`);
  const studios = countBy(active, (ticket) => ticket.studio)
    .slice(0, 4)
    .map((row) => `${row.name}: ${row.value} active tickets`);
  const owners = countBy(active, (ticket) => ticket.assignedTo)
    .filter((row) => row.value > 1)
    .slice(0, 4)
    .map((row) => `${row.name}: ${row.value} active tickets`);
  const topRisks = scored.slice(0, 5).map(({ ticket, score }) => ({
    ticketId: ticket.id,
    title: ticket.title,
    score: Math.min(100, score),
    reason: `${ticket.priority} · ${getSlaState(ticket, now)} · ${ticket.category}`,
  }));
  const nextActions = [
    topRisks[0] ? `Follow up on ${topRisks[0].ticketId} first: ${topRisks[0].title}` : undefined,
    patterns[0] ? `Review repeated pattern: ${patterns[0]}` : undefined,
    active.some((ticket) => getSlaState(ticket, now) === 'Breached' && !isRecordOnlyTicket(ticket)) ? 'Resolve or reassign breached SLA tickets before new low-priority work.' : undefined,
    studios[0] ? `Check studio hotspot: ${studios[0]}` : undefined,
  ].filter(Boolean) as string[];
  return { topRisks, repeatedPatterns: patterns, studioHotspots: studios, ownerWarnings: owners, nextActions };
}

export function buildNaturalLanguageAnalyticsAnswer(query: string, tickets: Ticket[]): NaturalLanguageAnalyticsAnswer {
  const normalized = query.toLowerCase();
  const studioMatch = tickets.find((ticket) => normalized.includes(ticket.studio.toLowerCase()) || ticket.studio.toLowerCase().split(',').some((part) => part.trim() && normalized.includes(part.trim())));
  const scoped = studioMatch ? tickets.filter((ticket) => ticket.studio === studioMatch.studio) : tickets;
  const rows = countBy(scoped, (ticket) => `${ticket.category} / ${ticket.subCategory}`).slice(0, 5);
  const sourceTicketIds = scoped.slice(0, 12).map((ticket) => ticket.id);
  return {
    title: studioMatch ? `Top ticket patterns for ${studioMatch.studio}` : 'Top ticket patterns in current data',
    lines: rows.length ? rows.map((row) => `${row.name}: ${row.value}`) : ['No matching tickets found for that question.'],
    sourceTicketIds,
  };
}

export function buildVoiceExtractionHints(text: string): string[] {
  if (!text.trim() || text.length < 8) return [];
  const lower = text.toLowerCase();
  const hints: string[] = [];
  // Studio detection (specific keywords only)
  if (/\b(bandra|supreme hq)\b/.test(lower)) hints.push('📍 Supreme HQ, Bandra');
  else if (/\b(kemps corner|kwality house|kemps|kwality)\b/.test(lower)) hints.push('📍 Kwality House, Kemps Corner');
  else if (/\b(bengaluru|bangalore|kenkere|kenkere house)\b/.test(lower)) hints.push('📍 Kenkere House, Bengaluru');
  else if (/\b(copper|cloves)\b/.test(lower)) hints.push('📍 Studio by Copper & Cloves');
  // Safety / urgency (only strong signals)
  if (/\b(injur|injury|injur|unsafe|harass|harassment|theft|fire|blood|emergency|fell|fracture)\b/.test(lower)) hints.push('⚡ Safety signal — mark Critical');
  else if (/\b(angry|furious|irate|refund|cancel(?:l?ation)?|lawsuit|legal|escalat)\b/.test(lower)) hints.push('⚡ High priority signal detected');
  // Class type (specific class names)
  if (/\b(barre\s*57|studio barre|power\s*cycle|powercycle|mat\s*57|studio mat|back body blaze|strength lab)\b/.test(lower)) hints.push('🏋️ Session-related ticket');
  else if (/\b(class|session|trainer|instructor)\b/.test(lower) && hints.length > 0) hints.push('🏋️ Session context detected');
  // Member name pattern (Firstname Lastname)
  const memberMatch = text.match(/\b(?:member|client)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
  if (memberMatch) hints.push(`👤 Member: ${memberMatch[1]}`);
  return Array.from(new Set(hints)).slice(0, 3);
}
