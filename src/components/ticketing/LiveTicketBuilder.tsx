import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flame,
  MapPin,
  MessageSquare,
  Star,
  Tag,
  User,
} from 'lucide-react';

interface LiveContext {
  intakeRoute?: string;
  category?: string;
  subCategory?: string;
  priority?: string;
  studio?: string;
  trainer?: string;
  classType?: string;
  classDateTime?: string;
  memberName?: string;
  memberContact?: string;
  membership?: string;
  memberId?: string;
  sessionId?: string;
  reportedBy?: string;
  assignedTo?: string;
  owner?: string;
  department?: string;
  team?: string;
  memberSentiment?: string;
  urgencyReason?: string;
  desiredResolution?: string;
  description?: string;
  clientsAffected?: string;
  [key: string]: string | undefined;
}

interface LiveDraft {
  title?: string;
  category?: string;
  subCategory?: string;
  priority?: string;
  studio?: string;
  trainer?: string | null;
  classType?: string | null;
  memberName?: string | null;
  memberContact?: string | null;
  assignedTo?: string | null;
  department?: string | null;
  sentiment?: string;
  conversationSummary?: string;
  tags?: string[];
}

interface Props {
  context: LiveContext;
  activeDraft?: LiveDraft | null;
}

function priorityColors(priority?: string) {
  if (priority === 'Critical') return 'bg-red-100 text-red-700 border-red-200';
  if (priority === 'High') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (priority === 'Medium') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-muted-foreground border-border';
}

function sentimentColors(sentiment?: string) {
  if (sentiment === 'Positive') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (sentiment === 'Concern' || sentiment === 'Negative') return 'bg-red-100 text-red-700 border-red-200';
  if (sentiment === 'Neutral') return 'bg-slate-100 text-muted-foreground border-border';
  return 'bg-slate-100 text-muted-foreground border-border';
}

const FieldChip: React.FC<{ label: string; value: string; tone?: 'default' | 'priority' | 'sentiment' }> = ({ label, value, tone = 'default' }) => {
  const toneClass = tone === 'priority' ? priorityColors(value) : tone === 'sentiment' ? sentimentColors(value) : 'bg-slate-100 text-slate-700 border-border';
  return (
    <div className={`flex items-center justify-between rounded-xl border px-2.5 py-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${toneClass} animate-p57-fade-up`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">{label}</span>
      <span className="ml-2 text-right text-[11px] font-semibold truncate max-w-[120px]" title={value}>{value}</span>
    </div>
  );
};

const SectionLabel: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <span className="text-slate-400">{icon}</span>
    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</span>
  </div>
);

function countFilledContext(ctx: LiveContext): number {
  const keys: (keyof LiveContext)[] = ['category', 'subCategory', 'studio', 'priority', 'memberName', 'classType', 'trainer', 'membership', 'memberSentiment', 'desiredResolution', 'urgencyReason'];
  return keys.filter((k) => ctx[k]?.trim()).length;
}

export const LiveTicketBuilder: React.FC<Props> = ({ context, activeDraft }) => {
  const filled = useMemo(() => countFilledContext(context), [context]);
  const hasDraft = Boolean(activeDraft?.title);
  const hasMember = Boolean(context.memberName || context.memberId);
  const hasSession = Boolean(context.classType || context.sessionId || context.classDateTime);
  const hasClassification = Boolean(context.category || context.priority || context.studio);
  const totalSignals = useMemo(() => {
    const signals: string[] = [];
    if (context.memberName) signals.push(context.memberName);
    if (context.studio) signals.push(context.studio);
    if (context.category) signals.push(context.category);
    return signals;
  }, [context]);
  const progressPct = Math.min(100, Math.round((filled / 8) * 100));

  if (filled === 0 && !hasDraft) {
    return (
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_46%,#eef6ff_100%)] px-5 py-6">
        <div className="rounded-2xl border border-border bg-card/92 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)]">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-700">Live preview</div>
              <p className="mt-1 text-sm font-semibold text-foreground">Ticket fields appear here</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            As Athena captures route, studio, impact, and follow-up details, this preview updates in real time.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {['Category', 'Studio', 'Member', 'Priority'].map((f) => (
            <div key={f} className="flex h-10 w-full items-center justify-between rounded-xl border border-dashed border-border bg-card/80 px-3 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{f}</span>
              <span className="h-2 w-16 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-[radial-gradient(circle_at_10%_10%,rgba(37,99,235,0.12),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef6ff_100%)] px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-600">Live Ticket</div>
            <div className="text-[13px] font-semibold text-foreground">
              {hasDraft ? 'Draft ready' : 'Capturing context...'}
            </div>
          </div>
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white bg-card/80 shadow-[0_14px_30px_rgba(37,99,235,0.14)]">
            <div
              className="absolute inset-1 rounded-xl"
              style={{ background: `conic-gradient(#2563eb ${progressPct * 3.6}deg, #e2e8f0 0deg)` }}
            />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-card text-[10px] font-black text-foreground">
              {progressPct}
            </div>
          </div>
          {hasDraft && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm animate-p57-fade-up">
              <CheckCircle2 className="h-3 w-3" />
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-600 transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-400 tabular-nums">{progressPct}%</span>
        </div>
        {totalSignals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {totalSignals.map((s, idx) => (
              <span 
                key={s} 
                className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-600 shadow-sm animate-p57-fade-up"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="chat-scrollbar flex-1 overflow-y-auto bg-slate-50/70">
        <div className="space-y-4 p-4">
          {hasDraft && activeDraft?.title && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50/70 to-blue-50 p-3.5 shadow-[0_18px_42px_rgba(37,99,235,0.13)] animate-p57-fade-up">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-500 mb-1">Draft Title</div>
              <div className="text-[12px] font-semibold text-foreground leading-snug">{activeDraft.title}</div>
              {activeDraft.tags && activeDraft.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeDraft.tags.slice(0, 4).map((tag, idx) => (
                    <span 
                      key={tag} 
                    className="inline-flex items-center gap-0.5 rounded-full border border-indigo-100 bg-card/80 px-1.5 py-0.5 text-[9px] text-indigo-600 shadow-sm animate-p57-fade-up"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasClassification && (
            <div>
              <SectionLabel icon={<BadgeCheck className="h-3.5 w-3.5" />} title="Classification" />
              <div className="space-y-1.5">
                {context.category && <FieldChip label="Category" value={context.category} />}
                {context.subCategory && <FieldChip label="Subcategory" value={context.subCategory} />}
                {(context.priority || activeDraft?.priority) && (
                  <FieldChip label="Priority" value={context.priority || activeDraft?.priority || ''} tone="priority" />
                )}
                {(context.studio || activeDraft?.studio) && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-slate-100 px-2.5 py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Studio</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {context.studio || activeDraft?.studio}
                    </span>
                  </div>
                )}
                {context.intakeRoute && <FieldChip label="Route" value={context.intakeRoute} />}
              </div>
            </div>
          )}

          {hasMember && (
            <div>
              <SectionLabel icon={<User className="h-3.5 w-3.5" />} title="Member" />
              <div className="space-y-1.5">
                {(context.memberName || activeDraft?.memberName) && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-600">Name</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                      <User className="h-3 w-3 text-emerald-400" />
                      {context.memberName || activeDraft?.memberName}
                    </span>
                  </div>
                )}
                {(context.memberContact || activeDraft?.memberContact) && (
                  <FieldChip label="Contact" value={context.memberContact || activeDraft?.memberContact || ''} />
                )}
                {context.membership && <FieldChip label="Membership" value={context.membership} />}
                {context.clientsAffected && <FieldChip label="Clients affected" value={context.clientsAffected} />}
              </div>
            </div>
          )}

          {hasSession && (
            <div>
              <SectionLabel icon={<Calendar className="h-3.5 w-3.5" />} title="Session" />
              <div className="space-y-1.5">
                {(context.classType || activeDraft?.classType) && (
                  <FieldChip label="Class" value={context.classType || activeDraft?.classType || ''} />
                )}
                {(context.trainer || activeDraft?.trainer) && (
                  <FieldChip label="Trainer" value={context.trainer || activeDraft?.trainer || ''} />
                )}
                {context.classDateTime && (
                  <FieldChip label="Date/Time" value={(() => {
                    try { return new Date(context.classDateTime!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
                    catch { return context.classDateTime!; }
                  })()} />
                )}
              </div>
            </div>
          )}

          {(context.memberSentiment || activeDraft?.sentiment || context.urgencyReason || context.desiredResolution) && (
            <div>
              <SectionLabel icon={<Star className="h-3.5 w-3.5" />} title="Sentiment & Resolution" />
              <div className="space-y-1.5">
                {(context.memberSentiment || activeDraft?.sentiment) && (
                  <FieldChip label="Sentiment" value={context.memberSentiment || activeDraft?.sentiment || ''} tone="sentiment" />
                )}
                {context.urgencyReason && (
                  <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wide text-orange-500">Urgency</div>
                      <div className="text-[11px] text-orange-700">{context.urgencyReason}</div>
                    </div>
                  </div>
                )}
                {context.desiredResolution && (
                  <div className="rounded-lg border border-border bg-slate-50 px-2.5 py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Desired resolution</div>
                    <div className="mt-0.5 text-[11px] text-slate-700">{context.desiredResolution}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(context.assignedTo || activeDraft?.assignedTo || context.department || activeDraft?.department) && (
            <div>
              <SectionLabel icon={<MessageSquare className="h-3.5 w-3.5" />} title="Routing" />
              <div className="space-y-1.5">
                {(context.assignedTo || context.owner || activeDraft?.assignedTo) && (
                  <FieldChip label="Assignee" value={context.assignedTo || context.owner || activeDraft?.assignedTo || ''} />
                )}
                {(context.department || context.team || activeDraft?.department) && (
                  <FieldChip label="Department" value={context.department || context.team || activeDraft?.department || ''} />
                )}
              </div>
            </div>
          )}

          {hasDraft && activeDraft?.conversationSummary && (
            <div>
              <SectionLabel icon={<Flame className="h-3.5 w-3.5" />} title="Summary" />
              <div className="rounded-xl border border-border bg-slate-50 p-2.5">
                <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-5">{activeDraft.conversationSummary}</p>
              </div>
            </div>
          )}

          {hasDraft && (
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-3 shadow-[0_12px_30px_rgba(16,185,129,0.10)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="text-[11px] font-bold text-emerald-800">Draft ready to review</div>
                  <div className="text-[10px] text-emerald-600">Click "Review draft" in the chat to publish.</div>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 text-emerald-400" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
