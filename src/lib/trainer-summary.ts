export type TrainerSummaryTrend = 'improving' | 'declining' | 'stable' | string;

export interface TrainerSummaryInput {
  trainerName: string;
  averageScore: number;
  reviewCount: number;
  topStrengths?: string[];
  attentionAreas?: string[];
  recentFeedback?: string[];
  trend?: TrainerSummaryTrend;
  classTypes?: string[];
  studios?: string[];
}

function cleanList(values?: string[], limit = 3): string[] {
  return Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function trendPhrase(trend?: TrainerSummaryTrend): string {
  if (trend === 'improving') return 'an improving trajectory';
  if (trend === 'declining') return 'a trend that needs coaching attention';
  return 'a stable performance pattern';
}

export function buildTrainerFallbackSummary(input: TrainerSummaryInput): string {
  const trainerName = input.trainerName.trim() || 'This instructor';
  const reviewCount = Number.isFinite(input.reviewCount) ? Math.max(0, Math.round(input.reviewCount)) : 0;
  const averageScore = Number.isFinite(input.averageScore) ? Math.round(input.averageScore) : 0;
  const strengths = cleanList(input.topStrengths);
  const attentionAreas = cleanList(input.attentionAreas);
  const classTypes = cleanList(input.classTypes, 2);
  const studios = cleanList(input.studios, 2);
  const reviewLabel = `${reviewCount} assessment${reviewCount === 1 ? '' : 's'}`;
  const context = [classTypes.join(', '), studios.join(', ')].filter(Boolean).join(' across ');

  const firstSentence = `${trainerName} is averaging ${averageScore}% across ${reviewLabel}${context ? `, with recent work in ${context}` : ''}, showing ${trendPhrase(input.trend)}.`;
  const strengthSentence = strengths.length
    ? `The strongest recurring signals are ${strengths.join(', ')}.`
    : 'The profile does not yet have enough scored strengths to identify a consistent standout area.';
  const coachingSentence = attentionAreas.length
    ? `The next coaching focus should be ${attentionAreas.join(', ')}.`
    : 'Continue collecting assessments to sharpen the next coaching focus.';

  return [firstSentence, strengthSentence, coachingSentence].join(' ');
}
