export type IssueType =
  | 'refund'
  | 'membership'
  | 'billing'
  | 'trainer'
  | 'class_dispute'
  | 'facility'
  | 'general';

export interface IssueClassification {
  type: IssueType;
  confidence: number;
  label: string;
  specialistRole: string;
}

interface Classifier {
  type: IssueType;
  pattern: RegExp;
  label: string;
  specialistRole: string;
  weight: number;
}

const CLASSIFIERS: Classifier[] = [
  {
    type: 'refund',
    pattern: /\b(refund|money back|reimburse|reimbursement|cancel.*charge|charged.*cancel|fee waiver|waiver.*refund|refund.*waiver)\b/i,
    label: 'Refund',
    specialistRole: 'refund specialist',
    weight: 10,
  },
  {
    type: 'billing',
    pattern: /\b(billing|payment|charged|charge|invoice|receipt|transaction|overcharge|double charge|autopay|auto-pay|deducted|amount|upi|neft)\b/i,
    label: 'Billing',
    specialistRole: 'billing specialist',
    weight: 9,
  },
  {
    type: 'membership',
    pattern: /\b(freeze|pause|membership|package|extension|roll.*over|rollover|renewal|upgrade|downgrade|expir|class pack|credits|cancel.*membership|auto.renew)\b/i,
    label: 'Membership',
    specialistRole: 'membership specialist',
    weight: 8,
  },
  {
    type: 'trainer',
    pattern: /\b(trainer|instructor|coach|late arrival|punctual|no.show|correction|adjustment|inappropriate|harass|behavior|behaviour|rude|feedback.*trainer|trainer.*feedback|instructor.*complaint)\b/i,
    label: 'Trainer',
    specialistRole: 'trainer relations specialist',
    weight: 8,
  },
  {
    type: 'class_dispute',
    pattern: /\b(class|session|booking|schedule|waitlist|capacity|overcrowd|cancel.*class|class.*cancel|late entry|experience|music|cue|intensity|class flow|walked out|paused)\b/i,
    label: 'Class Experience',
    specialistRole: 'class experience specialist',
    weight: 6,
  },
  {
    type: 'facility',
    pattern: /\b(repair|maintenance|broken|not working|hvac|ac\b|air con|plumbing|leak|electrical|locker|washroom|shower|door|lock|equipment|machine|bike|smell|odour|odor|pest|mold|mould)\b/i,
    label: 'Facility',
    specialistRole: 'facility & operations specialist',
    weight: 7,
  },
];

export function classifyIssue(text: string): IssueClassification {
  const lower = text.toLowerCase();
  let topMatch: Classifier | null = null;
  let topScore = 0;

  for (const classifier of CLASSIFIERS) {
    const globalPattern = new RegExp(classifier.pattern.source, 'gi');
    const matches = (lower.match(globalPattern) || []).length;
    const score = matches * classifier.weight;
    if (score > topScore) {
      topScore = score;
      topMatch = classifier;
    }
  }

  if (!topMatch || topScore < classifier_min_score(topMatch)) {
    return {
      type: 'general',
      confidence: 0.45,
      label: 'General',
      specialistRole: 'intake specialist',
    };
  }

  const confidence = Math.min(0.95, 0.55 + topScore / 60);
  return {
    type: topMatch.type,
    confidence,
    label: topMatch.label,
    specialistRole: topMatch.specialistRole,
  };
}

function classifier_min_score(c: Classifier): number {
  return c.weight;
}
