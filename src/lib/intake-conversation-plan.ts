import type { IntakeContext } from './intake-rules';

type ConversationFieldType = 'select' | 'text' | 'textarea' | 'date' | 'datetime-local' | 'number' | 'rating';

export interface ConversationPlanField {
  id: string;
  label: string;
  type: ConversationFieldType;
  options?: string[];
  required?: boolean;
}

interface BuildPlanInput {
  initialText: string;
  context?: IntakeContext;
  reporterName?: string;
}

export interface ConversationPlanStep {
  id: string;
  title: string;
  fieldIds: string[];
  reason: string;
}

export interface IntakeConversationPlan {
  reporterFirstName?: string;
  initialSignal: string;
  openingTone: string;
  followUpFieldIds: string[];
  steps: ConversationPlanStep[];
}

interface NaturalPromptInput {
  field: ConversationPlanField;
  reporterFirstName?: string;
}

function titleCase(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

export function getReporterFirstName(name?: string | null): string | undefined {
  const value = (name || '').trim();
  if (!value || /^authenticated user$/i.test(value)) return undefined;

  const candidate = value.includes('@')
    ? value.split('@')[0].split(/[._-]/)[0]
    : value.split(/\s+/)[0];

  const cleaned = candidate.replace(/[^a-zA-Z]/g, '');
  return cleaned ? titleCase(cleaned) : undefined;
}

function hasConfirmedAffectedClients(value?: string): boolean {
  return /^yes\b/i.test(value?.trim() || '');
}

function hasClassAffectedSignal(value: string): boolean {
  return /\b(?:classes?|sessions?|schedule)\b.{0,36}\b(?:affected|impacted|delayed|paused|cancelled|canceled|moved|disrupted)\b/i.test(value)
    || /\b(?:affected|impacted|delayed|paused|cancelled|canceled|moved|disrupted)\b.{0,36}\b(?:classes?|sessions?|schedule)\b/i.test(value)
    || /\bclass flow\b|\bfull class\b|\bhad to pause\b|\bmembers?\s+stepped out\b|\bwalked out\b/i.test(value);
}

function hasClientImpactSignal(value: string): boolean {
  return /\b(member|client|customer|guest|prospect|attendee|lead|complain|complaint|said|reported|requested|felt|uncomfortable|walked out|class|session|booking)\b/i.test(value);
}

function hasTrainerLateSignal(value: string): boolean {
  return /\b(?:late|late arrival|arrived late|started late|delayed start|punctuality|punctuality issue|tardy)\b/i.test(value)
    && /\b(?:trainer|instructor|coach|class|session|practice)\b/i.test(value);
}

function compactSignal(text: string): string {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value.length <= 180) return value;
  return `${value.slice(0, 177).trimEnd()}...`;
}

export function buildIntakeConversationPlan({
  initialText,
  context = {},
  reporterName,
}: BuildPlanInput): IntakeConversationPlan {
  const reporterFirstName = getReporterFirstName(reporterName);
  const combined = [
    initialText,
    context.initialReport,
    context.description,
    context.operationalImpact,
    context.currentWorkaround,
    context.classImpactType,
    context.classImpactDetails,
  ].filter(Boolean).join(' ');
  const followUpFieldIds = new Set<string>();
  const steps: ConversationPlanStep[] = [];

  steps.push({
    id: 'understand-report',
    title: 'Acknowledge the report and infer route/category/priority',
    fieldIds: ['intakeRoute', 'category', 'subCategory', 'priority'],
    reason: 'Start from the staff member details instead of route-first form selection.',
  });

  if (hasConfirmedAffectedClients(context.clientsAffected)) {
    followUpFieldIds.add('memberName');
    steps.push({
      id: 'affected-members',
      title: 'Identify affected member(s)',
      fieldIds: ['memberName'],
      reason: 'Confirmed client impact needs Momence member context before drafting.',
    });
  } else {
    followUpFieldIds.add('clientsAffected');
    steps.push({
      id: 'confirm-client-impact',
      title: 'Confirm whether any members were directly or indirectly affected',
      fieldIds: ['clientsAffected'],
      reason: 'Every ticket needs the client-impact check before drafting.',
    });
    if (hasClientImpactSignal(combined)) {
      steps.push({
        id: 'conditional-affected-members',
        title: 'If client impact is confirmed, identify affected member(s)',
        fieldIds: ['memberName'],
        reason: 'Client impact may change the required Momence follow-up path.',
      });
    }
  }

  if (hasClassAffectedSignal(combined)) {
    followUpFieldIds.add('classType');
    followUpFieldIds.add('classImpactType');
    followUpFieldIds.add('classImpactDetails');
    steps.push({
      id: 'affected-session',
      title: 'Identify affected class/session',
      fieldIds: ['classType'],
      reason: 'The report says a class or schedule was affected.',
    });
    steps.push({
      id: 'session-impact',
      title: 'Capture how the class/session was affected',
      fieldIds: ['classImpactType', 'classImpactDetails'],
      reason: 'The owner needs to know whether the session was delayed, paused, moved, cancelled, or otherwise disrupted.',
    });
  }

  if (hasTrainerLateSignal(combined) || context.subCategory === 'Trainer Punctuality Issues') {
    followUpFieldIds.add('sessionId');
    followUpFieldIds.add('classType');
    followUpFieldIds.add('trainer');
    followUpFieldIds.add('classDateTime');
    // reportedTime omitted — incidentDateTime covers it; only ask if explicitly missing
    followUpFieldIds.add('delayMinutes'); // covers actualStartTime implicitly
    followUpFieldIds.add('advanceNoticeGiven');
    followUpFieldIds.add('advanceNoticeTime');
    followUpFieldIds.add('latenessReason');
    // membersAffected only needed when no specific member is already identified
    const memberIdentified = Boolean(context.memberName || context.memberId);
    if (!memberIdentified) {
      followUpFieldIds.add('membersAffected');
    }
    // membersUpset skipped — optional supplementary context, not a blocking required field
    followUpFieldIds.add('serviceRecoveryNeeded');
    followUpFieldIds.add('serviceRecoveryAction');
    steps.push({
      id: 'trainer-session',
      title: 'Identify the affected Momence session',
      fieldIds: ['sessionId'],
      reason: 'The exact session should be identified first so the late-arrival report is attached to the right Momence record.',
    });
    steps.push({
      id: 'trainer-punctuality',
      title: 'Capture trainer punctuality details',
      fieldIds: [
        'classType',
        'trainer',
        'classDateTime',
        'delayMinutes', // one field covers delay duration; skip separate actualStartTime
        'advanceNoticeGiven',
        'advanceNoticeTime',
        'latenessReason',
        // membersAffected only if no member context
        ...(memberIdentified ? [] : ['membersAffected']),
        'serviceRecoveryNeeded',
        'serviceRecoveryAction',
      ],
      reason: 'Late arrival incidents need the session timeline, delay duration, notice given, reason, and recovery facts. Skip any field already answered in context.',
    });
  }

  steps.push({
    id: 'resolution-required',
    title: 'Confirm whether this ticket requires a resolution',
    fieldIds: ['resolutionRequired'],
    reason: 'This final gate separates actionable tickets from record-only documentation.',
  });

  steps.push({
    id: 'draft-review',
    title: 'Draft only after required context is complete',
    fieldIds: [],
    reason: 'Keep the chat conversational while preserving publish-ready ticket quality.',
  });

  return {
    reporterFirstName,
    initialSignal: compactSignal(initialText),
    openingTone: reporterFirstName
      ? `${reporterFirstName}, I'll keep this conversational and ask only for the missing details.`
      : "I'll keep this conversational and ask only for the missing details.",
    followUpFieldIds: Array.from(followUpFieldIds),
    steps,
  };
}

export function serializeConversationPlan(plan: IntakeConversationPlan): string {
  return [
    plan.initialSignal ? `Report signal: ${plan.initialSignal}` : '',
    'Investigation path:',
    ...plan.steps.map((step, index) => (
      `${index + 1}. ${step.title} — ${step.reason}`
    )),
  ].filter(Boolean).join('\n');
}

const FIELD_GAP_DESCRIPTIONS: Record<string, string> = {
  intakeRoute: 'the nature of this report (complaint, request, feedback, or internal report)',
  category: 'what category this issue falls under',
  subCategory: 'the specific type of issue',
  studio: 'which studio this happened at',
  clientsAffected: 'whether any members were affected',
  memberName: 'which member was involved',
  memberId: 'the member\'s Momence ID',
  sessionId: 'which specific Momence session this relates to',
  classType: 'which class or session was involved',
  trainer: 'which trainer or instructor was involved',
  classDateTime: 'when the class was scheduled',
  incidentDateTime: 'when exactly this happened',
  reportedTime: 'when this was first noticed or reported',
  delayMinutes: 'how long the class was delayed',
  actualStartTime: 'what time the class actually started',
  advanceNoticeGiven: 'whether the trainer gave any advance notice to the studio',
  advanceNoticeTime: 'how much notice was given before the class was due to start',
  latenessReason: 'what reason was given for the late arrival',
  membersAffected: 'how many or which members were impacted',
  membersUpset: 'how members reacted — whether anyone expressed frustration or left',
  serviceRecoveryNeeded: 'whether any service recovery was offered or needed',
  serviceRecoveryAction: 'what was done to address the situation for affected members',
  description: 'a clear description of what happened',
  desiredResolution: 'what outcome the reporter or member is looking for',
  membership: 'which membership or package is involved',
  membership_type: 'the type of membership this member holds',
  freezeStartDate: 'when the freeze should start',
  freezeEndDate: 'when the freeze should end',
  freezeReason: 'the reason for the freeze request',
  classesRemaining: 'how many classes or credits are left',
  packageExpiryDate: 'when the current package expires',
  requestedRolloverDate: 'what date the member wants the extension to',
  rolloverReason: 'the reason the member needs the extension',
  momencePurchaseContext: 'the relevant purchase or payment details from Momence',
  classImpactType: 'how the class or session was affected',
  classImpactDetails: 'the specific details of how the class was impacted',
  partnerName: 'who the hosted class partner or influencer is',
  resolutionRequired: 'whether this ticket needs an active resolution or is just for the record',
};

export function buildNarrativeGapDescription(
  missingFieldIds: string[],
  _context?: Record<string, unknown>,
): string {
  if (missingFieldIds.length === 0) return 'nothing — all details are captured';

  const descriptions = missingFieldIds
    .slice(0, 5)
    .map((id) => FIELD_GAP_DESCRIPTIONS[id] || id.replace(/([A-Z])/g, ' $1').toLowerCase().trim())
    .filter(Boolean);

  if (descriptions.length === 1) return descriptions[0];
  if (descriptions.length === 2) return `${descriptions[0]} and ${descriptions[1]}`;

  const last = descriptions.pop();
  return `${descriptions.join(', ')}, and ${last}${missingFieldIds.length > 5 ? ` (plus ${missingFieldIds.length - 5} more details)` : ''}`;
}

export function limitConversationalFieldBatch<T extends { id: string }>(fields: T[], maxFields = 1): T[] {
  const clientImpactField = fields.find((field) => field.id === 'clientsAffected');
  if (clientImpactField) return [clientImpactField];
  const resolutionRequiredField = fields.find((field) => field.id === 'resolutionRequired');
  if (resolutionRequiredField && fields.length === 1) return [resolutionRequiredField];
  const fieldsBeforeResolutionGate = resolutionRequiredField
    ? fields.filter((field) => field.id !== 'resolutionRequired')
    : fields;
  return fieldsBeforeResolutionGate.slice(0, Math.max(1, maxFields));
}

function questionFromLabel(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Can you share that detail?';
  return cleaned.endsWith('?') ? cleaned.charAt(0).toLowerCase() + cleaned.slice(1) : `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}?`;
}

export function buildNaturalSingleFieldPrompt({ field, reporterFirstName }: NaturalPromptInput): string {
  const prefix = reporterFirstName ? `${reporterFirstName}, ` : '';

  if (field.id === 'memberName') {
    return `${prefix}which affected member(s) should I link from Momence?`;
  }
  if (field.id === 'sessionId') {
    return `${prefix}which exact Momence session should this late-arrival report be attached to?`;
  }
  if (field.id === 'classType') {
    return `${prefix}which class/session was affected?`;
  }
  if (field.id === 'reportedTime') {
    return `${prefix}when was the delay first reported or noticed?`;
  }
  if (field.id === 'actualStartTime') {
    return `${prefix}when did the class actually start?`;
  }
  if (field.id === 'delayMinutes') {
    return `${prefix}how many minutes was the start delayed?`;
  }
  if (field.id === 'advanceNoticeGiven') {
    return `${prefix}did the instructor inform the studio in advance?`;
  }
  if (field.id === 'advanceNoticeTime') {
    return `${prefix}when was the advance notice shared?`;
  }
  if (field.id === 'membersAffected') {
    return `${prefix}which members or how many members were affected?`;
  }
  if (field.id === 'membersUpset') {
    return `${prefix}did any members express frustration, leave early, or raise a concern?`;
  }
  if (field.id === 'latenessReason') {
    return `${prefix}what reason was given for the late arrival?`;
  }
  if (field.id === 'serviceRecoveryNeeded') {
    return `${prefix}was service recovery needed?`;
  }
  if (field.id === 'serviceRecoveryAction') {
    return `${prefix}what service recovery was offered or taken?`;
  }
  if (field.id === 'classImpactDetails') {
    return `${prefix}what changed for the affected class/session? For example, was it delayed, paused, moved, cancelled, or did members share a specific concern?`;
  }
  if (field.id === 'classImpactType') {
    return `${prefix}what kind of class/session impact was reported?`;
  }
  if (field.id === 'description') {
    return `${prefix}what did the member or team report in their own words?`;
  }
  if (field.id === 'desiredResolution') {
    return `${prefix}what resolution or follow-up did the member ask for?`;
  }
  if (field.id === 'incidentDateTime') {
    return `${prefix}when did this happen or first get noticed?`;
  }
  if (field.id === 'resolutionRequired') {
    return `${prefix}Does this ticket require a resolution?`;
  }

  if (field.type === 'select') return `${prefix}${questionFromLabel(field.label)}`;
  return `${prefix}please share ${field.label.toLowerCase()}.`;
}
