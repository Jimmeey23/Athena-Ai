import { CLASS_TYPES, STUDIOS, TRAINERS } from './ticketing-data.ts';

export type TrainerReviewTemplate = 'Barre' | 'PowerCycle' | 'StrengthFit';

export interface TrainerEvaluationScore {
  category: string;
  weightage: number;
  score: number;
}

export interface TrainerEvaluationInput {
  trainer: string;
  template: TrainerReviewTemplate;
  studio?: string;
  classType?: string;
  reviewPeriod?: string;
  scores: TrainerEvaluationScore[];
  feedback: string;
  focusPoints?: string;
  goals?: string;
  rawText?: string;
}

export interface TrainerReviewRecord extends TrainerEvaluationInput {
  id: string;
  createdAt: string;
  totalWeightage: number;
  totalScore: number;
  scorePercent: number;
  source?: string;
  sourceRef?: string;
}

export interface FilloutTrainingEvaluationMapping {
  input: TrainerEvaluationInput;
  record: TrainerReviewRecord;
  sourceRef: string;
  submissionId?: string;
  formId?: string;
  receivedAt: string;
  answers: Array<{ label: string; value: string }>;
}

export const TRAINER_REVIEW_TEMPLATES: Record<TrainerReviewTemplate, Array<{ category: string; weightage: number }>> = {
  Barre: [
    { category: 'Client attendance', weightage: 12.5 },
    { category: 'Client retention', weightage: 12.5 },
    { category: 'Client outreach, communication and connection', weightage: 12.5 },
    { category: 'Client feedback', weightage: 12.5 },
    { category: 'Mindful moment / USP integration / Motivation', weightage: 8 },
    { category: 'Musicality', weightage: 8 },
    { category: 'Energy and vocals', weightage: 8 },
    { category: 'Choreography and sequencing', weightage: 8 },
    { category: 'Learning styles and use of names', weightage: 8 },
    { category: 'Classes, workshops, meetings and core values', weightage: 10 },
  ],
  PowerCycle: [
    { category: 'Class attendance and bike fill rate', weightage: 12.5 },
    { category: 'Client retention and repeat riders', weightage: 12.5 },
    { category: 'Client outreach, communication and connection', weightage: 12.5 },
    { category: 'Client feedback', weightage: 12.5 },
    { category: 'Ride motivation / USP integration', weightage: 8 },
    { category: 'Musicality and beat matching', weightage: 10 },
    { category: 'Energy, vocals and command', weightage: 10 },
    { category: 'Ride programming and sequencing', weightage: 8 },
    { category: 'Safety, setup and form corrections', weightage: 8 },
    { category: 'Work ethics, meetings and core values', weightage: 6 },
  ],
  StrengthFit: [
    { category: 'Pre-class setup', weightage: 8 },
    { category: 'Verbal cues', weightage: 8 },
    { category: 'Visual demonstrations', weightage: 8 },
    { category: 'Injury modifications', weightage: 8 },
    { category: 'Level-appropriate personal modifications', weightage: 8 },
    { category: 'USP integration, motivation and connection', weightage: 8 },
    { category: 'Music choices', weightage: 7 },
    { category: 'Studio space and equipment organisation', weightage: 7 },
    { category: 'Time management and class flow', weightage: 7 },
    { category: 'Use of client names', weightage: 7 },
    { category: 'Overall energy', weightage: 8 },
    { category: 'Mindful moment', weightage: 8 },
    { category: 'Post-class spiel', weightage: 8 },
  ],
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeValueText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyText(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function slug(value: unknown): string {
  return keyText(value).replace(/[^a-z0-9]+/g, '');
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

function firstIdentifier(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return normalizeValueText(value);
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join(' | ');
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return stringifyValue(object.value)
      || stringifyValue(object.label)
      || stringifyValue(object.name)
      || stringifyValue(object.text)
      || stringifyValue(object.answer)
      || stringifyValue(object.email)
      || stringifyValue(object.phone)
      || JSON.stringify(value);
  }
  return '';
}

function collectAnswerPairs(input: unknown, pairs: Array<{ label: string; value: string }> = [], path: string[] = []): Array<{ label: string; value: string }> {
  if (!input || typeof input !== 'object') return pairs;
  if (Array.isArray(input)) {
    input.forEach((item, index) => collectAnswerPairs(item, pairs, [...path, String(index)]));
    return pairs;
  }

  const object = input as Record<string, unknown>;
  const label = firstString(object.name, object.label, object.title, object.question, object.key, object.id);
  const rawValue = object.value ?? object.answer ?? object.answers ?? object.text;
  const value = stringifyValue(rawValue);
  if (label && value && !/questions|answers|submission/i.test(label)) {
    pairs.push({ label, value });
  }

  for (const [key, child] of Object.entries(object)) {
    if (['value', 'answer', 'text'].includes(key)) continue;
    if (child && typeof child === 'object') {
      collectAnswerPairs(child, pairs, [...path, key]);
    } else {
      const primitiveValue = stringifyValue(child);
      if (primitiveValue && !/id|created|submitted|url|token|signature/i.test(key)) {
        pairs.push({ label: key, value: primitiveValue });
      }
    }
  }
  return pairs;
}

function collectFieldDefinitions(input: unknown, definitions: Map<string, string> = new Map()): Map<string, string> {
  if (!input || typeof input !== 'object') return definitions;
  if (Array.isArray(input)) {
    input.forEach((item) => collectFieldDefinitions(item, definitions));
    return definitions;
  }

  const object = input as Record<string, unknown>;
  const label = firstString(object.name, object.label, object.title, object.question);
  const id = firstIdentifier(object.id, object.key, object.fieldId, object.field_id, object.questionId, object.question_id);
  if (id && label && keyText(id) !== keyText(label) && !/^(name|label|title|question|type)$/i.test(label)) {
    definitions.set(id, label);
  }

  Object.values(object).forEach((child) => collectFieldDefinitions(child, definitions));
  return definitions;
}

function normalizeFilloutPairs(payload: unknown, pairs: Array<{ label: string; value: string }>): Array<{ label: string; value: string }> {
  const definitions = collectFieldDefinitions(payload);
  return pairs
    .map((pair) => ({
      label: definitions.get(pair.label) || pair.label,
      value: pair.value,
    }))
    .filter((pair) => {
      const label = keyText(pair.label);
      if (/^(name|type|id|key|field id|question id)$/.test(label)) return false;
      if (/^(date time picker|dropdown|number input|long answer|short answer|file upload|audio recording|switch|number)$/.test(keyText(pair.value))) return false;
      return true;
    });
}

function uniquePairs(pairs: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const key = `${slug(pair.label)}:${pair.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findValue(pairs: Array<{ label: string; value: string }>, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const pair = pairs.find((candidate) => pattern.test(candidate.label));
    if (pair?.value) return pair.value;
  }
  return '';
}

function findKnownValue(raw: string, values: string[]): string {
  const rawKey = keyText(raw);
  if (!rawKey) return '';
  return values.find((value) => keyText(value) === rawKey)
    || values.find((value) => rawKey.includes(keyText(value)) || keyText(value).includes(rawKey))
    || '';
}

function parseNumber(value: string): number {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getFilloutSubmissionObject(payload: unknown): Record<string, unknown> {
  const object = asRecord(payload) || {};
  const nestedCandidates = [
    object.submission,
    object.data,
    asRecord(object.data)?.submission,
    Array.isArray(object.responses) ? object.responses[0] : undefined,
    Array.isArray(asRecord(object.data)?.responses) ? (asRecord(object.data)?.responses as unknown[])[0] : undefined,
  ];
  const candidate = nestedCandidates.map(asRecord).find((item) =>
    Boolean(item && (Array.isArray(item.questions) || item.submissionId || item.submission_id || item.id))
  );
  return candidate || object;
}

export function normalizeScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

export function scoreTrainerEvaluation(scores: TrainerEvaluationScore[]) {
  const normalizedScores = scores.map((item) => ({
    ...item,
    score: normalizeScore(item.score, item.weightage),
  }));
  const totalWeightage = normalizedScores.reduce((sum, item) => sum + item.weightage, 0);
  const totalScore = normalizedScores.reduce((sum, item) => sum + item.score, 0);
  return {
    scores: normalizedScores,
    totalWeightage,
    totalScore,
    scorePercent: totalWeightage ? Math.round((totalScore / totalWeightage) * 100) : 0,
  };
}

export function buildTrainerReviewRecord(
  input: TrainerEvaluationInput,
  options: { id?: string; createdAt?: string; source?: string; sourceRef?: string } = {}
): TrainerReviewRecord {
  const scored = scoreTrainerEvaluation(input.scores);
  return {
    ...input,
    scores: scored.scores,
    id: options.id || `trainer-review-${Date.now()}`,
    createdAt: options.createdAt || new Date().toISOString(),
    totalWeightage: scored.totalWeightage,
    totalScore: scored.totalScore,
    scorePercent: scored.scorePercent,
    source: options.source,
    sourceRef: options.sourceRef,
  };
}

export function buildTrainerEvaluationText(input: TrainerEvaluationInput): string {
  const scored = scoreTrainerEvaluation(input.scores);
  const scorePercent = scored.scorePercent;
  const priorityBand = scorePercent < 65 ? 'High coaching priority' : scorePercent < 80 ? 'Development watch' : 'On-track performance';
  const scoreRows = scored.scores
    .filter((item) => item.weightage > 0)
    .map((item) => ({
      ...item,
      ratio: item.score / item.weightage,
    }));
  const scoreLines = scoreRows.map((item) => (
    `- ${item.category}: ${item.score}/${item.weightage} (${Math.round(item.ratio * 100)}%)`
  ));
  const strengths = scoreRows
    .filter((item) => item.ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((item) => `- ${item.category} is a current strength at ${item.score}/${item.weightage}.`);
  const coachingRisks = scoreRows
    .filter((item) => item.ratio > 0 && item.ratio < 0.7)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3)
    .map((item) => `- ${item.category} needs focused coaching at ${item.score}/${item.weightage}.`);
  const actionLines = [
    input.focusPoints ? `- Primary focus: ${input.focusPoints}` : '',
    input.goals ? `- Target goal: ${input.goals}` : '',
    scorePercent < 65 ? '- Schedule instructor coaching review within the high-priority SLA window.' : '',
    scorePercent >= 65 && scorePercent < 80 ? '- Track the next two Studio Sessions for measurable improvement against focus points.' : '',
    scorePercent >= 80 ? '- Continue monitoring for consistency and capture practices that can be shared with the instructor team.' : '',
  ].filter(Boolean);

  return [
    'Instructor Evaluation Brief',
    '',
    'Evaluation Snapshot',
    `- Instructor: ${input.trainer}`,
    `- Method template: ${input.template}`,
    input.studio ? `- Studio Space: ${input.studio}` : '',
    input.classType ? `- Signature Experience observed: ${input.classType}` : '',
    input.reviewPeriod ? `- Review period / observed session: ${input.reviewPeriod}` : '',
    `- Weighted score: ${scored.totalScore}/${scored.totalWeightage} (${scorePercent}%)`,
    `- Performance band: ${priorityBand}`,
    '',
    scoreLines.length ? `Weighted Scorecard\n${scoreLines.join('\n')}` : '',
    '',
    strengths.length ? `Demonstrated Strengths\n${strengths.join('\n')}` : 'Demonstrated Strengths\n- No score-based strength threshold was captured in this submission.',
    '',
    coachingRisks.length ? `Coaching Attention Areas\n${coachingRisks.join('\n')}` : 'Coaching Attention Areas\n- No urgent score-based coaching risk was captured in this submission.',
    '',
    'Evaluator / Training Notes',
    input.feedback || 'No evaluator notes were provided in the submission.',
    '',
    actionLines.length ? `Coaching Plan And Follow-up\n${actionLines.join('\n')}` : '',
    '',
    'Routing Context',
    '- Department owner: Training',
    '- Recommended owner: Anisha Shah',
    '- Source: Instructor evaluation submission',
  ].filter(Boolean).join('\n');
}

export function parseTrainerEvaluationText(text: string, trainer = 'Unspecified Instructor'): TrainerEvaluationInput {
  const lower = text.toLowerCase();
  const template: TrainerReviewTemplate = /\bstrength\b|\bstrength\s+lab\b|\bstrength\s*\/\s*fit\b|\bfit\b/.test(lower)
    ? 'StrengthFit'
    : /power\s?cycle|bike|ride|rider/.test(lower) ? 'PowerCycle' : 'Barre';
  const avgAttendance = Number(text.match(/average for 2023\s*\n?.*?(\d+(?:\.\d+)?)/i)?.[1] || 0);
  const feedback = [
    text.match(/Client Feedback\s+([\s\S]*?)(?:Internal feedback|Focus points|Goals|$)/i)?.[1],
    text.match(/Internal feedback\s+([\s\S]*?)(?:Focus points|Goals|$)/i)?.[1],
  ].filter(Boolean).join('\n\n').trim() || text.slice(0, 1600);
  const focusPoints = text.match(/Focus points\s+([\s\S]*?)(?:Goals|$)/i)?.[1]?.trim();
  const goals = text.match(/Goals\s+([\s\S]*?)$/i)?.[1]?.trim();
  const templateRows = TRAINER_REVIEW_TEMPLATES[template];
  const scores = templateRows.map((row, index) => ({
    ...row,
    score: index === 0 && avgAttendance ? Math.min(row.weightage, Math.round((avgAttendance / 6) * row.weightage * 10) / 10) : 0,
  }));
  return {
    trainer,
    template,
    scores,
    feedback,
    focusPoints,
    goals,
    rawText: text,
  };
}

const SCORE_LABEL_ALIASES: Record<string, string[]> = {
  clientattendance: ['attendance', 'avg attendance', 'average attendance', 'class average', 'fill rate'],
  clientretention: ['retention', 'repeat', 'check ins with new clients', 'needed modifications'],
  clientoutreachcommunicationandconnection: ['outreach', 'communication', 'connection', 'welcoming clients', 'fostering connections', 'icebreakers', 'post class sales', 'advertising self'],
  clientfeedback: ['client feedback', 'member feedback'],
  mindfulmomentuspintegrationmotivation: ['mindful moment', 'usp', 'motivation', 'whys', 'fun factor'],
  musicality: ['musical', 'music', 'playlist'],
  energyandvocals: ['energy', 'vocals', 'vocal', 'command'],
  choreographyandsequencing: ['choreography', 'sequencing', 'programming'],
  learningstylesanduseofnames: ['learning styles', 'use of names', 'kinesthetics', 'tactile', 'hands on', 'visual', 'demos', 'imagery', 'auditory', 'cuing', 'setting up clients', 'equipment'],
  classesworkshopsmeetingsandcorevalues: ['classes', 'workshops', 'meetings', 'core values', 'studio setup', 'vibe check', 'time management', 'sound on'],
  classattendanceandbikefillrate: ['attendance', 'bike fill', 'fill rate', 'riders'],
  clientretentionandrepeatriders: ['retention', 'repeat riders', 'repeat'],
  rideleadinmotivationuspintegration: ['ride motivation', 'usp', 'motivation'],
  ridemotivationuspintegration: ['ride motivation', 'usp', 'motivation'],
  musicalityandbeatmatching: ['musical', 'beat matching', 'music', 'playlist'],
  energyvocalsandcommand: ['energy', 'vocals', 'vocal', 'command'],
  rideprogrammingandsequencing: ['ride programming', 'sequencing', 'programming'],
  safetysetupandformcorrections: ['safety', 'setup', 'form corrections', 'equipment'],
  workethicsmeetingsandcorevalues: ['work ethics', 'meetings', 'core values', 'time management'],
  preclasssetup: ['pre class', 'pre-class', 'room presentation', 'room setup', 'equipment organised', 'vibe'],
  verbalcues: ['verbal cues', 'cueing', 'coaching cues', 'cues'],
  visualdemonstrations: ['visual demonstrations', 'demonstrations', 'demos', 'correct form'],
  injurymodifications: ['injury modifications', 'injuries', 'safe modifications'],
  levelappropriatepersonalmodifications: ['level modifications', 'level-appropriate', 'personal modifications', 'beginners', 'advanced clients', 'progressions'],
  uspintegrationmotivationandconnection: ['usp integration', 'motivation', 'connection', 'brand usp', 'client connection'],
  musicchoices: ['music choices', 'music', 'tempo', 'genre'],
  studiospaceandequipmentorganisation: ['space', 'equipment', 'studio space', 'equipment organisation', 'equipment placement'],
  timemanagementandclassflow: ['time management', 'class flow', 'pacing', 'starts and ends on time', 'structural flow'],
  useofclientnames: ['use of names', 'client names', 'new client names'],
  overallenergy: ['overall energy', 'energy', 'enthusiasm'],
  mindfulmoment: ['mindful moment', 'entry', 'exit'],
  postclassspiel: ['post class', 'post-class', 'spiel', 'farewell', 'new client onboarding'],
};

function scoreLabelMatch(category: string, label: string): number {
  const labelText = keyText(label);
  const categorySlug = slug(category);
  const labelSlug = slug(label);
  if (labelSlug.includes(categorySlug) || categorySlug.includes(labelSlug)) return 100;
  const aliases = SCORE_LABEL_ALIASES[categorySlug] || [];
  const aliasScore = aliases.reduce((score, alias) => keyText(labelText).includes(keyText(alias)) ? Math.max(score, 30 + keyText(alias).length) : score, 0);
  if (aliasScore) return aliasScore;
  const categoryWords = keyText(category)
    .split(' ')
    .filter((word) => word.length > 3 && !['client', 'class', 'ride'].includes(word));
  return categoryWords.reduce((score, word) => labelText.includes(word) ? score + 10 : score, 0);
}

function scoreFromAnswers(category: string, weightage: number, pairs: Array<{ label: string; value: string }>): number {
  const candidates = pairs
    .map((candidate) => ({ candidate, matchScore: scoreLabelMatch(category, candidate.label) }))
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
  const pair = candidates[0]?.candidate;
  if (!pair) return 0;
  return normalizeScore(parseNumber(pair.value), weightage);
}

export function mapFilloutTrainingEvaluation(payload: unknown, now = new Date()): FilloutTrainingEvaluationMapping {
  const object = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const submission = getFilloutSubmissionObject(object);
  const answers = uniquePairs(normalizeFilloutPairs(submission, collectAnswerPairs(submission)));
  const allText = answers.map((answer) => `${answer.label}: ${answer.value}`).join('\n');

  const trainerRaw = findValue(answers, [/trainer/i, /instructor/i, /coach/i]);
  const trainer = findKnownValue(trainerRaw, TRAINERS) || trainerRaw || 'Unspecified Instructor';
  const templateRaw = findValue(answers, [/template/i, /format/i, /class\s*type/i, /discipline/i]);
  const templateText = `${templateRaw}\n${allText}`;
  const template: TrainerReviewTemplate = /\bstrength\b|\bstrength\s+lab\b|\bstrength\s*\/\s*fit\b|\bfit\b/i.test(templateText)
    ? 'StrengthFit'
    : /power\s?cycle|bike|ride|rider/i.test(templateText) ? 'PowerCycle' : 'Barre';
  const studioRaw = findValue(answers, [/^center$/i, /^studio$/i, /^location$/i, /^branch$/i, /studio/i, /location/i, /branch/i, /center/i]);
  const classRaw = findValue(answers, [/class/i, /session/i, /format/i]);
  const reviewPeriod = findValue(answers, [/review\s*period/i, /period/i, /month/i, /date/i]);
  const feedback = findValue(answers, [/feedback/i, /comments?/i, /observation/i, /evaluation/i, /internal/i])
    || allText.slice(0, 1600)
    || 'Fillout training evaluation submitted without evaluator comments.';
  const focusPoints = findValue(answers, [/focus/i, /improvement/i, /work\s*on/i]);
  const goals = findValue(answers, [/goal/i, /next\s*step/i, /target/i]);
  const scores = TRAINER_REVIEW_TEMPLATES[template].map((row) => ({
    ...row,
    score: scoreFromAnswers(row.category, row.weightage, answers),
  }));

  const dataObject = asRecord(object.data) || {};
  const submissionId = firstIdentifier(
    object.submissionId,
    object.submission_id,
    dataObject.submissionId,
    dataObject.submission_id,
    submission.submissionId,
    submission.submission_id,
    submission.id
  );
  const formId = firstIdentifier(
    object.formId,
    object.form_id,
    dataObject.formId,
    dataObject.form_id,
    submission.formId,
    submission.form_id
  );
  const receivedAt = now.toISOString();
  const sourceRef = `fillout:${formId || 'unknown-form'}:${submissionId || String(Math.abs(allText.split('').reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) | 0), 0))).toString()}`;
  const input: TrainerEvaluationInput = {
    trainer,
    template,
    studio: findKnownValue(studioRaw, STUDIOS) || studioRaw || undefined,
    classType: findKnownValue(classRaw, CLASS_TYPES) || classRaw || undefined,
    reviewPeriod: reviewPeriod || undefined,
    scores,
    feedback,
    focusPoints: focusPoints || undefined,
    goals: goals || undefined,
    rawText: allText || JSON.stringify(payload),
  };

  return {
    input,
    record: buildTrainerReviewRecord(input, {
      id: `fillout-trainer-review-${submissionId || Date.now()}`,
      createdAt: receivedAt,
      source: 'fillout',
      sourceRef,
    }),
    sourceRef,
    submissionId: submissionId || undefined,
    formId: formId || undefined,
    receivedAt,
    answers,
  };
}
