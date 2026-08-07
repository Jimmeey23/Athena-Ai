import React, { useState } from 'react';
import { CATEGORIES, PRIORITY_SLA, STUDIOS, Ticket } from '@/lib/ticketing-data';
import { Sparkles, Check, Pencil, MapPin, User, Calendar, Tag, Clock, ShieldCheck, AlertTriangle, Brain, Route, Layers3, Loader2, MessageSquareText, Copy } from 'lucide-react';
import { SlaCountdown } from './SlaCountdown';
import { TicketReviewInsights } from '@/lib/ticket-review';
import { MomenceMemberTicketField, MomenceSessionTicketField } from './MomenceTicketEntityFields';
import { buildSmartTicketIntelligence, DuplicatePatternInsights, SmartTicketIntelligence } from '@/lib/smart-ops-intelligence';

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

interface Props {
  draft: DraftTicket;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard?: () => void;
  onSaveEdit?: (draft: DraftTicket) => void;
  confirmed?: boolean;
  ticketId?: string;
  confirmedTicket?: Pick<Ticket, 'slaDueAt' | 'status'>;
  publishing?: boolean;
  reviewInsights?: TicketReviewInsights;
  duplicatePatternInsights?: DuplicatePatternInsights;
  momenceLoading?: boolean;
  momenceError?: string | null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function stepsFromText(value: string): string[] {
  return Array.from(new Set(
    value
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
  ));
}

function getDraftResolutionSteps(draft: DraftTicket): string[] {
  return stringArray(draft.metadata?.recommendedResolutionSteps);
}

export const TicketPreviewCard: React.FC<Props> = ({ draft, onConfirm, onEdit, onDiscard, onSaveEdit, confirmed, ticketId, confirmedTicket, publishing = false, reviewInsights, duplicatePatternInsights, momenceLoading = false, momenceError }) => {
  const priorityMeta = PRIORITY_SLA[draft.priority];
  const slaHours = PRIORITY_SLA[draft.priority]?.hours ?? PRIORITY_SLA.Medium.hours;
  const tags = Array.isArray(draft.tags) ? draft.tags : [];
  const [editing, setEditing] = useState(false);
  const [editedDraft, setEditedDraft] = useState<DraftTicket>(draft);

  React.useEffect(() => {
    setEditedDraft(draft);
  }, [draft]);

  const updateEditedDraft = (field: keyof DraftTicket, value: string) => {
    setEditedDraft((current) => ({ ...current, [field]: value }));
  };
  const recommendedResolutionSteps = getDraftResolutionSteps(editing ? editedDraft : draft);
  const updateRecommendedResolutionSteps = (value: string) => {
    setEditedDraft((current) => ({
      ...current,
      metadata: {
        ...(current.metadata || {}),
        recommendedResolutionSteps: stepsFromText(value),
      },
    }));
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-3xl border border-border bg-card/96 p-5 shadow-[0_26px_80px_rgba(15,23,42,0.14)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
      <div className="mb-3 flex items-center justify-between gap-3 pt-1">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
          <Sparkles className="h-3 w-3" />
          Athena draft
        </div>
        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase text-white ${priorityMeta.color}`}>
          {draft.priority} priority
        </span>
      </div>

      <div className="mb-3">
        {editing ? (
          <input
            value={editedDraft.title}
            onChange={(event) => updateEditedDraft('title', event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
        ) : (
          <h4 className="text-lg font-semibold leading-snug text-foreground">{draft.title}</h4>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{draft.category}</span>
          <span className="text-blue-600">/</span>
          <span>{draft.subCategory}</span>
          {draft.sentiment && (
            <>
              <span className="text-blue-600">/</span>
              <span>{draft.sentiment}</span>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mb-4 space-y-3">
          <textarea
            value={editedDraft.description}
            onChange={(event) => updateEditedDraft('description', event.target.value)}
            rows={8}
            className="w-full resize-y rounded-2xl border border-border bg-card p-3 text-sm leading-relaxed text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
          {recommendedResolutionSteps.length > 0 && (
            <textarea
              value={recommendedResolutionSteps.join('\n')}
              onChange={(event) => updateRecommendedResolutionSteps(event.target.value)}
              rows={5}
              className="w-full resize-y rounded-2xl border border-border bg-card p-3 text-sm leading-relaxed text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              aria-label="Recommended resolution steps"
            />
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <EditSelect
              label="Priority"
              value={editedDraft.priority}
              options={Object.keys(PRIORITY_SLA)}
              onChange={(value) => updateEditedDraft('priority', value as DraftTicket['priority'])}
            />
            <EditSelect
              label="Category"
              value={editedDraft.category}
              options={Object.keys(CATEGORIES)}
              onChange={(value) => {
                setEditedDraft((current) => ({
                  ...current,
                  category: value,
                  subCategory: CATEGORIES[value]?.includes(current.subCategory) ? current.subCategory : CATEGORIES[value]?.[0] || 'Other',
                }));
              }}
            />
            <EditSelect
              label="Subcategory"
              value={editedDraft.subCategory}
              options={CATEGORIES[editedDraft.category] || []}
              onChange={(value) => updateEditedDraft('subCategory', value)}
            />
            <EditSelect
              label="Studio"
              value={editedDraft.studio}
              options={STUDIOS}
              onChange={(value) => updateEditedDraft('studio', value)}
            />
            <EditInput label="Instructor" value={editedDraft.trainer || ''} onChange={(value) => updateEditedDraft('trainer', value)} />
            <MomenceSessionTicketField
              classType={editedDraft.classType}
              classDateTime={editedDraft.classDateTime}
              trainer={editedDraft.trainer}
              studio={editedDraft.studio}
              onSelect={(session) => {
                setEditedDraft((current) => ({
                  ...current,
                  classType: session.classType || session.label,
                  classDateTime: session.startsAt || null,
                  trainer: session.trainer || current.trainer,
                  studio: session.studio || current.studio,
                }));
              }}
              onClear={() => {
                setEditedDraft((current) => ({
                  ...current,
                  classType: null,
                  classDateTime: null,
                }));
              }}
            />
            <MomenceMemberTicketField
              memberName={editedDraft.memberName}
              memberContact={editedDraft.memberContact}
              onSelect={(member) => {
                setEditedDraft((current) => ({
                  ...current,
                  memberName: member.name || member.label,
                  memberContact: member.email || member.phoneNumber || member.description || null,
                }));
              }}
              onClear={() => {
                setEditedDraft((current) => ({
                  ...current,
                  memberName: null,
                  memberContact: null,
                }));
              }}
            />
            <EditInput label="Documented by" value={editedDraft.reportedBy || ''} onChange={(value) => updateEditedDraft('reportedBy', value)} />
            <EditInput label="Owner" value={editedDraft.assignedTo || ''} onChange={(value) => updateEditedDraft('assignedTo', value)} />
            <EditInput label="Department" value={editedDraft.department || ''} onChange={(value) => updateEditedDraft('department', value)} />
          </div>
        </div>
      ) : (
        <>
          <FormattedDescription text={draft.description} />
          {recommendedResolutionSteps.length > 0 && (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Recommended resolution steps</div>
              <ol className="space-y-1.5 text-xs leading-relaxed text-foreground">
                {recommendedResolutionSteps.map((step, index) => (
                  <li key={`${step}-${index}`} className="grid grid-cols-[18px_1fr] gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-[10px] font-bold text-blue-700 ring-1 ring-blue-100">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <div className="mb-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
        <Row icon={<Tag className="h-3 w-3" />} label="Classification" value={`${draft.category} / ${draft.subCategory}`} />
        <Row icon={<MapPin className="h-3 w-3" />} label="Studio" value={draft.studio} />
        {draft.memberName && <Row icon={<User className="h-3 w-3" />} label="Member" value={draft.memberName} />}
        {draft.memberContact && <Row icon={<User className="h-3 w-3" />} label="Member contact" value={draft.memberContact} />}
        {draft.trainer && <Row icon={<User className="h-3 w-3" />} label="Instructor" value={draft.trainer} />}
        {draft.classType && <Row icon={<Calendar className="h-3 w-3" />} label="Class / Session" value={draft.classType} />}
        {draft.classDateTime && <Row icon={<Clock className="h-3 w-3" />} label="Session time" value={new Date(draft.classDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} />}
        <Row icon={<ShieldCheck className="h-3 w-3" />} label="Documented by" value={draft.reportedBy || 'Auto-assigned'} />
        <Row icon={<User className="h-3 w-3" />} label="Owner" value={draft.assignedTo || 'Auto-routed'} />
        <Row icon={<Tag className="h-3 w-3" />} label="Department" value={draft.department || 'Auto-routed'} />
        <Row icon={<Clock className="h-3 w-3" />} label="SLA target" value={`${slaHours} hour${slaHours === 1 ? '' : 's'} from publish`} />
      </div>

      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold text-blue-700">
              #{t}
            </span>
          ))}
        </div>
      )}

      {!confirmed && reviewInsights && !editing && (
        <TicketReviewPanel insights={reviewInsights} duplicatePatternInsights={duplicatePatternInsights} momenceLoading={momenceLoading} momenceError={momenceError} draft={draft} />
      )}

      {confirmed ? (
        <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-2 font-semibold">
            <Check className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Ticket {ticketId} published to dashboard</span>
          </div>
          {confirmedTicket ? (
            <SlaCountdown
              slaDueAt={confirmedTicket.slaDueAt}
              status={confirmedTicket.status}
              compact
              className="w-full justify-start ring-0 sm:w-auto"
            />
          ) : (
            <span className="rounded-xl border border-emerald-200 bg-card/75 px-3 py-2 font-semibold text-emerald-700">
              SLA clock syncing
            </span>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  onSaveEdit?.(editedDraft);
                  setEditing(false);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-950 py-2.5 text-xs font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-stone-800"
              >
                <Check className="w-3.5 h-3.5" /> Save edited draft
              </button>
              <button
                onClick={() => {
                  setEditedDraft(draft);
                  setEditing(false);
                }}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition duration-200 hover:border-blue-200 hover:bg-muted"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onConfirm}
                disabled={publishing}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-950 py-2.5 text-xs font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow-[0_20px_42px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:bg-stone-950 disabled:hover:shadow-[0_16px_34px_rgba(15,23,42,0.18)]"
              >
                <Check className="w-3.5 h-3.5" /> {publishing ? 'Publishing...' : 'Publish ticket'}
              </button>
              <button
                onClick={onDiscard}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Discard draft
              </button>
              <button
                onClick={() => {
                  onEdit();
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
              >
                <Route className="w-3.5 h-3.5" /> Fix routing
              </button>
              <button
                onClick={() => {
                  onEdit();
                  setEditing(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-muted"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit draft
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const cleanInlineMarkdown = (value: string) =>
  value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[-*]\s+/, '')
    .trim();

const FormattedDescription: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="my-2 list-disc space-y-1 pl-5">
        {bullets.map((line, index) => <li key={index}>{cleanInlineMarkdown(line)}</li>)}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || /^(\*{3,}|-{3,})$/.test(line)) {
      flushBullets();
      elements.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line);
      return;
    }
    flushBullets();
    elements.push(<p key={`p-${index}`} className="mb-1">{cleanInlineMarkdown(line)}</p>);
  });
  flushBullets();

  return (
    <div className="mb-4 rounded-2xl border border-border bg-muted/70 p-3 text-sm leading-relaxed text-foreground shadow-inner shadow-stone-200/60">
      {elements}
    </div>
  );
};

const Row: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex min-w-0 items-start gap-2 rounded-xl border border-stone-200 bg-white/80 px-2.5 py-2 dark:border-stone-800 dark:bg-stone-950/60">
    <div className="mt-0.5 text-blue-600">{icon}</div>
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="truncate text-foreground">{value}</div>
    </div>
  </div>
);

const TicketReviewPanel: React.FC<{
  insights: TicketReviewInsights;
  duplicatePatternInsights?: DuplicatePatternInsights;
  momenceLoading: boolean;
  momenceError?: string | null;
  draft: DraftTicket;
}> = ({ insights, duplicatePatternInsights, momenceLoading, momenceError, draft }) => {
  const smart = buildSmartTicketIntelligence({ draft: draft as BuildableDraftTicket });
  const averageConfidence = Math.round(
    insights.confidence.reduce((sum, item) => sum + item.score, 0) / Math.max(1, insights.confidence.length)
  );
  return (
  <div className="mb-3 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
    {insights.duplicateWarning && (
      <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <div className="mb-1 flex items-center gap-2 font-bold">
          <AlertTriangle className="h-4 w-4" />
          Exact duplicate: {insights.duplicateWarning.ticketId}
        </div>
        <div className="leading-relaxed">
          {insights.duplicateWarning.title} · {insights.duplicateWarning.status}
        </div>
      </div>
    )}

    {duplicatePatternInsights && (
      <PatternNotice insights={duplicatePatternInsights} />
    )}

    <div className="border-b border-border bg-muted/65 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Decision Summary</div>
          <div className="mt-0.5 text-sm font-semibold text-foreground">Routing, risk and readiness before publishing.</div>
        </div>
        <span className={`rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-bold ${confidenceTone(averageConfidence)}`}>
          {averageConfidence}% confidence
        </span>
      </div>
      <SmartOpsReviewStrip intelligence={smart} momenceLoading={momenceLoading} momenceReady={insights.momenceChips.length > 0} confidenceScore={averageConfidence} />
    </div>

    <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.6fr)] p-4">
      <div className="grid gap-3">
        <ReviewBlock icon={<Route className="h-3.5 w-3.5" />} title="Routing evidence" compact>
          <StructuredLineList lines={insights.routingRationale} />
        </ReviewBlock>
        <ReviewBlock icon={<Brain className="h-3.5 w-3.5" />} title="Momence context" compact>
          <MomenceReviewState loading={momenceLoading} error={momenceError} chips={insights.momenceChips} />
        </ReviewBlock>
        {insights.riskSignals.length > 0 && (
          <ReviewBlock icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Risk flags" compact>
            <StructuredLineList lines={insights.riskSignals} tone="amber" />
          </ReviewBlock>
        )}
        <ReviewBeforePublish sections={insights.sections} />
      </div>
      <SmartOpsReviewBlock intelligence={smart} resolutionSteps={getDraftResolutionSteps(draft)} draft={draft} />
    </div>
  </div>
  );
};

type BuildableDraftTicket = Parameters<typeof buildSmartTicketIntelligence>[0]['draft'];

const SmartOpsReviewStrip: React.FC<{ intelligence: SmartTicketIntelligence; momenceLoading: boolean; momenceReady: boolean; confidenceScore: number }> = ({ intelligence, momenceLoading, momenceReady, confidenceScore }) => (
  <div className="grid gap-2 sm:grid-cols-4">
    <DecisionMetric
      label="Risk"
      value={`${intelligence.riskScore}`}
      detail={intelligence.riskLevel}
      tone={intelligence.riskScore >= 72 ? 'amber' : 'blue'}
      score={intelligence.riskScore}
    />
    <DecisionMetric
      label="Confidence"
      value={`${confidenceScore}%`}
      detail="Draft readiness"
      tone={confidenceScore >= 70 ? 'green' : 'amber'}
      score={confidenceScore}
    />
    <DecisionMetric label="Playbook" value={intelligence.playbook.title} detail={intelligence.playbook.owner} tone="slate" />
    <DecisionMetric label="Momence" value={momenceReady ? 'Context attached' : momenceLoading ? 'Loading context' : 'Not selected'} detail={momenceReady ? 'Ready' : 'Needs check'} tone={momenceReady ? 'green' : 'amber'} score={momenceReady ? 100 : momenceLoading ? 55 : 25} />
  </div>
);

const DecisionMetric: React.FC<{ label: string; value: string; detail: string; tone: 'blue' | 'green' | 'amber' | 'slate'; score?: number }> = ({ label, value, detail, tone, score }) => {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    slate: 'border-border bg-card text-foreground',
  };
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-65">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold tabular-nums" title={value}>{value}</div>
      <div className="mt-0.5 truncate text-[10px] opacity-70">{detail}</div>
      {typeof score === 'number' && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/70">
          <div className={`h-full rounded-full ${confidenceBar(score)}`} style={{ width: `${Math.max(6, Math.min(100, score))}%` }} />
        </div>
      )}
    </div>
  );
};

const SmartOpsReviewBlock: React.FC<{ intelligence: SmartTicketIntelligence; resolutionSteps?: string[]; draft: DraftTicket }> = ({ intelligence, resolutionSteps, draft }) => {
  // Prefer the AI's incident-specific resolution steps over the generic playbook template.
  const steps = resolutionSteps && resolutionSteps.length ? resolutionSteps : intelligence.playbook.steps;
  const stepsTitle = resolutionSteps && resolutionSteps.length ? 'Recommended resolution steps' : intelligence.playbook.title;
  return (
  <div className="space-y-3">
      <div className="rounded-xl border border-border bg-slate-950 p-3 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">Smart risk</div>
            <div className="mt-1 text-2xl font-bold leading-none tabular-nums">{intelligence.riskScore}</div>
          </div>
          <div className="h-16 w-16 rounded-full border-[8px] border-blue-400/80 bg-white/10 p-2 text-center text-[10px] font-bold uppercase leading-[34px] text-white">
            {intelligence.riskLevel}
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className={`h-full rounded-full ${confidenceBar(intelligence.riskScore)}`} style={{ width: `${intelligence.riskScore}%` }} />
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-slate-300">{intelligence.urgencyExplanation}</div>
      </div>
      <ReviewBlock icon={<Brain className="h-3.5 w-3.5" />} title={stepsTitle} compact>
        <StructuredLineList lines={steps} />
      </ReviewBlock>
      <ReviewBlock icon={<Sparkles className="h-3.5 w-3.5" />} title="Quick actions & resolution copilot" compact>
        <CopilotQuickActions
          suggestedReply={intelligence.playbook.suggestedReply}
          quickActions={intelligence.quickActions}
          draft={draft}
          steps={steps}
        />
      </ReviewBlock>
      <ReviewBlock icon={<MessageSquareText className="h-3.5 w-3.5" />} title="Next best questions" compact>
        <StructuredLineList lines={intelligence.nextBestQuestions} />
      </ReviewBlock>
  </div>
  );
};

const CopilotQuickActions: React.FC<{
  suggestedReply: string;
  quickActions: Array<{ label: string; prompt: string }>;
  draft: DraftTicket;
  steps: string[];
}> = ({ suggestedReply, quickActions, draft, steps }) => {
  const [copiedReply, setCopiedReply] = useState(false);
  const [copiedBriefing, setCopiedBriefing] = useState(false);

  const copyReply = () => {
    navigator.clipboard.writeText(suggestedReply);
    setCopiedReply(true);
    setTimeout(() => setCopiedReply(false), 2000);
  };

  const copyBriefing = () => {
    const briefingText = [
      `🚨 ATHENA OPS BRIEFING`,
      `Issue: ${draft.title}`,
      `Category: ${draft.category} / ${draft.subCategory}`,
      `Studio: ${draft.studio} | Priority: ${draft.priority}`,
      draft.memberName ? `Member: ${draft.memberName}` : null,
      draft.trainer ? `Instructor: ${draft.trainer}` : null,
      `SOP Resolution Steps:`,
      ...steps.map((s, i) => `${i + 1}. ${s}`),
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(briefingText);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2000);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={copyReply}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs"
        >
          {copiedReply ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-emerald-600" />}
          {copiedReply ? 'Copied member reply!' : 'Copy WhatsApp member reply'}
        </button>

        <button
          type="button"
          onClick={copyBriefing}
          className="inline-flex items-center gap-1 rounded-full border border-blue-300/80 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 shadow-2xs"
        >
          {copiedBriefing ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3 text-blue-600" />}
          {copiedBriefing ? 'Copied briefing!' : 'Copy Slack/WhatsApp briefing'}
        </button>

        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${action.label}: ${action.prompt}`);
            }}
            title={`Copy: ${action.prompt}`}
            className="rounded-full border border-border/80 bg-card px-2.5 py-1 text-[10px] font-semibold text-foreground transition hover:border-blue-300 hover:bg-muted"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-2.5 text-[11px] leading-relaxed text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-2xs">
        <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
          <span>Athena suggested member reply</span>
          <span className="text-[8.5px] font-medium opacity-80">Click button above to copy</span>
        </div>
        {suggestedReply}
      </div>
    </div>
  );
};

const ReviewBlock: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; compact?: boolean }> = ({ icon, title, children, compact = false }) => (
  <div className={`rounded-xl border border-border bg-card ${compact ? 'p-2.5' : 'p-3'}`}>
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {icon}
      {title}
    </div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const PatternNotice: React.FC<{ insights: DuplicatePatternInsights }> = ({ insights }) => (
  <div className="border-b border-blue-100 bg-blue-50/75 px-4 py-3 text-xs text-blue-950">
    <div className="mb-2 flex items-center gap-2 font-bold">
      <Layers3 className="h-4 w-4" />
      Smart duplicate and pattern check
    </div>
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr]">
      <MiniInsight label="Issue pattern" value={insights.patternSummary} />
      <MiniInsight label="Member pattern" value={insights.memberRepeatSummary} />
      <MiniInsight label="Recommended action" value={insights.recommendedAction} strong />
    </div>
  </div>
);

const MiniInsight: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong = false }) => (
  <div className={`rounded-lg border px-2.5 py-2 ${strong ? 'border-blue-200 bg-white text-blue-950' : 'border-white/70 bg-white/75 text-foreground'}`}>
    <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    <div className="text-[11px] font-medium leading-snug">{value}</div>
  </div>
);

const StructuredLineList: React.FC<{ lines: string[]; tone?: 'slate' | 'amber' }> = ({ lines, tone = 'slate' }) => (
  <div className="space-y-1.5">
    {lines.map((line) => (
      <div key={line} className={`flex gap-2 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed ${tone === 'amber' ? 'border border-amber-100 bg-amber-50 text-amber-900' : 'bg-muted text-muted-foreground'}`}>
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'amber' ? 'bg-amber-500' : 'bg-blue-500'}`} />
        <span>{line}</span>
      </div>
    ))}
  </div>
);

const MomenceReviewState: React.FC<{ loading: boolean; error?: string | null; chips: string[] }> = ({ loading, error, chips }) => (
  <>
    {loading && (
      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading live Momence context...
      </div>
    )}
    {error && (
      <div className="rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
        {error}
      </div>
    )}
    {chips.length ? (
      <div className="flex flex-wrap gap-1">
        {chips.map((chip) => (
          <span key={chip} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
            {chip}
          </span>
        ))}
      </div>
    ) : !loading && (
      <div className="rounded-lg bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
        No live Momence member/session context selected yet.
      </div>
    )}
  </>
);

const ReviewBeforePublish: React.FC<{ sections: TicketReviewInsights['sections'] }> = ({ sections }) => (
  <ReviewBlock icon={<Layers3 className="h-3.5 w-3.5" />} title="Review before publish" compact>
    <div className="grid gap-2 md:grid-cols-2">
      {sections.map((section) => (
        <div key={section.title} className="rounded-xl border border-border bg-card p-2 shadow-[0_8px_18px_rgba(15,23,42,0.03)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{section.title}</div>
            <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/4 rounded-full bg-blue-500" />
            </div>
          </div>
          <div className="space-y-1">
            {section.items.slice(0, 4).map((item) => (
              <div key={item} className="truncate text-[11px] text-foreground" title={item}>{item}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </ReviewBlock>
);

function confidenceTone(score: number): string {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 65) return 'text-blue-700';
  if (score >= 45) return 'text-amber-700';
  return 'text-red-700';
}

function confidenceBar(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 65) return 'bg-blue-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

const EditInput: React.FC<{ label: string; value: string; type?: string; onChange: (value: string) => void }> = ({ label, value, type = 'text', onChange }) => (
  <label className="block rounded-xl border border-border bg-card p-2">
    <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
    />
  </label>
);

const EditSelect: React.FC<{ label: string; value: string; options: string[]; onChange: (value: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="block rounded-xl border border-border bg-card p-2">
    <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);
