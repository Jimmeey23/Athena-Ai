import type { IssueClassification, IssueType } from './issue-classifier';
import type { MemberContextSnapshot } from './member-context-fetcher';
import type { IntakeContext } from './intake-rules';

const SPECIALIST_REQUIRED_FIELDS: Record<IssueType, string[]> = {
  refund: ['memberName', 'membership', 'description', 'desiredResolution'],
  billing: ['memberName', 'membership', 'momencePurchaseContext', 'description'],
  membership: ['memberName', 'membership', 'description', 'desiredResolution'],
  trainer: ['trainer', 'classType', 'classDateTime', 'description'],
  class_dispute: ['classType', 'classDateTime', 'description', 'clientsAffected'],
  facility: ['studio', 'description', 'incidentDateTime'],
  general: ['description'],
};

const SPECIALIST_FOCUS_NOTES: Record<IssueType, string> = {
  refund: 'Verify eligibility before promising outcomes. Confirm exact purchase, amount, and reason. Check if prior refund exists — repeat requests need escalation flag.',
  billing: 'Get exact transaction amount and date. Identify if overcharge, double-charge, or incorrect auto-renewal. Pull Momence purchase context.',
  membership: 'Confirm exact package name from Momence — do not infer. Freezes need specific start/end dates. Rollovers need expiry date and reason.',
  trainer: 'Capture: which trainer, which class, date/time, exact nature of concern. Stay neutral. Do not editorialize. Note if safety or harassment — escalate priority.',
  class_dispute: 'Get class date/time and instructor name. Understand if member was directly impacted or observed an issue. Note if class was paused, cancelled, or if member left.',
  facility: 'Assess safety risk first. Get exact location within studio. Note if workaround is in place. Mark Critical if access or safety is blocked.',
  general: 'Standard intake. Infer route and category from context. Ask for the most important missing field first.',
};

function formatMemberships(memberships: MemberContextSnapshot['memberships']): string {
  if (!memberships.length) return 'None found in Momence';
  return memberships.map((m) => {
    const parts = [m.name];
    if (m.isFrozen) parts.push('FROZEN');
    if (m.creditsRemaining != null) parts.push(`${m.creditsRemaining} credits left`);
    if (m.expiresAt) parts.push(`expires ${m.expiresAt.slice(0, 10)}`);
    return parts.join(' · ');
  }).join(' | ');
}

function formatRecentClasses(classes: MemberContextSnapshot['recentClasses']): string {
  if (!classes.length) return 'None in last 90 days';
  return classes.map((c) => {
    const parts = [c.sessionName];
    if (c.date) parts.push(c.date);
    if (c.trainer) parts.push(c.trainer);
    if (c.studio) parts.push(c.studio);
    return parts.join(' · ');
  }).join(' | ');
}

function formatRecentTickets(tickets: MemberContextSnapshot['recentTickets']): string {
  if (!tickets.length) return 'None';
  return tickets.map((t) => `${t.title} [${t.status}]`).join(' | ');
}

export function buildSpecialistPreamble(
  classification: IssueClassification,
  memberContext: MemberContextSnapshot | null,
  knownContext: Partial<IntakeContext>,
): string {
  const lines: string[] = [];

  lines.push(
    `SPECIALIST MODE: You are Athena's ${classification.specialistRole}. Issue classified as "${classification.label}" (${Math.round(classification.confidence * 100)}% confidence).`
  );

  if (memberContext) {
    lines.push('');
    lines.push(`MEMBER FILE [${memberContext.memberName}]:`);
    if (memberContext.momenceId) lines.push(`  Momence ID: ${memberContext.momenceId}`);
    lines.push(`  Active memberships: ${formatMemberships(memberContext.memberships)}`);
    lines.push(`  Recent classes: ${formatRecentClasses(memberContext.recentClasses)}`);
    lines.push(`  Past tickets: ${formatRecentTickets(memberContext.recentTickets)}`);
    if (memberContext.hasPastRefund) lines.push(`  ⚠ Prior refund/waiver on record — flag if repeat request.`);
    if (memberContext.hasOpenTickets) lines.push(`  ⚠ Open ticket(s) exist — check for duplication before logging.`);
    if (memberContext.repeatComplainant) lines.push(`  ⚠ Repeat complainant — note pattern in ticket description.`);
  } else {
    lines.push('');
    lines.push('MEMBER FILE: Not yet loaded. Ask for member name early to pull Momence context.');
  }

  // What is already known
  const knownParts: string[] = [];
  if (knownContext.studio) knownParts.push(`studio: ${knownContext.studio}`);
  if (knownContext.membership) knownParts.push(`membership: ${knownContext.membership}`);
  if (knownContext.trainer) knownParts.push(`trainer: ${knownContext.trainer}`);
  if (knownContext.classType) knownParts.push(`class: ${knownContext.classType}`);
  if (knownContext.priority) knownParts.push(`priority: ${knownContext.priority}`);
  if (knownParts.length) {
    lines.push('');
    lines.push(`ALREADY KNOWN: ${knownParts.join(', ')}`);
  }

  // What still needs to be gathered — in natural language, not field IDs
  const requiredFields = SPECIALIST_REQUIRED_FIELDS[classification.type];
  const stillNeeded = requiredFields.filter(
    (f) => !knownContext[f as keyof IntakeContext] || knownContext[f as keyof IntakeContext] === ''
  );
  const FIELD_NATURAL_DESCRIPTIONS: Record<string, string> = {
    memberName: 'which member this is about',
    membership: 'which package or membership they\'re on',
    description: 'a clear picture of what actually happened',
    desiredResolution: 'what outcome the member or reporter is looking for',
    momencePurchaseContext: 'the transaction or purchase details from Momence',
    trainer: 'which trainer or instructor is involved',
    classType: 'which class or session this relates to',
    classDateTime: 'when the class was scheduled',
    studio: 'which studio this happened at',
    incidentDateTime: 'when this occurred',
    clientsAffected: 'whether any members were directly affected',
  };
  if (stillNeeded.length) {
    const naturalDescriptions = stillNeeded.map((f) => FIELD_NATURAL_DESCRIPTIONS[f] || f.replace(/([A-Z])/g, ' $1').toLowerCase());
    lines.push(`STILL NEED TO UNDERSTAND: ${naturalDescriptions.join(', ')}`);
  }

  lines.push('');
  lines.push(`SPECIALIST FOCUS: ${SPECIALIST_FOCUS_NOTES[classification.type]}`);
  lines.push('');
  lines.push('RULES: One natural question per turn — phrase it like a colleague, not a form. Never re-ask what member context already answers. If issue type shifts mid-conversation, adapt focus. Do not state you are in specialist mode to the user — just behave accordingly.');

  return lines.join('\n');
}
