const GREETING_PATTERN = /^(hi|hello|hey|heya|hiya|good\s+(morning|afternoon|evening)|namaste|yo)(\s+athena)?[.!?\s]*$/i;
const ISSUE_SIGNAL_PATTERN = /\b(ac|hvac|broken|not working|issue|problem|complaint|member|client|refund|billing|payment|class|session|trainer|instructor|studio|booking|schedule|maintenance|repair|leak|dirty|urgent)\b/i;

export interface GreetingQuickAction {
  label: string;
  value: string;
  field: string;
}

const GREETING_QUICK_ACTIONS: GreetingQuickAction[] = [
  { label: 'Complaint', value: 'Complaint', field: 'intakeRoute' },
  { label: 'Request', value: 'Request', field: 'intakeRoute' },
  { label: 'Feedback', value: 'Feedback', field: 'intakeRoute' },
];

export function isCasualGreeting(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (ISSUE_SIGNAL_PATTERN.test(value) && !GREETING_PATTERN.test(value)) return false;
  return GREETING_PATTERN.test(value);
}

export function getGreetingQuickActions(): GreetingQuickAction[] {
  return GREETING_QUICK_ACTIONS.map((action) => ({ ...action }));
}
