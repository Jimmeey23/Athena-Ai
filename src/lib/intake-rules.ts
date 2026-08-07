import {
  CLASS_TYPES,
  REPORTING_ASSOCIATES,
  STUDIOS,
  TRAINERS,
  getStudioAreaOptions,
} from './ticketing-data';

export type IntakePriority = 'Critical' | 'High' | 'Medium' | 'Low';

const KNOWN_MEMBERSHIP_NAMES = [
  'Barre 1 month Unlimited',
  'Barre 2 week Unlimited',
  'Barre 3 months Unlimited',
  'Barre 6 month Unlimited',
  'Barre Annual Membership',
  'Newcomers 2 For 1',
  "Owner's Special - 2 for 1",
  'powerCycle 1 month Unlimited',
  'powerCycle 2 week Unlimited',
  'powerCycle 3 months Unlimited',
  'powerCycle 6 months Unlimited',
  'powerCycle Annual Membership',
  'Strength Lab 1 month Unlimited',
  'Strength Lab 2 week Unlimited',
  'Strength Lab 3 months Unlimited',
  'Strength Lab 6 months Unlimited',
  'Strength Lab Annual Membership',
  'Studio 1 Month Unlimited Membership',
  'Studio 10 Single Class Pack',
  'Studio 12 Class Package',
  'Studio 2 Week Unlimited Membership',
  'Studio 20 Single Class Pack',
  'Studio 3 Month U/L Monthly Installment',
  'Studio 3 Month Unlimited Membership',
  'Studio 30 Single Class Pack',
  'Studio 4 Class Package',
  'Studio 6 Month Unlimited Membership',
  'Studio 8 Class Package',
  'Studio Annual Membership - Monthly Intsallment',
  'Studio Annual Unlimited Membership',
  'Studio Extended 10 Single Class Pack',
  'Studio Happy Hour Private',
  'Studio Newcomers 2 Week Unlimited Membership',
  'Studio Private - Anisha (Single Class)',
  'Studio Private Class',
  'Studio Private Class X 10',
  'Studio Privates - Anisha x 10',
  'Studio Single Class',
  'Summer Bootcamp - Studio 6 Week Unlimited',
  'Virtual Private - Anisha',
  'Virtual Private Class',
  'Virtual Private Class X 10',
  'Virtual Privates - Anisha x 10',
];

export interface IntakeContext {
  intakeRoute?: string;
  requestType?: string;
  clientsAffected?: string;
  memberId?: string;
  memberName?: string;
  memberContact?: string;
  sessionId?: string;
  studio?: string;
  trainer?: string;
  classType?: string;
  classDateTime?: string;
  reportedTime?: string;
  actualStartTime?: string;
  delayMinutes?: string;
  advanceNoticeGiven?: string;
  advanceNoticeTime?: string;
  membersAffected?: string;
  membersUpset?: string;
  latenessReason?: string;
  serviceRecoveryNeeded?: string;
  serviceRecoveryAction?: string;
  membership?: string;
  category?: string;
  subCategory?: string;
  reportedBy?: string;
  priority?: IntakePriority | string;
  description?: string;
  incidentDateTime?: string;
  desiredResolution?: string;
  urgencyReason?: string;
  memberSentiment?: string;
  resolutionRequired?: string;
  momencePurchaseContext?: string;
  classImpactType?: string;
  classImpactDetails?: string;
  freezeStartDate?: string;
  freezeEndDate?: string;
  freezeReason?: string;
  classesRemaining?: string;
  packageExpiryDate?: string;
  requestedRolloverDate?: string;
  rolloverReason?: string;
  partnerName?: string;
  hostedFeedbackArea?: string;
  attendeeCount?: string;
  prospectQuality?: string;
  followUpPreference?: string;
  initialReport?: string;
  [key: string]: string | undefined;
}

const PLACEHOLDER_VALUE_PATTERN = /unspecified|not specified|member-reported issue|ai intake|authenticated user/i;

const INTAKE_ROUTES = ['Request', 'Complaint', 'Feedback', 'Internal Reporting'];
export const RESOLUTION_REQUIRED_OPTIONS = ['Yes', 'No'] as const;
export const CLIENTS_AFFECTED_OPTIONS = [
  'Yes - directly affected',
  'Yes - indirectly affected',
  'Yes - directly and indirectly affected',
  'No clients affected',
  'Not confirmed yet',
] as const;
export const CLASS_IMPACT_TYPE_OPTIONS = [
  'Delayed start',
  'Paused during session',
  'Cancelled',
  'Moved to another space',
  'Shortened session',
  'Capacity or comfort issue',
  'Member left early',
  'Other impact',
] as const;
export const OPERATIONAL_IMPACT_OPTIONS = [
  'No immediate operational impact',
  'Equipment unavailable',
  'Member-facing session affected',
  'Staff workflow affected',
  'Safety or access risk',
  'Revenue/bookings affected',
  'Comfort or cleanliness affected',
  'Unable to determine',
] as const;
export const CURRENT_WORKAROUND_OPTIONS = [
  'No workaround currently in place',
  'Item removed from use',
  'Members redirected to alternate option',
  'Temporary signage / communication added',
  'Staff monitoring manually',
  'Vendor/team already notified',
  'Workaround not possible',
  'Unable to determine',
] as const;
export const RESOLUTION_REQUIREMENT_OPTIONS = [
  'Vendor inspection / repair required',
  'Internal operations follow-up required',
  'Replacement part or item needed',
  'Monitor and close if stable',
  'No action needed / record only',
  'Escalate to studio management',
] as const;

const STUDIO_REQUIRED_CATEGORIES = new Set([
  'Scheduling',
  'Class Experience',
  'Trainer Feedback',
  'Repair and Maintenance',
  'Studio Amenities and Facilities',
  'Safety and Security',
  'Theft and Lost Items',
  'Miscellaneous',
  'Instructor & Class Quality',
  'Booking & Schedule',
  'Facility & Equipment',
  'Front Desk & Service',
]);

export const PROTECTED_ENTITY_FIELD_IDS = [
  'memberName',
  'memberContact',
  'memberId',
  'classType',
  'classDateTime',
  'trainer',
  'sessionId',
  'membership',
] as const;

export type ProtectedEntityFieldId = typeof PROTECTED_ENTITY_FIELD_IDS[number];

export const PROTECTED_ENTITY_FIELD_SET = new Set<string>(PROTECTED_ENTITY_FIELD_IDS);

// Categories that are strictly facility/ops. A specific member/class is only relevant
// when explicitly requested by a non-physical profile.
const PHYSICAL_ONLY_CATEGORIES = new Set([
  'Repair and Maintenance',
  'Studio Amenities and Facilities',
  'Facility & Equipment',
  'Operating Systems',
  'Tech Issues',
  'App & Digital',
]);

function hasTrainerLateSignal(text: string): boolean {
  return /\b(?:late|late arrival|arrived late|started late|delayed start|punctuality|punctuality issue|tardy)\b/i.test(text)
    && /\b(?:trainer|instructor|coach|class|session|practice)\b/i.test(text);
}

type IntakeFieldType = 'select' | 'text' | 'textarea' | 'date' | 'datetime-local' | 'number';

export interface IntakeFieldDefinition {
  id: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  options?: string[];
  dependsOn?: string;
}

export interface MissingIntakeFieldOptions {
  includeClientImpact?: boolean;
}

const FIELD_DEFINITIONS: Record<string, IntakeFieldDefinition> = {
  intakeRoute: { id: 'intakeRoute', label: 'Intake Route', type: 'select', required: true, options: INTAKE_ROUTES },
  clientsAffected: {
    id: 'clientsAffected',
    label: 'Were any clients affected?',
    type: 'select',
    required: true,
    options: [...CLIENTS_AFFECTED_OPTIONS],
  },
  category: { id: 'category', label: 'Category', type: 'select', required: true },
  subCategory: { id: 'subCategory', label: 'Issue type', type: 'select', required: true, dependsOn: 'category' },
  studio: { id: 'studio', label: 'Studio', type: 'select', required: true, options: [...STUDIOS] },
  incidentDateTime: { id: 'incidentDateTime', label: 'When did this occur?', type: 'datetime-local', required: true },
  reportedBy: { id: 'reportedBy', label: 'Documented By', type: 'select', required: true, options: [...REPORTING_ASSOCIATES] },
  priority: { id: 'priority', label: 'Priority', type: 'select', required: true, options: ['Critical', 'High', 'Medium', 'Low'] },
  description: { id: 'description', label: 'Issue summary', type: 'textarea', required: true },
  memberName: { id: 'memberName', label: 'Member', type: 'text', required: true },
  memberContact: { id: 'memberContact', label: 'Member Contact', type: 'text' },
  sessionId: { id: 'sessionId', label: 'Momence Session', type: 'text' },
  classType: { id: 'classType', label: 'Momence Class / Session', type: 'select', required: true },
  trainer: { id: 'trainer', label: 'Instructor', type: 'select', options: [...TRAINERS] },
  reportedTime: { id: 'reportedTime', label: 'Reported time', type: 'datetime-local', required: true },
  actualStartTime: { id: 'actualStartTime', label: 'Actual start time', type: 'datetime-local', required: true },
  delayMinutes: { id: 'delayMinutes', label: 'Delay in minutes', type: 'number', required: true },
  advanceNoticeGiven: {
    id: 'advanceNoticeGiven',
    label: 'Was the late arrival pre-informed by the instructor?',
    type: 'select',
    required: true,
    options: ['Yes - before scheduled start', 'Yes - after scheduled start', 'No advance notice', 'Unable to confirm'],
  },
  advanceNoticeTime: { id: 'advanceNoticeTime', label: 'Advance notice time', type: 'datetime-local' },
  membersAffected: { id: 'membersAffected', label: 'Members affected', type: 'textarea', required: true },
  membersUpset: { id: 'membersUpset', label: 'Members upset / reaction', type: 'textarea', required: true },
  latenessReason: { id: 'latenessReason', label: 'Reason for late arrival', type: 'textarea', required: true },
  serviceRecoveryNeeded: {
    id: 'serviceRecoveryNeeded',
    label: 'Was service recovery needed?',
    type: 'select',
    required: true,
    options: ['Yes', 'No', 'Unable to confirm'],
  },
  serviceRecoveryAction: { id: 'serviceRecoveryAction', label: 'Service recovery action', type: 'textarea' },
  membership: { id: 'membership', label: 'Active Package / Membership', type: 'select', required: true },
  desiredResolution: { id: 'desiredResolution', label: 'Requested resolution', type: 'textarea' },
  memberSentiment: { id: 'memberSentiment', label: 'Member Sentiment', type: 'select' },
  resolutionRequired: {
    id: 'resolutionRequired',
    label: 'Does this ticket require a resolution?',
    type: 'select',
    required: true,
    options: [...RESOLUTION_REQUIRED_OPTIONS],
  },
  momencePurchaseContext: {
    id: 'momencePurchaseContext',
    label: 'Momence purchase/payment context',
    type: 'textarea',
    required: true,
  },
  classImpactType: {
    id: 'classImpactType',
    label: 'What type of class/session impact was reported?',
    type: 'select',
    required: true,
    options: [...CLASS_IMPACT_TYPE_OPTIONS],
  },
  classImpactDetails: {
    id: 'classImpactDetails',
    label: 'How was the class/session affected?',
    type: 'textarea',
    required: true,
  },
  freezeStartDate: { id: 'freezeStartDate', label: 'Requested Freeze Start Date', type: 'date', required: true },
  freezeEndDate: { id: 'freezeEndDate', label: 'Requested Freeze End Date', type: 'date', required: true },
  freezeReason: { id: 'freezeReason', label: 'Freeze Reason Stated by Member', type: 'select', required: true },
  classesRemaining: { id: 'classesRemaining', label: 'Classes / Credits Remaining', type: 'number' },
  packageExpiryDate: { id: 'packageExpiryDate', label: 'Current Package Expiry Date', type: 'date' },
  requestedRolloverDate: { id: 'requestedRolloverDate', label: 'Requested Roll Over / Extension Date', type: 'date', required: true },
  rolloverReason: { id: 'rolloverReason', label: 'Roll Over Reason', type: 'select', required: true },
  partnerName: { id: 'partnerName', label: 'Hosted Class Partner / Influencer', type: 'text', required: true },
  hostedFeedbackArea: { id: 'hostedFeedbackArea', label: 'Hosted Class Feedback Area', type: 'select', required: true },
  prospectQuality: { id: 'prospectQuality', label: 'Prospect Quality / Conversion Signal', type: 'select' },
  followUpPreference: { id: 'followUpPreference', label: 'Follow-up Preference Indicated', type: 'select' },
  machineSymptom: {
    id: 'machineSymptom',
    label: 'Machine symptom observed',
    type: 'select',
    required: true,
    options: ['Will not turn on', 'Not draining', 'Not spinning', 'Leaking water', 'Electrical issue', 'Excess noise or vibration', 'Other / unsure'],
  },
  bikeSymptom: {
    id: 'bikeSymptom',
    label: 'Bike issue observed',
    type: 'select',
    required: true,
    options: ['Console or power not responding', 'Resistance not adjusting', 'Pedal or crank issue', 'Seat or handlebar issue', 'Loose part', 'Excess noise or vibration', 'Other / unsure'],
  },
  equipmentSymptom: {
    id: 'equipmentSymptom',
    label: 'Equipment issue observed',
    type: 'select',
    required: true,
    options: ['Not working / unusable', 'Loose or broken part', 'Electrical issue', 'Missing part or accessory', 'Excess noise or vibration', 'Other / unsure'],
  },
  hvacSymptom: {
    id: 'hvacSymptom',
    label: 'HVAC issue observed',
    type: 'select',
    required: true,
    options: ['Not cooling', 'Not heating', 'No airflow', 'Water leakage', 'Noise / vibration', 'Remote or control issue', 'Other / unsure'],
  },
  lockerNumber: {
    id: 'lockerNumber',
    label: 'Locker number or specific section',
    type: 'text',
    required: false,
  },
  valuablesMissing: {
    id: 'valuablesMissing',
    label: 'Were any personal valuables or items missing?',
    type: 'select',
    required: true,
    options: ['No valuables missing', 'Yes - valuables or cash missing', 'Uncertain / under investigation'],
  },
  photoEvidenceAvailable: {
    id: 'photoEvidenceAvailable',
    label: 'Is photo/image evidence available?',
    type: 'select',
    required: true,
    options: ['Yes - photo attached / available', 'No photo available', 'Requested from staff / member'],
  },
  hygieneArea: {
    id: 'hygieneArea',
    label: 'Specific studio area affected',
    type: 'select',
    required: true,
    options: ['Locker room', 'Washroom / Showers', 'Main Studio 1', 'Studio 2', 'Strength Studio', 'Reception / Lounge', 'Other studio area'],
  },
  lockFaultType: {
    id: 'lockFaultType',
    label: 'Door or lock fault type',
    type: 'select',
    required: true,
    options: ['Will not close', 'Will not open', 'Latch not catching', 'Key/card access failing', 'Handle loose or broken', 'Hinge issue', 'Other / unsure'],
  },
  accessStatus: {
    id: 'accessStatus',
    label: 'Current access status',
    type: 'select',
    required: true,
    options: ['Access open and usable', 'Access restricted but workaround available', 'Area cannot be secured', 'Area cannot be accessed', 'Unknown'],
  },
  securityRisk: {
    id: 'securityRisk',
    label: 'Security or safety risk',
    type: 'select',
    required: true,
    options: ['No immediate risk', 'Member/staff safety risk', 'Area cannot be secured overnight', 'Fire/access compliance risk', 'Unknown'],
  },
  plumbingSymptom: {
    id: 'plumbingSymptom',
    label: 'Plumbing symptom observed',
    type: 'select',
    required: true,
    options: ['Leak', 'Drain clogged', 'Overflow', 'No water', 'Low pressure', 'Flush issue', 'Odour/sewage concern', 'Other / unsure'],
  },
  electricalSymptom: {
    id: 'electricalSymptom',
    label: 'Electrical or lighting symptom',
    type: 'select',
    required: true,
    options: ['Light not working', 'Flickering light', 'Socket not working', 'Exposed/loose wiring', 'Trip or power loss', 'Other / unsure'],
  },
  affectedArea: { id: 'affectedArea', label: 'Affected area inside the studio', type: 'select', required: true, options: getStudioAreaOptions() },
  operationalImpact: {
    id: 'operationalImpact',
    label: 'Operational impact right now',
    type: 'select',
    required: true,
    options: [...OPERATIONAL_IMPACT_OPTIONS],
  },
  currentWorkaround: {
    id: 'currentWorkaround',
    label: 'Temporary workaround currently in place',
    type: 'select',
    required: true,
    options: [...CURRENT_WORKAROUND_OPTIONS],
  },
  resolutionRequirement: {
    id: 'resolutionRequirement',
    label: 'Expected resolution or vendor action needed',
    type: 'select',
    required: true,
    options: [...RESOLUTION_REQUIREMENT_OPTIONS],
  },
  appIssueSurface: {
    id: 'appIssueSurface',
    label: 'Digital surface affected',
    type: 'select',
    required: true,
    options: ['Momence app', 'Website', 'Payment gateway', 'iPad / check-in device', 'Wi-Fi / router', 'Other digital system'],
  },
  appErrorObserved: { id: 'appErrorObserved', label: 'Error message or behavior observed', type: 'textarea', required: true },
  deviceContext: { id: 'deviceContext', label: 'Device, browser, app version, or account context', type: 'text' },
};

export function getIntakeFieldDefinition(id: string): IntakeFieldDefinition | undefined {
  return FIELD_DEFINITIONS[id];
}

export function isProtectedEntityField(id: string): boolean {
  return PROTECTED_ENTITY_FIELD_SET.has(id);
}

const CLASS_CONTEXT_CATEGORIES = new Set([
  'Scheduling',
  'Class Experience',
  'Trainer Feedback',
  'Instructor & Class Quality',
  'Booking & Schedule',
]);

function hasConfirmedAffectedClients(value?: string): boolean {
  return /^yes\b/i.test(value?.trim() || '');
}

function hasNamedPersonRequestReference(text: string): boolean {
  const value = text.trim().replace(/\s+/g, ' ');
  if (/^(front desk|studio team|ops team|sales team|team member|instructor|trainer|manager)\b/i.test(value)) return false;
  return /^[a-z][a-z'.-]+\s+[a-z][a-z'.-]+(?:\s+[a-z][a-z'.-]+)?\s+(?:is\s+)?(?:asking|asked|requesting|requested|wants|wanted|would like|needs)\b/i.test(value);
}

function hasPersonalCommercialReference(text: string): boolean {
  return /\b(member|client|customer|guest|prospect)\b/i.test(text) ||
    /\b(she|he|her|his|their)\b/i.test(text) ||
    hasNamedPersonRequestReference(text);
}

function shouldRequireNamedMemberContext(context: IntakeContext, issueText: string): boolean {
  if (!isMissingIntakeValue(context.memberId) || !isMissingIntakeValue(context.memberName)) return false;

  const category = context.category || '';
  if (PHYSICAL_ONLY_CATEGORIES.has(category)) return false;

  const entityText = [
    context.initialReport,
    context.description,
    context.requestType,
  ].filter(Boolean).join(' ').toLowerCase();
  const lower = [
    entityText,
    context.intakeRoute,
    context.category,
    context.subCategory,
  ].filter(Boolean).join(' ').toLowerCase();

  const mentionsMember = hasPersonalCommercialReference(entityText);
  const needsPersonalFollowUp =
    /refund|billing|payment|membership|package|freeze|roll\s?over|extension|renewal|cancel|complain|complaint|follow-up|follow up|contact|whatsapp|email|phone|profile|account/.test(lower);

  return mentionsMember && needsPersonalFollowUp;
}

function shouldRequireComplaintResolution(context: IntakeContext, issueText: string): boolean {
  if (!isMissingIntakeValue(context.desiredResolution)) return false;
  if (!shouldRequireNamedMemberContext({ ...context, memberId: undefined, memberName: undefined }, issueText)) return false;

  const lower = [
    context.initialReport,
    context.description,
    context.requestType,
    context.category,
    context.subCategory,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/wants?\s+(a\s+)?(follow-?up|call|email|whatsapp|refund|waiver|extension|credit)|requested\s+(a\s+)?(follow-?up|call|email|whatsapp|refund|waiver|extension|credit)/.test(lower)) {
    return false;
  }

  return /complain|complaint|refund|billing|payment|delay|not resolved|follow-?up/.test(lower);
}

const STANDARD_CONTEXT_DETAIL_KEYS = new Set([
  'intakeRoute',
  'requestType',
  'clientsAffected',
  'memberId',
  'memberName',
  'memberContact',
  'sessionId',
  'studio',
  'trainer',
  'classType',
  'classDateTime',
  'membership',
  'category',
  'subCategory',
  'reportedBy',
  'priority',
  'description',
  'incidentDateTime',
  'desiredResolution',
  'urgencyReason',
  'memberSentiment',
  'resolutionRequired',
  'momencePurchaseContext',
  'classImpactType',
  'classImpactDetails',
  'freezeStartDate',
  'freezeEndDate',
  'freezeReason',
  'classesRemaining',
  'packageExpiryDate',
  'requestedRolloverDate',
  'rolloverReason',
  'partnerName',
  'hostedFeedbackArea',
  'attendeeCount',
  'prospectQuality',
  'followUpPreference',
  'initialReport',
]);

function hasSpecificConcernDetail(text?: string): boolean {
  const value = text?.trim().toLowerCase() || '';
  if (!value) return false;

  return /\b(?:because|due to|since|as\s+(?:she|he|they|the member|client))\b/.test(value)
    || /\b(?:overcrowd|too\s+loud|music|unhappy|dissatisfied|poor|denied|dirty|unclean|hot|cold|unsafe|injur|pain|not\s+(?:received|resolved|allowed|working|happy)|unable|could\s+not|wasn['’]?t|isn['’]?t)\b/.test(value);
}

function hasSupplementalIssueSpecifics(context: IntakeContext): boolean {
  return Object.entries(context).some(([key, value]) => {
    if (STANDARD_CONTEXT_DETAIL_KEYS.has(key)) return false;
    if (isMissingIntakeValue(value)) return false;
    const normalizedKey = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_:-]+/g, ' ')
      .toLowerCase();
    const normalizedValue = String(value).trim();
    if (normalizedValue.length < 5) return false;

    return /\b(?:reason|why|because|concern|issue|problem|experience|feedback|dissatisfaction|impact)\b/.test(normalizedKey)
      || hasSpecificConcernDetail(normalizedValue);
  });
}

function shouldRequireFullIssueSummary(context: IntakeContext, issueText: string): boolean {
  const description = context.description?.trim() || '';
  if (!description) return true;
  if (!shouldRequireNamedMemberContext({ ...context, memberId: undefined, memberName: undefined }, issueText)) return false;

  const lower = [
    context.initialReport,
    context.description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (description.length >= 60) return false;
  if (!/complain|complaint|refund|billing|payment|delay|not resolved/.test(lower)) return false;

  return !hasSpecificConcernDetail(description) && !hasSupplementalIssueSpecifics(context);
}

export function isMissingIntakeValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  return !normalized || PLACEHOLDER_VALUE_PATTERN.test(normalized);
}

// Physical/facility issues that require detailed operational context before the description
// is considered complete. Short initial reports for these are captured as preliminary only.
const HVAC_TEXT_PATTERN = /\b(?:ac|hvac)\b|air\s?con|air conditioning|not cooling|not heating|no airflow/i;
const PHYSICAL_ISSUE_TEXT_PATTERN = /repair|maintenance|broken|not working|not closing|not opening|stopped working|won't close|won't open|not cooling|not heating|too hot|too cold|very hot|very cold|temperature|malfunction|faulty|damaged|come off|came off|loose|leak|leaking|plumbing|drain|clog|flush|sewage|socket|electrical|bulb|fused|flickering|machine|washing|dryer|pump|pest|mold|damp|\bdoor\b|\block\b|\bhandle\b|hinge|ceiling|wall|skirting|baseboard|trim|panel|crack|odour|odor|smell|stench|ventilation|locker|shower|washroom|toilet|steam|\bac\b|hvac|air\s?con|app crash|login issue|website down/i;

const STUDIO_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:bandra|supreme|supreme hq|hq)\b/i, 'Supreme HQ, Bandra'],
  [/\b(?:kemps|kemps corner|kc|kwality|kwality house)\b/i, 'Kwality House, Kemps Corner'],
  [/\b(?:kenkere|blr|bangalore|bengaluru)\b/i, 'Kenkere House, Bengaluru'],
  [/\b(?:copper|cloves|copper and cloves|copper & cloves)\b/i, 'the Studio by Copper & Cloves, Bengaluru'],
  [/\b(?:courtside|court side)\b/i, 'Courtside, Mumbai'],
];

const CLASS_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:mat|mat57|mat\s*57)\b(?:\s+(?:class|session))?/i, 'Studio Mat 57'],
  [/\b(?:barre|barre57|barre\s*57|signature)\b(?:\s+(?:class|session))?/i, 'Studio Barre 57'],
  [/\b(?:pc|power\s*cycle|powercycle|cycle|spin)\b(?:\s+(?:class|session|room|studio))?/i, 'Studio PowerCycle'],
  [/\b(?:bb|bbb|back\s*body|back\s*body\s*blaze)\b(?:\s+(?:class|session))?/i, 'Studio Back Body Blaze'],
  [/\b(?:strength|strength\s*lab|sl)\b(?:\s+(?:class|session))?/i, 'Studio Strength Lab'],
  [/\b(?:hiit)\b(?:\s+(?:class|session))?/i, 'Studio HIIT'],
  [/\b(?:fit)\b(?:\s+(?:class|session))?/i, 'Studio FIT'],
  [/\b(?:recovery|stretch)\b(?:\s+(?:class|session))?/i, 'Studio Recovery'],
  [/\b(?:foundations|foundation)\b(?:\s+(?:class|session))?/i, 'Studio Foundations'],
];

const AREA_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:studio\s*1|s1|main studio)\b/i, 'Studio 1'],
  [/\b(?:studio\s*2|s2|second studio)\b/i, 'Studio 2'],
  [/\b(?:studio\s*3|s3|third studio)\b/i, 'Studio 3'],
  [/\b(?:strength room|strength studio|strength lab)\b/i, 'Strength Studio'],
  [/\b(?:pc room|power\s*cycle room|powercycle room|cycle room|power\s*cycle studio|powercycle studio)\b/i, 'powerCycle studio'],
  [/\b(?:his washroom|mens washroom|men's washroom|his space)\b/i, 'his space'],
  [/\b(?:her washroom|ladies washroom|women's washroom|her space)\b/i, 'her space'],
  [/\b(?:reception|front desk|fd)\b/i, 'reception'],
  [/\b(?:entrance|studio entrance)\b/i, 'studio entrance'],
  [/\b(?:lift|lift area|elevator)\b/i, 'lift area'],
];

function buildIssueText(context: IntakeContext, extraText = ''): string {
  return [
    extraText,
    context.initialReport,
    context.requestType,
    context.category,
    context.subCategory,
    context.description,
  ].filter(Boolean).join(' ').toLowerCase();
}

function findPatternValue(patterns: Array<[RegExp, string]>, text: string): string | undefined {
  return patterns.find(([pattern]) => pattern.test(text))?.[1];
}

function normalizeAliasText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferTrainerAlias(text: string): string | undefined {
  const normalizedText = ` ${normalizeAliasText(text)} `;
  const matches = TRAINERS.filter((trainer) => {
    const [firstName, ...rest] = trainer.split(/\s+/);
    const first = normalizeAliasText(firstName || '');
    const full = normalizeAliasText(trainer);
    const surname = normalizeAliasText(rest.join(' '));
    return (first && normalizedText.includes(` ${first} `)) ||
      (surname && normalizedText.includes(` ${surname} `)) ||
      (full && normalizedText.includes(` ${full} `));
  });
  if (matches.length === 1) return matches[0];

  const exactFull = TRAINERS.find((trainer) => normalizedText.includes(` ${normalizeAliasText(trainer)} `));
  return exactFull;
}

function normalizeAreaForStudio(area: string, studio?: string): string {
  const options = getStudioAreaOptions(studio);
  const exact = options.find((option) => normalizeAliasText(option) === normalizeAliasText(area));
  if (exact) return exact;
  if (/powercycle|power cycle/i.test(area)) {
    return options.find((option) => /powercycle|power cycle/i.test(option)) || area;
  }
  if (/studio 1/i.test(area)) {
    return options.find((option) => /^studio 1$/i.test(option)) || area;
  }
  if (/studio 2/i.test(area)) {
    return options.find((option) => /studio\s*(?:-|2)|studio 2/i.test(option)) || area;
  }
  if (/studio 3/i.test(area)) {
    return options.find((option) => /^studio 3$/i.test(option)) || area;
  }
  return area;
}

function inferClassAlias(text: string): string | undefined {
  const alias = findPatternValue(CLASS_ALIAS_PATTERNS, text);
  if (!alias) return undefined;
  return CLASS_TYPES.find((classType) => classType === alias) || alias;
}

function hasAffectedClassSignal(context: IntakeContext, issueText: string): boolean {
  const value = [
    issueText,
    context.initialReport,
    context.description,
    context.operationalImpact,
    context.currentWorkaround,
    context.classImpactType,
    context.classImpactDetails,
  ].filter(Boolean).join(' ').toLowerCase();

  return /\b(?:classes?|sessions?|schedule)\b.{0,36}\b(?:affected|impacted|delayed|paused|cancelled|canceled|moved|disrupted)\b/.test(value)
    || /\b(?:affected|impacted|delayed|paused|cancelled|canceled|moved|disrupted)\b.{0,36}\b(?:classes?|sessions?|schedule)\b/.test(value)
    || /\bclass flow\b|\bfull class\b|\bhad to pause\b|\bmembers?\s+stepped out\b|\bwalked out\b/.test(value);
}

function normalizeMembershipText(value: string): string {
  return value
    .toLowerCase()
    .replace(/owner['’]s/g, 'owners')
    .replace(/\bu\/l\b/g, 'unlimited')
    .replace(/\bintsallment\b/g, 'installment')
    .replace(/\bmonths\b/g, 'month')
    .replace(/\bclasses\b/g, 'class')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferMembershipFromText(text: string): string | undefined {
  const normalizedText = normalizeMembershipText(text);
  if (!normalizedText) return undefined;

  const directMatch = KNOWN_MEMBERSHIP_NAMES.find((membership) =>
    normalizedText.includes(normalizeMembershipText(membership))
  );
  if (directMatch) return directMatch;

  const methodPrefix =
    /\bpower cycle\b.{0,36}\b(?:annual|year|6 month|3 month|2 week|1 month|unlimited|membership|package)\b/.test(normalizedText) ? 'powerCycle'
      : /\bstrength lab\b.{0,36}\b(?:annual|year|6 month|3 month|2 week|1 month|unlimited|membership|package)\b/.test(normalizedText) ? 'Strength Lab'
        : /\bbarre\b.{0,36}\b(?:annual|year|6 month|3 month|2 week|1 month|unlimited|membership|package)\b/.test(normalizedText) ? 'Barre'
          : 'Studio';

  const duration =
    /\bannual|year\b/.test(normalizedText) ? 'annual'
      : /\b6\s*month\b/.test(normalizedText) ? '6 month'
        : /\b3\s*month\b/.test(normalizedText) ? '3 month'
          : /\b2\s*week\b/.test(normalizedText) ? '2 week'
            : /\b1\s*month\b/.test(normalizedText) ? '1 month'
              : undefined;
  if (!duration) return undefined;

  const packageKind =
    /\bunlimited|u l\b/.test(normalizedText) ? 'unlimited'
      : /\bsingle\s*class|class\s*pack|package\b/.test(normalizedText) ? 'package'
        : undefined;
  if (!packageKind) return undefined;

  let candidates = KNOWN_MEMBERSHIP_NAMES.filter((membership) => {
    const normalizedMembership = normalizeMembershipText(membership);
    return normalizedMembership.includes(normalizeMembershipText(methodPrefix)) &&
      normalizedMembership.includes(duration) &&
      normalizedMembership.includes(packageKind);
  });

  if (/\bunlimited\b/.test(normalizedText) && !/\binstallment\b/.test(normalizedText)) {
    const nonInstallment = candidates.filter((membership) => !/\binstall?ment|intsallment/i.test(membership));
    if (nonInstallment.length) candidates = nonInstallment;
  }

  return candidates[0] || undefined;
}

function getIssueProfileFieldIds(context: IntakeContext): string[] {
  const userText = [context.initialReport, context.description].filter(Boolean).join(' ');
  const category = context.category || '';
  const subCategory = context.subCategory || '';

  if (!PHYSICAL_ONLY_CATEGORIES.has(category)) return [];

  const bikeIssue = /\b(?:bike|spin bike|cycle bike|powercycle bike|power cycle bike)\b|\bbike\s*(?:no|number|#)?\s*\d+\b/i.test(userText);
  if (bikeIssue) {
    return ['bikeSymptom', 'resolutionRequirement'];
  }

  const laundryMachineIssue = /washing|washer|laundry|dryer|machine/i.test(userText);
  if (laundryMachineIssue) {
    return ['machineSymptom', 'resolutionRequirement'];
  }

  if (/^Broken Equipment(?: Not Repaired)?$/i.test(subCategory) || /equipment|method tool|tool|prop|mat|weights?|ball|barre|station/i.test(userText)) {
    return ['equipmentSymptom', 'resolutionRequirement'];
  }

  if (/\b(?:clean|cleanliness|dirty|hygiene|unclean|mess|trash|litter|spill|stain|dust|trashcan|garbage|odour|odor|smell|stench)\b/i.test(userText)) {
    return ['hygieneArea', 'photoEvidenceAvailable', 'resolutionRequirement'];
  }

  if (/\b(?:locker|lockers)\b/i.test(userText)) {
    return ['lockerNumber', 'valuablesMissing', 'photoEvidenceAvailable', 'resolutionRequirement'];
  }

  if (/\b(?:door|locks?|locked|unlock|unlocked|latch|handle|hinge|keypad|doorlock|access card)\b/i.test(userText) || subCategory === 'Door Lock Issues') {
    return ['lockFaultType', 'accessStatus', 'securityRisk', 'resolutionRequirement'];
  }

  if (HVAC_TEXT_PATTERN.test(userText) || subCategory === 'AC and HVAC Issues') {
    return ['hvacSymptom', 'affectedArea', 'resolutionRequirement'];
  }

  if (/plumbing|leak|drain|clog|flush|sewage|overflow|pipe|water/i.test(userText) || subCategory === 'Plumbing Leaks') {
    return ['plumbingSymptom', 'affectedArea', 'resolutionRequirement'];
  }

  if (/light|lighting|bulb|fused|flickering|electrical|socket|wiring|power|trip/i.test(userText) || subCategory === 'Lighting Issues') {
    return ['electricalSymptom', 'affectedArea', 'resolutionRequirement'];
  }

  if (/app|website|login|password|payment gateway|momence|sync|qr|ipad|wi-?fi|wifi|router/i.test(userText) || category === 'App & Digital' || category === 'Tech Issues') {
    return ['appIssueSurface', 'appErrorObserved', 'deviceContext'];
  }

  return [];
}

export function captureMemberFeedbackFromText(text: string, context: IntakeContext): string | null {
  const value = text.trim();

  if (!isMissingIntakeValue(context.description)) return null;
  if (!value || value.length < 12) return null;
  if (INTAKE_ROUTES.some((route) => route.toLowerCase() === value.toLowerCase())) return null;
  if (/^(here are the missing details|route this as|please refine the current ticket draft|title:|priority:)/i.test(value)) {
    return null;
  }
  if (/^(member|client|studio member|guest|prospect)\s+(said|stated|reported|shared|mentioned|requested|expressed|complained|noted|asked)\s*:/i.test(value)) {
    return value;
  }

  const detailLines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (detailLines.length > 0 && detailLines.every((line) => /^[a-z][a-z\s/'&-]{1,40}:/i.test(line))) {
    return null;
  }

  // For physical/maintenance/facility issues, a brief one-liner is a STARTING POINT, not a
  // complete description. Require substantially more detail (multi-sentence or >100 chars)
  // before treating it as the captured description so the AI is prompted to collect operational detail.
  const isPhysicalIssueText = PHYSICAL_ISSUE_TEXT_PATTERN.test(value);
  if (isPhysicalIssueText) {
    const isDetailed = value.length > 100 || (/[.!?]\s/.test(value) && value.length > 60) || value.includes('\n');
    if (!isDetailed) return null; // leave description empty — AI will collect proper operational detail
  }

  const looksLikeMemberFeedback =
    value.length > 15 ||
    /member|client|community|reported|said|stated|requested|complain|feedback|concern|issue|class|studio|refund|freeze|roll|trainer|instructor|billing|payment|booking|temperature|\bac\b|hvac|air\s?con|broken|repair|maintenance|not working|malfunction|leak|clean|smell|odour|locker|washroom|shower/i.test(value);

  return looksLikeMemberFeedback ? value : null;
}

export function inferIntakeContextFromText(text: string, context: IntakeContext = {}): Partial<IntakeContext> {
  const lower = [
    text,
    context.initialReport,
    context.requestType,
    context.category,
    context.subCategory,
    context.description,
  ].filter(Boolean).join(' ').toLowerCase();
  const inferred: Partial<IntakeContext> = {};

  if (isMissingIntakeValue(context.intakeRoute)) {
    if (/hosted class|host class|post-class feedback|attendees|lead tracking|lead feedback/.test(lower)) {
      inferred.intakeRoute = 'Feedback';
    } else if (/refund|freeze|roll\s?over|extension|reschedule|request|asked|wants|would like|approval|waiver|upgrade|remove her name|share details/.test(lower)) {
      inferred.intakeRoute = 'Request';
    } else if (/complain|angry|frustrated|unhappy|not resolved|delay|issue|problem|concern|denied|walked out|missing|stolen|harass|poach/.test(lower)) {
      inferred.intakeRoute = 'Complaint';
    } else if (/reported|feedback|suggested|said|shared|mentioned|compliment|liked|loved|lead|hosted class|post-class/.test(lower)) {
      inferred.intakeRoute = 'Feedback';
    } else {
      inferred.intakeRoute = 'Internal Reporting';
    }
  }

  if (isMissingIntakeValue(context.clientsAffected)) {
    if (/\b(?:no|not|none|zero)\s+(?:client|member|guest|prospect)s?\s+(?:affected|impacted|involved)\b/.test(lower)) {
      inferred.clientsAffected = 'No clients affected';
    } else if (/\b(?:client|member|guest|prospect|community member)\b.*\b(?:complain|complained|reported|said|stated|shared|mentioned|requested|affected|impacted|upset|frustrated|angry|refund|follow[-\s]?up)\b|\b(?:complain|complained|reported|said|stated|shared|mentioned|requested)\b.*\b(?:client|member|guest|prospect|community member)\b/.test(lower)) {
      inferred.clientsAffected = 'Yes - directly affected';
    }
  }

  if (isMissingIntakeValue(context.category)) {
    if (/momence|crm|zoho|data accuracy|handover|sop|standard operating|process|workflow|payroll|performance review|finance|reconciliation|upi|marketing|campaign|collateral|partnership approval|internal operations|internal memo/.test(lower)) {
      inferred.category = 'Operating Systems';
      inferred.subCategory = /momence|crm|data/.test(lower) ? 'Momence Issues' : /payment|upi|reconciliation|finance/.test(lower) ? 'Payment Gateway Issue' : 'Technical Assistance';
    } else if (/hosted|host class|influencer|partner|lead tracking|lead feedback|guestlist|collaboration/.test(lower)) {
      inferred.category = 'Hosted Class & Partnerships';
      inferred.subCategory = /lead|sales|conversion|prospect|drop-in|share details|requested/.test(lower) ? 'Prospect Conversion Opportunity' : /swap|instructor/.test(lower) ? 'Partner Instructor Feedback' : 'Hosted Class Feedback';
    } else if (/billing|refund|payment|freeze|roll\s?over|extension|membership|package|renewal|expiry|credit|late cancellation|waiver|upgrade/.test(lower)) {
      inferred.category = 'Pricing and Memberships';
      inferred.subCategory = /freeze|pause/.test(lower) ? 'Membership Pause and Freeze Policy' : /refund|waiver/.test(lower) ? 'Refund and Cancellation Policy Issue' : /upgrade|downgrade/.test(lower) ? 'Membership Upgrade/Downgrade' : 'Class Pack Expiry Confusion';
    } else if (/injury|safety|medical|harassment|security|theft|stolen|missing cash|cash envelope|unsafe|faint|cramp|conflict/.test(lower)) {
      inferred.category = 'Safety and Security';
      inferred.subCategory = /theft|stolen|missing cash|cash envelope/.test(lower) ? 'Theft Prevention Measures' : /harass|conflict/.test(lower) ? 'Harassment Reports' : 'Personal Safety Concerns';
    } else if (
      /repair|maintenance|broken|not working|not closing|not opening|stopped working|isn't working|isnt working|won't close|won't open|malfunction|faulty|damaged|damage|come off|came off|loose|crack|cracked|leak|leaking|overflow|plumbing|drain|clog|clogged|flush|sewage|socket|electrical|wiring|bulb|fused|flickering|lights not|light not|machine|washing machine|dryer|washing|pump|generator|pest|pest control|mold|mould|damp|seepage|wall|skirting|baseboard|trim|panel|\bdoor\b|\block\b|latch|handle|hinge/.test(lower) ||
      HVAC_TEXT_PATTERN.test(lower)
    ) {
      inferred.category = 'Repair and Maintenance';
      inferred.subCategory = HVAC_TEXT_PATTERN.test(lower) ? 'AC and HVAC Issues'
        : /light|bulb|fused|flickering/.test(lower) ? 'Lighting Issues'
        : /audio|speaker|mic|sound/.test(lower) ? 'Audio System Malfunction'
        : /leak|plumbing|drain|flush|sewage|overflow|clog|pipe/.test(lower) ? 'Plumbing Leaks'
        : /pest|cockroach|rat|rodent|insect|ant/.test(lower) ? 'Pest Control Needed'
        : /\b(?:door|locks?|locked|unlock|unlocked|latch|handle|hinge|keypad|doorlock)\b/i.test(lower) ? 'Door Lock Issues'
        : /machine|washing|dryer|equipment|broken|not working|malfunction|faulty/.test(lower) ? 'Broken Equipment'
        : 'General Maintenance Delays';
    } else if (/odour|odor|smell|stench|ventilation|air quality|locker|shower|washroom|toilet|steam room|valet|parking|wi-fi|wifi|boutique|retail|amenity|amenities|cleanliness|hygiene|clean|dirty/.test(lower)) {
      inferred.category = 'Studio Amenities and Facilities';
      inferred.subCategory = /temperature|too hot|too cold|cold|hot/.test(lower) ? 'Air Quality Poor'
        : /ventilation|air quality/.test(lower) ? 'Ventilation Poor'
        : /clean|hygiene|dirty/.test(lower) ? 'Cleanliness and Hygiene'
        : /locker/.test(lower) ? 'Locker Availability'
        : /boutique|retail/.test(lower) ? 'Boutique Availability Issues'
        : /steam/.test(lower) ? 'Steam Room Not Working'
        : 'Studio Odour and Aroma';
    } else if (/temperature|too hot|too cold|air\s?con|air quality/.test(lower)) {
      // Temperature/AC comfort complaint (not a breakdown) — map to amenities, not maintenance
      inferred.category = 'Studio Amenities and Facilities';
      inferred.subCategory = 'Air Quality Poor';
    } else if (/trainer|instructor|class|music|cue|correction|adjustment|intensity|overcrowded|capacity|late start|no-show|substitute|punctual|engagement/.test(lower)) {
      inferred.category = /trainer|instructor|correction|adjustment|punctual|engagement|no-show/.test(lower) ? 'Trainer Feedback' : 'Class Experience';
      inferred.subCategory = /overcrowd|capacity/.test(lower) ? 'Overcrowding in Class' : /audio|music|loud/.test(lower) ? 'Audio Issues' : /punctual|late|no-show/.test(lower) ? 'Trainer Punctuality Issues' : /intensity/.test(lower) ? 'Class Intensity Too High/Low' : 'Class Flow and Pacing';
    } else if (/app crash|app not|app freezing|login issue|login error|password reset|push notification|booking confirmation missing|payment gateway|momence account|sync issue|profile issue|website glitch|website not|website down|qr code|ipad not|ipad issue/.test(lower)) {
      inferred.category = 'App & Digital';
      inferred.subCategory = /crash|freeze|not responding/.test(lower) ? 'App Crash'
        : /login|password/.test(lower) ? 'Login Issue'
        : /notification/.test(lower) ? 'Push Notifications'
        : /payment|gateway/.test(lower) ? 'Payment Gateway Issue'
        : /momence|sync/.test(lower) ? 'Momence Account Sync'
        : /booking confirm/.test(lower) ? 'Booking Confirmation Missing'
        : /website/.test(lower) ? 'Website Chat / Lead Form Issue'
        : 'App Crash';
    } else if (/booking|schedule|class availability|late entry|waitlist|cancelled|reschedule|timing|variety/.test(lower)) {
      inferred.category = 'Scheduling';
      inferred.subCategory = /late entry/.test(lower) ? 'Late Arrival Policy' : /availability|variety/.test(lower) ? 'Additional Classes' : /cancel/.test(lower) ? 'Last-minute Cancellations' : 'Class Capacity Issues';
    } else if (/whatsapp|call|email|response|follow-up|front desk|communication|miscommunication|details/.test(lower)) {
      inferred.category = 'Customer Service and Communication';
      inferred.subCategory = 'Delay in Response';
    } else if (/sales|lead|trial|conversion|competitor|price|drop-in|location too far|prospect/.test(lower)) {
      inferred.category = 'Sales & Consultation';
      inferred.subCategory = /competitor/.test(lower) ? 'Competitor Mentioned' : /price|drop-in/.test(lower) ? 'Prospect Price Concern' : 'Lead Quality Note';
    } else {
      inferred.category = 'General Feedback';
      inferred.subCategory = 'Other';
    }
  }

  if (isMissingIntakeValue(context.priority)) {
    if (/injury|medical|harassment|security|theft|stolen|unsafe|emergency|missing cash|40,000/.test(lower)) inferred.priority = 'Critical';
    else if (/angry|frustrated|urgent|refund|not resolved|escalat|renewal|cancel|walked out|denied|poach|high-value/.test(lower)) inferred.priority = 'High';
    else if (/complain|issue|concern|delay|request|follow-up|hosted|lead/.test(lower)) inferred.priority = 'Medium';
    else inferred.priority = 'Low';
  }

  if (!context.urgencyReason && inferred.priority) {
    inferred.urgencyReason = `Priority inferred as ${inferred.priority} from the report.`;
  }

  if (isMissingIntakeValue(context.membership)) {
    const membership = inferMembershipFromText(lower);
    if (membership) inferred.membership = membership;
  }

  if (isMissingIntakeValue(context.studio)) {
    const studio = findPatternValue(STUDIO_ALIAS_PATTERNS, lower);
    if (studio) inferred.studio = studio;
  }

  if (isMissingIntakeValue(context.classType)) {
    const classType = inferClassAlias(lower);
    if (classType) inferred.classType = classType;
  }

  if (isMissingIntakeValue(context.trainer)) {
    const trainer = inferTrainerAlias(lower);
    if (trainer) inferred.trainer = trainer;
  }

  if (isMissingIntakeValue(context.affectedArea)) {
    const area = findPatternValue(AREA_ALIAS_PATTERNS, lower);
    if (area) inferred.affectedArea = normalizeAreaForStudio(area, inferred.studio || context.studio);
  }

  // Infer delayMinutes from natural language — "30 mins late", "started 30 minutes late", etc.
  if (isMissingIntakeValue(context.delayMinutes)) {
    const delayMatch = text.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?|hrs?|hours?)\s+(?:late|delayed|behind|of delay)\b/i)
      || text.match(/\blate\s+by\s+(\d{1,3})\s*(?:min(?:ute)?s?|hrs?|hours?)\b/i)
      || text.match(/\bstarted\s+(\d{1,3})\s*(?:min(?:ute)?s?|hrs?|hours?)\s+late\b/i)
      || text.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?)\s+(?:delay|behind schedule)\b/i);
    if (delayMatch) {
      inferred.delayMinutes = delayMatch[1];
    }
  }

  // Infer latenessReason from common short answers
  if (isMissingIntakeValue(context.latenessReason)) {
    const lowerText = text.toLowerCase().trim();
    if (/^traffic$|^stuck in traffic|^bad traffic/.test(lowerText)) inferred.latenessReason = 'Traffic';
    else if (/^personal|^personal reason/.test(lowerText)) inferred.latenessReason = 'Personal reason';
    else if (/^transport|^auto|^cab|^uber|^ola|^late train|^late bus/.test(lowerText)) inferred.latenessReason = 'Transport delay';
    else if (/^unwell|^sick|^health|^not feeling/.test(lowerText)) inferred.latenessReason = 'Unwell';
    else if (/^emergency/.test(lowerText)) inferred.latenessReason = 'Emergency';
  }

  return inferred;
}

export function getMissingIntakeFields(context: IntakeContext, options: MissingIntakeFieldOptions = {}): string[] {
  const fields: string[] = [];
  const add = (field: string, value?: string | null) => {
    if (isMissingIntakeValue(value) && !fields.includes(field)) fields.push(field);
  };
  const includeClientImpact = options.includeClientImpact ?? true;

  const route = context.intakeRoute || '';
  const category = context.category || '';
  const subCategory = context.subCategory || '';

  add('intakeRoute', route);
  add('category', category);
  add('subCategory', subCategory);

  if (fields.some((field) => field === 'intakeRoute' || field === 'category' || field === 'subCategory')) {
    return fields;
  }

  if (includeClientImpact) {
    add('clientsAffected', context.clientsAffected);
  }

  const routeLower = route.toLowerCase();
  const issueText = buildIssueText(context);
  const categoryPathText = `${category} ${subCategory} ${issueText}`.toLowerCase();
  const membershipSpecific =
    /freeze|pause|roll|extension|membership|package|renewal|upgrade|downgrade|auto-renew|refund|expiry|credit|class pack|billing|payment/.test(issueText);
  const hostedSpecific = /hosted|partner|influencer|partnership/.test(issueText) || category === 'Hosted Class & Partnerships';
  const prioritySpecific =
    routeLower !== 'feedback' ||
    /safety|security|theft|repair|maintenance|tech|operating|pricing|membership|customer service|complaint|urgent|injury|hazard/.test(categoryPathText);

  // Always require studio for any physical in-studio category — no keyword guard
  if (STUDIO_REQUIRED_CATEGORIES.has(category)) {
    add('studio', context.studio);
  }

  // For physical/maintenance/amenity issues: always require when it was first noticed.
  // The AI determines all other contextual fields dynamically from the incident description.
  const isPhysicalCategory = PHYSICAL_ONLY_CATEGORIES.has(category);
  if (isPhysicalCategory) {
    add('incidentDateTime', context.incidentDateTime);
    getIssueProfileFieldIds(context).forEach((field) => add(field, context[field]));
  }

  // Only infer member requirement from text AFTER clientsAffected is answered.
  // If clientsAffected is still missing, the confirmation question must come first —
  // otherwise the AI asks for member details before confirming any member was involved.
  const clientsAffectedSettled = !isMissingIntakeValue(context.clientsAffected);
  if (clientsAffectedSettled && shouldRequireNamedMemberContext(context, issueText)) {
    add('memberName', context.memberId || context.memberName);
  }

  const requireAffectedClientSelection = hasConfirmedAffectedClients(context.clientsAffected);

  if (requireAffectedClientSelection) {
    add('memberName', context.memberId || context.memberName);
    if (hasAffectedClassSignal(context, issueText)) {
      add('sessionId', context.sessionId);
      add('classType', context.sessionId || context.classType);
      add('classImpactType', context.classImpactType);
      add('classImpactDetails', context.classImpactDetails);
    }
  }

  const trainerLateIssue =
    (category === 'Trainer Feedback' && hasTrainerLateSignal(categoryPathText)) ||
    /trainer punctuality issues/i.test(categoryPathText) ||
    hasTrainerLateSignal(issueText);
  if (trainerLateIssue) {
    add('sessionId', context.sessionId);
    add('classType', context.sessionId || context.classType);
    add('trainer', context.trainer);
    add('classDateTime', context.classDateTime);
    // reportedTime is skipped if incidentDateTime already captures when the issue was noticed
    if (isMissingIntakeValue(context.incidentDateTime)) {
      add('reportedTime', context.reportedTime);
    }
    // Only ask actualStartTime if delayMinutes is also missing — one answer covers both
    const delayKnown = !isMissingIntakeValue(context.delayMinutes);
    const startKnown = !isMissingIntakeValue(context.actualStartTime);
    if (!delayKnown && !startKnown) {
      // Ask for delay minutes (covers "how late" + implies actual start)
      add('delayMinutes', context.delayMinutes);
    } else if (!delayKnown) {
      add('delayMinutes', context.delayMinutes);
    }
    add('advanceNoticeGiven', context.advanceNoticeGiven);
    if (/yes/i.test(context.advanceNoticeGiven || '')) add('advanceNoticeTime', context.advanceNoticeTime);
    add('latenessReason', context.latenessReason);
    // Skip membersAffected if a specific member is already identified — they ARE the affected member
    const memberAlreadyIdentified = !isMissingIntakeValue(context.memberName) || !isMissingIntakeValue(context.memberId);
    if (!memberAlreadyIdentified) {
      add('membersAffected', context.membersAffected);
    }
    // membersUpset is optional context — only ask if no member frustration is already implied
    const memberSentimentKnown = !isMissingIntakeValue(context.memberSentiment) || !isMissingIntakeValue(context.membersUpset);
    if (!memberSentimentKnown && !memberAlreadyIdentified) {
      add('membersUpset', context.membersUpset);
    }
    add('serviceRecoveryNeeded', context.serviceRecoveryNeeded);
    if (/yes/i.test(context.serviceRecoveryNeeded || '')) add('serviceRecoveryAction', context.serviceRecoveryAction);
  }

  if (membershipSpecific && /select active membership|which membership|membership record|package record/.test(issueText)) {
    add('membership', context.membership);

    if (/freeze start date|freeze end date|exact freeze dates/.test(issueText)) {
      add('freezeStartDate', context.freezeStartDate);
      add('freezeEndDate', context.freezeEndDate);
      add('freezeReason', context.freezeReason);
    }

    if (/classes remaining|package expiry date|requested rollover date|exact extension date/.test(issueText)) {
      add('classesRemaining', context.classesRemaining);
      add('packageExpiryDate', context.packageExpiryDate);
      add('requestedRolloverDate', context.requestedRolloverDate);
      add('rolloverReason', context.rolloverReason);
    }
  }

  if ((CLASS_CONTEXT_CATEGORIES.has(category) || hostedSpecific) && /class|session|hosted|barre|cycle|strength|trainer|instructor|late cancellation|injury during class/.test(issueText)) {
    add('classType', context.sessionId || context.classType);
  }
  if (category === 'Trainer Feedback' && /which trainer|specific trainer|trainer name/.test(issueText)) add('trainer', context.trainer);

  if (hostedSpecific) {
    if (/which partner|partner name|influencer name|host name/.test(issueText)) add('partnerName', context.partnerName);
    if (/feedback area|prospect quality|follow-up preference/.test(issueText)) {
      add('hostedFeedbackArea', context.hostedFeedbackArea);
      add('prospectQuality', context.prospectQuality);
      add('followUpPreference', context.followUpPreference);
    }
  }

  if (shouldRequireComplaintResolution(context, issueText) || ((routeLower === 'request' || routeLower === 'complaint') && /desired resolution|requested resolution|what resolution|what does the member want/.test(issueText))) {
    add('desiredResolution', context.desiredResolution);
  }
  if ((routeLower === 'feedback' || routeLower === 'complaint') && /sentiment unclear|member sentiment|how upset|frustration level/.test(issueText)) {
    add('memberSentiment', context.memberSentiment);
  }

  add('reportedBy', context.reportedBy);
  if (prioritySpecific) add('priority', context.priority);
  // For physical/maintenance/facility categories the AI uses custom field IDs to capture
  // operational detail — not the generic 'description' field. Don't require description
  // for those categories; let the AI reason about what specific questions to ask.
  if (!isPhysicalCategory) {
    add('description', shouldRequireFullIssueSummary(context, issueText) ? '' : context.description);
  }
  // Physical categories use resolutionRequirement (vendor/ops action field) instead.
  // Asking resolutionRequired on top is redundant and adds an extra question.
  if (!isPhysicalCategory) {
    add('resolutionRequired', context.resolutionRequired);
  }

  return fields;
}

export function isIntakePublishable(context: IntakeContext): boolean {
  return getMissingIntakeFields(context).length === 0;
}

export function getIntakeFieldDefinitions(context: IntakeContext): IntakeFieldDefinition[] {
  return getMissingIntakeFields(context).map((id) => {
    const definition = FIELD_DEFINITIONS[id];
    if (definition?.id === 'affectedArea') {
      return {
        ...definition,
        options: getStudioAreaOptions(context.studio),
      };
    }
    return definition || {
      id,
      label: id.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (value) => value.toUpperCase()),
      type: 'text',
      required: true,
    };
  });
}
