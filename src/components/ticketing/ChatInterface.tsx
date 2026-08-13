import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Sparkles, CheckCircle2, Paperclip, X, Mic, Square, ChevronDown, ChevronRight, Check, HelpCircle, ClipboardCheck, Gauge, GraduationCap, LayoutTemplate, Download, FileText, FileCode2, ImageDown, History, Plus, Search, ArrowRight, Building2, CalendarClock, Handshake, Star, Copy, RotateCw, WandSparkles, CornerDownLeft } from 'lucide-react';
import InteractiveRobotSpline from '@/components/InteractiveRobotSpline';
import { LiveClock } from '@/components/LiveClock';
import { ROBOT_SPLINE_URL } from '@/lib/galleryImages';
import { getErrorMessage } from '@/lib/error-formatting';
import { TicketPreviewCard } from './TicketPreviewCard';
import { ContextPicker, Context } from './ContextPicker';
import { useTickets } from './useTickets';
import { useBackendAuth } from '@/contexts/useBackendAuth';
import {
  getMomenceMemberMemberships,
  getMomenceSession,
  getMomenceSessionBookings,
  listMomenceHostMembershipOptions,
  loadMomenceSessionsProgressively,
  loadMomenceTicketContext,
  MomenceInsightSummary,
  MomenceMemberOption,
  MomenceMembership,
  MomenceSessionBooking,
  MomenceSessionOption,
  searchMomenceMembers,
  searchMomenceSessions,
} from '@/lib/momence-api';
import {
  CLASS_IMPACT_TYPE_OPTIONS,
  CLIENTS_AFFECTED_OPTIONS,
  captureMemberFeedbackFromText,
  getIntakeFieldDefinition,
  getMissingIntakeFields,
  inferIntakeContextFromText,
  isProtectedEntityField,
  isMissingIntakeValue,
  IntakeContext,
} from '@/lib/intake-rules';
import {
  shouldAcceptAiDetailForm,
  shouldAcceptInferredSubCategory,
  shouldHoldDraftForMoreInfo,
  shouldReplaceInferredCategory,
} from '@/lib/intake-response-state';
import {
  CATEGORIES,
  FREEZE_REASONS,
  HOSTED_CLASS_FEEDBACK_AREAS,
  CLASS_TYPES,
  INTAKE_ROUTES,
  MEMBER_SENTIMENT_OPTIONS,
  PRIORITY_SLA,
  REQUEST_TYPES,
  ROLLOVER_REASONS,
  STUDIOS,
  TRAINERS,
  Ticket,
  cleanTicketTitle,
  getStudioAreaOptions,
  resolveTicketAssignee,
  resolveTicketDepartment,
} from '@/lib/ticketing-data';
import { buildRelatedTicketNotice, findRelatedSubmittedTickets } from '@/lib/ticket-duplicate-matching';
import { invokeTicketingFunction, withTimeout } from '@/lib/ticketing-functions';
import { buildAthenaDraftRequestBody } from '@/lib/ticket-ai-chat-payload';
import {
  buildOperationalTicketDescription,
  draftDescriptionNeedsRewrite,
  normalizeDraftContextForSource,
  summarizeOperationalReport,
} from '@/lib/ticket-draft-formatting';
import { buildTicketReviewInsights } from '@/lib/ticket-review';
import { buildDuplicatePatternInsights, buildVoiceExtractionHints, optimizeIntakePromptForAthena } from '@/lib/smart-ops-intelligence';
import { getGreetingQuickActions, isCasualGreeting } from '@/lib/athena-chat-intent';
import { classifyIssue, IssueClassification } from '@/lib/issue-classifier';
import { fetchMemberContext, MemberContextSnapshot } from '@/lib/member-context-fetcher';
import { buildSpecialistPreamble } from '@/lib/specialist-prompt-builder';
import { shouldUseOptionButtons } from '@/lib/intake-option-buttons';
import {
  buildIntakeConversationPlan,
  buildNarrativeGapDescription,
  buildNaturalSingleFieldPrompt,
  getReporterFirstName,
  limitConversationalFieldBatch,
  serializeConversationPlan,
} from '@/lib/intake-conversation-plan';
import {
  htmlForChatTranscript,
  plainTextForChatTranscript,
  transcriptFileBaseName,
} from '@/lib/chat-export';
import {
  CONTEXT_TEMPLATES,
  ContextTemplate,
  ContextTemplateField,
  HostedClassAttendeeFeedback,
  HostedClassFeedbackInput,
  HostedClassSessionSummary,
  buildContextTemplateText,
  buildHostedClassFeedbackText,
} from '@/lib/intake-templates';
import { trainerImageUrl, trainerInitials } from '@/lib/trainer-images';
import {
  TRAINER_REVIEW_TEMPLATES,
  TrainerEvaluationInput,
  TrainerEvaluationScore,
  TrainerReviewTemplate,
  buildTrainerEvaluationText,
  buildTrainerReviewRecord,
  isTrainerEvaluationProfileOnly,
  parseTrainerEvaluationText,
  saveTrainerReview,
} from '@/lib/trainer-profiles';
import { SlaCountdown } from './SlaCountdown';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SuggestedChip {
  label: string;
  value: string;
  field: string;
}

type DetailFieldType = 'select' | 'text' | 'textarea' | 'date' | 'datetime-local' | 'number' | 'rating';

interface DetailFormField {
  id: string;
  label: string;
  type: DetailFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  dependsOn?: string;
  dependsOnValue?: string;
  section?: string;
  scoreWeight?: number;
}

interface DetailForm {
  id?: string;
  title: string;
  description?: string;
  fields: DetailFormField[];
  submitLabel?: string;
}

interface DraftTicket {
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
  metadata?: Record<string, unknown>;
}

interface PendingAttachment {
  id: string;
  file: File;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type DetailContext = Context & IntakeContext;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  aiGenerated?: boolean;
  ticket?: DraftTicket | null;
  trainerEvaluation?: TrainerEvaluationInput;
  suggestedChips?: SuggestedChip[];
  ticketId?: string;
  published?: boolean;
  detailForm?: DetailForm | null;
  publishedTicket?: Ticket;
  debugTrace?: Record<string, unknown> | null;
}

type ChatMessage = Message;

interface ChatHistoryEntry {
  id: string;
  title: string;
  updatedAt: number;
  conversationId: string | null;
  context: DetailContext;
  messages: Message[];
}

const CHAT_HISTORY_STORAGE_KEY = 'athena.chat.history.v1';
const CHAT_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHAT_HISTORY_ENTRIES = 40;

interface AiIntakeResponse {
  conversationId?: string;
  needsMoreInfo?: boolean;
  reply?: string;
  detailForm?: DetailForm | null;
  ticket?: DraftTicket | null;
  suggestedChips?: SuggestedChip[];
  inferredContext?: Partial<DetailContext>;
  missingFields?: string[];
  publishable?: boolean;
  urgencyReason?: string;
  debugTrace?: Record<string, unknown> | null;
}

const GREETING: Message = {
  id: 'greet',
  role: 'assistant',
  content: "Hey! I'm Athena 👋 What would you like to log today? Tell me what happened and I'll take it from there.",
};

function buildGreetingMessage(reporterName?: string): Message {
  const firstName = getReporterFirstName(reporterName);
  return {
    ...GREETING,
    content: firstName
      ? `Hey ${firstName}! 👋 What would you like to log today? Just describe what happened and I'll handle the rest.`
      : "Hey! I'm Athena 👋 What would you like to log today? Tell me what happened and I'll take it from there.",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function writingPauseMs(content: string): number {
  const length = content.trim().length;
  return Math.min(1150, Math.max(420, 300 + length * 4));
}

function isAthenaDebugTraceEnabled(): boolean {
  if (import.meta.env.VITE_ATHENA_DEBUG_TRACE === 'true') return true;
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const queryValue = url.searchParams.get('athenaTrace');
  if (queryValue !== null) {
    return !/^(0|false|off)$/i.test(queryValue);
  }
  return window.localStorage.getItem('athena-debug-trace') === '1';
}

const ATHENA_CHAT_RESPONSE_TIMEOUT_MS = 30_000;
const ATHENA_CHAT_TIMEOUT_MESSAGE = 'Athena chat response timed out';
const ATHENA_AI_PROVIDER = 'openai';
const ATHENA_AI_PROVIDER_BADGE_LABEL = 'OpenAI GPT-5.4 mini';

const USER_TONES = [
  {
    avatar: 'border-blue-200 bg-card text-blue-600 shadow-[0_12px_28px_rgba(37,99,235,0.16)]',
    bubble: 'rounded-tr-md border border-l-4 border-blue-200 border-l-blue-500 bg-card text-foreground shadow-[0_18px_44px_rgba(37,99,235,0.14)]',
    more: 'text-blue-700 hover:text-blue-900',
  },
  {
    avatar: 'border-cyan-200 bg-card text-cyan-600 shadow-[0_12px_28px_rgba(8,145,178,0.14)]',
    bubble: 'rounded-tr-md border border-l-4 border-cyan-200 border-l-cyan-500 bg-card text-foreground shadow-[0_18px_44px_rgba(8,145,178,0.13)]',
    more: 'text-cyan-700 hover:text-cyan-900',
  },
  {
    avatar: 'border-indigo-200 bg-card text-indigo-600 shadow-[0_12px_28px_rgba(79,70,229,0.14)]',
    bubble: 'rounded-tr-md border border-l-4 border-indigo-200 border-l-indigo-500 bg-card text-foreground shadow-[0_18px_44px_rgba(79,70,229,0.13)]',
    more: 'text-indigo-700 hover:text-indigo-900',
  },
  {
    avatar: 'border-sky-200 bg-card text-sky-600 shadow-[0_12px_28px_rgba(2,132,199,0.15)]',
    bubble: 'rounded-tr-md border border-l-4 border-sky-200 border-l-sky-500 bg-card text-foreground shadow-[0_18px_44px_rgba(2,132,199,0.14)]',
    more: 'text-sky-700 hover:text-sky-900',
  },
];

const getDisplayError = getErrorMessage;

function getDynamicStarters(context: Partial<{ studio: string; trainer: string; category: string; memberName: string; classType: string }>): string[] {
  const { studio, trainer, category, memberName, classType } = context;
  const studioShort = studio ? studio.split(',')[0] : null;

  if (trainer && classType) return [
    `${trainer} arrived late for the ${classType} class`,
    `Feedback on ${trainer}'s ${classType} session today`,
    `Member had an issue during ${trainer}'s class`,
    `${trainer} skipped cooldown — members upset`,
    `Safety concern during ${classType} with ${trainer}`,
    `${trainer} ended class 10 min early today`,
    `Member wants follow-up after ${trainer}'s ${classType}`,
    `${trainer} did not follow ${classType} script`,
    `Complaint about music volume in ${trainer}'s class`,
    `${trainer} needs coaching on cueing technique`,
  ];
  if (trainer) return [
    `Complaint about ${trainer}'s class today`,
    `${trainer} did not follow class protocol`,
    `Member praised ${trainer}'s session`,
    `Injury concern during ${trainer}'s class`,
    `${trainer} started late and ended early`,
    `Member requests different instructor permanently`,
    `${trainer}'s form corrections were too aggressive`,
    `Positive feedback — ${trainer}'s energy was exceptional`,
    `${trainer} skipped the warm-up section`,
    `Follow-up needed on ${trainer}'s attendance`,
  ];
  if (studio && category) return [
    `${category} issue at ${studioShort}`,
    `Member complaint about ${category.toLowerCase()} at ${studioShort}`,
    `Staff at ${studioShort} handling ${category.toLowerCase()} incorrectly`,
    `Follow up needed on ${category.toLowerCase()} for ${studioShort}`,
    `Urgent ${category.toLowerCase()} matter at ${studioShort}`,
    `${studioShort} team escalation — ${category.toLowerCase()}`,
    `${category} policy not being followed at ${studioShort}`,
    `Member escalated ${category.toLowerCase()} concern at ${studioShort}`,
    `${studioShort} needs immediate action on ${category.toLowerCase()}`,
    `${category} repeat issue at ${studioShort} — third time`,
  ];
  if (studio) return [
    `Locker room issue at ${studioShort} today`,
    `AC not working at ${studioShort}`,
    `Member complaint at ${studioShort} studio`,
    `Equipment broken at ${studioShort}`,
    `Cleanliness issue at ${studioShort} — needs attention`,
    `Front desk staff rude to a member at ${studioShort}`,
    `${studioShort} class overcrowded — safety concern`,
    `Bike malfunction during class at ${studioShort}`,
    `${studioShort} WiFi and music system down`,
    `Member slipped on wet floor at ${studioShort}`,
  ];
  if (memberName) return [
    `${memberName} wants a membership refund`,
    `${memberName} reported an issue with a class`,
    `${memberName}'s package expired prematurely`,
    `${memberName} had a bad experience with an instructor`,
    `Follow up required for ${memberName}`,
    `${memberName} requesting a class reschedule`,
    `${memberName} was charged twice — billing issue`,
    `${memberName} wants to freeze membership`,
    `${memberName}'s Momence profile shows wrong data`,
    `${memberName} left class upset — needs outreach`,
  ];
  return [
    'A member complained about the AC at Bandra studio',
    'Member wants a refund for her last class',
    'Locker room was not clean at Kemps today',
    'Equipment issue — bike broken at Bengaluru',
    'Instructor arrived late for the barre class',
    'Membership package expired before last class',
    'Front desk conflict at Bandra studio — follow up needed',
    'Member slipped near the reception area',
    'Class was double-booked — members turned away',
    'Sound system failure during powercycle class',
  ];
}

function getReporterName(user: ReturnType<typeof useBackendAuth>['user']): string {
  const metadata = user?.user_metadata || {};
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
  const name = typeof metadata.name === 'string' ? metadata.name.trim() : '';
  return fullName || name || user?.email || 'Authenticated user';
}

const DETAIL_FORM_FIELD_LIBRARY: Record<string, DetailFormField> = {
  intakeRoute: {
    id: 'intakeRoute',
    label: 'Intake Route',
    type: 'select',
    required: true,
    options: INTAKE_ROUTES,
  },
  requestType: {
    id: 'requestType',
    label: 'Specific Ticket Type',
    type: 'select',
    required: true,
    options: REQUEST_TYPES,
  },
  clientsAffected: {
    id: 'clientsAffected',
    label: 'Were any clients affected?',
    type: 'select',
    required: true,
    options: [...CLIENTS_AFFECTED_OPTIONS],
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    type: 'select',
    required: true,
    options: STUDIOS,
  },
  category: {
    id: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    options: Object.keys(CATEGORIES),
  },
  subCategory: {
    id: 'subCategory',
    label: 'Issue Type',
    type: 'select',
    required: true,
    dependsOn: 'category',
    options: Object.values(CATEGORIES).flat(),
  },
  trainer: {
    id: 'trainer',
    label: 'Instructor',
    type: 'select',
    options: TRAINERS,
  },
  classType: {
    id: 'classType',
    label: 'Class / Session',
    type: 'select',
    required: true,
    options: [],
  },
  membership: {
    id: 'membership',
    label: 'Package / Membership',
    type: 'select',
    options: [],
  },
  memberName: {
    id: 'memberName',
    label: 'Member Name',
    type: 'text',
    required: true,
  },
  memberContact: {
    id: 'memberContact',
    label: 'Member Contact',
    type: 'text',
    required: true,
  },
  priority: {
    id: 'priority',
    label: 'Priority',
    type: 'select',
    required: true,
    options: Object.keys(PRIORITY_SLA),
  },
  description: {
    id: 'description',
    label: 'Describe the issue in detail',
    type: 'textarea',
    required: true,
  },
  desiredResolution: {
    id: 'desiredResolution',
    label: 'Requested resolution',
    type: 'textarea',
  },
  incidentDateTime: {
    id: 'incidentDateTime',
    label: 'When was this noticed or reported?',
    type: 'datetime-local',
  },
  memberSentiment: {
    id: 'memberSentiment',
    label: 'Member Sentiment',
    type: 'select',
    options: MEMBER_SENTIMENT_OPTIONS,
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
  freezeStartDate: {
    id: 'freezeStartDate',
    label: 'Requested Freeze Start Date',
    type: 'date',
    required: true,
  },
  freezeEndDate: {
    id: 'freezeEndDate',
    label: 'Requested Freeze End Date',
    type: 'date',
    required: true,
  },
  freezeReason: {
    id: 'freezeReason',
    label: 'Freeze Reason Stated by Member',
    type: 'select',
    required: true,
    options: FREEZE_REASONS,
  },
  classesRemaining: {
    id: 'classesRemaining',
    label: 'Classes / Credits Remaining',
    type: 'number',
  },
  packageExpiryDate: {
    id: 'packageExpiryDate',
    label: 'Current Package Expiry Date',
    type: 'date',
  },
  requestedRolloverDate: {
    id: 'requestedRolloverDate',
    label: 'Requested Roll Over / Extension Date',
    type: 'date',
    required: true,
  },
  rolloverReason: {
    id: 'rolloverReason',
    label: 'Roll Over Reason',
    type: 'select',
    required: true,
    options: ROLLOVER_REASONS,
  },
  partnerName: {
    id: 'partnerName',
    label: 'Hosted Class Partner / Influencer',
    type: 'text',
    required: true,
  },
  hostedFeedbackArea: {
    id: 'hostedFeedbackArea',
    label: 'Hosted Class Feedback Area',
    type: 'select',
    required: true,
    options: HOSTED_CLASS_FEEDBACK_AREAS,
  },
  attendeeCount: {
    id: 'attendeeCount',
    label: 'Approx. Attendee Count',
    type: 'number',
  },
  prospectQuality: {
    id: 'prospectQuality',
    label: 'Prospect Quality / Conversion Signal',
    type: 'select',
    options: ['High Fit', 'Moderate Fit', 'Low Fit', 'Existing Members Mostly', 'Unable to Determine'],
  },
  followUpPreference: {
    id: 'followUpPreference',
    label: 'Follow-up Preference Indicated',
    type: 'select',
    options: ['Phone Call', 'WhatsApp', 'Email', 'Instagram DM', 'In-Person Next Visit', 'No Follow-up Requested'],
  },
};

function getDetailField(id: string): DetailFormField | undefined {
  return DETAIL_FORM_FIELD_LIBRARY[id] || getIntakeFieldDefinition(id);
}

function downloadTextFile(filename: string, text: string, contentType: string) {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function collectDocumentStyleText(): string {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

function absoluteImageSources(root: HTMLElement) {
  root.querySelectorAll('img').forEach((image) => {
    const source = image.getAttribute('src');
    if (!source) return;
    try {
      image.setAttribute('src', new URL(source, window.location.href).href);
    } catch {
      // Keep the original source if URL normalization fails.
    }
  });
}

async function imageLoaded(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === 'function') {
    await image.decode();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('PNG export image render failed'));
  });
}

async function pngDataUrlForElementScreenshot(node: HTMLElement): Promise<string> {
  const width = Math.max(1, node.clientWidth);
  const height = Math.max(1, node.clientHeight);
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const clone = node.cloneNode(true) as HTMLElement;
  absoluteImageSources(clone);
  clone.style.width = `${Math.max(node.scrollWidth, width)}px`;
  clone.style.height = `${Math.max(node.scrollHeight, height)}px`;
  clone.style.maxWidth = 'none';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.transform = `translate(${-node.scrollLeft}px, ${-node.scrollTop}px)`;
  clone.style.transformOrigin = 'top left';

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.background = '#f3f4f6';

  const style = document.createElement('style');
  style.textContent = collectDocumentStyleText();
  wrapper.append(style, clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject width="100%" height="100%">${serialized}</foreignObject>`,
    '</svg>',
  ].join('');
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await imageLoaded(image);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable for PNG export');
  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = '#f3f4f6';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function detailFieldWithContext(base: DetailFormField, ctx?: DetailContext): DetailFormField {
  if (base.id === 'subCategory') {
    const category = ctx?.category;
    const options = category && CATEGORIES[category]?.length ? CATEGORIES[category] : base.options;
    return { ...base, options };
  }
  if (base.id === 'affectedArea') {
    return { ...base, options: getStudioAreaOptions(ctx?.studio) };
  }
  return base;
}

function normalizeDetailForm(input: unknown, ctx?: DetailContext): DetailForm | null {
  if (!input || typeof input !== 'object') return null;
  const form = input as Partial<DetailForm> & { fields?: Array<Partial<DetailFormField> | string> };
  const seen = new Set<string>();
  const allowedTypes = new Set<DetailFieldType>(['select', 'text', 'textarea', 'date', 'datetime-local', 'number']);
  const fields = (form.fields || [])
    .map((field) => {
      if (typeof field === 'string') {
        const normalizedId = field === 'requestType' ? 'intakeRoute' : field;
        if (seen.has(normalizedId)) return null;
        seen.add(normalizedId);
        const base = getDetailField(normalizedId);
        return base ? { ...detailFieldWithContext(base, ctx), required: true } : undefined;
      }
      const id = field.id ? (String(field.id) === 'requestType' ? 'intakeRoute' : String(field.id)) : '';
      if (id === 'reportedBy') return null;
      const base = getDetailField(id);
      if (seen.has(id)) return null;
      seen.add(id);
      if (base) {
        const contextualBase = detailFieldWithContext(base, ctx);
        // AI-provided labels can be contextual, but known fields keep the app's
        // standard option lists so irrelevant choices do not leak into the form.
        const aiLabel = typeof (field as Partial<DetailFormField>).label === 'string' && (field as Partial<DetailFormField>).label!.trim()
          ? (field as Partial<DetailFormField>).label!.trim()
          : null;
        const rawAiOptions = (field as Partial<DetailFormField>).options;
        const aiOptions = Array.isArray(rawAiOptions) && rawAiOptions.length > 0
          ? rawAiOptions.map(String).filter(Boolean).slice(0, 30)
          : null;
        const standardOptions = contextualBase.options?.length ? contextualBase.options : null;
        return {
          ...contextualBase,
          ...field,
          id: contextualBase.id,
          label: aiLabel || contextualBase.label,
          options: standardOptions || aiOptions || contextualBase.options,
          required: field.required ?? contextualBase.required,
        } as DetailFormField;
      }

      const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : '';
      const type = field.type && allowedTypes.has(field.type) ? field.type : 'text';
      if (!id || !label) return null;
      return {
        id: id.replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 80),
        label,
        type,
        required: field.required !== false,
        options: Array.isArray(field.options) ? field.options.map(String).filter(Boolean).slice(0, 30) : undefined,
        dependsOn: typeof field.dependsOn === 'string' ? field.dependsOn : undefined,
      } as DetailFormField;
    })
    .filter(Boolean) as DetailFormField[];

  if (fields.length === 0) return null;
  return {
    title: form.title || 'Add the missing ticket details',
    description: form.description,
    fields,
    submitLabel: form.submitLabel || 'Continue drafting',
  };
}

function chipsForSingleField(field: DetailFormField, ctx: DetailContext): SuggestedChip[] {
  if (ctx[field.id]) return [];
  if (field.type !== 'select') return [];
  const options = field.id === 'subCategory' && ctx.category
    ? CATEGORIES[ctx.category] || []
    : field.id === 'affectedArea'
      ? getStudioAreaOptions(ctx.studio)
      : field.options || [];
  if (field.id === 'membership' || options.length === 0) return [];
  return options.slice(0, 10).map((option) => ({
    label: option,
    value: option,
    field: field.id,
  }));
}

function loadChatHistory(): ChatHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - CHAT_HISTORY_RETENTION_MS;
    return parsed
      .filter((entry): entry is ChatHistoryEntry => (
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.updatedAt === 'number' &&
        entry.updatedAt >= cutoff &&
        Array.isArray(entry.messages)
      ))
      .slice(0, MAX_CHAT_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

function saveChatHistory(entries: ChatHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    const cutoff = Date.now() - CHAT_HISTORY_RETENTION_MS;
    window.localStorage.setItem(
      CHAT_HISTORY_STORAGE_KEY,
      JSON.stringify(entries.filter((entry) => entry.updatedAt >= cutoff).slice(0, MAX_CHAT_HISTORY_ENTRIES))
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function chatHistoryTitle(messages: Message[], context: DetailContext): string {
  const ticketTitle = messages.find((message) => message.ticket?.title)?.ticket?.title;
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content;
  return (
    ticketTitle ||
    context.description ||
    firstUserMessage ||
    'Athena intake conversation'
  ).replace(/\s+/g, ' ').trim().slice(0, 80);
}

function applyDetailValue(ctx: DetailContext, field: string, value: string): DetailContext {
  const next = { ...ctx };
  if (field === 'studio') next.studio = value;
  else if (field === 'trainer') next.trainer = value;
  else if (field === 'classType') next.classType = value;
  else if (field === 'memberName') next.memberName = value;
  else if (field === 'memberContact') next.memberContact = value;
  else if (field === 'category') {
    next.category = value;
    next.subCategory = undefined;
  } else if (field === 'subCategory') next.subCategory = value;
  else if (field === 'reportedBy') next.reportedBy = value;
  else if (field === 'assignedTo' || field === 'owner') next.assignedTo = value;
  else if (field === 'department' || field === 'team') next.department = value;
  else next[field] = value;
  return next;
}

function normalizeInferredContext(input: unknown): Partial<DetailContext> {
  if (!input || typeof input !== 'object') return {};
  const value = input as Record<string, unknown>;
  const next: Partial<DetailContext> = {};
  const assignString = (key: keyof DetailContext) => {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) next[key] = candidate.trim();
  };

  assignString('intakeRoute');
  assignString('requestType');
  assignString('category');
  assignString('subCategory');
  assignString('priority');
  assignString('memberSentiment');
  assignString('resolutionRequired');
  assignString('desiredResolution');
  assignString('urgencyReason');
  // clientsAffected is intentionally excluded here. It must ONLY come from explicit
  // user form selection — never from AI inference. Accepting it here would let the AI
  // silently satisfy the check (e.g. "Not confirmed yet"), bypass the question entirely,
  // and prevent memberName from ever being required.
  assignString('membership');
  assignString('classImpactType');
  assignString('classImpactDetails');

  return next;
}

function mergeInferredContext(ctx: DetailContext, inferred: Partial<DetailContext>, fallbackUrgency?: string): DetailContext {
  const next: DetailContext = { ...ctx };
  for (const [key, value] of Object.entries(inferred)) {
    if (!value) continue;
    if (
      (key === 'category' || key === 'subCategory') &&
      next.category === 'Hosted Class & Partnerships' &&
      (value === 'General Feedback' || value === 'Other')
    ) {
      continue;
    }
    if (key === 'category' && next.category !== value) {
      if (!shouldReplaceInferredCategory(next.category, value)) continue;
      next.category = value;
      next.subCategory = undefined;
      continue;
    }
    if (key === 'subCategory' && !shouldAcceptInferredSubCategory(next.category, value, CATEGORIES[next.category || ''])) {
      continue;
    }
    next[key] = value;
  }
  if (fallbackUrgency && !next.urgencyReason) next.urgencyReason = fallbackUrgency;
  return next;
}

function fieldHasContextValue(field: DetailFormField, ctx: DetailContext): boolean {
  const value = ctx[field.id];
  const hasAnyIntakeValue = (...values: unknown[]) => values.some((candidate) => !isMissingIntakeValue(candidate));
  if (field.id === 'memberName') return hasAnyIntakeValue(ctx.memberId, ctx.memberName);
  if (field.id === 'memberContact') return hasAnyIntakeValue(ctx.memberContact, ctx.memberId);
  if (field.id === 'classType') return hasAnyIntakeValue(ctx.sessionId, ctx.classType);
  if (field.id === 'membership') return hasAnyIntakeValue(ctx.membership);
  return !isMissingIntakeValue(value);
}

function pruneDetailForm(form: DetailForm | null, ctx: DetailContext): DetailForm | null {
  if (!form) return null;
  const fields = form.fields.filter((field) => !fieldHasContextValue(field, ctx));
  if (fields.length === 0) return null;
  return { ...form, fields };
}

function filterAiDetailForm(form: DetailForm | null, ctx: DetailContext, requiredFields: Set<string>): DetailForm | null {
  if (!form) return null;
  // AI drives, guard is a floor. Keep the AI's contextual questions (canonical + invented).
  // Only drop reportedBy (supplied by signed-in user) and member/class pickers the guard did
  // not flag, so a pure facility/ops incident never renders a member/session search.
  const fields = form.fields.map((field) => {
    if (field.id === 'reportedBy') return false;
    if (isProtectedEntityField(field.id) && !requiredFields.has(field.id)) return false;
    return requiredFields.has(field.id) ? { ...field, required: true } : field;
  }).filter(Boolean) as DetailFormField[];

  if (fields.length === 0) return null;
  return { ...form, fields };
}

function mergeDetailForms(primary: DetailForm | null, secondary: DetailForm | null): DetailForm | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  const seen = new Set<string>();
  const fields = [...primary.fields, ...secondary.fields].filter((field) => {
    if (seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });

  return {
    ...primary,
    description: primary.description || secondary.description,
    fields,
    submitLabel: primary.submitLabel || secondary.submitLabel,
  };
}

function batchDetailFormForConversation(form: DetailForm | null): DetailForm | null {
  if (!form) return null;
  const fields = limitConversationalFieldBatch(form.fields);
  if (fields.length === form.fields.length) return form;
  return {
    ...form,
    title: fields.length === 1 ? fields[0].label : form.title,
    description: undefined,
    fields,
    submitLabel: 'Continue',
  };
}

function detailFormFromQuestionText(text: string, ctx: DetailContext): DetailForm | null {
  const questionLines = text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[).\s-]*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.endsWith('?') || /which|what|when|where|issue|experience|report|happen|date|time|resolution|refund|apology|investigation|member|contact|studio|request|category|reported|priority|freeze|roll|hosted|partner/i.test(line));

  if (questionLines.length < 2) {
    return null;
  }

  const fieldIds = new Set<string>();
  const add = (id: string, present?: string) => {
    if (!present) fieldIds.add(id);
  };

  for (const line of questionLines) {
    const lower = line.toLowerCase();
    if (lower.includes('studio')) add('studio', ctx.studio);
    if (/client|member|affected|impact/.test(lower)) add('clientsAffected', ctx.clientsAffected);
    if (lower.includes('member') || lower.includes('name')) add('memberName', ctx.memberName);
    if (lower.includes('contact') || lower.includes('phone') || lower.includes('email')) add('memberContact', ctx.memberContact);
    if (lower.includes('issue') || lower.includes('experience') || lower.includes('report') || lower.includes('what happened') || lower.includes('what did')) add('description', ctx.description);
    if (lower.includes('when') || lower.includes('date') || lower.includes('time') || lower.includes('happen') || lower.includes('incident')) add('incidentDateTime', ctx.incidentDateTime);
    if (lower.includes('resolution') || lower.includes('looking for') || lower.includes('refund') || lower.includes('apology') || lower.includes('investigation') || lower.includes('something else')) add('desiredResolution', ctx.desiredResolution);
    if (lower.includes('specific') || lower.includes('type')) add('requestType', ctx.requestType);
    if (lower.includes('reported') || lower.includes('documented')) add('reportedBy', ctx.reportedBy);
    if (lower.includes('priority') || lower.includes('urgent')) add('priority', ctx.priority);
    if (lower.includes('freeze')) {
      add('membership', ctx.membership);
      add('freezeStartDate', ctx.freezeStartDate);
      add('freezeEndDate', ctx.freezeEndDate);
      add('freezeReason', ctx.freezeReason);
    }
    if (lower.includes('roll') || lower.includes('extension')) {
      add('membership', ctx.membership);
      add('classesRemaining', ctx.classesRemaining);
      add('packageExpiryDate', ctx.packageExpiryDate);
      add('requestedRolloverDate', ctx.requestedRolloverDate);
      add('rolloverReason', ctx.rolloverReason);
    }
    if (lower.includes('hosted') || lower.includes('partner') || lower.includes('influencer')) {
      add('partnerName', ctx.partnerName);
      add('hostedFeedbackArea', ctx.hostedFeedbackArea);
      add('prospectQuality', ctx.prospectQuality);
      add('followUpPreference', ctx.followUpPreference);
    }
    if (/(?:late|late arrival|arrived late|started late|punctuality|tardy)/.test(lower) && /(trainer|instructor|class|session|practice)/.test(lower)) {
      add('classType', ctx.classType);
      add('trainer', ctx.trainer);
      add('classDateTime', ctx.classDateTime);
      add('reportedTime', ctx.reportedTime);
      add('actualStartTime', ctx.actualStartTime);
      add('delayMinutes', ctx.delayMinutes);
      add('advanceNoticeGiven', ctx.advanceNoticeGiven);
      add('advanceNoticeTime', ctx.advanceNoticeTime);
      add('latenessReason', ctx.latenessReason);
      add('membersAffected', ctx.membersAffected);
      add('membersUpset', ctx.membersUpset);
      add('serviceRecoveryNeeded', ctx.serviceRecoveryNeeded);
      add('serviceRecoveryAction', ctx.serviceRecoveryAction);
    }
  }

  return normalizeDetailForm({
    title: 'Complete the ticket details',
    description: 'Athena grouped the missing operational details into a structured intake form using the Physique 57 master data lists.',
    fields: Array.from(fieldIds),
    submitLabel: 'Continue drafting ticket',
  });
}

function mergeDraftWithContext(draft: DraftTicket, ctx: DetailContext): DraftTicket {
  const resolvedOwner = ctx.assignedTo || ctx.owner || draft.assignedTo || resolveTicketAssignee(ctx.category || draft.category, ctx.studio || draft.studio);
  const resolvedDepartment = ctx.department || ctx.team || draft.department || resolveTicketDepartment(ctx.category || draft.category, resolvedOwner);
  return {
    ...draft,
    category: ctx.category || draft.category,
    subCategory: ctx.subCategory || draft.subCategory,
    priority: (ctx.priority as DraftTicket['priority']) || draft.priority,
    studio: ctx.studio || draft.studio,
    trainer: draft.trainer || null,
    classType: draft.classType || null,
    classDateTime: draft.classDateTime || null,
    memberName: draft.memberName || null,
    memberContact: draft.memberContact || null,
    reportedBy: ctx.reportedBy || draft.reportedBy,
    assignedTo: resolvedOwner,
    department: resolvedDepartment,
    sentiment: ctx.memberSentiment || draft.sentiment,
    conversationSummary: ctx.description || draft.conversationSummary,
  };
}

function contextFromDraft(draft: DraftTicket, ctx: DetailContext): DetailContext {
  return {
    ...ctx,
    category: draft.category || ctx.category,
    subCategory: draft.subCategory || ctx.subCategory,
    priority: draft.priority || ctx.priority,
    studio: draft.studio || ctx.studio,
    trainer: draft.trainer || undefined,
    classType: draft.classType || undefined,
    classDateTime: draft.classDateTime || undefined,
    memberName: draft.memberName || undefined,
    memberContact: draft.memberContact || undefined,
    reportedBy: ctx.reportedBy || draft.reportedBy,
    assignedTo: draft.assignedTo || ctx.assignedTo || ctx.owner,
    department: draft.department || ctx.department || ctx.team,
    memberSentiment: draft.sentiment || ctx.memberSentiment,
    description: ctx.description || draft.description || draft.conversationSummary,
  };
}

function requiredFieldsForIssue(ctx: DetailContext, draft?: DraftTicket | null): string[] {
  const mergedContext: DetailContext = draft
    ? {
        ...ctx,
        category: ctx.category || draft.category,
        subCategory: ctx.subCategory || draft.subCategory,
        priority: ctx.priority || draft.priority,
        studio: ctx.studio || draft.studio,
        trainer: ctx.trainer || draft.trainer || undefined,
        classType: ctx.classType || draft.classType || undefined,
        classDateTime: ctx.classDateTime || draft.classDateTime || undefined,
        memberName: ctx.memberName || draft.memberName || undefined,
        memberContact: ctx.memberContact || draft.memberContact || undefined,
        reportedBy: ctx.reportedBy || draft.reportedBy || undefined,
        memberSentiment: ctx.memberSentiment || draft.sentiment || undefined,
        description: ctx.description || draft.description || draft.conversationSummary || undefined,
      }
    : ctx;
  if (draft) {
    const fields = getMissingIntakeFields(mergedContext, { includeClientImpact: true });
    return draft.description?.trim()
      ? fields.filter((field) => field !== 'description')
      : fields;
  }
  return getMissingIntakeFields(mergedContext);
}

const MEMBER_ENTITY_KEYS = ['memberId', 'memberName', 'memberContact', 'membership'] as const;
const SESSION_ENTITY_KEYS = ['sessionId', 'classType', 'classDateTime', 'trainer'] as const;

function hasConfirmedAffectedClients(value?: string): boolean {
  return /^yes\b/i.test(value || '');
}

function shouldCarryMemberContext(issueText: string, ctx: DetailContext): boolean {
  const value = [
    issueText,
    ctx.initialReport,
    ctx.category,
    ctx.subCategory,
    ctx.requestType,
    ctx.clientsAffected,
  ].filter(Boolean).join(' ').toLowerCase();

  if (hasConfirmedAffectedClients(ctx.clientsAffected)) return true;
  return /member|client|customer|guest|prospect|profile|contact|phone|email|membership|package|billing|payment|refund|freeze|roll\s?over|extension|renewal|follow-up/.test(value);
}

function shouldCarrySessionContext(issueText: string, ctx: DetailContext): boolean {
  const value = [
    issueText,
    ctx.initialReport,
    ctx.category,
    ctx.subCategory,
    ctx.requestType,
  ].filter(Boolean).join(' ').toLowerCase();

  return /class|session|booking|schedul|waitlist|attendance|attendee|trainer|instructor|barre|cycle|powercycle|strength|late cancellation|no-show/.test(value);
}

function pruneEntityContextForIssue(
  ctx: DetailContext,
  issueText: string,
  explicitlyRequestedFields = new Set<string>()
): DetailContext {
  const next: DetailContext = { ...ctx };
  const keepMemberContext = shouldCarryMemberContext(issueText, ctx)
    || MEMBER_ENTITY_KEYS.some((key) => explicitlyRequestedFields.has(key));
  const keepSessionContext = shouldCarrySessionContext(issueText, ctx)
    || SESSION_ENTITY_KEYS.some((key) => explicitlyRequestedFields.has(key));

  if (!keepMemberContext) {
    MEMBER_ENTITY_KEYS.forEach((key) => {
      delete (next as Record<string, unknown>)[key];
    });
  }

  if (!keepSessionContext) {
    SESSION_ENTITY_KEYS.forEach((key) => {
      delete (next as Record<string, unknown>)[key];
    });
  }

  return next;
}

function detailFormForContext(ctx: DetailContext): DetailForm | null {
  const fields = requiredFieldsForIssue(ctx);
  if (fields.length === 0) return null;
  return normalizeDetailForm({
    title: 'Complete the ticket details',
    description: 'Athena needs these required fields before a ticket draft can be reviewed.',
    fields,
    submitLabel: 'Continue drafting ticket',
  });
}

function detailFormForIncompleteDraft(draft: DraftTicket | null | undefined, ctx: DetailContext): DetailForm | null {
  if (!draft) return null;
  const fields = requiredFieldsForIssue(ctx, mergeDraftWithContext(draft, ctx));

  if (fields.length === 0) return null;
  return normalizeDetailForm({
    title: 'Complete the ticket details',
    description: 'Athena needs these required fields before the ticket can be published.',
    fields,
    submitLabel: 'Submit required details',
  });
}

function buildClientDraft(ctx: DetailContext, text: string): DraftTicket {
  const sourceText = ctx.initialReport || ctx.description || text;
  const normalizedContext = normalizeDraftContextForSource(ctx, sourceText) as DetailContext;
  const category = normalizedContext.category || 'General Feedback';
  const subCategory = normalizedContext.subCategory || 'Other';
  const includeMemberContext = shouldCarryMemberContext(sourceText, normalizedContext);
  const includeSessionContext = shouldCarrySessionContext(sourceText, normalizedContext);
  const description = buildOperationalTicketDescription({
    sourceText,
    context: normalizedContext,
    category,
    subCategory,
  });
  const summary = summarizeOperationalReport(sourceText);

  return {
    title: [normalizedContext.intakeRoute || 'Ticket', subCategory, normalizedContext.trainer || (includeMemberContext ? normalizedContext.memberName : null)].filter(Boolean).join(' · ').slice(0, 96),
    description,
    category,
    subCategory,
    priority: (normalizedContext.priority as DraftTicket['priority']) || 'Medium',
    studio: normalizedContext.studio || 'Unspecified Studio',
    trainer: includeSessionContext ? normalizedContext.trainer || null : null,
    classType: includeSessionContext ? normalizedContext.classType || null : null,
    classDateTime: includeSessionContext ? normalizedContext.classDateTime || null : null,
    memberName: includeMemberContext ? normalizedContext.memberName || null : null,
    memberContact: includeMemberContext ? normalizedContext.memberContact || null : null,
    reportedBy: normalizedContext.reportedBy || null,
    assignedTo: normalizedContext.assignedTo || normalizedContext.owner || null,
    department: normalizedContext.department || normalizedContext.team || null,
    tags: ['ai-draft', normalizedContext.intakeRoute, category, subCategory].filter(Boolean).map((value) =>
      String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    ),
    sentiment: normalizedContext.memberSentiment || 'Neutral',
    conversationSummary: summary,
  };
}

function normalizeDraftForReview(draft: DraftTicket, ctx: DetailContext, text: string): DraftTicket {
  const sourceText = ctx.initialReport || ctx.description || text || draft.conversationSummary || draft.description;
  const category = draft.category || ctx.category || 'General Feedback';
  const subCategory = draft.subCategory || ctx.subCategory || 'Other';
  const normalizedContext = normalizeDraftContextForSource({
    ...ctx,
    intakeRoute: ctx.intakeRoute,
    category,
    subCategory,
    studio: draft.studio || ctx.studio,
    trainer: draft.trainer || ctx.trainer,
    classType: draft.classType || ctx.classType,
    classDateTime: draft.classDateTime || ctx.classDateTime,
    memberName: draft.memberName || ctx.memberName,
    memberContact: draft.memberContact || ctx.memberContact,
    desiredResolution: ctx.desiredResolution,
  }, sourceText) as DetailContext;
  const includeMemberContext = shouldCarryMemberContext(sourceText, normalizedContext);
  const includeSessionContext = shouldCarrySessionContext(sourceText, normalizedContext);
  const description = draftDescriptionNeedsRewrite(draft.description, normalizedContext.intakeRoute, sourceText)
    ? buildOperationalTicketDescription({
        sourceText,
        context: normalizedContext,
        category,
        subCategory,
      })
    : draft.description;
  const metadata = draft.metadata && typeof draft.metadata === 'object'
    ? Object.fromEntries(
        Object.entries(draft.metadata).filter(([key]) => key !== 'recommendedResolutionSteps')
      )
    : draft.metadata;

  return {
    ...draft,
    metadata,
    title: draft.title || [normalizedContext.intakeRoute || 'Ticket', subCategory, normalizedContext.trainer || null].filter(Boolean).join(' · ').slice(0, 96),
    description,
    category,
    subCategory,
    studio: normalizedContext.studio || draft.studio || 'Unspecified Studio',
    trainer: includeSessionContext ? normalizedContext.trainer || draft.trainer || null : null,
    classType: includeSessionContext ? normalizedContext.classType || draft.classType || null : null,
    classDateTime: includeSessionContext ? normalizedContext.classDateTime || draft.classDateTime || null : null,
    memberName: includeMemberContext ? normalizedContext.memberName || draft.memberName || null : null,
    memberContact: includeMemberContext ? normalizedContext.memberContact || draft.memberContact || null : null,
    conversationSummary: summarizeOperationalReport(sourceText),
  };
}

function scorePercentFromEvaluation(input: TrainerEvaluationInput): number {
  const totalWeightage = input.scores.reduce((sum, item) => sum + item.weightage, 0);
  const totalScore = input.scores.reduce((sum, item) => sum + Math.max(0, Math.min(item.weightage, item.score)), 0);
  return totalWeightage ? Math.round((totalScore / totalWeightage) * 100) : 0;
}

function trainerEvaluationBand(scorePercent: number): string {
  if (scorePercent < 65) return 'High coaching priority';
  if (scorePercent < 80) return 'Development watch';
  return 'On-track performance';
}

function buildTrainerEvaluationDraft(input: TrainerEvaluationInput): DraftTicket {
  const scorePercent = scorePercentFromEvaluation(input);
  const structuredDescription = buildTrainerEvaluationText({ ...input, rawText: undefined });
  const trainerReview = buildTrainerReviewRecord(input, {
    source: 'athena',
    sourceRef: `athena-trainer-review:${input.trainer}:${input.template}:${input.reviewPeriod || Date.now()}`,
  });
  return {
    title: `Instructor evaluation · ${input.trainer} · ${input.template}`,
    description: structuredDescription,
    category: 'Trainer Feedback',
    subCategory: 'Knowledge and Competence',
    priority: 'Low',
    studio: input.studio || STUDIOS[0],
    trainer: input.trainer,
    classType: input.classType || null,
    classDateTime: input.reviewPeriod || null,
    memberName: null,
    memberContact: null,
    reportedBy: null,
    assignedTo: 'Trainer Profile',
    department: 'Training & Client Experience',
    tags: ['trainer-profile', 'instructor-evaluation', 'profile-only', input.template.toLowerCase()],
    sentiment: scorePercent >= 80 ? 'Positive' : scorePercent >= 65 ? 'Neutral' : 'Negative',
    conversationSummary: [
      `Instructor evaluation drafted for ${input.trainer} (${input.template}).`,
      `Weighted score: ${scorePercent}% · ${trainerEvaluationBand(scorePercent)}.`,
      input.focusPoints ? `Primary focus: ${input.focusPoints}` : '',
      input.goals ? `Target goal: ${input.goals}` : '',
      'Recorded under Trainer Profiles only. No operational owner or SLA follow-up required.',
    ].filter(Boolean).join('\n'),
    metadata: {
      profileOnly: true,
      trainerReview,
      routing: {
        department: 'Training & Client Experience',
        assigned_to: 'Trainer Profile',
        status: 'Closed',
        priority: 'Low',
        profile_only: true,
        routing_source: 'trainer_profile_record',
      },
    },
  };
}

export const ChatInterface: React.FC<{ onOpenExistingTicket?: (ticket: Ticket) => void; resetVersion?: number; onNewChat?: () => void; athenaTrainerMode?: boolean; onHome?: () => void }> = ({ onOpenExistingTicket, resetVersion = 0, onNewChat, athenaTrainerMode = false, onHome }) => {
  const { createApprovedTicket, tickets, setSelectedTicket } = useTickets();
  const { user } = useBackendAuth();
  const activeAiProvider = ATHENA_AI_PROVIDER;
  const athenaDebugTraceEnabled = isAthenaDebugTraceEnabled();
const reporterName = getReporterName(user);
  const reporterFirstName = getReporterFirstName(reporterName);
  const [messages, setMessages] = useState<Message[]>(() => [buildGreetingMessage(reporterName)]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>(() => loadChatHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [context, setContext] = useState<DetailContext>({});
  const [pendingSingleField, setPendingSingleField] = useState<DetailFormField | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLiveText, setVoiceLiveText] = useState('');
  const [voiceHint, setVoiceHint] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeDraftReviewMessageId, setActiveDraftReviewMessageId] = useState<string | null>(null);
  const [instructorEvaluationMode, setInstructorEvaluationMode] = useState(false);
  const [textToTicketOpen, setTextToTicketOpen] = useState(false);
  const [textToTicketText, setTextToTicketText] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<ContextTemplate | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'png' | null>(null);
  const [loadDecorativeRobot, setLoadDecorativeRobot] = useState(false);
  const [specialistClassification, setSpecialistClassification] = useState<IssueClassification | null>(null);
  const specialistMemberContextRef = useRef<MemberContextSnapshot | null>(null);
  const publishingRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalVoiceTranscriptRef = useRef('');
  const voiceSessionActiveRef = useRef(false);
  const voiceManualStopRef = useRef(false);
  const voiceSilenceTimerRef = useRef<number | null>(null);
  const requestNonceRef = useRef(0);
  const activeChatEpochRef = useRef(0);
  const shownRelatedTicketNoticeKeysRef = useRef<Set<string>>(new Set());
  const lastResetVersionRef = useRef(resetVersion);
  const [recentTicketsExpanded, setRecentTicketsExpanded] = useState(false);
  const [showSmartReplies, setShowSmartReplies] = useState(false);
  const [starterSeed] = useState(() => Math.floor(Math.random() * 997));
  const recentTickets = useMemo(
    () => tickets
      .filter((ticket) => !isTrainerEvaluationProfileOnly(ticket))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
    [tickets]
  );
  const smartVoiceHints = useMemo(() => {
    const source = voiceLiveText || input;
    return source.trim() ? buildVoiceExtractionHints(source) : [];
  }, [input, voiceLiveText]);
  const isUrgentInput = useMemo(() => {
    if (input.length < 6) return false;
    return /\b(injur|injury|unsafe|harass|harassment|theft|fire|blood|emergency|accident|fracture|fell|ambulance|angry|furious|irate|refund|cancel(?:l?ation)?|lawsuit|legal|escalat|abuse|assault)\b/i.test(input);
  }, [input]);
  const capturedContextSummary = useMemo(() => {
    const items: string[] = [];
    if (context.studio) items.push(`📍 ${context.studio.split(',')[0]}`);
    if (context.category) items.push(`🏷 ${context.category}`);
    if (context.subCategory) items.push(`• ${context.subCategory}`);
    if (context.memberName) items.push(`👤 ${context.memberName}`);
    if (context.priority) items.push(`⚡ ${context.priority}`);
    if (context.classType) items.push(`🏋️ ${context.classType}`);
    return items;
  }, [context]);
  const activeDraftReviewMessage = useMemo(
    () => messages.find((message) => message.id === activeDraftReviewMessageId && message.ticket) || null,
    [activeDraftReviewMessageId, messages]
  );

  const smartQuickReplies = useMemo(() => {
    if (loading || instructorEvaluationMode || activeTemplate) return [];
    const replies: Array<{ label: string; value: string }> = [];
    const hasMember = Boolean(context.memberName || context.memberId);
    const hasSession = Boolean(context.sessionId || context.classType);
    const hasCategory = Boolean(context.category);
    const hasDraft = messages.some((message) => message.ticket && !message.published);
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === 'assistant' && lastMessage.detailForm && !lastMessage.ticket) {
      replies.push({ label: 'I’m not sure', value: 'I’m not sure — can you help me pick?' });
      replies.push({ label: 'Skip for now', value: 'Skip that for now.' });
    }
    if (!hasMember) {
      replies.push({ label: 'Add member', value: 'The member involved is ' });
    }
    if (!hasSession) {
      replies.push({ label: 'Add session', value: 'The class / session was ' });
    }
    if (!hasCategory) {
      replies.push({ label: 'It’s a complaint', value: 'This is a complaint.' });
      replies.push({ label: 'It’s feedback', value: 'This is member feedback.' });
    }
    if (hasDraft) {
      replies.push({ label: 'Publish draft', value: 'Please publish the ticket draft.' });
    }
    replies.push({ label: 'Draft now', value: 'Please go ahead and draft the ticket for review.' });
    if (isUrgentInput) {
      replies.unshift({ label: 'Flag urgent', value: 'Please flag this as high priority.' });
    }
    return replies.slice(0, 4);
  }, [activeTemplate, context.category, context.memberId, context.memberName, context.sessionId, context.classType, instructorEvaluationMode, isUrgentInput, loading, messages]);

  const applySmartQuickReply = (reply: { label: string; value: string }) => {
    setInput(reply.value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const length = textareaRef.current?.value.length || 0;
      textareaRef.current?.setSelectionRange(length, length);
    });
  };

  const addExportError = useCallback((format: string, error: unknown) => {
    const message = getDisplayError(error, `Could not export ${format}`);
    setMessages((prev) => [
      ...prev,
      {
        id: `export-error-${Date.now()}`,
        role: 'assistant',
        content: `I could not export the conversation as ${format}: ${message}`,
      },
    ]);
  }, []);

  const exportTranscriptText = useCallback(() => {
    try {
      const exportedAt = new Date();
      downloadTextFile(
        `${transcriptFileBaseName(exportedAt)}.txt`,
        plainTextForChatTranscript(messages, { conversationId, reporterName, exportedAt }),
        'text/plain;charset=utf-8'
      );
    } catch (error) {
      addExportError('text', error);
    }
  }, [addExportError, conversationId, messages, reporterName]);

  const exportTranscriptHtml = useCallback(() => {
    try {
      const exportedAt = new Date();
      downloadTextFile(
        `${transcriptFileBaseName(exportedAt)}.html`,
        htmlForChatTranscript(messages, { conversationId, reporterName, exportedAt }),
        'text/html;charset=utf-8'
      );
    } catch (error) {
      addExportError('HTML', error);
    }
  }, [addExportError, conversationId, messages, reporterName]);

  const exportTranscriptPng = useCallback(async () => {
    const node = scrollRef.current;
    if (!node) return;
    setExportingFormat('png');
    try {
      const exportedAt = new Date();
      const dataUrl = await pngDataUrlForElementScreenshot(node);
      downloadDataUrl(`${transcriptFileBaseName(exportedAt)}.png`, dataUrl);
    } catch (error) {
      addExportError('PNG', error);
    } finally {
      setExportingFormat(null);
    }
  }, [addExportError]);

  useEffect(() => {
    setContext((current) => {
      if (current.reportedBy === reporterName) return current;
      return { ...current, reportedBy: reporterName };
    });
  }, [reporterName]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0].id !== 'greet') return current;
      return [buildGreetingMessage(reporterName)];
    });
  }, [reporterName]);

  useEffect(() => {
    setChatHistory(loadChatHistory());
  }, []);

  useEffect(() => {
    const userMessageCount = messages.filter((message) => message.role === 'user').length;
    if (userMessageCount === 0) return;
    const firstUserMessageId = messages.find((message) => message.role === 'user')?.id || 'current';
    const id = conversationId || `local-${firstUserMessageId}`;
    const entry: ChatHistoryEntry = {
      id,
      title: chatHistoryTitle(messages, context),
      updatedAt: Date.now(),
      conversationId,
      context,
      messages,
    };
    setChatHistory((current) => {
      const next = [entry, ...current.filter((item) => item.id !== id)];
      saveChatHistory(next);
      return loadChatHistory();
    });
  }, [conversationId, context, messages]);

  useEffect(() => {
    const mode = instructorEvaluationMode ? 'trainer' : 'ticket';
    document.documentElement.dataset.athenaMode = mode;
    window.dispatchEvent(new CustomEvent('athena-mode-change', { detail: { mode } }));
    return () => {
      document.documentElement.dataset.athenaMode = 'ticket';
      window.dispatchEvent(new CustomEvent('athena-mode-change', { detail: { mode: 'ticket' } }));
    };
  }, [instructorEvaluationMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const idle = window.requestIdleCallback?.(() => setLoadDecorativeRobot(true), { timeout: 2_500 });
    if (idle != null) return () => window.cancelIdleCallback?.(idle);
    const handle = window.setTimeout(() => setLoadDecorativeRobot(true), 1_500);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    const maybeCtor = (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    setVoiceSupported(Boolean(maybeCtor));
  }, []);

  useEffect(() => () => {
    voiceSessionActiveRef.current = false;
    speechRecognitionRef.current?.stop();
    if (voiceSilenceTimerRef.current) window.clearTimeout(voiceSilenceTimerRef.current);
  }, []);

  const addAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    setPendingAttachments((current) => {
      const next = [...current];
      Array.from(files).forEach((file) => {
        const exists = next.some((entry) => (
          entry.file.name === file.name &&
          entry.file.size === file.size &&
          entry.file.lastModified === file.lastModified
        ));
        if (!exists) next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file });
      });
      return next.slice(0, 8);
    });
  };

  const normalizeVoiceText = (value: string) =>
    value
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim();

  const armVoiceSilenceTimer = () => {
    if (voiceSilenceTimerRef.current) window.clearTimeout(voiceSilenceTimerRef.current);
    voiceSilenceTimerRef.current = window.setTimeout(() => {
      if (voiceSessionActiveRef.current && speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    }, 2500);
  };

  const startVoiceCapture = () => {
    if (loading || listening) return;
    const maybeCtor = (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!maybeCtor) return;

    finalVoiceTranscriptRef.current = '';
    voiceManualStopRef.current = false;
    voiceSessionActiveRef.current = true;
    setVoiceLiveText('');
    setVoiceHint('Listening… speak naturally.');
    const recognition = new maybeCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const fragment = event.results[i][0]?.transcript || '';
        const cleanedFragment = normalizeVoiceText(fragment);
        if (!cleanedFragment || cleanedFragment.length < 2) continue;
        if (event.results[i].isFinal) {
          finalVoiceTranscriptRef.current = normalizeVoiceText(`${finalVoiceTranscriptRef.current} ${cleanedFragment}`);
        } else {
          interim += ` ${cleanedFragment}`;
        }
      }
      const composed = normalizeVoiceText(`${finalVoiceTranscriptRef.current} ${interim}`);
      setVoiceLiveText(composed);
      setInput(composed);
      armVoiceSilenceTimer();
    };
    recognition.onerror = (event) => {
      const reason = event?.error ? `Microphone issue: ${event.error}` : 'Microphone issue detected.';
      setVoiceHint(reason);
      setListening(false);
      voiceSessionActiveRef.current = false;
      speechRecognitionRef.current = null;
      if (voiceSilenceTimerRef.current) window.clearTimeout(voiceSilenceTimerRef.current);
    };
    recognition.onend = () => {
      if (voiceSilenceTimerRef.current) window.clearTimeout(voiceSilenceTimerRef.current);
      const finalTranscript = normalizeVoiceText(finalVoiceTranscriptRef.current);
      if (voiceSessionActiveRef.current && !voiceManualStopRef.current) {
        try {
          recognition.start();
          setVoiceHint('Listening…');
          return;
        } catch {
          // fall through to finalize
        }
      }
      setListening(false);
      voiceSessionActiveRef.current = false;
      speechRecognitionRef.current = null;
      setVoiceLiveText('');
      setVoiceHint('');
      if (finalTranscript && !loading) {
        sendMessage(finalTranscript);
      }
    };
    speechRecognitionRef.current = recognition;
    setListening(true);
    armVoiceSilenceTimer();
    recognition.start();
  };

  const stopVoiceCapture = () => {
    voiceManualStopRef.current = true;
    voiceSessionActiveRef.current = false;
    if (voiceSilenceTimerRef.current) window.clearTimeout(voiceSilenceTimerRef.current);
    setVoiceHint('Finalizing transcript…');
    speechRecognitionRef.current?.stop();
  };

  const buildContextPreamble = (ctx: DetailContext) => {
    const parts: string[] = [];

    // --- Core identity fields ---
    if (ctx.memberName) parts.push(`Member: ${ctx.memberName}`);
    if (ctx.memberId) parts.push(`Momence ID: ${ctx.memberId}`);
    if (ctx.memberContact) parts.push(`Contact: ${ctx.memberContact}`);
    if (ctx.membership) parts.push(`Membership: ${ctx.membership}`);

    // --- Ticket routing ---
    if (ctx.intakeRoute) parts.push(`Route: ${ctx.intakeRoute}`);
    if (ctx.requestType) parts.push(`Type: ${ctx.requestType}`);
    if (ctx.category) parts.push(`Category: ${ctx.category}`);
    if (ctx.subCategory) parts.push(`Sub-category: ${ctx.subCategory}`);
    if (ctx.priority) parts.push(`Priority: ${ctx.priority}`);
    if (ctx.clientsAffected) parts.push(`Clients affected: ${ctx.clientsAffected}`);
    if (ctx.reportedBy) parts.push(`Reported by: ${ctx.reportedBy}`);

    // --- Session & location context ---
    if (ctx.studio) parts.push(`Studio: ${ctx.studio}`);
    if (ctx.classType) parts.push(`Class: ${ctx.classType}`);
    if (ctx.trainer) parts.push(`Trainer: ${ctx.trainer}`);
    if (ctx.classDateTime) parts.push(`Session date/time: ${ctx.classDateTime}`);
    if (ctx.reportedTime) parts.push(`Reported time: ${ctx.reportedTime}`);
    if (ctx.actualStartTime) parts.push(`Actual start time: ${ctx.actualStartTime}`);
    if (ctx.delayMinutes) parts.push(`Delay minutes: ${ctx.delayMinutes}`);
    if (ctx.advanceNoticeGiven) parts.push(`Advance notice: ${ctx.advanceNoticeGiven}`);
    if (ctx.advanceNoticeTime) parts.push(`Advance notice time: ${ctx.advanceNoticeTime}`);
    if (ctx.sessionId) parts.push(`Momence session ID: ${ctx.sessionId}`);

    // --- Issue substance ---
    if (ctx.description) parts.push(`Issue: ${ctx.description}`);
    if (ctx.incidentDateTime) parts.push(`When noticed/reported: ${ctx.incidentDateTime}`);
    if (ctx.memberSentiment) parts.push(`Sentiment: ${ctx.memberSentiment}`);
    if (ctx.urgencyReason) parts.push(`Urgency: ${ctx.urgencyReason}`);
    if (ctx.desiredResolution) parts.push(`Resolution requested: ${ctx.desiredResolution}`);
    if (ctx.membersAffected) parts.push(`Members affected: ${ctx.membersAffected}`);
    if (ctx.membersUpset) parts.push(`Members upset / reaction: ${ctx.membersUpset}`);
    if (ctx.latenessReason) parts.push(`Late arrival reason: ${ctx.latenessReason}`);
    if (ctx.serviceRecoveryNeeded) parts.push(`Service recovery needed: ${ctx.serviceRecoveryNeeded}`);
    if (ctx.serviceRecoveryAction) parts.push(`Service recovery action: ${ctx.serviceRecoveryAction}`);

    // --- Remaining custom fields (catch-all) ---
    const HANDLED_KEYS = new Set([
      'memberName', 'memberId', 'memberContact', 'membership',
      'intakeRoute', 'requestType', 'category', 'subCategory', 'priority', 'clientsAffected', 'reportedBy',
      'studio', 'classType', 'trainer', 'classDateTime', 'sessionId',
      'description', 'incidentDateTime', 'memberSentiment', 'urgencyReason', 'desiredResolution',
      'reportedTime', 'actualStartTime', 'delayMinutes', 'advanceNoticeGiven', 'advanceNoticeTime',
      'membersAffected', 'membersUpset', 'latenessReason', 'serviceRecoveryNeeded', 'serviceRecoveryAction',
      'conversationPlan', 'reporterFirstName', 'initialReport',
    ]);
    Object.entries(ctx).forEach(([key, value]) => {
      if (value && !HANDLED_KEYS.has(key)) {
        parts.push(`${getDetailField(key)?.label || key}: ${value}`);
      }
    });

    // --- Constant hints so AI picks valid values ---
    const hints: string[] = [];
    if (!ctx.studio) hints.push(`Valid studios: ${STUDIOS.join(', ')}`);
    if (!ctx.classType) hints.push(`Valid class types: ${CLASS_TYPES.join(', ')}`);
    if (!ctx.trainer) hints.push(`Valid trainers: ${TRAINERS.join(', ')}`);

    if (ctx.conversationPlan) parts.push(`Specialist context: ${ctx.conversationPlan}`);

    // --- Natural-language gap description (replaces rigid "ASK NEXT: field label") ---
    const missingNow = getMissingIntakeFields(ctx);
    const stateLines: string[] = [];
    if (missingNow.length === 0) {
      stateLines.push('STATUS: All key details captured. Draft the ticket — do not ask any more questions.');
    } else {
      const gapDesc = buildNarrativeGapDescription(missingNow, ctx);
      stateLines.push(`WHAT'S STILL UNCLEAR: ${gapDesc}`);
      stateLines.push('Ask naturally about the most important gap. Do NOT use field labels or database terms — phrase it as a human would in conversation. Do NOT ask two things at once. Do NOT re-ask anything already in context above.');
      // Cross-field inference hints — tell AI when a field is already implied by something else
      if ((ctx.memberName || ctx.memberId) && missingNow.includes('membersAffected')) {
        stateLines.push(`NOTE: The member (${ctx.memberName || ctx.memberId}) is already known — membersAffected is answered, skip it.`);
      }
      if (ctx.incidentDateTime && missingNow.includes('reportedTime')) {
        stateLines.push(`NOTE: reportedTime is already covered by the incident time — skip it.`);
      }
      if ((ctx.delayMinutes || ctx.actualStartTime) && (missingNow.includes('actualStartTime') || missingNow.includes('delayMinutes'))) {
        stateLines.push(`NOTE: Delay duration is already answered — do not ask for it again.`);
      }
    }

    const contextBlock = parts.length ? `[Context — ${parts.join(' | ')}]` : '';
    const hintsBlock = hints.length ? `[Constants — ${hints.join(' | ')}]` : '';
    const stateBlock = stateLines.length ? `[State — ${stateLines.join(' | ')}]` : '';
    return [contextBlock, hintsBlock, stateBlock].filter(Boolean).join('\n') + (contextBlock || hintsBlock || stateBlock ? '\n' : '');
  };

  const sendMessage = async (text: string, contextOverride?: DetailContext) => {
    if (!text.trim() || loading) return;
    if (!contextOverride && !pendingSingleField && isCasualGreeting(text)) {
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
      };
      setInput('');
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      await sleep(520);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          aiGenerated: true,
          content: reporterFirstName
            ? `Hi ${reporterFirstName}, I’m ready. What are we logging? 🙂`
            : "Hi, I’m ready. What are we logging? 🙂",
          suggestedChips: getGreetingQuickActions(),
        },
      ]);
      setLoading(false);
      return;
    }
    let activeContext: DetailContext = { ...(contextOverride || context), reportedBy: reporterName };
    if (!contextOverride && pendingSingleField && pendingSingleField.type !== 'select') {
      activeContext = applyDetailValue(context, pendingSingleField.id, text.trim());
      activeContext.reportedBy = reporterName;
      setContext(activeContext);
      setPendingSingleField(null);
    }
    const capturedFeedback = !contextOverride && !pendingSingleField
      ? captureMemberFeedbackFromText(text, activeContext)
      : null;

    if (capturedFeedback) {
      activeContext = applyDetailValue(activeContext, 'description', capturedFeedback);
      activeContext.reportedBy = reporterName;
      setContext(activeContext);
    }
    const issueText = capturedFeedback || text;
    if (!activeContext.initialReport && !/^here are the missing details:/i.test(text.trim())) {
      activeContext = { ...activeContext, initialReport: issueText };
    }
    const localInference = inferIntakeContextFromText(issueText, activeContext);

    // Infer incidentDateTime from common temporal words — the pure inference fn avoids Date.now()
    if (!localInference.incidentDateTime && isMissingIntakeValue(activeContext.incidentDateTime)) {
      const lowerText = issueText.toLowerCase();
      if (/\b(today|just now|this morning|this afternoon|this evening|tonight|right now|currently)\b/.test(lowerText)) {
        const now = new Date();
        localInference.incidentDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      } else if (/\byesterday\b/.test(lowerText)) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        localInference.incidentDateTime = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}T00:00`;
      }
    }

    if (Object.keys(localInference).length > 0) {
      activeContext = { ...activeContext, ...localInference, reportedBy: reporterName };
      setContext(activeContext);
    }
    if (reporterFirstName) {
      activeContext = { ...activeContext, reporterFirstName };
    }
    if (
      !contextOverride &&
      !/^here are the missing details:/i.test(text.trim()) &&
      issueText.trim().length > 8
    ) {
      // Classify issue type (cached after first turn)
      let classification = specialistClassification;
      if (!classification) {
        classification = classifyIssue(issueText);
        setSpecialistClassification(classification);
      }

      // Kick off member context fetch if we have a name (non-blocking)
      const memberNameForContext = activeContext.memberName || localInference.memberName;
      if (memberNameForContext && !specialistMemberContextRef.current) {
        fetchMemberContext(memberNameForContext, tickets).then((ctx) => {
          if (ctx) specialistMemberContextRef.current = ctx;
        });
      }

      // Rebuild plan every turn so already-answered fields are pruned from the AI's instruction
      const plan = buildIntakeConversationPlan({
        initialText: issueText,
        context: activeContext,
        reporterName,
      });
      const specialistBlock = buildSpecialistPreamble(
        classification,
        specialistMemberContextRef.current,
        activeContext,
      );
      activeContext = {
        ...activeContext,
        reporterFirstName: plan.reporterFirstName || reporterFirstName,
        conversationPlan: `${specialistBlock}\n\nCONVERSATION PLAN:\n${serializeConversationPlan(plan)}`,
      };
    }

    activeContext.reportedBy = reporterName;
    activeContext = pruneEntityContextForIssue(activeContext, issueText);
    activeContext.reportedBy = reporterName;
    setContext(activeContext);
    const preamble = buildContextPreamble(activeContext);
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    const requestNonce = ++requestNonceRef.current;
    const requestEpoch = activeChatEpochRef.current;
    try {
      setLoading(true);
      const relatedTickets = findRelatedSubmittedTickets(capturedFeedback || text, activeContext, tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket)));
      const relatedTicketNotice = buildRelatedTicketNotice(relatedTickets, shownRelatedTicketNoticeKeysRef.current);
      if (relatedTicketNotice) {
        shownRelatedTicketNoticeKeysRef.current.add(relatedTicketNotice.key);
        setMessages((prev) => [
          ...prev,
          {
            id: `${relatedTicketNotice.messageIdPrefix}-${Date.now()}`,
            role: 'assistant',
            content: relatedTicketNotice.content,
          },
        ]);
      }

      const missingFields = requiredFieldsForIssue(activeContext);

      const relatedTicketsSummary = [
        ...(relatedTickets.exactDuplicate ? [relatedTickets.exactDuplicate] : []),
        ...relatedTickets.similarTickets.slice(0, 2),
      ].map((t) => ({
        title: t.title || '',
        status: t.status || '',
        createdAt: t.createdAt,
        studio: t.studio || undefined,
        category: t.category || undefined,
      }));

      const { data, error } = await withTimeout(
        invokeTicketingFunction<AiIntakeResponse>('ticket-ai-chat', {
          body: buildAthenaDraftRequestBody({
            aiProvider: activeAiProvider,
            debugTrace: athenaDebugTraceEnabled,
            messages: newMessages,
            preamble,
            conversationId,
            context: activeContext,
            intakeContract: {
              missingFields,
              fields: missingFields
                .map((id) => getDetailField(id))
                .filter(Boolean),
            },
            relatedTickets: relatedTicketsSummary,
          }),
        }),
        ATHENA_CHAT_RESPONSE_TIMEOUT_MS,
        ATHENA_CHAT_TIMEOUT_MESSAGE
      );

      if (error) throw error;
      if (requestEpoch !== activeChatEpochRef.current || requestNonce !== requestNonceRef.current) return;

      if (data?.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const inferredContext = normalizeInferredContext(data?.inferredContext);
      let responseContext = mergeInferredContext(activeContext, inferredContext, data?.urgencyReason);
      if (Object.keys(inferredContext).length > 0 || data?.urgencyReason) {
        responseContext = { ...responseContext, reportedBy: reporterName };
        activeContext = responseContext;
        setContext(responseContext);
      }

      const normalizedAiTicket = data?.ticket ? normalizeDraftForReview(data.ticket, responseContext, text) : null;
      const remainingMissingFields = requiredFieldsForIssue(responseContext, normalizedAiTicket || undefined);
      const requiredFieldSet = new Set(remainingMissingFields);
      const incompleteDraftForm = detailFormForIncompleteDraft(normalizedAiTicket, responseContext);
      const localMissingForm = normalizedAiTicket ? null : detailFormForContext(responseContext);
      const deterministicForm = incompleteDraftForm || localMissingForm;
      const acceptsAiDetailForm = shouldAcceptAiDetailForm({
        remainingMissingFieldCount: remainingMissingFields.length,
        aiNeedsMoreInfo: data?.needsMoreInfo,
        aiProposedFieldCount: data?.detailForm?.fields?.length ?? 0,
      });
      const normalizedForm = acceptsAiDetailForm
        ? pruneDetailForm(
            filterAiDetailForm(normalizeDetailForm(data?.detailForm, responseContext), responseContext, requiredFieldSet),
            responseContext
          )
        : null;
      const detailForm = mergeDetailForms(deterministicForm, normalizedForm);
      const parsedQuestionForm = acceptsAiDetailForm && !detailForm && !normalizedAiTicket
        ? pruneDetailForm(
            filterAiDetailForm(detailFormFromQuestionText(data?.reply || '', responseContext), responseContext, requiredFieldSet),
            responseContext
          )
        : null;
      const finalDetailForm = batchDetailFormForConversation(detailForm || parsedQuestionForm);
      const holdDraftForMoreInfo = shouldHoldDraftForMoreInfo({
        hasDetailForm: Boolean(finalDetailForm),
        remainingMissingFieldCount: remainingMissingFields.length,
        aiNeedsMoreInfo: data?.needsMoreInfo,
      });
      let ticket = holdDraftForMoreInfo
        ? null
        : normalizedAiTicket || buildClientDraft(responseContext, text);
      if (
        ticket &&
        responseContext.category === 'Hosted Class & Partnerships' &&
        (ticket.category === 'General Feedback' || ticket.subCategory === 'Other')
      ) {
        ticket = {
          ...ticket,
          category: 'Hosted Class & Partnerships',
          subCategory: responseContext.subCategory || 'Hosted Class Feedback',
          tags: Array.from(new Set([...(ticket.tags || []), 'hosted-class', 'partnership-feedback'])),
        };
      }
      if (ticket) {
        const syncedContext = contextFromDraft(ticket, responseContext);
        activeContext = { ...syncedContext, reportedBy: reporterName };
        setContext(activeContext);
      }
      const singleField = finalDetailForm?.fields.length === 1 ? finalDetailForm.fields[0] : null;
      const singleFieldNeedsPicker = singleField
        ? ['memberName', 'memberContact', 'classType', 'sessionId', 'membership'].includes(singleField.id)
        : false;
      const singleFieldChips = singleField && !singleFieldNeedsPicker && singleField.type === 'select'
        ? chipsForSingleField(singleField, responseContext)
        : [];
      const renderSingleFieldAsChat = Boolean(
        singleField &&
        !singleFieldNeedsPicker &&
        (singleField.type !== 'select' || singleFieldChips.length > 0)
      );
      const assistantContent = singleField
        ? buildNaturalSingleFieldPrompt({
            field: singleField,
            reporterFirstName,
          })
        : (data?.reply && data.reply.trim().length > 5)
          ? data.reply
          : finalDetailForm
            ? `${reporterFirstName ? `${reporterFirstName}, ` : ''}Just a couple more details and we'll have a clean draft ready! 🙂`
            : ticket
              ? "Looks good — I've drafted the ticket below. Take a quick look before publishing."
              : "Hmm, I didn't quite catch that. Could you tell me a bit more?";
      setPendingSingleField(singleField && !singleFieldNeedsPicker && singleField.type !== 'select' ? singleField : null);
      await sleep(writingPauseMs(assistantContent));
      if (requestEpoch !== activeChatEpochRef.current || requestNonce !== requestNonceRef.current) return;
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        aiGenerated: true,
        content: assistantContent,
        ticket,
        suggestedChips: singleFieldChips,
        detailForm: renderSingleFieldAsChat ? null : finalDetailForm,
        published: false,
        ticketId: undefined,
      };
      setMessages((prev) => [
        ...prev,
        assistantMsg,
      ]);
      if (ticket) {
        setActiveDraftReviewMessageId(assistantMsg.id);
      }

    } catch (e: unknown) {
      if (requestEpoch !== activeChatEpochRef.current || requestNonce !== requestNonceRef.current) return;
      const message = getDisplayError(e, 'Ticket AI chat failed');
      if (message.includes(ATHENA_CHAT_TIMEOUT_MESSAGE)) {
        const timeoutForm = batchDetailFormForConversation(detailFormForContext(activeContext));
        const singleField = timeoutForm?.fields.length === 1 ? timeoutForm.fields[0] : null;
        const singleFieldNeedsPicker = singleField
          ? ['memberName', 'memberContact', 'classType', 'sessionId', 'membership'].includes(singleField.id)
          : false;
        const singleFieldChips = singleField && !singleFieldNeedsPicker && singleField.type === 'select'
          ? chipsForSingleField(singleField, activeContext)
          : [];
        const renderSingleFieldAsChat = Boolean(
          singleField &&
          !singleFieldNeedsPicker &&
          (singleField.type !== 'select' || singleFieldChips.length > 0)
        );
        const fallbackTicket = timeoutForm ? null : buildClientDraft(activeContext, text);
        const fallbackContent = singleField
          ? buildNaturalSingleFieldPrompt({ field: singleField, reporterFirstName })
          : timeoutForm
            ? `${reporterFirstName ? `${reporterFirstName}, ` : ""}I’m taking a little longer than usual — continuing locally so you don’t lose momentum.`
            : "I’m taking a little longer than usual, so I’ve prepared a local draft for you to review.";

        setPendingSingleField(singleField && !singleFieldNeedsPicker && singleField.type !== 'select' ? singleField : null);
        const fallbackMessage: Message = {
          id: `timeout-${Date.now()}`,
          role: 'assistant',
          aiGenerated: false,
          content: fallbackContent,
          ticket: fallbackTicket,
          suggestedChips: singleFieldChips,
          detailForm: renderSingleFieldAsChat ? null : timeoutForm,
          published: false,
        };
        setMessages((prev) => [...prev, fallbackMessage]);
        if (fallbackTicket) setActiveDraftReviewMessageId(fallbackMessage.id);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Something went wrong on my end — ${message}. Feel free to try again!`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (chip: SuggestedChip) => {
    if (context[chip.field]) return;
    const next = applyDetailValue(context, chip.field, chip.value);
    setPendingSingleField(null);
    setContext(next);
    sendMessage(`${getDetailField(chip.field)?.label || chip.field}: ${chip.value}`, next);
  };

  const regenerateLastReply = () => {
    if (loading || activeTemplate || instructorEvaluationMode) return;
    let lastUserIndex = -1;
    let lastAssistantIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (lastAssistantIndex === -1 && message.role === 'assistant' && message.aiGenerated) lastAssistantIndex = index;
      if (lastUserIndex === -1 && message.role === 'user') lastUserIndex = index;
      if (lastAssistantIndex !== -1 && lastUserIndex !== -1) break;
    }
    if (lastUserIndex === -1 || lastAssistantIndex === -1) return;
    const lastUserText = messages[lastUserIndex].content;
    const remaining = messages.slice(0, lastUserIndex);
    setMessages(remaining);
    setActiveDraftReviewMessageId(null);
    sendMessage(lastUserText);
  };

  const lastGeneratedIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant' && messages[index].aiGenerated) return index;
    }
    return -1;
  }, [messages]);

  const applyTemplate = (template: ContextTemplate) => {
    setPendingSingleField(null);
    setActiveTemplate(template);
    setContext((current) => ({
      ...current,
      intakeRoute: template.intakeRoute,
      category: template.category,
      subCategory: template.subCategory,
      priority: template.priority,
      reportedBy: reporterName,
    }));
  };

  const resetChat = useCallback(() => {
    activeChatEpochRef.current += 1;
    requestNonceRef.current += 1;
    voiceSessionActiveRef.current = false;
    voiceManualStopRef.current = true;
    speechRecognitionRef.current?.stop();
    if (voiceSilenceTimerRef.current) window.clearTimeout(voiceSilenceTimerRef.current);
    setListening(false);
    setVoiceLiveText('');
    setVoiceHint('');
    setMessages([buildGreetingMessage(reporterName)]);
    setContext({ reportedBy: reporterName });
    setPendingSingleField(null);
    setPendingAttachments([]);
    setConversationId(null);
    setActiveDraftReviewMessageId(null);
    shownRelatedTicketNoticeKeysRef.current.clear();
    setInstructorEvaluationMode(false);
    setActiveTemplate(null);
    setLoading(false);
  }, [reporterName]);

  const restoreChatHistoryEntry = useCallback((entry: ChatHistoryEntry) => {
    activeChatEpochRef.current += 1;
    requestNonceRef.current += 1;
    setLoading(false);
    setPendingSingleField(null);
    setPendingAttachments([]);
    setActiveDraftReviewMessageId(null);
    shownRelatedTicketNoticeKeysRef.current.clear();
    setConversationId(entry.conversationId);
    setContext({ ...entry.context, reportedBy: reporterName });
    setMessages(entry.messages.length > 0 ? entry.messages : [buildGreetingMessage(reporterName)]);
    window.setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }, [reporterName]);

  useEffect(() => {
    if (resetVersion === lastResetVersionRef.current) return;
    lastResetVersionRef.current = resetVersion;
    resetChat();
  }, [resetVersion, resetChat]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingInField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (event.metaKey || event.ctrlKey || event.altKey || typingInField) return;
      if (event.key.toLowerCase() === 'n' && onNewChat) {
        event.preventDefault();
        onNewChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNewChat]);

  const submitDetailForm = (values: Record<string, string>, form?: DetailForm) => {
    const formFieldIds = new Set((form?.fields || []).map((field) => String(field.id)));
    const formIncludesMember = ['memberId', 'memberName', 'memberContact', 'membership']
      .some((field) => formFieldIds.has(field));
    const formIncludesSession = ['sessionId', 'classType', 'classDateTime', 'trainer']
      .some((field) => formFieldIds.has(field));
    const allowedValueKeys = new Set(formFieldIds);
    if (formIncludesMember) MEMBER_ENTITY_KEYS.forEach((field) => allowedValueKeys.add(field));
    if (formIncludesSession) {
      SESSION_ENTITY_KEYS.forEach((field) => allowedValueKeys.add(field));
      allowedValueKeys.add('studio');
    }

    let nextContext: DetailContext = { ...context, reportedBy: reporterName };
    for (const [key, value] of Object.entries(values)) {
      if (form && !allowedValueKeys.has(key)) continue;
      if (!value) continue;
      nextContext = applyDetailValue(nextContext, key, value);
    }

    const fieldLabels = new Map((form?.fields || []).map((field) => [field.id, field.label]));
    const detailLines = Object.entries(values)
      .filter(([key, value]) => (!form || allowedValueKeys.has(key)) && value.trim())
      .map(([key, value]) => `${getDetailField(key)?.label || fieldLabels.get(key) || key}: ${value}`);
    nextContext = pruneEntityContextForIssue(nextContext, detailLines.join('\n'), allowedValueKeys);
    nextContext.reportedBy = reporterName;
    setContext(nextContext);
    setPendingSingleField(null);
    sendMessage(`Here are the missing details:\n${detailLines.join('\n')}`, nextContext);
  };

  const publishDraft = async (messageId: string, draft: DraftTicket, trainerEvaluation?: TrainerEvaluationInput) => {
    if (loading || publishingRef.current.has(messageId)) return;
    const publishableDraft = mergeDraftWithContext(draft, context);
    const explicitlyUsedFields = new Set<string>();
    if (publishableDraft.memberName || publishableDraft.memberContact) MEMBER_ENTITY_KEYS.forEach((field) => explicitlyUsedFields.add(field));
    if (publishableDraft.classType || publishableDraft.classDateTime || publishableDraft.trainer) SESSION_ENTITY_KEYS.forEach((field) => explicitlyUsedFields.add(field));
    const publishContext = pruneEntityContextForIssue(
      contextFromDraft(publishableDraft, context),
      `${publishableDraft.title}\n${publishableDraft.description}`,
      explicitlyUsedFields
    );
    const missingDetailsForm = detailFormForIncompleteDraft(publishableDraft, publishContext);
    if (missingDetailsForm) {
      setPendingSingleField(null);
      setActiveDraftReviewMessageId(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `publish-required-${Date.now()}`,
          role: 'assistant',
          content: 'Almost there! Just a few required details are missing — fill them in below and we can publish. 🙂',
          detailForm: missingDetailsForm,
          published: false,
        },
      ]);
      return;
    }
    publishingRef.current.add(messageId);
    setLoading(true);
    try {
      const created = await createApprovedTicket(
        publishableDraft,
        conversationId,
        publishContext as Record<string, unknown>,
        pendingAttachments.map((entry) => entry.file)
      );
      if (trainerEvaluation && !publishableDraft.metadata?.trainerReview) {
        saveTrainerReview(trainerEvaluation);
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, published: true, ticketId: created.id, publishedTicket: created }
            : message
        )
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `published-${Date.now()}`,
          role: 'assistant',
          content: `Done. Ticket **${created.id}** has been published to Submitted Tickets. ✅`,
          published: true,
          ticketId: created.id,
          publishedTicket: created,
        },
      ]);
      setPendingAttachments([]);
      setActiveDraftReviewMessageId(null);
    } catch (e: unknown) {
      const message = getDisplayError(e, 'Ticket creation failed');
      setMessages((prev) => [
        ...prev,
        {
          id: `publish-error-${Date.now()}`,
          role: 'assistant',
          content: `I could not publish that ticket yet: ${message}. The draft is still available for approval.`,
        },
      ]);
    } finally {
      publishingRef.current.delete(messageId);
      setLoading(false);
    }
  };

  const refineDraft = () => {
    // TicketPreviewCard owns the edit UI; this callback keeps the existing prop contract.
  };

  const saveEditedDraft = (messageId: string, draft: DraftTicket) => {
    const syncedContext = { ...contextFromDraft(draft, context), reportedBy: reporterName };
    setContext(syncedContext);
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              ticket: {
                ...draft,
                conversationSummary: draft.conversationSummary || draft.description,
              },
              published: false,
              ticketId: undefined,
            }
          : message
      )
    );
  };

  const discardDraft = (messageId: string) => {
    setActiveDraftReviewMessageId((current) => current === messageId ? null : current);
    setMessages((prev) =>
      prev.map((message) => (
        message.id === messageId
          ? { ...message, ticket: null, detailForm: null, published: false, ticketId: undefined, content: 'Draft discarded.' }
          : message
      ))
    );
  };

  const onConfirmDraftFromMessage = (message: Message) => {
    if (!message.ticket) return;
    publishDraft(message.id, mergeDraftWithContext(message.ticket, context), message.trainerEvaluation);
  };

  const createTrainerEvaluationDraft = (evaluation: TrainerEvaluationInput, source: 'form' | 'text' = 'form') => {
    const draft = buildTrainerEvaluationDraft(evaluation);
    const messageId = `trainer-eval-draft-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: 'assistant',
        aiGenerated: true,
        content: source === 'text'
          ? `I extracted the pasted review into a structured instructor evaluation draft for **${evaluation.trainer}**. Please review before publishing.`
          : `Instructor evaluation draft prepared for **${evaluation.trainer}**. Please review before publishing.`,
        ticket: draft,
        trainerEvaluation: evaluation,
        published: false,
      },
    ]);
    setContext((current) => ({
      ...current,
      studio: evaluation.studio || current.studio,
      trainer: evaluation.trainer || current.trainer,
      classType: evaluation.classType || current.classType,
      category: 'Trainer Feedback',
      subCategory: 'Knowledge and Competence',
      reportedBy: reporterName,
    }));
    setActiveDraftReviewMessageId(messageId);
  };

  const submitInstructorEvaluation = async (evaluation: TrainerEvaluationInput) => {
    createTrainerEvaluationDraft(evaluation, 'form');
    setInstructorEvaluationMode(false);
  };

  const submitTextToTicket = async () => {
    const sourceText = textToTicketText.trim();
    if (!sourceText) return;
    setLoading(true);
    try {
      const aiInstruction = [
        'TEXT_TO_TICKET_CLASSIFICATION_TASK',
        'Classify the pasted text as either trainer_evaluation or ticket_submission.',
        'If it is trainer_evaluation, return a Trainer Feedback draft only; do not treat it as a member complaint.',
        'If it is ticket_submission, return the normal support ticket draft.',
        'Use structured fields instead of placing all pasted text into description.',
        '',
        sourceText,
      ].join('\n');
      const { data } = await invokeTicketingFunction<AiIntakeResponse>('ticket-ai-chat', {
        body: buildAthenaDraftRequestBody({
          aiProvider: activeAiProvider,
          debugTrace: athenaDebugTraceEnabled,
          messages: [{ id: `text-to-ticket-${Date.now()}`, role: 'user', content: aiInstruction }],
          preamble: buildContextPreamble({ ...context, reportedBy: reporterName }),
          conversationId,
          context: {
            ...context,
            reportedBy: reporterName,
            textToTicketMode: true,
            classificationOptions: ['trainer_evaluation', 'ticket_submission'],
          },
        }),
      });

      const aiTicket = data?.ticket || null;
      const aiSaysTrainer = aiTicket?.category === 'Trainer Feedback' ||
        /trainer[_\s-]?evaluation|instructor evaluation|performance review|weighted scoring|focus points/i.test(`${data?.reply || ''}\n${aiTicket?.title || ''}\n${aiTicket?.description || ''}`);
      const localTrainerSignal = /client feedback|internal feedback|focus points|avg attendance|conversion rate|certification|trainer|instructor|barre classes|power\s?cycle/i.test(sourceText);

      if (aiSaysTrainer || (!aiTicket && localTrainerSignal)) {
        const evaluation = parseTrainerEvaluationText(sourceText, context.trainer || 'Unspecified Instructor');
        createTrainerEvaluationDraft({
          ...evaluation,
          studio: context.studio || evaluation.studio,
          classType: context.classType || evaluation.classType,
          reviewPeriod: context.classDateTime || evaluation.reviewPeriod,
        }, 'text');
      } else {
        const inferredContext = normalizeInferredContext(data?.inferredContext);
        const draftContext = mergeInferredContext({ ...context, reportedBy: reporterName }, inferredContext);
        const draft = aiTicket
          ? normalizeDraftForReview(aiTicket, draftContext, sourceText)
          : buildClientDraft(draftContext, sourceText);
        const messageId = `text-ticket-draft-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            aiGenerated: true,
            content: 'I classified the pasted text as a support ticket and prepared a draft for review.',
            ticket: draft,
            published: false,
          },
        ]);
        setActiveDraftReviewMessageId(messageId);
      }
      setTextToTicketText('');
      setTextToTicketOpen(false);
    } catch (error) {
      const localTrainerSignal = /client feedback|internal feedback|focus points|avg attendance|conversion rate|certification|trainer|instructor|barre classes|power\s?cycle/i.test(sourceText);
      if (localTrainerSignal) {
        const evaluation = parseTrainerEvaluationText(sourceText, context.trainer || 'Unspecified Instructor');
        createTrainerEvaluationDraft({
          ...evaluation,
          studio: context.studio || evaluation.studio,
          classType: context.classType || evaluation.classType,
          reviewPeriod: context.classDateTime || evaluation.reviewPeriod,
        }, 'text');
      } else {
        const messageId = `text-ticket-draft-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            aiGenerated: true,
            content: 'AI classification was unavailable, so I prepared a support-ticket draft using the pasted text.',
            ticket: buildClientDraft({ ...context, reportedBy: reporterName }, sourceText),
            published: false,
          },
        ]);
        setActiveDraftReviewMessageId(messageId);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50 font-['Plus_Jakarta_Sans',Inter,sans-serif]">
      {/* Left sidebar - Robot illustration */}
      <div className="relative hidden h-full w-[28%] shrink-0 overflow-hidden border-r border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 lg:block 2xl:w-[24%]">
        <div className="absolute -left-12 top-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -right-12 bottom-10 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute left-0 right-0 top-1/3 h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(100,116,139,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.08)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_78%_56%_at_50%_50%,#000_68%,transparent_110%)]" />
        {loadDecorativeRobot ? (
          <InteractiveRobotSpline
            scene={ROBOT_SPLINE_URL}
            className="athena-bot-tint-blue absolute inset-0 h-full w-full transition duration-500"
            smile
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10">
            <div className="h-10 w-10 rounded-full border-2 border-blue-300/30 border-t-blue-300/80 animate-spin" />
          </div>
        )}
        {/* Top card: mode toggle */}
        <div className="absolute left-3 right-3 top-3 z-10">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5 shadow-[0_18px_54px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300/70">Athena mode</div>
              <div className="truncate text-xs font-semibold text-white/90">
                {instructorEvaluationMode ? 'Instructor evaluation' : 'Ticket intake'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={instructorEvaluationMode}
              onClick={() => setInstructorEvaluationMode((current) => !current)}
              className={`relative h-7 w-12 rounded-full border transition ${
                instructorEvaluationMode
                  ? 'border-blue-400 bg-blue-600'
                  : 'border-white/20 bg-white/10'
              }`}
              title="Toggle instructor evaluation mode"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition ${
                  instructorEvaluationMode ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
          {/* Specialist mode indicator */}
          {specialistClassification && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
                {specialistClassification.label} specialist mode
              </span>
            </div>
          )}
        </div>
        {/* Bottom card: recent tickets — hover to expand */}
        <div
          className="absolute bottom-2 left-2 right-2 z-10"
          onMouseEnter={() => setRecentTicketsExpanded(true)}
          onMouseLeave={() => setRecentTicketsExpanded(false)}
        >
          <div className={`rounded-2xl border border-white/10 bg-white/6 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300 ease-out ${recentTicketsExpanded ? 'p-3' : 'p-2.5'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-px flex-1 bg-white/10" />
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300/60 flex items-center gap-1.5">
                Recent tickets
                {recentTickets.length > 0 && (
                  <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-bold text-blue-300/80">
                    {recentTickets.length}
                  </span>
                )}
              </div>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {!recentTicketsExpanded ? (
              // Collapsed: show 2 chips + count indicator
              <div className="flex flex-wrap gap-1.5">
                {recentTickets.length > 0 ? recentTickets.slice(0, 2).map((ticket, index) => {
                  const cleaned = cleanTicketTitle(ticket.title);
                  const compactLabel = cleaned.length > 28 ? `${cleaned.slice(0, 25).trimEnd()}…` : cleaned;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => { setSelectedTicket(ticket); onOpenExistingTicket?.(ticket); }}
                      className="animate-ticket-chip-in max-w-[200px] rounded-full border border-white/10 bg-white/8 px-2.5 py-1.5 text-[10px] font-medium text-white/70 shadow-sm transition hover:border-blue-400/30 hover:bg-blue-500/15 hover:text-white/90"
                      style={{ animationDelay: `${index * 80}ms` }}
                      title={`${ticket.id} — ${cleaned}`}
                    >
                      <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{compactLabel}</span>
                    </button>
                  );
                }) : (
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-medium text-white/40 shadow-sm">
                    No recent tickets
                  </span>
                )}
                {recentTickets.length > 2 && (
                  <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1.5 text-[10px] font-semibold text-blue-300/60">
                    +{recentTickets.length - 2} more
                  </span>
                )}
              </div>
            ) : (
              // Expanded: show all 10 as a list
              <div className="space-y-1 max-h-[50vh] overflow-y-auto chat-scrollbar">
                {recentTickets.length > 0 ? recentTickets.map((ticket, index) => {
                  const cleaned = cleanTicketTitle(ticket.title);
                  const priorityDot =
                    ticket.priority === 'Critical' ? 'bg-red-400' :
                    ticket.priority === 'High' ? 'bg-orange-400' :
                    ticket.priority === 'Medium' ? 'bg-blue-400' : 'bg-slate-400';
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => { setSelectedTicket(ticket); onOpenExistingTicket?.(ticket); }}
                      className="animate-p57-fade-up flex w-full items-start gap-2 rounded-xl border border-white/8 bg-white/6 px-2.5 py-2 text-left transition hover:border-blue-400/25 hover:bg-blue-500/12"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-white/80" title={cleaned}>{cleaned}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/40">
                          <span className="font-mono">{ticket.id.slice(-6)}</span>
                          <span>·</span>
                          <span className="truncate">{ticket.studio?.split(',')[0] || ticket.category}</span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[9px] font-medium text-white/30 ml-1">
                        {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </button>
                  );
                }) : (
                  <div className="py-3 text-center text-[11px] text-white/40">No recent tickets</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col chat-bg-premium bg-background" style={{ boxShadow: '0 0 0 1px rgba(15,23,42,0.06), -8px 0 32px rgba(15,23,42,0.08)' }}>
        {/* Merged app header — replaces the outer AppLayout header when in chat mode */}
        <div className={`animate-chat-header-in relative z-40 flex-shrink-0 flex items-center gap-2.5 border-b px-4 py-1.5 shadow-[0_1px_0_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl ${
          athenaTrainerMode ? 'border-blue-100/70 bg-blue-50/94' : 'border-border bg-background/96'
        }`}>
          {/* Logo */}
          <button
            type="button"
            onClick={() => onHome?.()}
            aria-label="Go to home"
            className="athena-main-logo relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-300 bg-slate-900 ring-1 ring-slate-900/20 shadow-[0_8px_18px_rgba(15,23,42,0.22)] focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          >
            <img src="/athena-ai-logo.png" alt="Athena" className="athena-logo-spin h-full w-full rounded-full object-cover" />
          </button>
          {/* Brand */}
          <div className="shrink-0 min-w-0">
            <div className="flex items-baseline gap-0 leading-none">
              <span className="text-[18px] font-black uppercase tracking-[0.22em] text-stone-900">Athena</span>
              <span className="ai-kinetic ml-0.5 text-[9px] font-bold">Ai</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-px w-16 bg-gradient-to-r from-blue-500 via-cyan-400 to-transparent" />
              <p className={`text-[8.5px] font-semibold uppercase tracking-[0.2em] ${athenaTrainerMode ? 'text-blue-600/80' : 'text-stone-400'}`}>
                {athenaTrainerMode ? 'Instructor Intelligence' : 'Member Support OS'}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-1 hidden h-6 w-px bg-slate-200 shrink-0 sm:block" />

          {/* Athena chat status */}
          <div className="hidden sm:flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
            {specialistClassification && (
              <span className="hidden rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 xl:inline-flex">
                {specialistClassification.label}
              </span>
            )}
          </div>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <TemplatesAndExportTabs
              disabled={messages.length === 0 || Boolean(exportingFormat)}
              exportingPng={exportingFormat === 'png'}
              messages={messages}
              ticketDraft={activeDraftReviewMessage?.ticket || null}
              onExportText={exportTranscriptText}
              onExportHtml={exportTranscriptHtml}
              onExportPng={exportTranscriptPng}
              onSelectTemplate={applyTemplate}
              onOpenTextToTicket={() => setTextToTicketOpen(true)}
              historyEntries={chatHistory}
              onRestoreHistory={restoreChatHistoryEntry}
              onNewChat={onNewChat}
            />
            <ThemeToggle />
            <div className="hidden h-5 w-px bg-slate-200 xl:block" />
            {/* Date / time */}
            <LiveClock
              className="hidden text-right xl:block"
              dateClassName="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400"
              timeClassName="text-[13px] font-bold tabular-nums leading-none text-foreground"
            />
          </div>
        </div>

        {instructorEvaluationMode ? (
          <div className="chat-scrollbar flex-1 overflow-y-auto bg-gradient-to-b from-blue-50/60 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
              <EvaluationClassSelector />
            </div>
          </div>
        ) : activeTemplate ? (
          <div className="chat-scrollbar flex-1 overflow-y-auto bg-[#f4f6fa] px-4 pb-10 pt-4 sm:px-6">
            <div className="mx-auto w-full max-w-[1100px]">
              {/* Back bar */}
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTemplate(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-muted hover:text-foreground hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                    <LayoutTemplate className="h-3 w-3" />
                  </span>
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
                    <span className="truncate text-blue-600">{activeTemplate.category || 'Template'}</span>
                    <span className="text-slate-300">/</span>
                    <span className="truncate text-slate-700">{activeTemplate.label}</span>
                  </div>
                </div>
              </div>
              {activeTemplate.id === 'hosted-class-feedback' ? (
                <HostedClassTemplateForm
                  template={activeTemplate}
                  disabled={loading}
                  onCancel={() => setActiveTemplate(null)}
                  onSubmit={(payload) => {
                    const nextContext: DetailContext = {
                      ...context,
                      intakeRoute: activeTemplate.intakeRoute,
                      category: activeTemplate.category,
                      subCategory: activeTemplate.subCategory,
                      priority: activeTemplate.priority,
                      sessionId: payload.session.id,
                      classType: payload.session.classType,
                      classDateTime: payload.session.startsAt,
                      trainer: payload.session.trainer,
                      studio: payload.session.studio,
                      reportedBy: reporterName,
                      partnerName: payload.partnerName,
                      description: payload.classFeedback,
                    };
                    setContext(nextContext);
                    setActiveTemplate(null);
                    sendMessage(buildHostedClassFeedbackText(payload), nextContext);
                  }}
                />
              ) : (
                <DetailCaptureForm
                  form={templateDetailFormFromTemplate(activeTemplate)}
                  initialContext={context}
                  disabled={loading}
                  onSubmit={(values, form) => {
                    const nextContext: DetailContext = {
                      ...context,
                      ...values,
                      intakeRoute: activeTemplate.intakeRoute,
                      category: activeTemplate.category,
                      subCategory: activeTemplate.subCategory,
                      priority: activeTemplate.priority,
                      reportedBy: reporterName,
                      description: Object.values(values).filter(Boolean).join('\n'),
                    };
                    setContext(nextContext);
                    setActiveTemplate(null);
                    sendMessage(buildContextTemplateText(activeTemplate, values), nextContext);
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="chat-scrollbar mx-auto w-full max-w-7xl flex-1 space-y-5 overflow-y-auto bg-transparent px-4 py-6 sm:px-6"
          >
            {messages.map((m, index) => (
              <MessageBubble
                key={m.id}
                message={m}
                index={index}
                onChipClick={handleChipClick}
                onDetailFormSubmit={submitDetailForm}
                onOpenDraftReview={(messageId) => setActiveDraftReviewMessageId(messageId)}
                onRegenerate={regenerateLastReply}
                canRegenerate={index === lastGeneratedIndex && messages.length > 1}
                context={context}
                showDebugTrace={athenaDebugTraceEnabled}
              />
            ))}
            {!loading && messages.length === 1 && (() => {
              const allStarters = getDynamicStarters(context);
              const shuffled = [...allStarters].sort((a, b) => {
                const ha = ((a.charCodeAt(0) * 31 + starterSeed) % 97);
                const hb = ((b.charCodeAt(0) * 31 + starterSeed) % 97);
                return ha - hb;
              }).slice(0, 5);
              const hasContext = !!(context.studio || context.trainer || context.category);
              return (
                <div className="animate-p57-fade-up mt-6 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300 backdrop-blur-md shadow-sm">
                      <span className={`h-2 w-2 rounded-full ${hasContext ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
                      {hasContext ? 'Suggested for context' : 'Quick start options'}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {shuffled.map((starter, idx) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => { setInput(starter); textareaRef.current?.focus(); }}
                        className="animate-p57-fade-up group relative flex w-full items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-card/90 px-4 py-3.5 text-left text-[13px] font-semibold text-foreground shadow-[0_2px_12px_rgba(15,23,42,0.05)] backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/50 hover:bg-gradient-to-r hover:from-blue-50/70 hover:to-indigo-50/70 hover:shadow-[0_8px_24px_rgba(37,99,235,0.15)] active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900/90 dark:hover:from-blue-950/40 dark:hover:to-indigo-950/40"
                        style={{ animationDelay: `${idx * 55}ms` }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 text-base shadow-inner transition-transform duration-200 group-hover:scale-110 group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white dark:from-blue-500/25 dark:to-indigo-500/25">
                          {idx === 0 ? '💬' : idx === 1 ? '⚡' : idx === 2 ? '📋' : idx === 3 ? '🔔' : '📌'}
                        </span>
                        <span className="flex-1 leading-snug tracking-tight">{starter}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            {loading && <TypingIndicator />}
          </div>
        )}

        <Dialog
          open={Boolean(activeDraftReviewMessage)}
          onOpenChange={(open) => {
            if (!open) setActiveDraftReviewMessageId(null);
          }}
        >
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-border bg-muted/95 p-4 shadow-[0_30px_100px_rgba(15,23,42,0.28)] data-[state=open]:zoom-in-90 sm:rounded-3xl sm:p-5">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-base text-slate-950">Review Athena ticket draft</DialogTitle>
              <DialogDescription>
                Check the context, routing, and Momence signals before publishing.
              </DialogDescription>
            </DialogHeader>
            {activeDraftReviewMessage?.ticket && (
              <DraftTicketReviewPreview
                draft={mergeDraftWithContext(activeDraftReviewMessage.ticket, context)}
                context={context}
                tickets={tickets}
                onConfirm={() => onConfirmDraftFromMessage(activeDraftReviewMessage)}
                onEdit={() => refineDraft()}
                onDiscard={() => discardDraft(activeDraftReviewMessage.id)}
                onSaveEdit={(draft) => saveEditedDraft(activeDraftReviewMessage.id, draft)}
                confirmed={activeDraftReviewMessage.published}
                ticketId={activeDraftReviewMessage.ticketId}
                confirmedTicket={activeDraftReviewMessage.publishedTicket}
                publishing={publishingRef.current.has(activeDraftReviewMessage.id)}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={textToTicketOpen} onOpenChange={setTextToTicketOpen}>
          <DialogContent className="max-w-2xl border-border bg-card p-5 shadow-[0_30px_100px_rgba(15,23,42,0.25)] sm:rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base text-slate-950">Text to ticket</DialogTitle>
              <DialogDescription>
                Paste review notes or performance text. Athena will extract a structured ticket draft for review.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={textToTicketText}
              onChange={(event) => setTextToTicketText(event.target.value)}
              rows={9}
              placeholder="Paste the source text here..."
              className="mt-3 w-full resize-none rounded-2xl border border-border bg-muted px-3 py-3 text-sm leading-relaxed text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTextToTicketOpen(false)}
                className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTextToTicket}
                disabled={!textToTicketText.trim()}
                className="h-9 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Generate draft
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {!instructorEvaluationMode && !activeTemplate && (
        <>
        <div className="z-10 flex-shrink-0 border-t border-slate-100/80 bg-gradient-to-r from-white via-slate-50/60 to-white px-4 py-1.5 sm:px-6 shadow-[0_-1px_0_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-2.5 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Context</span>
              <div className="h-4 w-px bg-slate-200" />
            </div>
            <div className="min-w-0 flex-1">
              <ContextPicker
                context={context}
                attachmentCount={pendingAttachments.length}
                accent="blue"
                onChange={(next) => setContext((current) => ({ ...current, ...next }))}
              />
            </div>
          </div>
        </div>

        <div className="z-10 flex-shrink-0 border-t border-slate-100 bg-background px-4 pb-4 pt-3 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">
            {isUrgentInput && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
                <span>⚡</span>
                <span>High-priority signals detected — Athena will flag this appropriately</span>
              </div>
            )}
            {capturedContextSummary.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {capturedContextSummary.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 dark:border-blue-400/30 backdrop-blur-md shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    {item}
                  </span>
                ))}
              </div>
            )}
            {smartQuickReplies.length > 0 && (
              <div className="relative mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSmartReplies((prev) => !prev)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-indigo-500/15 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300 backdrop-blur-md shadow-sm transition hover:border-violet-500 hover:scale-[1.02] active:scale-95"
                >
                  <WandSparkles className="h-3.5 w-3.5 animate-pulse text-violet-600 dark:text-violet-400" />
                  <span>Smart replies ({smartQuickReplies.length})</span>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showSmartReplies ? 'rotate-180' : ''}`} />
                </button>

                {showSmartReplies && (
                  <div className="absolute bottom-full mb-2.5 left-0 z-50 animate-p57-fade-up w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-violet-500/30 bg-card dark:bg-slate-900 p-3 shadow-[0_16px_45px_rgba(124,58,237,0.25)] backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                        <WandSparkles className="h-3.5 w-3.5 text-violet-500" />
                        Smart Suggestions
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSmartReplies(false)}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto chat-scrollbar">
                      {smartQuickReplies.map((reply) => (
                        <button
                          key={reply.label}
                          type="button"
                          onClick={() => {
                            applySmartQuickReply(reply);
                            setShowSmartReplies(false);
                          }}
                          className="group inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-50/80 dark:bg-violet-950/40 px-3 py-1.5 text-[11.5px] font-semibold text-violet-900 dark:text-violet-200 transition-all hover:border-violet-500 hover:bg-gradient-to-r hover:from-violet-600 hover:to-indigo-600 hover:text-white dark:hover:from-violet-600 dark:hover:to-indigo-600 active:scale-95"
                          title={reply.value}
                        >
                          <CornerDownLeft className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                          <span>{reply.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pendingAttachments.map((entry) => (
                  <span
                    key={entry.id}
                    className="inline-flex max-w-[200px] items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] text-muted-foreground"
                    title={`${entry.file.name} (${Math.max(1, Math.round(entry.file.size / 1024))} KB)`}
                  >
                    <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
                    <span className="truncate">{entry.file.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingAttachments((current) => current.filter((item) => item.id !== entry.id))}
                      className="rounded-full p-0.5 text-slate-400 hover:text-slate-700"
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="group relative flex items-end gap-2.5 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-card/95 p-2 shadow-[0_10px_35px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:shadow-[0_12px_40px_-5px_rgba(37,99,235,0.2)] dark:bg-slate-900/95">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Tell me what happened…"
                  className="max-h-32 w-full resize-none rounded-2xl bg-transparent px-4 py-2.5 pr-11 text-[13.5px] font-medium text-foreground outline-none transition placeholder:text-slate-400 focus:outline-none"
                  style={{ minHeight: '46px' }}
                />
                <button
                  type="button"
                  disabled={!input.trim() || loading}
                  onClick={() => {
                    const optimized = optimizeIntakePromptForAthena(input);
                    if (optimized && optimized !== input) {
                      setInput(optimized);
                    }
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Polish your prompt with Athena AI"
                  aria-label="Optimise prompt for Athena"
                >
                  <Sparkles className={`h-4 w-4 ${input.trim() ? 'text-blue-600 dark:text-blue-400 animate-pulse' : ''}`} />
                </button>
                {listening && (
                  <div className="mt-1.5 flex items-center gap-2 px-4 pb-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-0.5 animate-[equalizer-wave_0.8s_ease-in-out_infinite] rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span className="h-3.5 w-0.5 animate-[equalizer-wave_0.8s_ease-in-out_0.2s_infinite] rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span className="h-4.5 w-0.5 animate-[equalizer-wave_0.8s_ease-in-out_0.4s_infinite] rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span className="h-2 w-0.5 animate-[equalizer-wave_0.8s_ease-in-out_0.6s_infinite] rounded-full bg-blue-600 dark:bg-blue-400" />
                    </span>
                    <span>{voiceHint || (voiceLiveText ? 'Listening…' : 'Listening… start speaking')}</span>
                  </div>
                )}
                {smartVoiceHints.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 px-4 pb-1">
                    {smartVoiceHints.map((hint) => (
                      <span key={hint} className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:text-blue-300">
                        {hint}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx"
                onChange={(event) => {
                  addAttachments(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-muted/80 text-muted-foreground transition-all duration-200 hover:border-blue-500/40 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 active:scale-95"
                title="Attach files"
                aria-label="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={listening ? stopVoiceCapture : startVoiceCapture}
                  disabled={loading}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                    listening
                      ? 'border-red-500 bg-red-600 text-white shadow-[0_4px_14px_rgba(239,68,68,0.3)] animate-pulse'
                      : 'border-slate-200/90 dark:border-slate-800 bg-muted/80 text-muted-foreground hover:border-blue-500/40 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400'
                  }`}
                  title={listening ? 'Stop voice input' : 'Start voice input'}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                >
                  {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] transition-all duration-200 hover:scale-105 hover:shadow-[0_6px_22px_rgba(37,99,235,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 disabled:shadow-none"
              >
                <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span>Enter to send · Shift+Enter for new line</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="p57-kbd">N</kbd>
                new chat
              </span>
            </p>
          </div>
        </div>
        </>
        )}
      </div>

    </div>
  );
};

const TEMPLATE_CATEGORY_STYLE: Record<string, { icon: React.ElementType; gradient: string }> = {
  'Hosted Class & Partnerships': { icon: Handshake, gradient: 'from-indigo-600 via-indigo-500 to-violet-600' },
  'Trainer Feedback': { icon: GraduationCap, gradient: 'from-amber-500 via-orange-500 to-amber-600' },
  'Booking & Schedule': { icon: CalendarClock, gradient: 'from-sky-500 via-blue-500 to-blue-600' },
  'Class Experience': { icon: Star, gradient: 'from-emerald-500 via-teal-500 to-emerald-600' },
  'Studio Amenities and Facilities': { icon: Building2, gradient: 'from-slate-600 via-slate-700 to-slate-800' },
};

const TEMPLATE_PRIORITY_STYLE: Record<string, { badge: string; dot: string }> = {
  Critical: { badge: 'border-red-200 bg-red-50/90 text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300', dot: 'bg-red-500' },
  High: { badge: 'border-amber-200 bg-amber-50/90 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-500' },
  Medium: { badge: 'border-blue-200 bg-blue-50/90 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300', dot: 'bg-blue-500' },
  Low: { badge: 'border-slate-200 bg-slate-100/90 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300', dot: 'bg-slate-400' },
};

const TemplateLibraryPanel: React.FC<{
  onSelect: (template: ContextTemplate) => void;
  onClose?: () => void;
}> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const normalizedQuery = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const set = new Set<string>();
    CONTEXT_TEMPLATES.forEach((t) => { if (t.category) set.add(t.category); });
    return ['All', ...Array.from(set)];
  }, []);

  const grouped = useMemo(() => {
    const filtered = CONTEXT_TEMPLATES.filter((template) => {
      if (selectedCategory !== 'All' && template.category !== selectedCategory) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        template.label,
        template.description,
        template.category,
        template.subCategory,
        template.intakeRoute,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    const map = new Map<string, ContextTemplate[]>();
    for (const template of filtered) {
      const category = template.category || 'Other';
      const group = map.get(category) || [];
      group.push(template);
      map.set(category, group);
    }
    return Array.from(map.entries());
  }, [normalizedQuery, selectedCategory]);

  const total = CONTEXT_TEMPLATES.length;
  const resultCount = grouped.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col space-y-3">
      {/* Top Bar: Search & Close */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates by name, route, or category…"
            className="h-9.5 w-full rounded-2xl border border-border/80 bg-muted/80 pl-9 pr-8 text-xs text-foreground outline-none backdrop-blur-sm transition placeholder:text-slate-400 focus:border-blue-500/80 focus:bg-background focus:ring-4 focus:ring-blue-500/15 dark:border-slate-800 dark:bg-slate-900/80"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Clear template search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9.5 items-center justify-center rounded-xl border border-border/60 bg-muted/60 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            Done
          </button>
        )}
      </div>

      {/* Category Quick Filter Pills */}
      <div className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5">
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-[10.5px] font-semibold transition duration-150 ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'border border-border/60 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Result Meta */}
      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {normalizedQuery || selectedCategory !== 'All' ? `${resultCount} of ${total} templates` : `${total} ready templates`}
        </span>
      </div>

      {/* Groups */}
      <div className="chat-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-0.5 pr-1">
        {grouped.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 px-4 py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <Search className="h-5 w-5" />
            </div>
            <div className="mt-3 text-xs font-semibold text-foreground">No templates found</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Try clearing search filters or picking another category.</div>
          </div>
        )}
        {grouped.map(([category, items], groupIndex) => {
          const style = TEMPLATE_CATEGORY_STYLE[category] || { icon: LayoutTemplate, gradient: 'from-slate-600 to-slate-800' };
          const CategoryIcon = style.icon;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br ${style.gradient} text-white shadow-sm ring-1 ring-white/20`}>
                  <CategoryIcon className="h-3 w-3" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{category}</span>
                <span className="h-px flex-1 bg-border/60" />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-bold tabular-nums text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((template, index) => {
                  const priorityMeta = TEMPLATE_PRIORITY_STYLE[template.priority] || TEMPLATE_PRIORITY_STYLE.Medium;
                  const fieldCount = template.fields?.length || template.prompts?.length || 0;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onSelect(template)}
                      className="template-card-sheen animate-template-card-in group relative block w-full rounded-2xl border border-border/80 bg-card p-3.5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400/80 hover:shadow-[0_12px_32px_rgba(37,99,235,0.14)] focus:outline-none focus:ring-4 focus:ring-blue-500/15 dark:hover:border-blue-500/80"
                      style={{ animationDelay: `${Math.min(groupIndex * 40 + index * 45, 360)}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${style.gradient} text-white shadow-md transition duration-200 group-hover:scale-105 group-hover:shadow-indigo-500/25`}>
                          <CategoryIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">{template.label}</span>
                            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold ${priorityMeta.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot} template-pulse-dot`} />
                              {template.priority}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">{template.description}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-2.5">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/80 px-2 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
                          {template.intakeRoute}
                        </span>
                        <span className="truncate text-[10px] font-medium text-muted-foreground">{template.subCategory}</span>
                        {fieldCount > 0 && (
                          <span className="hidden text-[9.5px] font-semibold text-slate-400 sm:inline-block">
                            · {fieldCount} fields
                          </span>
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-600 transition duration-200 group-hover:translate-x-0.5 dark:text-blue-400">
                          Use template
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TemplatesAndExportTabs: React.FC<{
  disabled?: boolean;
  exportingPng?: boolean;
  messages: ChatMessage[];
  ticketDraft: DraftTicket | null;
  onExportText: () => void;
  onExportHtml: () => void;
  onExportPng: () => void | Promise<void>;
  onSelectTemplate: (template: ContextTemplate) => void;
  onOpenTextToTicket: () => void;
  historyEntries: ChatHistoryEntry[];
  onRestoreHistory: (entry: ChatHistoryEntry) => void;
  onNewChat?: () => void;
}> = ({ disabled = false, exportingPng = false, messages, ticketDraft, onExportText, onExportHtml, onExportPng, onSelectTemplate, onOpenTextToTicket, historyEntries, onRestoreHistory, onNewChat }) => {
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<'templates' | 'export' | 'history' | null>(null);
  
  const handleCopyToClipboard = async () => {
    try {
      const transcript = plainTextForChatTranscript(
        messages.map((message) => ({
          ...message,
          ticket: message.ticket || (message.id === 'active-draft' ? ticketDraft : message.ticket),
        }))
      );
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setActivePanel(null);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const runPanelAction = (action: () => void | Promise<void>) => {
    setActivePanel(null);
    void action();
  };

  return (
    <div className="relative shrink-0">
      <div className={`grid h-9 ${onNewChat ? 'grid-cols-5' : 'grid-cols-4'} rounded-xl border border-border bg-card p-0.5 shadow-sm`}>
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground transition hover:bg-slate-900 hover:text-white"
            title="New chat"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            <span className="hidden xl:inline">New chat</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setActivePanel((current) => current === 'templates' ? null : 'templates')}
          className={`inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
            activePanel === 'templates' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden xl:inline">Templates</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel(null);
            onOpenTextToTicket();
          }}
          className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted-foreground transition hover:bg-blue-50 hover:text-blue-700"
        >
          <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden xl:inline">Text</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setActivePanel((current) => current === 'export' ? null : 'export')}
          className={`inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
            activePanel === 'export' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden xl:inline">Export</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePanel((current) => current === 'history' ? null : 'history')}
          className={`inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
            activePanel === 'history' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <History className="mr-1.5 h-3.5 w-3.5" />
          <span className="hidden xl:inline">History</span>
        </button>
      </div>
      {activePanel === 'templates' && (
      <div className="absolute right-0 top-11 z-[100] mt-0">
        <div className="flex max-h-[min(600px,calc(100vh-8rem))] w-[min(470px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card dark:bg-slate-900 shadow-2xl">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
              <LayoutTemplate className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">Ready templates</div>
              <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
                Select a common context template, complete the blanks, then send to Athena.
              </p>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2.5">
            <TemplateLibraryPanel
              onSelect={(template) => {
                setActivePanel(null);
                onSelectTemplate(template);
              }}
            />
          </div>
        </div>
      </div>
      )}
      {activePanel === 'export' && (
      <div className="absolute right-0 top-11 z-[100] mt-0">
        <div className="w-60 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card dark:bg-slate-900 p-1.5 shadow-2xl">
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <button
            type="button"
            onClick={() => runPanelAction(onExportText)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
          >
            <FileText className="h-3.5 w-3.5" />
            Text transcript
          </button>
          <button
            type="button"
            onClick={() => runPanelAction(onExportHtml)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            HTML transcript
          </button>
          <button
            type="button"
            onClick={() => runPanelAction(onExportPng)}
            disabled={exportingPng}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageDown className="h-3.5 w-3.5" />
            {exportingPng ? 'Preparing PNG...' : 'PNG screenshot'}
          </button>
        </div>
      </div>
      )}
      {activePanel === 'history' && (
      <div className="absolute right-0 top-11 z-[100] mt-0">
        <div className="w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card dark:bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">Last 7 days</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Restore recent Athena conversations from this browser.</p>
          </div>
          <div className="max-h-[340px] overflow-y-auto p-2">
            {historyEntries.length > 0 ? historyEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setActivePanel(null);
                  onRestoreHistory(entry);
                }}
                className="block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50"
              >
                <div className="truncate text-sm font-semibold text-slate-950">{entry.title}</div>
                <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {new Date(entry.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </button>
            )) : (
              <div className="px-3 py-6 text-center text-xs text-slate-400">No saved chats yet.</div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

const ChatExportMenu: React.FC<{
  disabled?: boolean;
  exportingPng?: boolean;
  messages: ChatMessage[];
  ticketDraft: DraftTicket | null;
  onExportText: () => void;
  onExportHtml: () => void;
  onExportPng: () => void | Promise<void>;
}> = ({ disabled = false, exportingPng = false, messages, ticketDraft, onExportText, onExportHtml, onExportPng }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleCopyToClipboard = async () => {
    try {
      const transcript = plainTextForChatTranscript(
        messages.map((message) => ({
          ...message,
          ticket: message.ticket || ticketDraft,
        }))
      );
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setOpen(false);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };
  
  const runAction = (action: () => void | Promise<void>) => {
    setOpen(false);
    void action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-card px-3 text-xs font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"
          title="Export chat conversation"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-56 overflow-hidden rounded-2xl border-border bg-card/96 p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={() => runAction(handleCopyToClipboard)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
        <button
          type="button"
          onClick={() => runAction(onExportText)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
        >
          <FileText className="h-3.5 w-3.5" />
          Text transcript
        </button>
        <button
          type="button"
          onClick={() => runAction(onExportHtml)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
        >
          <FileCode2 className="h-3.5 w-3.5" />
          HTML transcript
        </button>
        <button
          type="button"
          onClick={() => runAction(onExportPng)}
          disabled={exportingPng}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageDown className="h-3.5 w-3.5" />
          {exportingPng ? 'Preparing PNG...' : 'PNG screenshot'}
        </button>
      </PopoverContent>
    </Popover>
  );
};

const TemplatePicker: React.FC<{ onSelect: (template: ContextTemplate) => void }> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[470px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-border bg-card/96 p-0 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <LayoutTemplate className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Ready templates</div>
            <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
              Select a common context template, complete the blanks, then send to Athena.
            </p>
          </div>
        </div>
        <div className="h-[min(440px,calc(100vh-12rem))] p-2.5">
          <TemplateLibraryPanel
            onSelect={(template) => {
              onSelect(template);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

const HOSTED_ATTENDEE_STATUS_OPTIONS = [
  'Booked / not checked in',
  'Checked in / attended',
  'Cancelled before class',
  'Late arrival noted',
  'No-show / absent',
  'Interested in continuing',
  'Needs follow-up',
  'Converted / package sold',
  'Concern raised',
  'Not a fit',
];

const HOSTED_FOLLOW_UP_OPTIONS = [
  'No follow-up needed',
  'WhatsApp same day',
  'Phone call',
  'Email package details',
  'Invite to intro offer',
  'Client success follow-up',
  'Partner follow-up',
];

const HOSTED_PARTNER_TYPE_OPTIONS = [
  'Influencer / creator',
  'Wellness partner',
  'Corporate / brand partner',
  'Community builder',
  'Member-hosted group',
  'Other',
];

const HOSTED_SOURCE_OPTIONS = [
  'Partner referral',
  'Instagram / social',
  'Existing member guest',
  'Corporate community',
  'Walk-in / studio invite',
  'Other',
];

const HOSTED_AUDIENCE_FIT_OPTIONS = [
  'Strong P57 fit',
  'Good fit with nurturing',
  'Mixed audience fit',
  'Low conversion fit',
  'Proximity was an issue',
  'Unable to determine',
];

const HOSTED_PARTNER_RESPONSE_OPTIONS = [
  'Partner expressed strong satisfaction',
  'Partner expressed mixed feedback',
  'Partner requested another collaboration',
  'Partner requested changes before repeating',
  'No partner feedback captured',
];

const HOSTED_ARRIVAL_PATTERN_OPTIONS = [
  'No late arrivals noted',
  '1-2 late arrivals',
  '3+ late arrivals',
  'Late arrivals affected class flow',
  'Unable to determine',
];

const HOSTED_CONVERSION_OPTIONS = [
  'Strong package interest',
  'Intro offer interest',
  'Needs nurturing',
  'Low purchase intent',
  'Package sold',
  'Unable to determine',
];

const HOSTED_SOCIAL_OPTIONS = [
  'Partner will post',
  'P57 content opportunity',
  'Testimonials captured',
  'No content opportunity',
  'Follow up for assets',
];

const HOSTED_FOLLOW_UP_PLAN_OPTIONS = [
  'Definitely collaborate again',
  'Maybe collaborate again',
  'Needs further review',
  'Do not collaborate again',
  'Unable to determine',
];

const HOSTED_CLASS_SESSION_TYPES = ['private'];

function momenceBookingMemberName(booking: MomenceSessionBooking): string {
  const name = [booking.member?.firstName, booking.member?.lastName].filter(Boolean).join(' ').trim();
  return name || `Momence member #${booking.member?.id || booking.id}`;
}

function momenceBookingContact(booking: MomenceSessionBooking): string {
  return [booking.member?.email, booking.member?.phoneNumber].filter(Boolean).join(' · ');
}

function hostedBookingStatus(booking: MomenceSessionBooking): string {
  if (booking.cancelledAt) return 'Cancelled before class';
  if (booking.checkedIn) return 'Checked in / attended';
  return 'Booked / not checked in';
}

function hostedStatusTone(status: string): string {
  if (/converted|package sold/i.test(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (/checked in|attended|interested/i.test(status)) return 'border-blue-200 bg-blue-50 text-blue-800';
  if (/cancelled|no-show|absent|not a fit/i.test(status)) return 'border-border bg-slate-100 text-slate-700';
  if (/concern|late/i.test(status)) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-card text-slate-700';
}

function sessionSummaryFromOption(session: MomenceSessionOption): HostedClassSessionSummary {
  return {
    id: session.id,
    classType: session.classType,
    trainer: session.trainer,
    studio: session.studio,
    startsAt: session.startsAt,
    bookingCount: session.bookingCount,
    capacity: session.capacity ?? undefined,
    waitlistBookingCount: session.waitlistBookingCount ?? undefined,
    waitlistCapacity: session.waitlistCapacity ?? undefined,
  };
}

function formatHostedSessionDateTime(value?: string): string {
  if (!value) return 'Date not returned';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function toDateTimeLocalInputValue(value?: string): string {
  if (!value || typeof value !== 'string') return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return (value || '').replace(/([+-]\d{2}:?\d{2}|Z)$/i, '').slice(0, 16);
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

const templateDetailFormFromTemplate = (template: ContextTemplate): DetailForm => {
  if (!template) {
    return {
      id: 'default',
      title: 'Template Details',
      fields: [],
      submitLabel: 'Generate ticket draft',
    };
  }
  return {
    id: template.id || 'template',
    title: `${template.label} details`,
    description: template.description || '',
    fields: (template.fields || (template.prompts || []).map((prompt): ContextTemplateField => ({
      id: prompt,
      label: String(prompt || '').replace(/:\s*$/, ''),
      type: /feedback|concern|impact|action|notes|comment|resolution/i.test(String(prompt || '')) ? 'textarea' : 'text',
      required: true,
    }))).map((field): DetailFormField => ({
      id: String(field.id || ''),
      label: String(field.label || field.id || ''),
      type: field.type || 'text',
      required: Boolean(field.required),
      options: field.options || templateFieldOptions(String(field.id || '')),
      placeholder: field.placeholder || '',
      dependsOn: field.dependsOn,
      dependsOnValue: field.dependsOnValue,
      section: field.section,
      scoreWeight: field.scoreWeight,
    })),
    submitLabel: 'Generate ticket draft',
  };
};

function templateFieldOptions(fieldId: string): string[] | undefined {
  if (fieldId === 'studio') return STUDIOS;
  if (fieldId === 'trainer') return TRAINERS;
  if (fieldId === 'classType') return CLASS_TYPES;
  return undefined;
}

const HostedClassTemplateForm: React.FC<{
  template: ContextTemplate;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (payload: HostedClassFeedbackInput) => void;
}> = ({ template, disabled = false, onCancel, onSubmit }) => {
  const [sessionValues, setSessionValues] = useState<Record<string, string>>({});
  const [selectedSession, setSelectedSession] = useState<HostedClassSessionSummary | null>(null);
  const [attendees, setAttendees] = useState<HostedClassAttendeeFeedback[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerType, setPartnerType] = useState('');
  const [acquisitionSource, setAcquisitionSource] = useState('');
  const [audienceFit, setAudienceFit] = useState('');
  const [classFeedback, setClassFeedback] = useState('');
  const [hostFeedback, setHostFeedback] = useState(HOSTED_PARTNER_RESPONSE_OPTIONS[0]);
  const [lateComerFeedback, setLateComerFeedback] = useState(HOSTED_ARRIVAL_PATTERN_OPTIONS[0]);
  const [otherFeedback, setOtherFeedback] = useState('');
  const [conversionSummary, setConversionSummary] = useState(HOSTED_CONVERSION_OPTIONS[0]);
  const [socialAmplification, setSocialAmplification] = useState(HOSTED_SOCIAL_OPTIONS[0]);
  const [followUpPlan, setFollowUpPlan] = useState(HOSTED_FOLLOW_UP_PLAN_OPTIONS[1]);
  const canSubmit = Boolean(selectedSession && classFeedback.trim()) && !disabled;
  const hostedTemplateProgress = [
    { label: 'Session', value: selectedSession ? 'Selected' : 'Required', complete: Boolean(selectedSession) },
    { label: 'Member feedback', value: classFeedback.trim() ? 'Captured' : 'Required', complete: Boolean(classFeedback.trim()) },
    { label: 'Future collab', value: followUpPlan || 'Pending', complete: Boolean(followUpPlan) },
  ];

  const selectSession = async (session: MomenceSessionOption) => {
    const summary = sessionSummaryFromOption(session);
    setSelectedSession(summary);
    setSessionValues({
      sessionId: summary.id,
      classType: summary.classType,
      classDateTime: summary.startsAt || '',
      trainer: summary.trainer || '',
      studio: summary.studio || '',
    });
    setLoadingBookings(true);
    setBookingError(null);
    try {
      const detailed = await getMomenceSession(session.id);
      setSelectedSession({
        ...summary,
        bookingCount: detailed.bookingCount ?? session.bookingCount,
        capacity: detailed.capacity ?? session.capacity,
        waitlistBookingCount: detailed.waitlistBookingCount,
        waitlistCapacity: detailed.waitlistCapacity,
        trainer: detailed.teacher ? `${detailed.teacher.firstName || ''} ${detailed.teacher.lastName || ''}`.trim() || summary.trainer : summary.trainer,
        studio: detailed.inPersonLocation?.name || summary.studio,
      });
      const bookings = await getMomenceSessionBookings(session.id);
      setAttendees(bookings.map((booking) => ({
        bookingId: String(booking.id),
        memberName: momenceBookingMemberName(booking),
        memberContact: momenceBookingContact(booking),
        status: hostedBookingStatus(booking),
        followUpPreference: 'No follow-up needed',
        conversionSignal: '',
        comment: '',
      })));
    } catch (error) {
      setAttendees([]);
      setBookingError(error instanceof Error ? error.message : 'Could not load class attendees.');
    } finally {
      setLoadingBookings(false);
    }
  };

  const updateAttendee = (bookingId: string, patch: Partial<HostedClassAttendeeFeedback>) => {
    setAttendees((current) => current.map((attendee) => (
      attendee.bookingId === bookingId ? { ...attendee, ...patch } : attendee
    )));
  };

  return (
    <form
      className="rounded-[28px] border border-border bg-card shadow-[0_28px_80px_rgba(15,23,42,0.10)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selectedSession || !canSubmit) return;
        onSubmit({
          partnerName,
          partnerType,
          acquisitionSource,
          audienceFit,
          session: selectedSession,
          attendees,
          classFeedback,
          hostFeedback,
          lateComerFeedback,
          otherFeedback,
          conversionSummary,
          socialAmplification,
          followUpPlan,
        });
      }}
    >
      <div className="relative overflow-hidden rounded-t-[28px] border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.22),_transparent_60%)]" />
        <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30">
              <LayoutTemplate className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Hosted class template</div>
              <h3 className="mt-1 text-base font-semibold text-white">{template.label}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">Partner audience insight, attendee response, and conversion follow-up for Signature Partnership Experiences.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div aria-label="Hosted template progress" className="grid min-w-[min(100%,390px)] grid-cols-3 gap-2">
              {hostedTemplateProgress.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-3 py-2 ${
                    item.complete
                      ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-200'
                      : 'border-white/10 bg-white/8 text-white/60'
                  }`}
                >
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">{item.label}</div>
                  <div className="mt-1 truncate text-[11px] font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3 text-xs font-semibold text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_480px]">
          <section className="rounded-3xl border border-border bg-gradient-to-br from-slate-50 via-white to-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Momence source</div>
                <h4 className="mt-1 text-sm font-semibold text-slate-950">Selected session</h4>
              </div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Private hosted</span>
            </div>
            <MomenceSessionDropdownField
              multi={false}
              sessionTypes={HOSTED_CLASS_SESSION_TYPES}
              values={sessionValues}
              onChange={async (sessions) => {
                const session = sessions[0];
                if (!session) {
                  setSelectedSession(null);
                  setSessionValues({});
                  setAttendees([]);
                  return;
                }
                await selectSession(session);
              }}
            />
            {selectedSession && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { label: 'Class', value: selectedSession.classType || 'Class not returned' },
                  { label: 'Date', value: formatHostedSessionDateTime(selectedSession.startsAt) },
                  { label: 'Studio', value: selectedSession.studio || 'Studio not returned' },
                  { label: 'Instructor', value: selectedSession.trainer || 'Instructor not returned' },
                  { label: 'Booked', value: selectedSession.capacity != null ? `${selectedSession.bookingCount || 0}/${selectedSession.capacity}` : `${selectedSession.bookingCount || 0} booked` },
                  { label: 'Waitlist', value: selectedSession.waitlistBookingCount != null ? `${selectedSession.waitlistBookingCount}/${selectedSession.waitlistCapacity ?? 'unlimited'}` : 'Not returned' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
                    <div className="mt-1 truncate text-xs font-semibold text-foreground">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Partner signal</div>
                <h4 className="mt-1 text-sm font-semibold text-slate-950">Partnership context</h4>
              </div>
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TemplateTextInput label="Host name" value={partnerName} onChange={setPartnerName} />
              <TemplateSelect label="Partner type" value={partnerType} options={HOSTED_PARTNER_TYPE_OPTIONS} onChange={setPartnerType} />
              <TemplateSelect label="Attendance source" value={acquisitionSource} options={HOSTED_SOURCE_OPTIONS} onChange={setAcquisitionSource} />
              <TemplateSelect label="Audience fit" value={audienceFit} options={HOSTED_AUDIENCE_FIT_OPTIONS} onChange={setAudienceFit} />
            </div>
          </section>
        </div>
        {bookingError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{bookingError}</div>}
        {loadingBookings && <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">Loading class attendees from Momence...</div>}

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_520px]">
          <section className="rounded-3xl border border-border/80 bg-card p-4.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Momence bookings</div>
                <h4 className="mt-0.5 text-sm font-bold text-foreground">Attendee response</h4>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/80 px-3 py-1 text-[10px] font-bold text-foreground shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 template-pulse-dot" />
                {selectedSession ? `${attendees.length} members loaded` : 'Awaiting session'}
              </div>
            </div>
            {selectedSession && (
              <div className="max-h-[50vh] space-y-2.5 overflow-y-auto pr-1">
                {attendees.length ? attendees.map((attendee) => (
                  <div key={attendee.bookingId} className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 shadow-2xs transition-all hover:border-blue-300 hover:bg-card dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-blue-500/50">
                    {/* Top Row: Member Info + Status & Follow-Up Dropdowns */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm ring-2 ring-blue-500/20">
                          {attendee.memberName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-foreground">{attendee.memberName}</div>
                          {attendee.memberContact && <div className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{attendee.memberContact}</div>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        {/* Attendance Status Dropdown */}
                        <div className="relative w-full sm:w-[175px]">
                          <select
                            value={attendee.status}
                            onChange={(event) => updateAttendee(attendee.bookingId, { status: event.target.value })}
                            className={`h-9.5 w-full appearance-none rounded-xl border pl-3 pr-8 text-xs font-semibold outline-none transition cursor-pointer focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 ${hostedStatusTone(attendee.status)}`}
                          >
                            {Array.from(new Set([attendee.status, ...HOSTED_ATTENDEE_STATUS_OPTIONS])).map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-70" />
                        </div>

                        {/* Attendee Follow-up Dropdown */}
                        <div className="relative w-full sm:w-[185px]">
                          <select
                            value={attendee.followUpPreference || HOSTED_FOLLOW_UP_OPTIONS[0]}
                            onChange={(event) => updateAttendee(attendee.bookingId, { followUpPreference: event.target.value })}
                            className="h-9.5 w-full appearance-none rounded-xl border border-border/80 bg-background pl-3 pr-8 text-xs font-semibold text-foreground outline-none transition cursor-pointer hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900"
                          >
                            {HOSTED_FOLLOW_UP_OPTIONS.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 opacity-70" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Full width verbatim note input */}
                    <div className="mt-2.5">
                      <input
                        value={attendee.comment || ''}
                        onChange={(event) => updateAttendee(attendee.bookingId, { comment: event.target.value })}
                        placeholder="Capture member verbatim feedback, complaint, or session observation…"
                        className="h-9 w-full rounded-xl border border-border/80 bg-background px-3.5 text-xs text-foreground outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-0 dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/40 px-3 py-8 text-center text-xs font-medium text-muted-foreground">
                    No attendees returned for this Momence class.
                  </div>
                )}
              </div>
            )}
            {!selectedSession && (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/40 px-4 py-10 text-center text-xs font-medium leading-relaxed text-muted-foreground">
                Awaiting hosted Momence session selection.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Ticket intelligence</div>
                <h4 className="mt-1 text-sm font-semibold text-slate-950">Feedback and follow-up</h4>
              </div>
              <Gauge className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="space-y-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TemplateSelect label="Partner response" value={hostFeedback} options={HOSTED_PARTNER_RESPONSE_OPTIONS} onChange={setHostFeedback} />
                <TemplateSelect label="Arrival pattern" value={lateComerFeedback} options={HOSTED_ARRIVAL_PATTERN_OPTIONS} onChange={setLateComerFeedback} />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TemplateSelect label="Conversion signal" value={conversionSummary} options={HOSTED_CONVERSION_OPTIONS} onChange={setConversionSummary} />
                <TemplateSelect label="Social opportunity" value={socialAmplification} options={HOSTED_SOCIAL_OPTIONS} onChange={setSocialAmplification} />
              </div>
              <TemplateSelect label="Follow-up plan" value={followUpPlan} options={HOSTED_FOLLOW_UP_PLAN_OPTIONS} onChange={setFollowUpPlan} />
              <TemplateTextArea label="Overall class comments" required value={classFeedback} onChange={setClassFeedback} />
              <TemplateTextArea label="Additional notes" value={otherFeedback} onChange={setOtherFeedback} />
            </div>
          </section>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-border/80 bg-card/90 px-6 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${selectedSession ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300'}`}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {selectedSession ? 'Session selected' : 'Session required'}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${classFeedback.trim() ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300'}`}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {classFeedback.trim() ? 'Member feedback captured' : 'Member feedback required'}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10.5 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 text-xs font-bold text-white shadow-[0_8px_24px_rgba(79,70,229,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-violet-500 hover:shadow-[0_14px_32px_rgba(79,70,229,0.42)] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none"
        >
          <WandSparkles className="h-3.5 w-3.5" />
          Generate ticket draft
        </button>
      </div>
    </form>
  );
};

const TemplateTextArea: React.FC<{
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, required = false, onChange }) => (
  <label className="block min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all focus-within:border-blue-500/80 focus-within:ring-4 focus-within:ring-blue-500/15 sm:col-span-2 xl:col-span-3 dark:border-slate-800 dark:bg-slate-900">
    <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {label}
      {required ? <span className="text-blue-600 dark:text-blue-400"> *</span> : null}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      placeholder={`Enter ${label.toLowerCase()}…`}
      className="mt-2 min-h-24 w-full resize-y rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-foreground outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-background focus:ring-0 dark:border-slate-800 dark:bg-slate-950"
    />
    <SuggestionChips suggestions={suggestionsForTemplateTextField(label, value)} onPick={onChange} />
  </label>
);

const TemplateTextInput: React.FC<{
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, required = false, onChange }) => (
  <label className="block min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all focus-within:border-blue-500/80 focus-within:ring-4 focus-within:ring-blue-500/15 dark:border-slate-800 dark:bg-slate-900">
    <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {label}
      {required ? <span className="text-blue-600 dark:text-blue-400"> *</span> : null}
    </span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Enter ${label.toLowerCase()}…`}
      className="mt-2 h-10 w-full rounded-xl border border-border/80 bg-muted/40 px-3.5 text-xs font-medium text-foreground outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-background focus:ring-0 dark:border-slate-800 dark:bg-slate-950"
    />
    <SuggestionChips suggestions={suggestionsForTemplateTextField(label, value)} onPick={onChange} />
  </label>
);

function suggestionsForTemplateTextField(label: string, value = ''): string[] {
  const normalized = label.toLowerCase();
  const current = value.trim();
  const currentLower = current.toLowerCase();

  // Dynamic autocomplete based on active user typing
  if (current.length > 2) {
    return [
      `${current} — documented during studio touchpoint.`,
      `${current} — member requested follow-up from team.`,
      `${current} — flagged for resolution review.`,
      `${current} — confirmed with studio staff on duty.`,
    ];
  }

  const hasSessionContext = /\b(class|session|trainer|instructor|member|late|start|impact)\b/.test(currentLower);
  const hasLateSignal = /\b(late|delay|delayed|started late|punctual|tardy|behind schedule)\b/.test(currentLower);
  if (/host name/.test(normalized)) {
    return [
      'Partner / host name as listed in the collaboration brief.',
      'Creator or brand name that introduced the audience.',
      'Community partner name captured from the booking or invitation.',
    ];
  }
  if (/overall class comments|attendee details|class details/.test(normalized)) {
    return [
      'Attendees responded positively and several asked about the next session.',
      'The room was energetic, with a few guests asking about intro offers.',
      'Late arrivals and travel distance were mentioned, but the host kept engagement high.',
    ];
  }
  if (/additional notes/.test(normalized)) {
    return [
      'Partner asked for a follow-up on future Signature Partnership Experiences.',
      'Team member noted a possible repeat collaboration if proximity is better.',
      'No extra notes captured beyond the attendee comments and host feedback.',
    ];
  }
  if (/session|class|trainer|instructor/.test(normalized) && hasSessionContext) {
    return [
      'Exact Momence session ID or booking reference if available.',
      'The scheduled class, instructor and start time for this report.',
      'How the session changed, including delay, late start, or member impact.',
    ];
  }
  if (/member feedback|feedback|highlight|comment/.test(normalized)) {
    return [
      'Member reported that the touchpoint affected their overall Physique 57 experience.',
      'Member expressed appreciation for the instructor support and class energy.',
      'Member stated that they would like a follow-up before their next visit.',
    ];
  }
  if (/partner|influencer|host/.test(normalized)) {
    return [
      'Partner audience showed strong alignment with the P57 community.',
      'Partner requested follow-up on future Signature Partnership Experiences.',
      'Attendees mentioned discovering Physique 57 through the partner invitation.',
    ];
  }
  if (/context|note|detail|reason|concern|issue|resolution|action/.test(normalized)) {
    if (hasLateSignal) {
      return [
        'Trainer arrived late and the class started behind schedule.',
        'The late start was noticed after the scheduled start time had passed.',
        'Members were impacted and service recovery was discussed with the studio team.',
      ];
    }
    return [
      'Member reported the concern in person after the studio session.',
      'Team member offered an immediate workaround and member accepted follow-up.',
      'Member requested a clear resolution timeline and preferred WhatsApp follow-up.',
    ];
  }
  if (hasLateSignal) {
    return [
      'Trainer arrived late and the class started behind schedule.',
      'The instructor gave advance notice before the scheduled start.',
      'Members were affected and the team discussed service recovery.',
    ];
  }
  return [
    'Member reported this during a studio touchpoint.',
    'Member requested follow-up from the appropriate team.',
    'Team member documented the member feedback for internal resolution.',
  ];
}

function suggestionsForDetailField(field: DetailFormField, values: Record<string, string>): string[] {
  const id = field.id;
  const label = field.label.toLowerCase();
  const currentValue = (values[id] || '').trim();
  const memberName = values.memberName || values.reportedBy || '';
  const studioName = values.studio ? values.studio.split(',')[0] : '';
  const trainerName = values.trainer || '';
  const classType = values.classType || '';

  // Dynamic user input autocomplete
  if (currentValue.length > 2) {
    return [
      `${currentValue} — noted for ${memberName || 'member'} at ${studioName || 'studio'}.`,
      `${currentValue} — requested resolution follow-up within 24 hours.`,
      `${currentValue} — escalated to studio management for review.`,
    ];
  }

  const sessionContext = [
    values.sessionId || '',
    values.classType || '',
    values.trainer || '',
    values.classDateTime || '',
  ].join(' ').toLowerCase();
  const lateContext = [
    values.description || '',
    values.memberFeedback || '',
    values.classImpactDetails || '',
    values.latenessReason || '',
    values.lateArrivalReason || '',
    values.serviceRecoveryAction || '',
  ].join(' ').toLowerCase();
  const hasSessionContext = Boolean(sessionContext.trim());
  const hasLateSignal = /\b(late|delay|delayed|started late|punctual|tardy|behind schedule)\b/.test(lateContext);

  if (id === 'memberFeedback') {
    return [
      memberName
        ? `"${memberName} reported that the session experience did not meet expectations."`
        : '"I was told I couldn\'t enter even though I arrived right at class time — this has never happened before."',
      trainerName
        ? `"${memberName || 'Member'} shared feedback regarding ${trainerName}'s ${classType || 'class'} energy and cues."`
        : '"The instructor didn\'t seem to notice the issue during class and I felt uncomfortable raising it."',
      studioName
        ? `"Feedback regarding the ${studioName} studio environment and overall session flow."`
        : '"I was really happy with the session today — the instructor\'s energy was amazing."',
    ];
  }
  if (id === 'entryDeniedReason') {
    return [
      'Entry was denied because the class had already started and the door policy had been enforced.',
      'The member arrived after the grace period and was advised that late entry was not permitted.',
      'Front desk turned the member away due to the late-arrival cutoff and class safety / flow rules.',
    ];
  }
  if (id === 'policyExplanation') {
    return [
      'Explained that our policy is to close the studio door 5 minutes after the session starts to protect the member experience.',
      'Informed the member that late entry is not permitted once the warm-up has begun, as per Physique 57 policy.',
      'Policy was not formally explained at the time — member was turned away without a written or verbal reason.',
    ];
  }
  if (id === 'lateArrivalReason' || id === 'latenessReason') {
    return [
      'Trainer cited traffic, transport issues, or an unavoidable commute delay.',
      'Trainer said the previous session ran over and the next class started late.',
      'Trainer gave an operational reason and the team recorded whether advance notice was shared.',
    ];
  }
  if (id === 'alternativeSolution') {
    return [
      'Offered a complimentary class credit to the member\'s Momence account as a goodwill gesture.',
      'Transferred the member\'s booking to the next available session at no extra charge.',
      'No alternative was offered — member was turned away and no follow-up was initiated.',
    ];
  }
  if (id === 'requestedResolution' || id === 'requestedChange') {
    return [
      'Member requested a class credit and a written apology from the studio manager.',
      'Member asked for a callback within 24 hours to confirm the resolution.',
      'Member requested the late-arrival policy be reviewed and communicated more clearly to members.',
    ];
  }
  if (id === 'classCreditedOrRescheduled') {
    return [
      'Credited back to the member account.',
      'Rescheduled to the next available session.',
      'No credit or reschedule was completed yet.',
    ];
  }
  if (id === 'escalationRequired') {
    return [
      'Yes - the member asked for manager review or follow-up.',
      'No - the issue was handled at the front desk.',
      'Unable to determine whether escalation is needed.',
    ];
  }
  if (id === 'reportedImpact' || id === 'membersUpset') {
    return [
      'Members were visibly frustrated and asked whether the class would start soon.',
      'A member left early after the delay and asked front desk for clarity.',
      'No obvious frustration was reported, but the team still noted the late start.',
    ];
  }
  if (id === 'membersAffected') {
    return [
      'A single member was affected because they arrived for the scheduled start time.',
      'Several members were affected because the entire class began behind schedule.',
      'The full session was impacted and the team is still confirming the total member count.',
    ];
  }
  if (id === 'serviceRecoveryAction' || id === 'immediateAction') {
    return [
      'Apologised to the member on behalf of the studio and escalated to the studio manager.',
      'Offered a complimentary session credit immediately and logged the concern in Momence.',
      'No immediate action taken — member left before any resolution could be offered.',
    ];
  }
  if (id === 'serviceRecoveryNeeded') {
    return [
      'Yes - a follow-up or goodwill action is needed for the affected session.',
      'No - the incident was documented only and no recovery is required.',
      'Unable to confirm whether service recovery is needed yet.',
    ];
  }
  if (id === 'advanceNoticeGiven') {
    return hasSessionContext
      ? [
          'Yes - the instructor informed the studio before the scheduled start.',
          'No - the studio learned about the delay only after members were waiting.',
          'Unable to confirm whether advance notice was shared.',
        ]
      : [
          'Yes - the issue was shared before the session started.',
          'No - the issue surfaced only after it impacted the touchpoint.',
          'Unable to confirm the timing of the notice.',
        ];
  }
  if (id === 'sessionFeedback') {
    return [
      'Member noted the instructor\'s cues were unclear during the tuck sequence and asked for more corrections.',
      'Member commented that the music was too loud and affected their ability to follow instructions.',
      'Member praised the energy in the room but felt the pacing was faster than usual for this class type.',
    ];
  }
  if (id === 'studioArea') {
    return [
      'Locker room — member reported a broken lock on locker #12 and visible mould near the showers.',
      'PowerCycle studio — bike near the door had a loose handlebar that was flagged during class.',
      'Reception and waiting area — member noted the area felt overcrowded before the 7 AM class.',
    ];
  }
  if (id === 'description' || id === 'classImpactDetails') {
    if (hasLateSignal || hasSessionContext) {
      return [
        'The trainer arrived late, the class started behind schedule, and members wanted the exact session attached.',
        'The session started late, members were impacted, and the front desk discussed service recovery with the team.',
        'Members asked whether the delay was pre-informed and whether a follow-up was needed.',
      ];
    }
    return [
      'Member reported the concern during a studio touchpoint and requested follow-up.',
      'Member stated the issue affected their session experience and wants a resolution timeline.',
      'Team member documented the concern with studio, session, and member impact context.',
    ];
  }
  if (id.toLowerCase().includes('resolution') || /resolution|outcome|action/.test(label)) {
    return hasSessionContext
      ? [
          'Member requested a callback with the confirmed next step for this session.',
          'Member asked for written confirmation on the follow-up and any service recovery.',
          'Team member documented the recovery step and whether the session should be reviewed further.',
        ]
      : [
          'Member requested a callback with the confirmed next step.',
          'Member requested written confirmation by WhatsApp or email.',
          'Team member offered an interim solution while the issue is reviewed.',
        ];
  }
  if (id.toLowerCase().includes('feedback') || /feedback|comment/.test(label)) {
    return [
      'Member expressed mixed feedback and asked that the concern be shared internally.',
      'Member complimented the instructor and noted the class energy felt strong.',
      'Member stated the touchpoint did not meet their expected Physique 57 standard.',
    ];
  }
  return suggestionsForTemplateTextField(field.label, values[id] || '');
}

const SuggestionChips: React.FC<{ suggestions: string[]; onPick: (value: string) => void }> = ({ suggestions, onPick }) => (
  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
    {suggestions.slice(0, 4).map((suggestion, idx) => (
      <button
        key={suggestion}
        type="button"
        onClick={() => onPick(suggestion)}
        className="animate-p57-fade-up group relative inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 px-3 py-1 text-[11px] font-semibold text-blue-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-blue-500 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:shadow-[0_4px_14px_rgba(37,99,235,0.28)] active:scale-95 dark:border-blue-500/35 dark:from-blue-950/40 dark:to-indigo-950/40 dark:text-blue-300 dark:hover:from-blue-600 dark:hover:to-indigo-600 dark:hover:text-white"
        style={{ animationDelay: `${idx * 40}ms` }}
        title={suggestion}
      >
        <Sparkles className="h-3 w-3 shrink-0 text-blue-500 opacity-80 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110 group-hover:text-white dark:text-blue-400" />
        <span className="truncate max-w-[200px]">{suggestion}</span>
      </button>
    ))}
  </div>
);

const TemplateSelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, options, required = false, onChange }) => (
  <label className="group relative flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm transition-all focus-within:border-blue-500/80 focus-within:ring-4 focus-within:ring-blue-500/15 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
    <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {label}
      {required ? <span className="text-blue-600 dark:text-blue-400"> *</span> : null}
    </span>
    <div className="relative mt-2 min-w-0 w-full">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 w-full appearance-none rounded-xl border border-border/80 bg-muted/50 pl-3 pr-9 text-xs font-semibold text-foreground outline-none transition cursor-pointer hover:border-blue-400 focus:border-blue-500 focus:bg-background focus:ring-0 dark:border-slate-800 dark:bg-slate-950"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 opacity-70 transition group-hover:text-blue-600" />
    </div>
  </label>
);

const MessageBubble: React.FC<{
  message: Message;
  index: number;
  onChipClick: (chip: SuggestedChip) => void;
  onDetailFormSubmit: (values: Record<string, string>, form?: DetailForm) => void;
  onOpenDraftReview: (messageId: string) => void;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
  context: DetailContext;
  showDebugTrace: boolean;
}> = ({ message, index, onChipClick, onDetailFormSubmit, onOpenDraftReview, onRegenerate, canRegenerate = false, context, showDebugTrace }) => {
  const isUser = message.role === 'user';
  const userTone = USER_TONES[index % USER_TONES.length];
  const visibleChips = (message.suggestedChips || []).filter((chip) => !context[chip.field]);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };
  
  // Streaming effect for AI messages
  const [streamedContent, setStreamedContent] = useState(isUser ? message.content : '');
  const [isStreaming, setIsStreaming] = useState(!isUser && message.aiGenerated);

  useEffect(() => {
    if (isUser || !message.aiGenerated) {
      setStreamedContent(message.content);
      setIsStreaming(false);
      return;
    }

    // Stream the content character by character
    let currentIndex = 0;
    const targetContent = message.content;
    setIsStreaming(true);
    setStreamedContent('');

    const streamInterval = setInterval(() => {
      if (currentIndex < targetContent.length) {
        // Stream 2-4 characters at a time for natural feel
        const chunkSize = Math.floor(Math.random() * 3) + 2;
        currentIndex = Math.min(currentIndex + chunkSize, targetContent.length);
        setStreamedContent(targetContent.slice(0, currentIndex));
      } else {
        setIsStreaming(false);
        clearInterval(streamInterval);
      }
    }, 25); // 25ms per chunk = ~40 chars/second

    return () => clearInterval(streamInterval);
  }, [message.content, message.aiGenerated, isUser]);

  const displayContent = isUser ? message.content : streamedContent;

  const renderContent = (text: string) => {
    const renderInline = (value: string) =>
      value.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={j}>{part}</React.Fragment>
        )
      );

    const blocks = text.split('\n\n').map((block) => block.trim()).filter(Boolean);
    return blocks.map((block, index) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const isList = lines.every((line) => /^-\s+/.test(line));
      if (isList) {
        return (
          <ul key={`b-${index}`} className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] break-words">
            {lines.map((line, itemIndex) => (
              <li key={`li-${itemIndex}`} className="leading-relaxed">{renderInline(line.replace(/^-\s+/, ''))}</li>
            ))}
          </ul>
        );
      }
      return (
        <p key={`b-${index}`} className={`${index === 0 ? '' : 'mt-1.5'} leading-relaxed break-words`}>
          {lines.map((line, lineIndex) => (
            <React.Fragment key={`l-${lineIndex}`}>
              {renderInline(line)}
              {lineIndex < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    });
  };
  const contentLines = displayContent.split('\n');
  const shouldCollapse =
    isUser &&
    !message.ticket &&
    !message.detailForm &&
    (contentLines.length > 3 || displayContent.length > 260);
  const previewContent = (() => {
    if (!shouldCollapse || expanded) return displayContent;
    const firstLines = contentLines.slice(0, 3).join('\n');
    return firstLines.length > 260 ? `${firstLines.slice(0, 260).trimEnd()}...` : `${firstLines.trimEnd()}...`;
  })();

  return (
    <div
      className={`animate-chat-message-in group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
      style={{ animationDelay: `${Math.min(index * 28, 240)}ms` }}
    >
      <div className={`flex w-full items-end gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && (
          <div className="relative p-[1.5px] rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 shadow-[0_2px_10px_rgba(59,130,246,0.3)] flex-shrink-0 mb-0.5">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-900">
              <img src="/athena-ai-logo.png" alt="Athena" className="w-full h-full rounded-full object-cover" />
            </div>
          </div>
        )}
        <div className={isUser ? 'max-w-[75%]' : 'max-w-[80%]'}>
          <div
            className={`inline-block max-w-full overflow-hidden break-words [word-break:break-word] [overflow-wrap:anywhere] rounded-[20px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
              isUser
                ? 'rounded-br-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-[0_6px_20px_-4px_rgba(37,99,235,0.35)] border border-white/15 font-medium'
                : 'rounded-bl-xs border border-slate-200/90 dark:border-slate-800 bg-card dark:bg-slate-900 text-foreground shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
            }`}
          >
            {renderContent(previewContent)}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse rounded-full bg-current opacity-70" />
            )}
            {shouldCollapse && (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className={`mt-2 block text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity ${
                  isUser ? 'text-white underline' : 'text-blue-600 dark:text-blue-400'
                }`}
              >
                {expanded ? 'Show less ↑' : 'Show more ↓'}
              </button>
            )}
          </div>
        </div>
      </div>

      {!isUser && message.content && (
        <div className="ml-11 mt-1.5 flex items-center gap-1 opacity-70 transition duration-200 group-hover:opacity-100">
          <button
            type="button"
            onClick={handleCopyContent}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {canRegenerate && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
            >
              <RotateCw className="h-3 w-3" />
              Regenerate
            </button>
          )}
        </div>
      )}

      {visibleChips.length > 0 && !message.ticket && (
        <div className="mt-3 ml-11 flex flex-wrap gap-2">
          {visibleChips.map((c, i) => (
            <button
              key={i}
              onClick={() => onChipClick(c)}
              style={{ animationDelay: `${i * 45}ms` }}
              className="animate-p57-fade-up group relative inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-cyan-500/10 px-3.5 py-1.5 text-[12px] font-bold text-blue-700 shadow-[0_2px_10px_rgba(37,99,235,0.08)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-blue-500 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] active:scale-95 dark:border-blue-400/35 dark:from-blue-950/50 dark:to-indigo-950/50 dark:text-blue-300 dark:hover:from-blue-600 dark:hover:to-indigo-600 dark:hover:text-white"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/15 text-[10px] transition-colors group-hover:bg-white/20 group-hover:text-white">
                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {message.detailForm && !message.ticket && (
        <DetailCaptureForm form={message.detailForm} initialContext={context} onSubmit={onDetailFormSubmit} />
      )}

      {message.ticket && (
        <div className="mt-3 ml-11 w-full max-w-md">
          {message.published && message.ticketId ? (
            <PublishedTicketSummary ticketId={message.ticketId} ticket={message.publishedTicket} />
          ) : (
            <button
              type="button"
              onClick={() => onOpenDraftReview(message.id)}
              className="animate-draft-popout-cue flex w-full items-center gap-3.5 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-card px-4 py-3.5 text-left shadow-[0_4px_20px_rgba(37,99,235,0.12)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-[0_8px_28px_rgba(37,99,235,0.22)] dark:from-blue-950/30 dark:to-indigo-950/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
                <ClipboardCheck className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-foreground">Draft ready</span>
                <span className="block truncate text-xs text-muted-foreground">{message.ticket.title}</span>
              </span>
              <span className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-slate-700">
                Review →
              </span>
            </button>
          )}
        </div>
      )}
      {message.published && !message.ticket && message.ticketId && (
        <PublishedTicketSummary ticketId={message.ticketId} ticket={message.publishedTicket} />
      )}

      {showDebugTrace && message.debugTrace && (
        (() => {
          const traceRecord = message.debugTrace as Record<string, unknown>;
          const final = traceRecord.final as Record<string, unknown> | undefined;
          const guard = traceRecord.guard as Record<string, unknown> | undefined;
          const steps = Array.isArray(traceRecord.decisionSteps) ? (traceRecord.decisionSteps as string[]) : [];
          const guardedMissingFields = Array.isArray(guard?.guardedMissingFields) ? (guard?.guardedMissingFields as string[]) : [];
          const finalDetailFormFieldIds = Array.isArray(final?.detailFormFieldIds) ? (final?.detailFormFieldIds as string[]) : [];
          return (
        <details className="mt-2 w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-950 shadow-sm">
          <summary className="cursor-pointer font-semibold uppercase tracking-[0.14em] text-amber-800">
            Athena decision trace
          </summary>
          <div className="mt-2 space-y-2">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-xl bg-white/90 p-2">
                <div className="font-semibold text-amber-900">Final decision</div>
                <div className="mt-1 text-slate-700">Path: {String(traceRecord.path || 'n/a')}</div>
                <div className="text-slate-700">Needs more info: {String(final?.needsMoreInfo ?? false)}</div>
                <div className="text-slate-700">Ticket returned: {String(final?.ticketPresent ?? false)}</div>
                {finalDetailFormFieldIds.length > 0 && (
                  <div className="text-slate-700">Final form fields: {finalDetailFormFieldIds.join(', ')}</div>
                )}
              </div>
              <div className="rounded-xl bg-white/90 p-2">
                <div className="font-semibold text-amber-900">Guard fields</div>
                <div className="mt-1 text-slate-700">
                  {guardedMissingFields.length > 0 ? guardedMissingFields.join(', ') : 'None'}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-white/90 p-2">
              <div className="font-semibold text-amber-900">Decision steps</div>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-slate-700">
                {steps.map((step: string, stepIndex: number) => (
                  <li key={stepIndex}>{step}</li>
                ))}
              </ol>
            </div>
            <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">
              {JSON.stringify(message.debugTrace, null, 2)}
            </pre>
          </div>
        </details>
          );
        })()
      )}
    </div>
  );
};

function firstContextValue(value?: string | null): string | undefined {
  return value
    ?.split('|')
    .map((item) => item.trim())
    .find(Boolean);
}

const DraftTicketReviewPreview: React.FC<{
  draft: DraftTicket;
  context: DetailContext;
  tickets: Ticket[];
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onSaveEdit: (draft: DraftTicket) => void;
  confirmed?: boolean;
  ticketId?: string;
  confirmedTicket?: Ticket;
  publishing?: boolean;
}> = ({ draft, context, tickets, onConfirm, onEdit, onDiscard, onSaveEdit, confirmed, ticketId, confirmedTicket, publishing }) => {
  const [momenceSummary, setMomenceSummary] = useState<MomenceInsightSummary | undefined>();
  const [momenceLoading, setMomenceLoading] = useState(false);
  const [momenceError, setMomenceError] = useState<string | null>(null);
  const memberId = firstContextValue(context.memberId);
  const sessionId = firstContextValue(context.sessionId);

  useEffect(() => {
    if (!memberId && !sessionId) {
      setMomenceSummary(undefined);
      setMomenceError(null);
      setMomenceLoading(false);
      return;
    }

    let cancelled = false;
    setMomenceLoading(true);
    setMomenceError(null);
    loadMomenceTicketContext({ memberId, sessionId })
      .then((momenceContext) => {
        if (!cancelled) setMomenceSummary(momenceContext.summary);
      })
      .catch((error) => {
        if (!cancelled) {
          setMomenceSummary(undefined);
          setMomenceError(error instanceof Error ? error.message : 'Momence context unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setMomenceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberId, sessionId]);

  const reviewContext = useMemo(() => contextFromDraft(draft, context), [context, draft]);
  const duplicateTicket = useMemo(
    () => findRelatedSubmittedTickets(`${draft.title}\n${draft.description}`, reviewContext, tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket))).exactDuplicate,
    [draft.description, draft.title, reviewContext, tickets]
  );
  const reviewInsights = useMemo(
    () => buildTicketReviewInsights({ draft, context: reviewContext, momenceSummary, duplicateTicket }),
    [draft, duplicateTicket, momenceSummary, reviewContext]
  );
  const duplicatePatternInsights = useMemo(() => buildDuplicatePatternInsights({
    id: '__draft__',
    title: draft.title,
    description: draft.description,
    category: draft.category,
    subCategory: draft.subCategory,
    priority: draft.priority,
    status: 'New',
    studio: draft.studio,
    trainer: draft.trainer || undefined,
    classType: draft.classType || undefined,
    classDateTime: draft.classDateTime || undefined,
    memberName: draft.memberName || undefined,
    memberContact: draft.memberContact || undefined,
    reportedBy: draft.reportedBy || undefined,
    assignedTo: draft.assignedTo || 'Unassigned',
    team: draft.department || 'Management',
    tags: draft.tags,
    createdAt: new Date(0).toISOString(),
    slaDueAt: new Date(0).toISOString(),
    sentiment: draft.sentiment as Ticket['sentiment'] | undefined,
  }, tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket))), [draft, tickets]);

  return (
    <TicketPreviewCard
      draft={draft}
      onConfirm={onConfirm}
      onEdit={onEdit}
      onDiscard={onDiscard}
      onSaveEdit={onSaveEdit}
      confirmed={confirmed}
      ticketId={ticketId}
      confirmedTicket={confirmedTicket}
      publishing={publishing}
      reviewInsights={reviewInsights}
      duplicatePatternInsights={duplicatePatternInsights}
      momenceLoading={momenceLoading}
      momenceError={momenceError}
    />
  );
};

const TypingIndicator: React.FC = () => (
  <div className="animate-p57-fade-up flex items-end gap-2.5">
    <div className="relative p-[1.5px] rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 shadow-[0_2px_10px_rgba(59,130,246,0.3)] animate-athena-logo-glow flex-shrink-0 mb-0.5">
      <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-900">
        <img src="/athena-ai-logo.png" alt="Athena" className="w-full h-full rounded-full object-cover" />
      </div>
    </div>
    <div className="flex items-center gap-2 rounded-[20px] rounded-bl-xs border border-slate-200/90 dark:border-slate-800 bg-card/98 px-4.5 py-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <span className="h-2 w-2 rounded-full bg-blue-600 animate-typing" style={{ animationDelay: '0s' }} />
      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-typing" style={{ animationDelay: '0.2s' }} />
      <span className="h-2 w-2 rounded-full bg-cyan-600 animate-typing" style={{ animationDelay: '0.4s' }} />
    </div>
  </div>
);

const TrainerAvatar: React.FC<{ name: string; src?: string; size?: 'sm' | 'lg' }> = ({ name, src, size = 'sm' }) => {
  const dimension = size === 'lg' ? 'h-16 w-16 text-sm' : 'h-6 w-6 text-[9px]';
  return (
    <span className={`${dimension} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50 font-bold text-blue-700`}>
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        trainerInitials(name)
      )}
    </span>
  );
};

const InstructorEvaluationChatbox: React.FC<{
  onSubmit: (evaluation: TrainerEvaluationInput) => void | Promise<void>;
  disabled?: boolean;
}> = ({ onSubmit, disabled }) => {
  const [template, setTemplate] = useState<TrainerReviewTemplate>('Barre');
  const [instructor, setInstructor] = useState('');
  const [studio, setStudio] = useState('');
  const [classType, setClassType] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [reviewPeriod, setReviewPeriod] = useState('');
  const [scores, setScores] = useState<TrainerEvaluationScore[]>(
    TRAINER_REVIEW_TEMPLATES.Barre.map((item) => ({ ...item, score: 0 }))
  );
  const [feedback, setFeedback] = useState('');
  const [focusPoints, setFocusPoints] = useState('');
  const [goals, setGoals] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScoring, setShowScoring] = useState(false);
  const [trainerMenuOpen, setTrainerMenuOpen] = useState(false);
  const selectedTrainerImage = trainerImageUrl(instructor);

  const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
  const totalWeightage = scores.reduce((sum, item) => sum + item.weightage, 0);
  const scorePercent = totalWeightage ? Math.round((totalScore / totalWeightage) * 100) : 0;

  const athenaPrompts = [
    !instructor ? 'Instructor name helps Athena update the right profile.' : '',
    !studio ? 'Studio context improves trend reporting.' : '',
    !scores.some((item) => item.score > 0) ? 'Use sliders when score weightage is available.' : '',
    !feedback.trim() ? 'Evaluator comments will make the ticket richer.' : '',
  ].filter(Boolean);

  const applyTemplate = (nextTemplate: TrainerReviewTemplate) => {
    setTemplate(nextTemplate);
    setScores(TRAINER_REVIEW_TEMPLATES[nextTemplate].map((item) => ({ ...item, score: 0 })));
    setClassType('');
    setSessionId('');
  };

  const setScore = (category: string, score: number) => {
    setScores((current) => current.map((item) => (
      item.category === category
        ? { ...item, score: Math.max(0, Math.min(item.weightage, score)) }
        : item
    )));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        trainer: instructor.trim() || 'Unspecified Instructor',
        template,
        studio,
        classType,
        reviewPeriod,
        scores,
        feedback: feedback.trim() || 'Instructor evaluation submitted without evaluator notes.',
        focusPoints,
        goals,
      });
      setFeedback('');
      setFocusPoints('');
      setGoals('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-blue-100 bg-card/95 p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <GraduationCap className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">Instructor evaluation</div>
          <div className="truncate text-[11px] text-muted-foreground">Optional fields · preview draft before publishing.</div>
        </div>
        </div>
        <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
          {scorePercent}% · {totalScore.toFixed(1)}/{totalWeightage}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-border bg-muted p-1">
        {(['Barre', 'PowerCycle', 'StrengthFit', 'NonTechnical'] as TrainerReviewTemplate[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => applyTemplate(item)}
            className={`h-9 rounded-lg text-[11px] font-semibold transition ${
              template === item
                ? 'bg-card text-blue-700 shadow-sm ring-1 ring-blue-100'
                : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
            }`}
          >
            {item === 'StrengthFit' ? 'Strength/Fit' : item === 'NonTechnical' ? 'Non-Technical' : item}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setTrainerMenuOpen((current) => !current)}
            className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-card px-2 text-left text-[11px] font-semibold text-foreground outline-none transition hover:border-blue-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          >
            <TrainerAvatar name={instructor || 'Instructor'} src={selectedTrainerImage} size="sm" />
            <span className="min-w-0 flex-1 truncate">{instructor || 'Instructor'}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${trainerMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {trainerMenuOpen && (
            <div className="absolute left-0 right-0 top-10 z-30 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
              <button
                type="button"
                onClick={() => {
                  setInstructor('');
                  setTrainerMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold text-muted-foreground transition hover:bg-muted"
              >
                <TrainerAvatar name="Instructor" size="sm" />
                <span>Instructor</span>
              </button>
              {TRAINERS.map((trainer) => (
                <button
                  key={trainer}
                  type="button"
                  onClick={() => {
                    setInstructor(trainer);
                    setTrainerMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold transition ${
                    instructor === trainer ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-muted'
                  }`}
                >
                  <TrainerAvatar name={trainer} src={trainerImageUrl(trainer)} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{trainer}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative shrink-0">
          <select
            value={studio}
            onChange={(event) => setStudio(event.target.value)}
            className="h-9 appearance-none rounded-xl border border-border/80 bg-card pl-2.5 pr-7 text-[11px] font-semibold text-foreground outline-none transition cursor-pointer hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="">Studio</option>
            {STUDIOS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 opacity-70" />
        </div>
        <div className="sm:col-span-2 xl:col-span-3">
          <MomenceSessionDropdownField
            multi={false}
            values={{ sessionId, classType, classDateTime: reviewPeriod, trainer: instructor, studio }}
            onChange={(sessions) => {
              const session = sessions[0];
              setSessionId(session?.id || '');
              setClassType(session?.classType || '');
              setReviewPeriod(session?.startsAt || '');
              setInstructor(session?.trainer || instructor);
              setStudio(session?.studio || studio);
            }}
          />
        </div>
        <input
          value={reviewPeriod}
          onChange={(event) => setReviewPeriod(event.target.value)}
          placeholder="Review period notes"
          className="h-9 rounded-xl border border-border bg-card px-2 text-[11px] font-medium text-foreground outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="mt-3 rounded-xl border border-border bg-muted p-2">
        <button
          type="button"
          onClick={() => setShowScoring((current) => !current)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Weighted scoring</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">{showScoring ? 'Hide scales' : 'Show scales and weightage'}</span>
          </span>
          <span className="rounded-full border border-blue-100 bg-card px-2 py-1 text-[10px] font-semibold text-blue-700">
            {scorePercent}% · {totalScore.toFixed(1)}/{totalWeightage}
          </span>
        </button>
        {showScoring && (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {scores.map((item) => (
              <label key={item.category} className="block rounded-xl border border-border bg-card p-2 shadow-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold leading-snug text-slate-700">{item.category}</span>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{item.score.toFixed(1)} / {item.weightage}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={item.weightage}
                  step={0.5}
                  value={item.score}
                  onChange={(event) => setScore(item.category, Number(event.target.value))}
                  className="h-2 w-full accent-blue-600"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Evaluator comments: client connection, cues, musicality, energy, choreography, hands-on corrections..."
          rows={4}
          className="min-h-24 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium leading-relaxed text-foreground outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
        <div className="grid gap-2">
          <textarea
            value={focusPoints}
            onChange={(event) => setFocusPoints(event.target.value)}
            placeholder="Focus points"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium leading-relaxed text-foreground outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          <textarea
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
            placeholder="Goals or next commitments"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium leading-relaxed text-foreground outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      {athenaPrompts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {athenaPrompts.slice(0, 3).map((question) => (
            <span key={question} className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
              {question}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={disabled || submitting}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
      >
        <Send className="h-3.5 w-3.5" />
        {submitting ? 'Preparing draft...' : 'Preview evaluation draft'}
      </button>
    </div>
  );
};

const PublishedTicketSummary: React.FC<{ ticketId: string; ticket?: Ticket }> = ({ ticketId, ticket }) => (
  <div className="mt-2 w-full max-w-xl overflow-hidden rounded-3xl border border-emerald-200 bg-card shadow-[0_18px_50px_rgba(15,23,42,0.1)]">
    <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
      <CheckCircle2 className="h-4 w-4" />
      Ticket {ticketId} published
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Live SLA clock</div>
        <p className="mt-1 text-xs text-muted-foreground">
          The countdown is now active in Submitted Tickets and every dashboard queue view.
        </p>
      </div>
      {ticket ? (
        <SlaCountdown slaDueAt={ticket.slaDueAt} status={ticket.status} className="justify-start" />
      ) : (
        <div className="rounded-2xl border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          Syncing SLA target
        </div>
      )}
    </div>
  </div>
);

const fieldHelpText = (field: DetailFormField): string => {
  const id = String(field.id);
  if (id === 'clientsAffected') return 'Confirm whether clients were impacted before publishing the ticket.';
  if (id === 'memberName' || id === 'memberContact') return 'Use Momence search where possible so the member record and contact stay consistent.';
  if (id === 'membership') return 'Choose the active package from Momence results when available, or from the standard membership list.';
  if (id === 'sessionId') return 'Choose the exact Momence session first so the report attaches to the right booking record.';
  if (id === 'classType' || id === 'classDateTime' || id === 'trainer') return 'Choose the relevant class/session context for the member issue.';
  if (id === 'reportedTime') return 'Capture when the late arrival was first noticed or reported.';
  if (id === 'actualStartTime') return 'Capture the actual start time so the delay is explicit.';
  if (id === 'delayMinutes') return 'Capture the delay duration in minutes.';
  if (id === 'advanceNoticeGiven') return 'Capture whether the instructor informed the studio in advance.';
  if (id === 'advanceNoticeTime') return 'Capture when the advance notice was shared, if it was shared.';
  if (id === 'membersAffected') return 'Capture which members or how many members were affected.';
  if (id === 'membersUpset') return 'Capture any member frustration, disruption, or early exit that was reported.';
  if (id === 'latenessReason') return 'Capture the reason given for the late arrival.';
  if (id === 'serviceRecoveryNeeded') return 'Capture whether any service recovery was needed.';
  if (id === 'serviceRecoveryAction') return 'Capture the recovery action that was offered or taken.';
  if (id === 'classImpactType') return 'Classify the class/session impact so routing and urgency are clear before asking for details.';
  if (id === 'classImpactDetails') return 'Capture exactly how the selected class/session changed, such as delay, pause, cancellation, relocation, or member response.';
  if (id === 'priority') return 'Choose the operational urgency. Safety, access and retention-risk issues should be High or Critical.';
  if (id === 'description') return 'Capture the concrete facts and what happened without adding subjective interpretation.';
  if (id === 'desiredResolution') return 'Document what the member asked Physique 57 to do next, including their preferred follow-up channel.';
  if (id === 'incidentDateTime') return 'Use the earliest known time the issue was noticed, reported, or experienced.';
  if (id === 'category' || id === 'subCategory') return 'Pick the closest routing category so ownership, analytics and SLA handling stay accurate.';
  if (id === 'intakeRoute') return 'Select the workflow this feedback belongs to; Athena uses this to shape the next ticket draft.';
  return field.required
    ? 'Required for clean routing and resolution without extra follow-up.'
    : 'Optional context that can help the owner resolve the ticket faster.';
};

// React owns only the outer container shell. All inner DOM is vanilla so
// Fillout's script can freely replace/mutate nodes without conflicting with
// React's reconciler.
const FilloutV1Widget: React.FC<{ filloutId: string; height?: number }> = ({ filloutId, height = 500 }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const embedDiv = document.createElement('div');
    embedDiv.setAttribute('data-fillout-id', filloutId);
    embedDiv.setAttribute('data-fillout-embed-type', 'standard');
    embedDiv.setAttribute('data-fillout-inherit-parameters', '');
    embedDiv.setAttribute('data-fillout-dynamic-resize', '');
    embedDiv.style.width = '100%';
    embedDiv.style.height = `${height}px`;
    container.appendChild(embedDiv);

    const script = document.createElement('script');
    script.src = 'https://server.fillout.com/embed/v1/';
    script.async = true;
    container.appendChild(script);

    return () => { container.innerHTML = ''; };
  }, [filloutId, height]);

  return <div ref={containerRef} style={{ width: '100%', minHeight: height }} />;
};

const FilloutZiteWidget: React.FC<{ ziteId: string; height?: number }> = ({ ziteId, height = 700 }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const embedDiv = document.createElement('div');
    embedDiv.setAttribute('data-zite-id', ziteId);
    embedDiv.setAttribute('data-zite-embed-type', 'standard');
    embedDiv.setAttribute('data-zite-inherit-parameters', '');
    embedDiv.style.width = '100%';
    embedDiv.style.height = `${height}px`;
    container.appendChild(embedDiv);

    const script = document.createElement('script');
    script.src = 'https://server.fillout.com/embed/v2-zite/';
    script.async = true;
    container.appendChild(script);

    return () => { container.innerHTML = ''; };
  }, [ziteId, height]);

  return <div ref={containerRef} style={{ width: '100%', minHeight: height }} />;
};

const FORM_IDS: Record<'barre' | 'powerCycle' | 'strength' | 'nonTechnical', string> = {
  barre: 'dSw2VkfdGqus',
  powerCycle: 'pdtcpzhxas',
  strength: 'jtvo8xrpg4',
  nonTechnical: 'syTsvPww8nus',
};

const EvaluationClassSelector: React.FC = () => {
  const [selected, setSelected] = React.useState<'barre' | 'powerCycle' | 'strength' | 'nonTechnical' | null>(null);
  const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'fetching' | 'done' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = React.useState('');
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;

  React.useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const d = event.data as Record<string, unknown>;
      if (!d || typeof d !== 'object') return;

      // Fillout fires submitCompleted / formSubmitted / fillout:submitCompleted
      const isSubmit =
        d.type === 'submitCompleted' ||
        d.type === 'formSubmitted' ||
        d.type === 'fillout:formSubmitted' ||
        d.type === 'fillout:submitCompleted';
      if (!isSubmit) return;

      const classType = selectedRef.current;
      if (!classType) return;

      const formId = FORM_IDS[classType];
      const submissionId =
        (d.submissionId as string | undefined) ||
        (d.submission_id as string | undefined) ||
        null;

      setSubmitStatus('fetching');
      setSubmitMessage('Saving evaluation as ticket…');

      try {
        const { data, error } = await invokeTicketingFunction<{
          created: boolean;
          duplicate?: boolean;
          ticketId?: string;
        }>('fillout-fetch-submission', {
          body: { formId, submissionId, classType },
        });

        if (error) throw new Error(String(error));

        if (data?.duplicate) {
          setSubmitStatus('done');
          setSubmitMessage('Evaluation already recorded — no duplicate created.');
        } else {
          setSubmitStatus('done');
          setSubmitMessage(`Ticket created successfully${data?.ticketId ? ` · #${data.ticketId.slice(-6)}` : ''}`);
        }
      } catch (e) {
        setSubmitStatus('error');
        setSubmitMessage(e instanceof Error ? e.message : 'Failed to create ticket');
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const CLASS_OPTIONS = [
    {
      key: 'barre' as const,
      label: 'Barre',
      icon: '🩰',
      desc: 'Classic barre class evaluation',
      color: 'from-rose-500 to-pink-600',
      border: 'border-rose-200 hover:border-rose-400',
      activeBg: 'bg-rose-50 border-rose-400',
    },
    {
      key: 'powerCycle' as const,
      label: 'PowerCycle',
      icon: '⚡',
      desc: 'Indoor cycling class evaluation',
      color: 'from-amber-500 to-orange-600',
      border: 'border-amber-200 hover:border-amber-400',
      activeBg: 'bg-amber-50 border-amber-400',
    },
    {
      key: 'strength' as const,
      label: 'Strength',
      icon: '💪',
      desc: 'Strength & conditioning evaluation',
      color: 'from-blue-500 to-indigo-600',
      border: 'border-blue-200 hover:border-blue-400',
      activeBg: 'bg-blue-50 border-blue-400',
    },
    {
      key: 'nonTechnical' as const,
      label: 'Non Technical',
      icon: '🤝',
      desc: 'For all levels — professionalism & soft-skills evaluation',
      color: 'from-emerald-500 to-teal-600',
      border: 'border-emerald-200 hover:border-emerald-400',
      activeBg: 'bg-emerald-50 border-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Instructor Evaluation</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Select the class type to open the evaluation form</p>
      </div>

      {submitStatus !== 'idle' && (
        <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${
          submitStatus === 'fetching' ? 'border-blue-200 bg-blue-50 text-blue-800' :
          submitStatus === 'done'     ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                                        'border-red-200 bg-red-50 text-red-700'
        }`}>
          {submitStatus === 'fetching' && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />}
          {submitStatus === 'done'     && <span className="text-base">✅</span>}
          {submitStatus === 'error'    && <span className="text-base">⚠️</span>}
          <span>{submitMessage}</span>
          {submitStatus !== 'fetching' && (
            <button
              type="button"
              onClick={() => { setSubmitStatus('idle'); setSubmitMessage(''); }}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >✕</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CLASS_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSelected(opt.key)}
            className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
              selected === opt.key ? opt.activeBg : `border-border bg-card ${opt.border}`
            }`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${opt.color} text-2xl shadow-md`}>
              {opt.icon}
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">{opt.label}</div>
              <div className="mt-0.5 text-[10.5px] text-muted-foreground leading-snug">{opt.desc}</div>
            </div>
            {selected === opt.key && (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">✓</span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className="animate-p57-fade-up overflow-hidden rounded-3xl border border-border bg-card shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-muted/80 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-base">{CLASS_OPTIONS.find(o => o.key === selected)?.icon}</span>
              <span className="text-sm font-semibold text-foreground">
                {CLASS_OPTIONS.find(o => o.key === selected)?.label} Evaluation Form
              </span>
            </div>
          </div>
          <div className="p-4">
            {selected === 'barre' && (
              <FilloutV1Widget key="barre" filloutId="dSw2VkfdGqus" height={500} />
            )}
            {selected === 'powerCycle' && (
              <FilloutZiteWidget key="powerCycle" ziteId="pdtcpzhxas" height={700} />
            )}
            {selected === 'strength' && (
              <FilloutZiteWidget key="strength" ziteId="jtvo8xrpg4" height={700} />
            )}
            {selected === 'nonTechnical' && (
              <FilloutV1Widget key="nonTechnical" filloutId="syTsvPww8nus" height={500} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TrainerSelectGrid: React.FC<{
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ id, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const selected = value || null;
  const imgSrc = selected ? trainerImageUrl(selected) : null;
  const initials = selected ? trainerInitials(selected) : null;
  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-sm transition ${
          selected
            ? 'border-blue-200 bg-blue-50 text-stone-900 hover:bg-blue-100'
            : 'border-border bg-muted text-slate-400 hover:bg-card'
        }`}
      >
        {selected ? (
          <>
            {imgSrc ? (
              <img src={imgSrc} alt={selected} className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-muted-foreground">{initials}</span>
            )}
            <span className="flex-1 text-left font-medium">{selected}</span>
          </>
        ) : (
          <span className="flex-1 text-left">Select trainer</span>
        )}
        <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-[0_16px_48px_rgba(15,23,42,0.16)]">
          {options.map((name) => {
            const src = trainerImageUrl(name);
            const ini = trainerInitials(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => { onChange(name); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition hover:bg-muted ${value === name ? 'bg-blue-50 font-semibold text-blue-700' : 'text-stone-800'}`}
              >
                {src ? (
                  <img src={src} alt={name} className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-muted-foreground">{ini}</span>
                )}
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DetailCaptureForm: React.FC<{
  form: DetailForm;
  initialContext: DetailContext;
  disabled?: boolean;
  onSubmit: (values: Record<string, string>, form?: DetailForm) => void;
}> = ({ form, initialContext, disabled = false, onSubmit }) => {
  const toCsvList = (value?: string) =>
    (value || '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  const appendCsvUnique = (current: string | undefined, next: string) => {
    const existing = toCsvList(current);
    if (existing.some((item) => item.toLowerCase() === next.trim().toLowerCase())) return current || '';
    return [...existing, next.trim()].join(' | ');
  };
  const removeCsvItem = (current: string | undefined, target: string) =>
    toCsvList(current)
      .filter((item) => item.toLowerCase() !== target.toLowerCase())
      .join(' | ');
  const removeSelectedMember = (current: Record<string, string>, memberName: string) => {
    const names = toCsvList(current.memberName);
    const index = names.findIndex((item) => item.toLowerCase() === memberName.toLowerCase());
    if (index < 0) {
      return {
        ...current,
        memberName: removeCsvItem(current.memberName, memberName),
      };
    }
    const removeAtIndex = (value?: string) =>
      toCsvList(value)
        .filter((_, itemIndex) => itemIndex !== index)
        .join(' | ');
    return {
      ...current,
      memberId: removeAtIndex(current.memberId),
      memberName: removeAtIndex(current.memberName),
      memberContact: removeAtIndex(current.memberContact),
      membership: '',
    };
  };

  const initialValues = form.fields.reduce<Record<string, string>>((acc, field) => {
    const id = String(field.id);
    acc[id] = initialContext[id] || '';
    return acc;
  }, {});
  const fieldIds = new Set(form.fields.map((field) => String(field.id)));
  const shouldSeedMemberValues = MEMBER_ENTITY_KEYS.some((field) => fieldIds.has(field));
  const shouldSeedSessionValues = SESSION_ENTITY_KEYS.some((field) => fieldIds.has(field));
  const hiddenSeedKeys = [
    ...(shouldSeedMemberValues ? MEMBER_ENTITY_KEYS : []),
    ...(shouldSeedSessionValues ? [...SESSION_ENTITY_KEYS, 'studio'] : []),
  ];
  for (const key of hiddenSeedKeys) {
    if (initialContext[key]) initialValues[key] = initialContext[key] || '';
  }
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [hostMembershipOptions, setHostMembershipOptions] = useState<string[]>([]);
  const [membershipOptions, setMembershipOptions] = useState<string[]>([]);
  const [sessionBookings, setSessionBookings] = useState<MomenceSessionBooking[]>([]);
  const [sessionBookingsLoading, setSessionBookingsLoading] = useState(false);
  const [sessionBookingsError, setSessionBookingsError] = useState<string | null>(null);
  const isAssessmentForm = form.id === 'trainer-class-assessment';
  const hasMemberFields = form.fields.some((field) => field.id === 'memberName' || field.id === 'memberContact');
  const hasSessionFields = form.fields.some((field) => field.id === 'classType' || field.id === 'classDateTime' || field.id === 'sessionId');

  useEffect(() => {
    let cancelled = false;
    loadHostMembershipOptions()
      .then((options) => {
        if (!cancelled) {
          setHostMembershipOptions(options);
          setMembershipOptions((current) => current.length ? current : options);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHostMembershipOptions([]);
          setMembershipOptions((current) => current);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!values.memberId) {
      setMembershipOptions(hostMembershipOptions);
      return;
    }
    let cancelled = false;
    loadActiveMembershipOptions(values.memberId, hostMembershipOptions)
      .then((options) => {
        if (!cancelled) setMembershipOptions(options);
      })
      .catch(() => {
        if (!cancelled) setMembershipOptions(hostMembershipOptions);
      });
    return () => {
      cancelled = true;
    };
  }, [hostMembershipOptions, values.memberId]);

  useEffect(() => {
    const sessionId = splitPipeList(values.sessionId)[0];
    if (!sessionId || !hasMemberFields) {
      setSessionBookings([]);
      setSessionBookingsError(null);
      setSessionBookingsLoading(false);
      return;
    }
    let cancelled = false;
    setSessionBookingsLoading(true);
    setSessionBookingsError(null);
    getMomenceSessionBookings(sessionId)
      .then((bookings) => {
        if (!cancelled) setSessionBookings(bookings);
      })
      .catch((error) => {
        if (!cancelled) setSessionBookingsError(error instanceof Error ? error.message : 'Session member list failed to load');
      })
      .finally(() => {
        if (!cancelled) setSessionBookingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasMemberFields, values.sessionId]);

  const setValue = (id: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [id]: value };
      if (id === 'category' && current.category !== value) next.subCategory = '';
      return next;
    });
  };

  const fieldVisible = (field: DetailFormField) => {
    if (!field.dependsOn) return true;
    return values[field.dependsOn] === field.dependsOnValue;
  };
  const visibleFields = form.fields.filter(fieldVisible);
  const ratingFields = visibleFields.filter((field) => field.type === 'rating' && field.scoreWeight);
  const weightedScore = ratingFields.reduce((sum, field) => {
    const rating = Number(values[field.id]);
    if (!Number.isFinite(rating)) return sum;
    return sum + (Math.max(0, Math.min(10, rating)) / 10) * (field.scoreWeight || 0);
  }, 0);
  const scoreOutOf100 = Math.round(weightedScore * 10) / 10;
  const canSubmit = visibleFields.every((field) => !field.required || values[String(field.id)]?.trim());
  const requiredFields = visibleFields.filter((field) => field.required);
  const completedRequired = requiredFields.filter((field) => values[String(field.id)]?.trim()).length;
  const completionPercent = requiredFields.length ? Math.round((completedRequired / requiredFields.length) * 100) : 100;
  const showTopSessionPicker = hasSessionFields && !isAssessmentForm;
  const startsSection = (field: DetailFormField, index: number) => {
    if (!field.section) return false;
    const candidates = form.fields
      .slice(0, index)
      .filter(fieldVisible)
      .filter((candidate) => !(isAssessmentForm && (candidate.id === 'studio' || candidate.id === 'trainer' || candidate.id === 'classDateTime')))
      .filter((candidate) => !(showTopSessionPicker && (candidate.id === 'classType' || candidate.id === 'classDateTime' || candidate.id === 'sessionId')));
    const previousVisible = candidates.length > 0 ? candidates[candidates.length - 1] : null;
    return previousVisible?.section !== field.section;
  };

  return (
    <form
      className="mt-3 w-full rounded-[28px] border border-border bg-card shadow-[0_28px_80px_rgba(15,23,42,0.10)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit && !disabled) {
          const submissionValues = isAssessmentForm
            ? { ...values, evaluationScore: `${scoreOutOf100}/100` }
            : values;
          onSubmit(submissionValues, form);
        }
      }}
    >
      <div className="relative overflow-hidden rounded-t-[28px] border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.22),_transparent_60%)]" />
        <div className="relative grid gap-4 md:grid-cols-[1fr_240px] md:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30">
              <ClipboardCheck className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Intake form</div>
              <h3 className="mt-1 text-base font-semibold text-white">{form.title}</h3>
              {form.description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">{form.description}</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-blue-300" />
                {isAssessmentForm ? 'Evaluation score' : 'Required complete'}
              </span>
              <span className="font-mono tabular-nums text-white">
                {isAssessmentForm ? `${scoreOutOf100}/100` : `${completedRequired}/${requiredFields.length || 0}`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isAssessmentForm ? 'bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400' : 'bg-blue-400'}`}
                style={{ width: `${isAssessmentForm ? Math.min(100, scoreOutOf100) : completionPercent}%` }}
              />
            </div>
            {isAssessmentForm && (
              <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                <span>{completedRequired}/{requiredFields.length || 0} required</span>
                <span>{values.templateType || 'Select template'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 bg-[#f4f6fa] p-5 sm:grid-cols-2 xl:grid-cols-3">
        {showTopSessionPicker && (
          <MomenceSessionDropdownField
            values={values}
            multi={false}
            onChange={(sessions) => {
              setValues((current) => ({
                ...current,
                sessionId: sessions.map((session) => session.id).join(' | '),
                classType: sessions.map((session) => session.classType).join(' | '),
                classDateTime: sessions.map((session) => session.startsAt || '').filter(Boolean).join(' | '),
                scheduledStartTime: current.scheduledStartTime || toDateTimeLocalInputValue(sessions[0]?.startsAt),
                trainer: sessions.map((session) => session.trainer || '').filter(Boolean).join(' | '),
                studio: sessions.map((session) => session.studio || '').filter(Boolean).join(' | ') || current.studio || '',
              }));
            }}
          />
        )}
        {hasMemberFields && (
          sessionBookings.length > 0 || values.sessionId ? (
            <SessionBookingMemberField
              values={values}
              bookings={sessionBookings}
              loading={sessionBookingsLoading}
              error={sessionBookingsError}
              onSelect={(booking) => {
                const memberName = momenceBookingMemberName(booking);
                const memberId = booking.member?.id ? String(booking.member.id) : '';
                const memberContact = momenceBookingContact(booking);
                setValues((current) => ({
                  ...current,
                  memberId: memberId ? appendCsvUnique(current.memberId, memberId) : current.memberId || '',
                  memberName: appendCsvUnique(current.memberName, memberName),
                  memberContact: memberContact ? appendCsvUnique(current.memberContact, memberContact) : current.memberContact || '',
                  membership: current.membership || '',
                }));
              }}
              onRemove={(memberName) => {
                setValues((current) => removeSelectedMember(current, memberName));
              }}
            />
          ) : (
            <MomenceMemberFormField
              values={values}
              onSelect={async (member) => {
                setValues((current) => ({
                  ...current,
                  memberId: appendCsvUnique(current.memberId, member.id),
                  memberName: appendCsvUnique(current.memberName, member.name),
                  memberContact: appendCsvUnique(current.memberContact, member.email || member.phoneNumber || member.description || ''),
                  membership: current.membership || '',
                }));
              }}
              onRemove={(memberName) => {
                setValues((current) => removeSelectedMember(current, memberName));
              }}
            />
          )
        )}
        {form.fields.map((field, fieldIndex) => {
          const id = String(field.id);
          if (!fieldVisible(field)) return null;
          if (hasMemberFields && (id === 'memberName' || id === 'memberContact')) return null;
          if (isAssessmentForm && id === 'classType') {
            return (
              <AssessmentSessionDetailsField
                key={id}
                values={values}
                onChange={(nextValues) => setValues((current) => ({ ...current, ...nextValues }))}
              />
            );
          }
          if (isAssessmentForm && (id === 'studio' || id === 'trainer' || id === 'classDateTime')) return null;
          if (showTopSessionPicker && (id === 'classType' || id === 'classDateTime' || id === 'sessionId')) return null;
          const helpText = fieldHelpText(field);
          const complete = !field.required || Boolean(values[id]?.trim());
          const category = values.category;
          const options =
            field.id === 'subCategory' && category
              ? CATEGORIES[category] || []
              : field.id === 'subCategory'
                ? []
              : field.id === 'affectedArea'
                ? getStudioAreaOptions(values.studio || initialContext.studio)
              : field.id === 'membership'
                ? withCurrentOption(membershipOptions, values.membership)
                : field.options || [];

          return (
            <div
              key={id}
              className={`group relative rounded-2xl border bg-card p-3 shadow-sm transition duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 ${
                complete ? 'border-border' : 'border-blue-200'
              } ${field.type === 'textarea' || field.type === 'rating' ? 'sm:col-span-2 xl:col-span-3' : ''}`}
            >
              {startsSection(field, fieldIndex) && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-blue-700" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-900">{field.section}</span>
                  {field.scoreWeight ? <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-slate-200">{field.scoreWeight} pts</span> : null}
                </div>
              )}
              <div className="mb-2 flex items-start justify-between gap-3">
                <label htmlFor={`detail-${id}`} className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] ${
                    complete ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                  }`}>
                    {fieldIndex + 1}
                  </span>
                  <span className="min-w-0 truncate">
                    {field.label}
                    {field.required ? <span className="text-blue-600"> *</span> : ''}
                  </span>
                </label>
                <span className="group/help relative inline-flex shrink-0">
                  <HelpCircle className="h-4 w-4 text-slate-400 transition group-hover/help:text-blue-700" />
                  <span className="pointer-events-none absolute right-0 top-6 z-20 w-64 rounded-2xl border border-slate-200 bg-stone-950 px-3 py-2 text-[11px] font-medium leading-relaxed text-white opacity-0 shadow-2xl transition group-hover/help:opacity-100">
                    {helpText}
                  </span>
                </span>
              </div>
              {field.type === 'rating' ? (
                <RatingControl
                  id={`detail-${id}`}
                  value={values[id] || ''}
                  weight={field.scoreWeight || 0}
                  onChange={(nextValue) => setValue(id, nextValue)}
                />
              ) : field.type === 'select' ? (
                (() => {
                  const forceSingle = new Set([
                    'intakeRoute',
                    'category',
                    'subCategory',
                    'priority',
                    'templateType',
                    'classType',
                    'studio',
                    'trainer',
                    'reportedBy',
                    'memberSentiment',
                    'clientsAffected',
                    'classImpactType',
                    'membership',
                    'freezeReason',
                    'rolloverReason',
                    'hostedFeedbackArea',
                    'prospectQuality',
                    'followUpPreference',
                    'hvacSymptom',
                    'machineSymptom',
                    'bikeSymptom',
                    'equipmentSymptom',
                    'lockFaultType',
                    'accessStatus',
                    'securityRisk',
                    'resolutionRequirement',
                    'affectedArea',
                    'plumbingSymptom',
                    'electricalSymptom',
                    'appIssueSurface',
                  ]);
                  const isMulti = !forceSingle.has(field.id);
                  const disabledSelect = field.id === 'subCategory' && !values.category;
                  const useButtons = !isMulti && !disabledSelect && shouldUseOptionButtons({ id, optionCount: options.length });
                  return isMulti ? (
                    <MultiSelectDropdown
                      value={values[id] || ''}
                      options={options}
                      placeholder={
                        `Select ${field.label.toLowerCase()}`
                      }
                      disabled={disabledSelect}
                      onChange={(nextValue) => setValue(id, nextValue)}
                    />
                  ) : useButtons ? (
                    <OptionButtonGroup
                      id={`detail-${id}`}
                      label={field.label}
                      value={values[id] || ''}
                      options={options}
                      onChange={(nextValue) => setValue(id, nextValue)}
                    />
                  ) : field.id === 'trainer' ? (
                    <TrainerSelectGrid
                      id={`detail-${id}`}
                      value={values[id] || ''}
                      options={options}
                      onChange={(v) => setValue(id, v)}
                    />
                  ) : (
                <div className="relative min-w-0 w-full">
                  <select
                    id={`detail-${id}`}
                    value={values[id] || ''}
                    onChange={(event) => setValue(id, event.target.value)}
                    disabled={disabledSelect}
                    className="h-11 w-full appearance-none rounded-xl border border-border/80 bg-muted/40 pl-3.5 pr-9 text-xs font-semibold text-foreground outline-none transition cursor-pointer hover:border-slate-300 focus:border-blue-500 focus:bg-background focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <option value="">
                      {field.id === 'subCategory' && !values.category
                          ? 'Select category first'
                        : `Select ${field.label.toLowerCase()}`}
                    </option>
                    {options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 opacity-70" />
                </div>
                  );
                })()
              ) : field.type === 'textarea' ? (
                <>
                  <textarea
                    id={`detail-${id}`}
                    value={values[id] || ''}
                    onChange={(event) => setValue(id, event.target.value)}
                    rows={4}
                    className="min-h-28 w-full resize-y rounded-xl border border-border bg-muted px-3 py-2 text-sm leading-relaxed text-stone-900 outline-none transition hover:bg-card focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10"
                    placeholder={field.placeholder || 'Describe the issue and relevant details...'}
                  />
                  <SuggestionChips suggestions={suggestionsForDetailField(field, values)} onPick={(suggestion) => setValue(id, suggestion)} />
                </>
              ) : (
                <>
                  <input
                    id={`detail-${id}`}
                    type={field.type === 'date' || field.type === 'datetime-local' || field.type === 'number' ? field.type : 'text'}
                    value={values[id] || ''}
                    onChange={(event) => setValue(id, event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm text-stone-900 outline-none transition hover:bg-card focus:border-blue-500 focus:bg-card focus:ring-4 focus:ring-blue-500/10"
                    placeholder={field.placeholder || field.label}
                  />
                  {field.type === 'text' && (
                    <SuggestionChips suggestions={suggestionsForDetailField(field, values)} onPick={(suggestion) => setValue(id, suggestion)} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 border-t border-border/80 bg-card/90 px-6 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${canSubmit ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 template-pulse-dot' : 'bg-slate-300 dark:bg-slate-700'}`} />
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            {completedRequired} of {requiredFields.length} required fields complete
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit || disabled}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(79,70,229,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-violet-500 hover:shadow-[0_14px_32px_rgba(79,70,229,0.42)] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
        >
          <WandSparkles className="h-3.5 w-3.5" />
          {form.submitLabel || 'Continue'}
        </button>
      </div>
    </form>
  );
};

const AssessmentSessionDetailsField: React.FC<{
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}> = ({ values, onChange }) => {
  return (
    <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-900">Session Details</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Select the Momence session first so class, studio, instructor and start time map automatically.
          </p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-[10px] font-semibold text-blue-800 ring-1 ring-blue-100">
          Momence mapped
        </span>
      </div>

      <MomenceSessionDropdownField
        values={values}
        multi={false}
        onChange={(sessions) => {
          onChange({
            sessionId: sessions.map((session) => session.id).join(' | '),
            classType: sessions.map((session) => session.classType).join(' | '),
            classDateTime: sessions.map((session) => session.startsAt || '').filter(Boolean).join(' | '),
            trainer: sessions.map((session) => session.trainer || '').filter(Boolean).join(' | '),
            studio: sessions.map((session) => session.studio || '').filter(Boolean).join(' | '),
          });
        }}
      />
    </div>
  );
};

const RatingControl: React.FC<{
  id: string;
  value: string;
  weight: number;
  onChange: (value: string) => void;
}> = ({ id, value, weight, onChange }) => {
  const rating = Number(value);
  const contribution = Number.isFinite(rating) ? Math.round((Math.max(0, Math.min(10, rating)) / 10) * weight * 10) / 10 : 0;
  const ratingLabel = !Number.isFinite(rating) || value === '' 
    ? 'Unrated' 
    : rating >= 9 ? 'Exceptional' 
    : rating >= 7 ? 'Strong' 
    : rating >= 5 ? 'Satisfactory' 
    : 'Needs Improvement';

  return (
    <div className="rounded-2xl border border-border/80 bg-muted/60 p-3 backdrop-blur-sm dark:bg-slate-900/60">
      <div className="mb-2.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-[0.14em] text-slate-500">
          Rating scale
          {value !== '' && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9.5px] font-bold text-blue-600 dark:text-blue-400">
              {ratingLabel}
            </span>
          )}
        </span>
        <span className="rounded-full bg-card px-2.5 py-0.5 font-mono text-[11px] font-bold text-foreground shadow-sm ring-1 ring-border">
          {value || '0'}/10 = {contribution}/{weight} pts
        </span>
      </div>
      <div id={id} className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, score) => {
          const isSelected = value === String(score);
          const colorClass = isSelected
            ? score >= 9
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/50'
              : score >= 7
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/50'
              : score >= 5
              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/50'
              : 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-400/50'
            : 'bg-card text-muted-foreground ring-1 ring-border/80 hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300';
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(String(score))}
              className={`h-9 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 ${colorClass}`}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const OptionButtonGroup: React.FC<{
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ id, label, value, options, onChange }) => (
  <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`min-h-10 rounded-xl border px-3.5 py-2 text-left text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-blue-500/15 active:scale-[0.98] ${
            selected
              ? 'border-blue-600 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
              : 'border-border/80 bg-muted/80 text-foreground hover:border-blue-300 hover:bg-card hover:shadow-sm'
          }`}
          aria-pressed={selected}
        >
          {option}
        </button>
      );
    })}
  </div>
);

const MultiSelectDropdown: React.FC<{
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
}> = ({ value, options = [], placeholder, disabled = false, loading = false, emptyMessage = 'No options available', onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const safeOptions = options || [];
  const selectedValues = useMemo(
    () => (value || '').split('|').map((item) => item.trim()).filter(Boolean),
    [value]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const updateValues = (nextValues: string[]) => {
    onChange(nextValues.join(' | '));
  };

  const toggleOption = (option: string) => {
    if (selectedSet.has(option)) {
      updateValues(selectedValues.filter((item) => item !== option));
      return;
    }
    updateValues([...selectedValues, option]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-stone-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedValues.length ? selectedValues.slice(0, 3).map((item) => (
            <span
              key={item}
              className="max-w-[180px] truncate rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800"
            >
              {item}
            </span>
          )) : (
            <span className="truncate text-slate-400">{placeholder}</span>
          )}
          {selectedValues.length > 3 && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              +{selectedValues.length - 3}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.14)]">
          {options.length ? options.map((option) => {
            const selected = selectedSet.has(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleOption(option)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  selected ? 'bg-blue-50 text-blue-900' : 'text-stone-700 hover:bg-muted'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-card'
                  }`}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1 break-words">{option}</span>
              </button>
            );
          }) : loading ? (
            <div className="px-2.5 py-2 text-xs text-muted-foreground">Loading options...</div>
          ) : (
            <div className="px-2.5 py-2 text-xs text-slate-400">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

function formatMembershipOption(membership: MomenceMembership): string {
  const name = membership.membership?.name || membership.type || `Membership #${membership.id}`;
  const credits =
    membership.eventCreditsLeft != null
      ? `${membership.eventCreditsLeft} credits left`
      : membership.usedSessions != null && membership.usageLimitForSessions != null
        ? `${Math.max(membership.usageLimitForSessions - membership.usedSessions, 0)} sessions left`
        : '';
  const endDate = membership.endDate
    ? `ends ${new Date(membership.endDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
    : '';
  return [name, credits, endDate].filter(Boolean).join(' · ');
}

function uniqueOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function withCurrentOption(options: string[], current?: string): string[] {
  return uniqueOptions([...(current ? [current] : []), ...options]);
}

let hostMembershipOptionsCache: string[] | null = null;

async function loadHostMembershipOptions(): Promise<string[]> {
  if (hostMembershipOptionsCache) return hostMembershipOptionsCache;
  hostMembershipOptionsCache = await listMomenceHostMembershipOptions();
  return hostMembershipOptionsCache;
}

async function loadActiveMembershipOptions(memberId: string, hostMembershipOptions: string[] = []): Promise<string[]> {
  const memberships = await getMomenceMemberMemberships(memberId);
  const activeMembershipOptions = memberships
    .filter((membership) => !membership.isFrozen)
    .map(formatMembershipOption);
  return uniqueOptions([...activeMembershipOptions, ...hostMembershipOptions]);
}

const momenceSessionSearchCache = new Map<string, MomenceSessionOption[]>();

function momenceSessionDropdownCacheKey(sessionTypes?: string[]): string {
  return `__momence_session_dropdown_options__:${sessionTypes?.join(',') || 'all'}`;
}

function mergeMomenceSessionOptions(currentOptions: MomenceSessionOption[], nextOptions: MomenceSessionOption[]): MomenceSessionOption[] {
  const byLabel = new Map<string, MomenceSessionOption>();
  for (const option of currentOptions) byLabel.set(momenceSessionDropdownLabel(option), option);
  for (const option of nextOptions) byLabel.set(momenceSessionDropdownLabel(option), option);
  return Array.from(byLabel.values());
}

const MomenceMemberFormField: React.FC<{
  values: Record<string, string>;
  onSelect: (member: MomenceMemberOption) => void | Promise<void>;
  onRemove: (memberName: string) => void;
}> = ({ values, onSelect, onRemove }) => {
  const [query, setQuery] = useState(values.memberName || values.memberContact || '');
  const [options, setOptions] = useState<MomenceMemberOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(values.memberId || '');
  const isAffectedClientSelection = hasConfirmedAffectedClients(values.clientsAffected);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      if (selectedMemberId && query === values.memberName) {
        setOptions([]);
        return;
      }
      if (query.trim().length < 2) {
        setOptions([]);
        return;
      }
      try {
        setError(null);
        setOptions(await searchMomenceMembers(query));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Member search failed');
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, selectedMemberId, values.memberName]);

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-3.5 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 sm:col-span-2 xl:col-span-3">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {isAffectedClientSelection ? 'Affected Momence Clients' : 'Momence Member'} *
      </span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-stone-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        placeholder="Search Momence by client name, email, or phone"
      />
      {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
      {values.memberName && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.memberName.split('|').map((member) => member.trim()).filter(Boolean).map((member) => (
            <button
              key={member}
              type="button"
              onClick={() => onRemove(member)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800"
              title="Remove member"
            >
              {member}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      {options.length > 0 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_18px_44px_rgba(15,23,42,0.1)]">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={async () => {
                setSelectedMemberId(option.id);
                setOptions([]);
                setQuery(option.label);
                await onSelect(option);
                setOptions([]);
              }}
              className="block w-full border-b border-stone-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-muted"
            >
              <div className="font-semibold text-stone-900">{option.label}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">{option.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SessionBookingMemberField: React.FC<{
  values: Record<string, string>;
  bookings: MomenceSessionBooking[];
  loading?: boolean;
  error?: string | null;
  onSelect: (booking: MomenceSessionBooking) => void;
  onRemove: (memberName: string) => void;
}> = ({ values, bookings, loading = false, error = null, onSelect, onRemove }) => {
  const selectedMembers = splitPipeList(values.memberName);
  const selectedSet = new Set(selectedMembers.map((member) => member.toLowerCase()));
  const activeBookings = bookings.filter((booking) => !booking.cancelledAt && booking.member);

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-3.5 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 sm:col-span-2 xl:col-span-3">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        Select members booked into this Momence session *
      </span>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        Member choices are mapped from the selected session bookings. Use this before falling back to a global member search.
      </p>
      {selectedMembers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedMembers.map((member) => (
            <button
              key={member}
              type="button"
              onClick={() => onRemove(member)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800"
              title="Remove member"
            >
              {member}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">Loading session members...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : activeBookings.length ? (
        <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-xl border border-border bg-muted p-1.5 sm:grid-cols-2">
          {activeBookings.map((booking) => {
            const memberName = momenceBookingMemberName(booking);
            const selected = selectedSet.has(memberName.toLowerCase());
            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => onSelect(booking)}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                  selected
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-border bg-card text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="font-semibold">{memberName}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{momenceBookingContact(booking) || hostedBookingStatus(booking)}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No active bookings were returned for the selected session.
        </div>
      )}
    </div>
  );
};

function splitPipeList(value?: string): string[] {
  return (value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function momenceSessionDropdownLabel(session: MomenceSessionOption): string {
  return [session.label, session.description].filter(Boolean).join(' · ');
}

const MomenceSessionDropdownField: React.FC<{
  values: Record<string, string>;
  onChange: (sessions: MomenceSessionOption[]) => void | Promise<void>;
  multi?: boolean;
  sessionTypes?: string[];
}> = ({ values, onChange, multi = true, sessionTypes }) => {
  const [options, setOptions] = useState<MomenceSessionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheKey = useMemo(() => momenceSessionDropdownCacheKey(sessionTypes), [sessionTypes]);
  const sessionSearchOptions = useMemo(
    () => (sessionTypes?.length ? { types: sessionTypes } : undefined),
    [sessionTypes]
  );

  const optionLabelMap = useMemo(() => {
    const labelMap = new Map<string, MomenceSessionOption>();
    options.forEach((session) => labelMap.set(momenceSessionDropdownLabel(session), session));
    return labelMap;
  }, [options]);

  const selectedDropdownLabels = useMemo(() => {
    const selectedIds = splitPipeList(values.sessionId);
    if (selectedIds.length > 0 && options.length > 0) {
      const byId = new Map(options.map((session) => [session.id, session]));
      return selectedIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((session) => momenceSessionDropdownLabel(session as MomenceSessionOption));
    }
    return splitPipeList(values.classType);
  }, [options, values.classType, values.sessionId]);

  useEffect(() => {
    let cancelled = false;
    const cached = momenceSessionSearchCache.get(cacheKey);
    if (cached) {
      setOptions(cached);
      return;
    }

    setOptions([]);
    setLoading(true);
    setError(null);
    loadMomenceSessionsProgressively('', sessionSearchOptions, (sessions) => {
      if (!cancelled) setOptions((current) => mergeMomenceSessionOptions(current, sessions));
    })
      .then((sessions) => {
        momenceSessionSearchCache.set(cacheKey, sessions);
        if (!cancelled) setOptions(sessions);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Session options failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, sessionSearchOptions]);

  const handleDropdownChange = (nextValue: string) => {
    const requestedLabels = splitPipeList(nextValue);
    const finalLabels = multi
      ? requestedLabels
      : (() => {
          const added = requestedLabels.find((label) => !selectedDropdownLabels.includes(label));
          return added ? [added] : [];
        })();
    const selectedSessions = finalLabels
      .map((label) => optionLabelMap.get(label))
      .filter(Boolean) as MomenceSessionOption[];

    void onChange(selectedSessions);
  };

  const dropdownOptions = options.map(momenceSessionDropdownLabel);
  const dropdownValue = selectedDropdownLabels.join(' | ');
  const placeholder = loading
    ? dropdownOptions.length === 0
      ? 'Loading first Momence sessions...'
      : 'Select Momence sessions'
    : error
      ? 'Momence sessions unavailable'
      : multi
        ? 'Select Momence sessions'
        : 'Select Momence session';

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-3.5 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 sm:col-span-2 xl:col-span-3">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        Momence Class / Session *
      </span>
      <MultiSelectDropdown
        value={dropdownValue}
        options={dropdownOptions}
        placeholder={placeholder}
        loading={loading && dropdownOptions.length === 0}
        emptyMessage="No Momence sessions loaded yet"
        onChange={handleDropdownChange}
      />
      {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
      {loading && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {dropdownOptions.length ? 'First sessions ready. Loading more in the background...' : 'Loading Momence sessions...'}
        </div>
      )}
    </div>
  );
};
