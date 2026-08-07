import { CLASS_TYPES, STUDIOS, TRAINERS } from './ticketing-data';

export interface DraftFormattingContext {
  intakeRoute?: string;
  category?: string;
  subCategory?: string;
  clientsAffected?: string;
  memberName?: string;
  studio?: string;
  trainer?: string;
  classType?: string;
  classDateTime?: string;
  incidentDateTime?: string;
  membership?: string;
  desiredResolution?: string;
  [key: string]: string | undefined;
}

interface BuildDescriptionInput {
  sourceText: string;
  context: DraftFormattingContext;
  category: string;
  subCategory: string;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPipeList(value?: string): string[] {
  return (value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function titleCaseStart(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

function hasGenericResolutionLanguage(value: string): boolean {
  return /(?:^|\n)\s*(?:next step|requested resolution|resolution pathway|athena review note)\s*:/i.test(value)
    || /\b(?:assigned owner|review and confirm|close the loop|team will|we will|follow[- ]?up action)\b/i.test(value);
}

export function summarizeOperationalReport(sourceText: string): string {
  const lines = sourceText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      return !/^(hi|hello|hey)\b.*[,!.]?$/i.test(line) &&
        !/^best[,!.]?$/i.test(line) &&
        !/^thanks[,!.]?$/i.test(line) &&
        !/^thank you[,!.]?$/i.test(line) &&
        !/^team physique 57[,!.]?$/i.test(line);
    });

  let summary = lines.join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^this is to inform you that\s+/i, '')
    .replace(/^the instructor,\s*/i, 'Instructor ')
    .replace(/\binstructor,\s+/i, 'instructor ')
    .replace(/^Instructor\s+([^,]+),\s+/i, 'Instructor $1 ')
    .trim();

  if (!summary) summary = sourceText.replace(/\s+/g, ' ').trim();
  if (summary && !/[.!?]$/.test(summary)) summary += '.';
  return titleCaseStart(summary);
}

function mentionedStudio(sourceText: string): string | undefined {
  const normalized = normalizeText(sourceText);
  if (/\bkenkere\b|\bbengaluru\b|\bbangalore\b/.test(normalized)) return 'Kenkere House, Bengaluru';
  if (/\bkwality\b|\bkemps\b|\bkemps corner\b/.test(normalized)) return 'Kwality House, Kemps Corner';
  if (/\bbandra\b|\bsupreme\b|\bsupreme hq\b/.test(normalized)) return 'Supreme HQ, Bandra';
  if (/\bcourtside\b/.test(normalized)) return 'Courtside, Mumbai';
  if (/\bcopper\b|\bcloves\b/.test(normalized)) return 'the Studio by Copper & Cloves, Bengaluru';
  return undefined;
}

function mentionedTrainer(sourceText: string): string | undefined {
  const normalized = normalizeText(sourceText);
  return TRAINERS.find((trainer) => {
    const parts = normalizeText(trainer).split(' ').filter((part) => part.length > 2);
    return parts.some((part) => new RegExp(`\\b${part}\\b`).test(normalized));
  });
}

function mentionedOption(value: string, sourceText: string): boolean {
  const normalizedSource = normalizeText(sourceText);
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return false;
  if (normalizedSource.includes(normalizedValue)) return true;
  const importantParts = normalizedValue.split(' ').filter((part) => part.length > 4);
  return importantParts.length > 0 && importantParts.every((part) => normalizedSource.includes(part));
}

function cleanContextOption(value: string | undefined, sourceText: string, approvedOptions?: string[]): string | undefined {
  const values = splitPipeList(value);
  if (values.length === 0) return undefined;

  if (values.length === 1) return values[0];

  const matchingValue = values.find((candidate) => mentionedOption(candidate, sourceText));
  if (matchingValue) return matchingValue;

  if (approvedOptions) {
    const matchingApproved = approvedOptions.find((option) => mentionedOption(option, sourceText));
    if (matchingApproved) return matchingApproved;
  }

  return undefined;
}

function cleanClassTypeOption(value: string | undefined, sourceText: string): string | undefined {
  const values = splitPipeList(value);
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];

  const normalizedSource = normalizeText(sourceText);
  return values.find((candidate) => normalizedSource.includes(normalizeText(candidate)));
}

export function normalizeDraftContextForSource(
  context: DraftFormattingContext,
  sourceText: string,
): DraftFormattingContext {
  const explicitStudio = mentionedStudio(sourceText);
  const explicitTrainer = mentionedTrainer(sourceText);

  return {
    ...context,
    studio: explicitStudio || cleanContextOption(context.studio, sourceText, STUDIOS),
    trainer: explicitTrainer || cleanContextOption(context.trainer, sourceText, TRAINERS),
    classType: cleanClassTypeOption(context.classType, sourceText),
  };
}

export function draftDescriptionNeedsRewrite(description: string | undefined, intakeRoute?: string, sourceText?: string): boolean {
  const value = description || '';
  if (!value.trim()) return true;
  if (/hi all|best,\s*(?:\n|$)|team physique 57/i.test(value)) return true;
  if (/member feedback summary/i.test(value) && /internal reporting/i.test(intakeRoute || value)) return true;
  if (hasGenericResolutionLanguage(value)) return true;
  if (sourceText && sourceText.trim().length > 80) {
    const normalizedDescription = normalizeText(value);
    const normalizedSource = normalizeText(sourceText);
    if (normalizedSource.length > 80 && normalizedDescription.includes(normalizedSource.slice(0, 80))) return true;
  }
  return false;
}

export function buildOperationalTicketDescription({
  sourceText,
  context,
  category,
  subCategory,
}: BuildDescriptionInput): string {
  const normalizedContext = normalizeDraftContextForSource(context, sourceText);
  const route = normalizedContext.intakeRoute || 'Internal Reporting';
  const summaryLabel = route === 'Internal Reporting' ? 'Internal report summary' : 'Issue summary';
  const summary = summarizeOperationalReport(sourceText);

  return [
    `${summaryLabel}: ${summary}`,
    '',
    'Operational context:',
    `- Intake route: ${route}`,
    `- Category: ${category} / ${subCategory}`,
    normalizedContext.clientsAffected ? `- Client impact check: ${normalizedContext.clientsAffected}` : null,
    normalizedContext.memberName ? `- Member: ${normalizedContext.memberName}` : null,
    normalizedContext.studio ? `- Studio: ${normalizedContext.studio}` : null,
    normalizedContext.trainer ? `- Instructor: ${normalizedContext.trainer}` : null,
    normalizedContext.classType ? `- Class/session: ${normalizedContext.classType}` : null,
    normalizedContext.incidentDateTime ? `- When noticed/reported: ${normalizedContext.incidentDateTime}` : null,
    normalizedContext.classDateTime ? `- Class/session date/time: ${normalizedContext.classDateTime}` : null,
    normalizedContext.desiredResolution ? `- Member-requested outcome: ${normalizedContext.desiredResolution}` : null,
    '',
  ].filter((line) => line !== null).join('\n');
}
