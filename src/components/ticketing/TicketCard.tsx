import React from 'react';
import { Ticket, PRIORITY_SLA, getEscalationTarget, getSlaState, isRecordOnlyTicket } from '@/lib/ticketing-data';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Layers3,
  Loader2,
  MapPin,
  MessageSquareText,
  Route,
  ShieldCheck,
  Tag,
  UserRound,
} from 'lucide-react';
import { SlaCountdown } from './SlaCountdown';

const STATUS_ICON: Record<string, React.ReactNode> = {
  'New': <Circle className="w-3.5 h-3.5" />,
  'In Progress': <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  'Awaiting Member': <AlertCircle className="w-3.5 h-3.5" />,
  'Resolved': <CheckCircle2 className="w-3.5 h-3.5" />,
  'Closed': <CheckCircle2 className="w-3.5 h-3.5" />,
};

const STATUS_COLOR: Record<string, string> = {
  'New': 'bg-slate-50 text-slate-700 border-slate-200',
  'In Progress': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Awaiting Member': 'bg-sky-50 text-sky-700 border-sky-200',
  'Resolved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Closed': 'bg-slate-100 text-slate-700 border-slate-200',
};

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_GRADIENTS = [
  'from-stone-700 to-stone-950',
  'from-sky-700 to-stone-950',
  'from-emerald-700 to-stone-950',
  'from-indigo-700 to-stone-950',
  'from-amber-700 to-stone-950',
  'from-zinc-600 to-neutral-950',
];

function gradientFor(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

const PRIORITY_BORDER_COLOR: Record<Ticket['priority'], string> = {
  Critical: 'before:bg-red-600 focus-visible:ring-red-100',
  High: 'before:bg-amber-500 focus-visible:ring-amber-100',
  Medium: 'before:bg-sky-500 focus-visible:ring-sky-100',
  Low: 'before:bg-emerald-500 focus-visible:ring-emerald-100',
};

const PRIORITY_PILL_COLOR: Record<Ticket['priority'], string> = {
  Critical: 'border-red-200 bg-red-600 text-white',
  High: 'border-amber-200 bg-amber-50 text-amber-800',
  Medium: 'border-sky-200 bg-sky-50 text-sky-800',
  Low: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

interface Props {
  ticket: Ticket;
  onClick?: () => void;
}

export const TicketCard: React.FC<Props> = ({ ticket, onClick }) => {
  const priorityMeta = PRIORITY_SLA[ticket.priority];
  const primaryPerson = ticket.memberName || ticket.reportedBy || 'No member linked';
  const primaryPersonLabel = ticket.memberName ? 'Member' : ticket.reportedBy ? 'Reported by' : 'Member context';
  const escalation = getEscalationTarget(ticket.assignedTo);
  const created = formatTicketDate(ticket.createdAt);
  const sessionContext = formatSessionContext(ticket);
  const tags = Array.isArray(ticket.tags) ? ticket.tags : [];
  const slaState = getSlaState(ticket);
  const description = previewText(ticket.description || ticket.conversationSummary || '');

  return (
    <button
      onClick={onClick}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-[0_14px_38px_rgba(15,23,42,0.06)] transition-all duration-200 before:absolute before:inset-x-0 before:top-0 before:h-1 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-4 ${PRIORITY_BORDER_COLOR[ticket.priority]}`}
    >
      <div className="flex min-h-0 flex-1 flex-col p-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-border bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                {ticket.id}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${STATUS_COLOR[ticket.status] || STATUS_COLOR.New}`}>
                {STATUS_ICON[ticket.status] || STATUS_ICON.New}
                {ticket.status}
              </span>
            </div>
            <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition group-hover:text-blue-700">
              {ticket.title}
            </h3>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${PRIORITY_PILL_COLOR[ticket.priority]}`}>
            <AlertCircle className="h-3 w-3" />
            {ticket.priority}
          </span>
        </div>

        <p className="mt-3 min-h-[40px] line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {description || 'No description captured yet.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip icon={<Layers3 className="h-3 w-3" />} label={ticket.category} tone="blue" />
          <Chip label={ticket.subCategory} />
          {ticket.sentiment && <Chip icon={<MessageSquareText className="h-3 w-3" />} label={ticket.sentiment} tone="slate" />}
        </div>

        <div className="mt-4 grid gap-2 border-y border-slate-100 py-3 sm:grid-cols-2">
          <InfoItem icon={<UserRound className="h-3.5 w-3.5" />} label={primaryPersonLabel} value={primaryPerson} />
          <InfoItem icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Owner" value={ticket.assignedTo || 'Unassigned'} />
          <InfoItem icon={<MapPin className="h-3.5 w-3.5" />} label="Studio" value={ticket.studio || 'No studio'} />
          <InfoItem icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={created} />
        </div>

        <div className="mt-3 grid gap-2">
          <div className="grid min-h-[38px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-slate-50 px-2.5 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <Clock3 className="h-3 w-3" />
                SLA
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <SlaCountdown slaDueAt={ticket.slaDueAt} status={ticket.status} noSla={isRecordOnlyTicket(ticket)} compact className="min-w-0 ring-0" />
              </div>
            </div>
            <div className="text-right">
              <span className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm">
                {slaState}
              </span>
              <div className="mt-1 text-[10px] text-slate-400">{priorityMeta?.label || `${ticket.priority} SLA`}</div>
            </div>
          </div>

          {sessionContext && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
                <Clock3 className="h-3 w-3" />
                Session context
              </div>
              <div className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-blue-950">
                {sessionContext}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div className="grid gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoItem icon={<Building2 className="h-3.5 w-3.5" />} label="Team" value={ticket.team || 'No team'} compact />
              <InfoItem icon={<Route className="h-3.5 w-3.5" />} label="Escalation" value={escalation} compact />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(primaryPerson)} text-[10px] font-bold text-white`}>
                  {initials(primaryPerson)}
                </div>
                <div className="min-w-0 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{ticket.assignedTo || 'Unassigned'}</span>
                  {tags.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                      <Tag className="h-3 w-3" />
                      {tags.length}
                    </span>
                  )}
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

const Chip: React.FC<{ icon?: React.ReactNode; label: string; tone?: 'blue' | 'slate' }> = ({ icon, label, tone }) => (
  <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
    tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-700'
      : tone === 'slate'
        ? 'border-border bg-slate-100 text-muted-foreground'
        : 'border-border bg-card text-muted-foreground'
  }`}>
    {icon}
    <span className="truncate">{label}</span>
  </span>
);

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string; compact?: boolean }> = ({ icon, label, value, compact = false }) => (
  <div className={`min-w-0 ${compact ? '' : 'rounded-lg bg-card/70 px-2 py-1.5'}`}>
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
      <span className="text-blue-600">{icon}</span>
      {label}
    </div>
    <div className={`${compact ? 'mt-0.5' : 'mt-1'} truncate text-xs font-semibold text-foreground`} title={value}>
      {value}
    </div>
  </div>
);

function previewText(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line)).slice(0, 3);
  if (bulletLines.length > 0) {
    return bulletLines.map((line) => line.replace(/^[-*]\s+/, '')).join(' ');
  }

  return lines.join(' ');
}

function formatTicketDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSessionDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSessionContext(ticket: Ticket): string | null {
  const parts = [
    ticket.trainer ? `Instructor: ${ticket.trainer}` : null,
    ticket.classType ? `Class: ${ticket.classType}` : null,
    ticket.classDateTime ? `When: ${formatSessionDate(ticket.classDateTime)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
