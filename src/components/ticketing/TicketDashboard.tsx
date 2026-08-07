import React, { useMemo, useState } from 'react';
import { ManualTicketInput } from './TicketContext';
import { useTickets } from './useTickets';
import { TicketCard } from './TicketCard';
import { SlaCountdown } from './SlaCountdown';
import {
  ASSOCIATES,
  CATEGORIES,
  getEscalationTarget,
  getSlaState,
  getTicketGroupValue,
  isClosedTicket,
  isRecordOnlyTicket,
  isTicketBreached,
  STATUSES,
  STUDIOS,
  Ticket,
} from '@/lib/ticketing-data';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Circle,
  Columns3,
  Flame,
  Grid3X3,
  LayoutList,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { isTrainerEvaluationProfileOnly } from '@/lib/trainer-profiles';
import { MomenceMemberTicketField, MomenceSessionTicketField } from './MomenceTicketEntityFields';
import { buildNaturalLanguageAnalyticsAnswer, buildSmartOpsBriefing } from '@/lib/smart-ops-intelligence';

type DashboardView = 'list' | 'table' | 'kanban' | 'grouped' | 'sla' | 'analytics';
type GroupBy = 'none' | 'status' | 'priority' | 'studio' | 'category' | 'assignee' | 'sla' | 'member';
type SlaFilter = 'All' | 'Breached' | 'At Risk' | 'On Track' | 'Closed' | 'Not Required';

interface Filters {
  query: string;
  status: string;
  priority: string;
  studio: string;
  category: string;
  assignee: string;
  sentiment: string;
  sla: SlaFilter;
  from: string;
  to: string;
  tag: string;
}

const EMPTY_FILTERS: Filters = {
  query: '',
  status: 'All',
  priority: 'All',
  studio: 'All',
  category: 'All',
  assignee: 'All',
  sentiment: 'All',
  sla: 'All',
  from: '',
  to: '',
  tag: '',
};

const VIEWS: Array<{ id: DashboardView; label: string; icon: React.ReactNode }> = [
  { id: 'list', label: 'List', icon: <LayoutList className="h-4 w-4" /> },
  { id: 'table', label: 'Table', icon: <Table2 className="h-4 w-4" /> },
  { id: 'kanban', label: 'Kanban', icon: <Columns3 className="h-4 w-4" /> },
  { id: 'grouped', label: 'Grouped', icon: <Grid3X3 className="h-4 w-4" /> },
  { id: 'sla', label: 'SLA & Escalations', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
];

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'studio', label: 'Studio' },
  { value: 'category', label: 'Category' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'sla', label: 'SLA state' },
  { value: 'member', label: 'Member' },
];

const CHART_COLORS = ['#111827', '#64748b', '#2563eb', '#334155', '#1d4ed8', '#94a3b8'];

export const TicketDashboard: React.FC = () => {
  const { tickets, setSelectedTicket, loading, error, refresh, createManualTicket } = useTickets();
  const operationalTickets = useMemo(() => tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket)), [tickets]);
  const [view, setView] = useState<DashboardView>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);

  const options = useMemo(() => {
    const unique = (values: Array<string | undefined>) =>
      Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
    return {
      studios: unique(operationalTickets.map((t) => t.studio)),
      categories: unique(operationalTickets.map((t) => t.category)),
      assignees: unique(operationalTickets.map((t) => t.assignedTo)),
      sentiments: unique(operationalTickets.map((t) => t.sentiment)),
    };
  }, [operationalTickets]);

  const filtered = useMemo(() => sortNewestFirst(filterTickets(operationalTickets, filters)), [operationalTickets, filters]);
  const stats = useMemo(() => buildStats(filtered, operationalTickets.length), [filtered, operationalTickets.length]);
  const groups = useMemo(() => groupTickets(filtered, groupBy), [filtered, groupBy]);
  const analytics = useMemo(() => buildAnalytics(filtered), [filtered]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const refreshTickets = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top_left,rgba(219,234,254,0.72),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_46%,#f8fafc_100%)]">
      <div className="flex-shrink-0 border-b border-stone-200/80 bg-card/86 px-4 py-2 shadow-[0_12px_42px_rgba(17,24,39,0.05)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">Operations ledger</div>
            <h2 className="truncate font-serif text-lg font-semibold tracking-tight text-stone-950">
              Submitted Tickets
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-card px-2.5 text-[11px] font-semibold text-emerald-700 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </div>
            <CollapseButton
              open={metricsOpen}
              onClick={() => setMetricsOpen((current) => !current)}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="Metrics"
              value={`${stats.visible}/${stats.total}`}
            />
            <CollapseButton
              open={filtersOpen}
              onClick={() => setFiltersOpen((current) => !current)}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label="Filters"
              value={activeFilterCount(filters)}
            />
            <CollapseButton
              open={viewsOpen}
              onClick={() => setViewsOpen((current) => !current)}
              icon={<LayoutList className="h-3.5 w-3.5" />}
              label="Views"
              value={VIEWS.find((item) => item.id === view)?.label || 'List'}
            />
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-950 bg-stone-950 px-3 text-[11px] font-semibold text-white shadow-[0_12px_26px_rgba(17,24,39,0.16)] transition hover:-translate-y-0.5 hover:bg-stone-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add ticket
            </button>
            <button
              type="button"
              onClick={refreshTickets}
              disabled={refreshing || loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {metricsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            <StatTile label="Open" value={stats.open} icon={<Circle className="h-4 w-4" />} tone="default" />
            <StatTile label="Critical" value={stats.critical} icon={<Flame className="h-4 w-4" />} tone="danger" />
            <StatTile label="Breached" value={stats.breached} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
            <StatTile label="Resolved" value={stats.resolved} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
            <StatTile label="Visible" value={`${stats.visible}/${stats.total}`} icon={<ListFilter className="h-4 w-4" />} tone="neutral" />
          </div>
        )}

        {viewsOpen && (
          <div className="mt-2 flex gap-1 overflow-x-auto rounded-full border border-border bg-muted/70 p-1 shadow-inner shadow-slate-200/60">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setViewsOpen(false);
                }}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-all duration-200 ${
                  view === item.id
                    ? 'border-slate-950 bg-slate-950 text-white shadow-[0_12px_28px_rgba(17,24,39,0.16)]'
                    : 'border-transparent bg-transparent text-muted-foreground hover:bg-card hover:text-slate-950'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}

        {filtersOpen && (
          <div className="mt-2">
            <FilterBar filters={filters} options={options} onChange={updateFilter} onReset={() => setFilters(EMPTY_FILTERS)} />
          </div>
        )}

        {view === 'grouped' && (
          <div className="mt-2 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-stone-400" />
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as GroupBy)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {loading && operationalTickets.length === 0 ? (
          <EmptyState icon={<Circle className="h-8 w-8 animate-pulse" />} label="Loading tickets from database..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ListFilter className="h-9 w-9" />} label="No tickets match the current filters" />
        ) : view === 'list' ? (
          <ListView tickets={filtered} onOpen={setSelectedTicket} />
        ) : view === 'table' ? (
          <TableView tickets={filtered} onOpen={setSelectedTicket} />
        ) : view === 'kanban' ? (
          <KanbanView tickets={filtered} onOpen={setSelectedTicket} />
        ) : view === 'grouped' ? (
          <GroupedView groups={groups} onOpen={setSelectedTicket} />
        ) : view === 'sla' ? (
          <SlaView tickets={filtered} onOpen={setSelectedTicket} />
        ) : (
          <AnalyticsView analytics={analytics} />
        )}
      </div>

      {creating && (
        <ManualTicketModal
          onClose={() => setCreating(false)}
          onCreate={async (values) => {
            await createManualTicket(values);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
};

function filterTickets(tickets: Ticket[], filters: Filters): Ticket[] {
  const query = filters.query.trim().toLowerCase();
  const fromTime = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const toTime = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;
  const tag = filters.tag.trim().toLowerCase();

  return tickets.filter((ticket) => {
    if (filters.status !== 'All' && ticket.status !== filters.status) return false;
    if (filters.priority !== 'All' && ticket.priority !== filters.priority) return false;
    if (filters.studio !== 'All' && ticket.studio !== filters.studio) return false;
    if (filters.category !== 'All' && ticket.category !== filters.category) return false;
    if (filters.assignee !== 'All' && ticket.assignedTo !== filters.assignee) return false;
    if (filters.sentiment !== 'All' && ticket.sentiment !== filters.sentiment) return false;
    if (filters.sla !== 'All' && getSlaState(ticket) !== filters.sla) return false;
    const tags = Array.isArray(ticket.tags) ? ticket.tags : [];
    if (tag && !tags.some((value) => value.toLowerCase().includes(tag))) return false;

    const created = new Date(ticket.createdAt).getTime();
    if (fromTime && created < fromTime) return false;
    if (toTime && created > toTime) return false;

    if (query) {
      const haystack = [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.conversationSummary,
        ticket.category,
        ticket.subCategory,
        ticket.studio,
        ticket.trainer,
        ticket.classType,
        ticket.memberName,
        ticket.memberContact,
        ticket.assignedTo,
        ticket.team,
        tags.join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

function sortNewestFirst(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function activeFilterCount(filters: Filters): string {
  const count = Object.entries(filters).filter(([key, value]) => {
    const emptyValue = EMPTY_FILTERS[key as keyof Filters];
    return value !== emptyValue && String(value).trim() !== '';
  }).length;
  return count === 0 ? 'None' : String(count);
}

const CollapseButton: React.FC<{
  open: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ open, onClick, icon, label, value }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm transition ${
      open
        ? 'border-slate-950 bg-slate-950 text-white'
        : 'border-border bg-card text-slate-700 hover:border-sky-200 hover:bg-sky-50'
    }`}
  >
    {icon}
    {label}
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${open ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground'}`}>
      {value}
    </span>
    <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
  </button>
);

const ManualTicketModal: React.FC<{
  onClose: () => void;
  onCreate: (values: ManualTicketInput) => Promise<void>;
}> = ({ onClose, onCreate }) => {
  const firstCategory = Object.keys(CATEGORIES)[0] || 'General Feedback';
  const [values, setValues] = useState<ManualTicketInput>({
    title: '',
    description: '',
    category: firstCategory,
    subCategory: CATEGORIES[firstCategory]?.[0] || 'Other',
    priority: 'Medium',
    studio: STUDIOS[0] || 'Unspecified Studio',
    assignedTo: ASSOCIATES[0]?.name || 'Nunu Yeptomi',
    tags: ['manual-entry'],
  });
  const [saving, setSaving] = useState(false);
  const subCategories = CATEGORIES[values.category] || ['Other'];

  const setValue = <K extends keyof ManualTicketInput>(key: K, value: ManualTicketInput[K]) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'category') next.subCategory = CATEGORIES[String(value)]?.[0] || 'Other';
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.title.trim() || !values.description.trim()) return;
    setSaving(true);
    try {
      await onCreate(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-stone-950/35 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="fixed left-1/2 top-1/2 z-50 grid max-h-[88vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Manual submitted ticket</div>
          <h3 className="mt-1 text-lg font-semibold text-stone-950">Add ticket</h3>
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-stone-600">
          Title
          <input value={values.title} onChange={(event) => setValue('title', event.target.value)} className="h-10 rounded-xl border border-border px-3 text-sm font-medium text-stone-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" required />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-stone-600">
          Description
          <textarea value={values.description} onChange={(event) => setValue('description', event.target.value)} rows={7} className="rounded-xl border border-border px-3 py-2 text-sm leading-relaxed text-stone-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" placeholder="Use one line per point; saved tickets will preserve readable bullets." required />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <SelectField label="Category" value={values.category} values={Object.keys(CATEGORIES)} onChange={(value) => setValue('category', value)} />
          <SelectField label="Sub-category" value={values.subCategory} values={subCategories} onChange={(value) => setValue('subCategory', value)} />
          <SelectField label="Priority" value={values.priority} values={['Critical', 'High', 'Medium', 'Low']} onChange={(value) => setValue('priority', value as Ticket['priority'])} />
          <SelectField label="Studio" value={values.studio} values={STUDIOS} onChange={(value) => setValue('studio', value)} />
          <SelectField label="Assigned to" value={values.assignedTo || ''} values={ASSOCIATES.map((associate) => associate.name)} onChange={(value) => setValue('assignedTo', value)} />
          <MomenceSessionTicketField
            classType={values.classType}
            classDateTime={values.classDateTime}
            trainer={values.trainer}
            studio={values.studio}
            onSelect={(session) => {
              setValues((current) => ({
                ...current,
                classType: session.classType || session.label,
                classDateTime: session.startsAt || null,
                trainer: session.trainer || current.trainer || null,
                studio: session.studio || current.studio,
              }));
            }}
            onClear={() => {
              setValues((current) => ({
                ...current,
                classType: null,
                classDateTime: null,
                trainer: null,
              }));
            }}
          />
          <MomenceMemberTicketField
            memberName={values.memberName}
            memberContact={values.memberContact}
            onSelect={(member) => {
              setValues((current) => ({
                ...current,
                memberName: member.name || member.label,
                memberContact: member.email || member.phoneNumber || member.description || null,
              }));
            }}
            onClear={() => {
              setValues((current) => ({
                ...current,
                memberName: null,
                memberContact: null,
              }));
            }}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-stone-600 transition hover:bg-muted">
            Cancel
          </button>
          <button type="submit" disabled={saving || !values.title.trim() || !values.description.trim()} className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? 'Saving...' : 'Save ticket'}
          </button>
        </div>
      </form>
    </>
  );
};

const SelectField: React.FC<{ label: string; value: string; values: string[] | readonly string[]; onChange: (value: string) => void }> = ({ label, value, values, onChange }) => (
  <label className="grid gap-1.5 text-xs font-semibold text-stone-600">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-stone-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
      {values.map((item) => (
        <option key={item} value={item}>{item || 'None'}</option>
      ))}
    </select>
  </label>
);

function buildStats(tickets: Ticket[], total: number) {
  return {
    total,
    visible: tickets.length,
    open: tickets.filter((ticket) => !isClosedTicket(ticket)).length,
    critical: tickets.filter((ticket) => ticket.priority === 'Critical' && !isClosedTicket(ticket)).length,
    breached: tickets.filter((ticket) => isTicketBreached(ticket)).length,
    resolved: tickets.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed').length,
  };
}

function groupTickets(tickets: Ticket[], groupBy: GroupBy) {
  const key = groupBy === 'none' ? 'all' : groupBy;
  return tickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    const group = getTicketGroupValue(ticket, key);
    acc[group] = acc[group] || [];
    acc[group].push(ticket);
    return acc;
  }, {});
}

function buildAnalytics(tickets: Ticket[]) {
  const countBy = (selector: (ticket: Ticket) => string) =>
    Object.entries(
      tickets.reduce<Record<string, number>>((acc, ticket) => {
        const key = selector(ticket) || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  const byDate = Object.entries(
    tickets.reduce<Record<string, number>>((acc, ticket) => {
      const key = new Date(ticket.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return {
    byPriority: countBy((ticket) => ticket.priority),
    byCategory: countBy((ticket) => ticket.category).slice(0, 8),
    byStudio: countBy((ticket) => ticket.studio).slice(0, 8),
    byAssignee: countBy((ticket) => ticket.assignedTo).slice(0, 8),
    bySla: countBy((ticket) => getSlaState(ticket)),
    byDate,
    drilldowns: {
      topCategories: countBy((ticket) => ticket.category).slice(0, 6),
      studioLoad: countBy((ticket) => ticket.studio).slice(0, 6),
      ownerLoad: countBy((ticket) => ticket.assignedTo).slice(0, 6),
      riskRows: tickets
        .filter((ticket) => !isRecordOnlyTicket(ticket) && (getSlaState(ticket) === 'Breached' || ticket.priority === 'Critical' || ticket.priority === 'High'))
        .slice(0, 8),
    },
    smartBriefing: buildSmartOpsBriefing(tickets),
    tickets,
  };
}

const FilterBar: React.FC<{
  filters: Filters;
  options: {
    studios: string[];
    categories: string[];
    assignees: string[];
    sentiments: string[];
  };
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onReset: () => void;
}> = ({ filters, options, onChange, onReset }) => (
  <div className="grid gap-2 rounded-2xl border border-stone-200 bg-card/72 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_14px_36px_rgba(17,24,39,0.05)] md:grid-cols-12">
    <div className="relative md:col-span-3">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-700/45" />
      <input
        type="text"
        placeholder="Search title, member, owner, tag..."
        value={filters.query}
        onChange={(event) => onChange('query', event.target.value)}
        className="h-10 w-full rounded-xl border border-stone-200 bg-card/90 pl-9 pr-3 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-900/5"
      />
    </div>
    <FilterSelect label="Status" value={filters.status} values={['All', ...STATUSES]} onChange={(value) => onChange('status', value)} />
    <FilterSelect label="Priority" value={filters.priority} values={['All', 'Critical', 'High', 'Medium', 'Low']} onChange={(value) => onChange('priority', value)} />
    <FilterSelect label="SLA" value={filters.sla} values={['All', 'Breached', 'At Risk', 'On Track', 'Closed', 'Not Required']} onChange={(value) => onChange('sla', value as SlaFilter)} />
    <FilterSelect label="Studio" value={filters.studio} values={['All', ...options.studios]} onChange={(value) => onChange('studio', value)} />
    <FilterSelect label="Category" value={filters.category} values={['All', ...options.categories]} onChange={(value) => onChange('category', value)} />
    <FilterSelect label="Assignee" value={filters.assignee} values={['All', ...options.assignees]} onChange={(value) => onChange('assignee', value)} />
    <FilterSelect label="Sentiment" value={filters.sentiment} values={['All', ...options.sentiments]} onChange={(value) => onChange('sentiment', value)} />
    <input
      type="date"
      value={filters.from}
      onChange={(event) => onChange('from', event.target.value)}
      className="h-10 rounded-xl border border-stone-200 bg-card/90 px-2 text-xs text-stone-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-900/5"
      aria-label="Created from"
    />
    <input
      type="date"
      value={filters.to}
      onChange={(event) => onChange('to', event.target.value)}
      className="h-10 rounded-xl border border-stone-200 bg-card/90 px-2 text-xs text-stone-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-900/5"
      aria-label="Created to"
    />
    <input
      type="text"
      placeholder="Tag"
      value={filters.tag}
      onChange={(event) => onChange('tag', event.target.value)}
      className="h-10 rounded-xl border border-stone-200 bg-card/90 px-3 text-xs text-stone-700 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-900/5"
    />
    <button
      onClick={onReset}
      className="h-10 rounded-xl border border-stone-200 bg-card px-3 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-stone-950"
    >
      Reset
    </button>
  </div>
);

const FilterSelect: React.FC<{ label: string; value: string; values: readonly string[]; onChange: (value: string) => void }> = ({
  label,
  value,
  values,
  onChange,
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="h-10 min-w-0 rounded-xl border border-stone-200 bg-card/90 px-2 text-xs font-medium text-stone-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-900/5"
  >
    {values.map((item) => (
      <option key={item}>{item}</option>
    ))}
  </select>
);

const ListView: React.FC<{ tickets: Ticket[]; onOpen: (ticket: Ticket) => void }> = ({ tickets, onOpen }) => (
  <section className="overflow-hidden rounded-2xl border border-stone-200 bg-card/60 shadow-[0_18px_54px_rgba(17,24,39,0.06)] backdrop-blur">
    <ViewHeader title="Recent Tickets" count={tickets.length} />
    <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} onClick={() => onOpen(ticket)} />
      ))}
    </div>
  </section>
);

const TableView: React.FC<{ tickets: Ticket[]; onOpen: (ticket: Ticket) => void }> = ({ tickets, onOpen }) => (
  <div className="overflow-hidden rounded-lg border border-stone-200 bg-card/88 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur dark:border-stone-800 dark:bg-stone-900">
    <ViewHeader title="Table Ledger" count={tickets.length} />
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1280px] table-fixed border-collapse text-left text-xs">
        <colgroup>
          <col className="w-[320px]" />
          <col className="w-[132px]" />
          <col className="w-[112px]" />
          <col className="w-[144px]" />
          <col className="w-[170px]" />
          <col className="w-[170px]" />
          <col className="w-[240px]" />
          <col className="w-[170px]" />
          <col className="w-[118px]" />
        </colgroup>
        <thead className="border-b border-border bg-slate-800 text-[10px] uppercase tracking-[0.18em] text-white dark:bg-stone-950 dark:text-stone-300">
          <tr>
            <Th>Ticket</Th>
            <Th>Status</Th>
            <Th>Priority</Th>
            <Th>SLA</Th>
            <Th>Member</Th>
            <Th>Studio</Th>
            <Th>Category</Th>
            <Th>Owner</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {tickets.map((ticket) => {
            const sla = getSlaState(ticket);
            return (
              <tr
                key={ticket.id}
                onClick={() => onOpen(ticket)}
                className="h-[70px] cursor-pointer transition hover:bg-sky-50/70 hover:text-stone-950 dark:hover:text-white"
              >
                <Td>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-stone-950 dark:text-stone-50" title={ticket.title}>{ticket.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-stone-500">{ticket.id}</div>
                  </div>
                </Td>
                <Td><PlainTableValue value={ticket.status} /></Td>
                <Td><PlainTableValue value={ticket.priority} /></Td>
                <Td>
                  <div className="flex min-w-0 items-center gap-2">
                    <SlaCountdown slaDueAt={ticket.slaDueAt} status={ticket.status} noSla={isRecordOnlyTicket(ticket)} compact className="shrink-0 ring-0" />
                    <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{sla}</span>
                  </div>
                </Td>
                <Td><Truncate value={ticket.memberName || '-'} /></Td>
                <Td><Truncate value={ticket.studio || '-'} /></Td>
                <Td>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-800 dark:text-stone-200" title={ticket.category}>{ticket.category}</div>
                    <div className="truncate text-[11px] text-stone-500" title={ticket.subCategory}>{ticket.subCategory}</div>
                  </div>
                </Td>
                <Td><Truncate value={ticket.assignedTo || '-'} /></Td>
                <Td>{new Date(ticket.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>
);

const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="min-w-0 overflow-hidden px-4 py-3 align-middle text-stone-700 dark:text-stone-300">{children}</td>
);

const Truncate: React.FC<{ value: string }> = ({ value }) => (
  <span className="block min-w-0 truncate" title={value}>{value}</span>
);

const PlainTableValue: React.FC<{ value: string }> = ({ value }) => (
  <span className="block truncate font-medium text-stone-800 dark:text-stone-200" title={value}>
    {value}
  </span>
);

const PriorityPill: React.FC<{ priority: Ticket['priority'] }> = ({ priority }) => {
  const className =
    priority === 'Critical'
      ? 'border-red-200 bg-red-600 text-white'
      : priority === 'High'
        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'
        : priority === 'Medium'
          ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
  return <span className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{priority}</span>;
};

const SlaPill: React.FC<{ state: string }> = ({ state }) => {
  const className =
    state === 'Breached'
      ? 'border-red-200 bg-red-600 text-white'
      : state === 'At Risk'
        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'
        : state === 'Closed'
          ? 'border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300'
          : state === 'Not Required'
            ? 'border-border bg-muted text-muted-foreground dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
  return <span className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{state}</span>;
};

const ViewHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5 text-white">
    <h3 className="font-serif text-base font-semibold tracking-tight">{title}</h3>
    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">
      {count} ticket{count === 1 ? '' : 's'}
    </span>
  </div>
);

const KanbanView: React.FC<{ tickets: Ticket[]; onOpen: (ticket: Ticket) => void }> = ({ tickets, onOpen }) => (
  <div className="grid min-w-[980px] grid-cols-5 gap-3">
    {STATUSES.map((status) => {
      const items = tickets.filter((ticket) => ticket.status === status);
      return (
        <section key={status} className="overflow-hidden rounded-lg border border-stone-200 bg-card/76 shadow-[0_16px_46px_rgba(17,24,39,0.06)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/70">
          <div className="flex items-center justify-between bg-slate-800 px-3 py-2 text-white">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em]">{status}</h3>
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-semibold">{items.length}</span>
          </div>
          <div className="space-y-3 p-3">
            {items.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={() => onOpen(ticket)} />
            ))}
          </div>
        </section>
      );
    })}
  </div>
);

const GroupedView: React.FC<{ groups: Record<string, Ticket[]>; onOpen: (ticket: Ticket) => void }> = ({ groups, onOpen }) => (
  <div className="space-y-4">
    {Object.entries(groups).map(([group, tickets]) => (
      <section key={group} className="overflow-hidden rounded-lg border border-stone-200 bg-card/76 shadow-[0_16px_46px_rgba(17,24,39,0.06)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/70">
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5 text-white">
          <h3 className="font-serif text-base font-semibold">{group}</h3>
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">{tickets.length} tickets</span>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => onOpen(ticket)} />
          ))}
        </div>
      </section>
    ))}
  </div>
);

const SlaView: React.FC<{ tickets: Ticket[]; onOpen: (ticket: Ticket) => void }> = ({ tickets, onOpen }) => {
  const sorted = sortNewestFirst(tickets);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-card/60 shadow-[0_18px_54px_rgba(17,24,39,0.06)] backdrop-blur">
        <ViewHeader title="SLA Queue" count={sorted.length} />
        <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
          {sorted.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => onOpen(ticket)} />
          ))}
        </div>
      </section>
      <aside className="overflow-hidden rounded-lg border border-stone-200 bg-card/80 shadow-[0_16px_46px_rgba(17,24,39,0.06)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/70">
        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white">
          <Users className="h-4 w-4" />
          Escalation routing
        </div>
        <div className="space-y-2 p-4">
          {sorted.filter((ticket) => !['Closed', 'Not Required'].includes(getSlaState(ticket))).slice(0, 12).map((ticket) => {
            const state = getSlaState(ticket);
            const target = getEscalationTarget(ticket.assignedTo);
            return (
              <button
                key={ticket.id}
                onClick={() => onOpen(ticket)}
                className="w-full rounded-lg border border-stone-200 bg-card px-3 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50/70 dark:border-stone-800 dark:bg-stone-950/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100">{ticket.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${state === 'Breached' ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white' : state === 'At Risk' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                    {state}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-stone-500">
                  {ticket.assignedTo} → {target}
                </div>
                <div className="mt-2">
                  <SlaCountdown slaDueAt={ticket.slaDueAt} status={ticket.status} noSla={isRecordOnlyTicket(ticket)} compact className="w-full justify-start ring-0" />
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

const AnalyticsView: React.FC<{ analytics: ReturnType<typeof buildAnalytics> }> = ({ analytics }) => {
  const [question, setQuestion] = useState('');
  const answer = useMemo(
    () => question.trim() ? buildNaturalLanguageAnalyticsAnswer(question, analytics.tickets) : null,
    [analytics.tickets, question]
  );

  return (
  <div className="grid gap-4 xl:grid-cols-2">
    <section className="grid gap-3 xl:col-span-2 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">Today's Ops Briefing</div>
            <div className="mt-1 text-sm font-semibold text-blue-950">Smart next actions from visible tickets</div>
          </div>
          <span className="rounded-full border border-blue-200 bg-card px-2.5 py-1 text-[10px] font-semibold text-blue-700">
            {analytics.smartBriefing.topRisks.length} risks
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {analytics.smartBriefing.nextActions.length ? analytics.smartBriefing.nextActions.map((action) => (
            <div key={action} className="rounded-xl border border-blue-100 bg-card px-3 py-2 text-xs leading-relaxed text-blue-900">{action}</div>
          )) : (
            <div className="rounded-xl border border-blue-100 bg-card px-3 py-2 text-xs text-blue-900">No urgent smart actions in the current filtered view.</div>
          )}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <SmartBriefingList title="Repeated Patterns" items={analytics.smartBriefing.repeatedPatterns} />
          <SmartBriefingList title="Studio Hotspots" items={analytics.smartBriefing.studioHotspots} />
          <SmartBriefingList title="Owner Warnings" items={analytics.smartBriefing.ownerWarnings} />
        </div>
      </div>
      <div className="rounded-lg border border-stone-200 bg-card p-4 shadow-sm">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ask Analytics</div>
        <div className="mt-2 flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about studios, complaints, risk..."
            className="h-10 min-w-0 flex-1 rounded-xl border border-stone-200 px-3 text-sm text-stone-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>
        {answer ? (
          <div className="mt-3 rounded-xl border border-border bg-muted p-3">
            <div className="text-xs font-semibold text-slate-950">{answer.title}</div>
            <div className="mt-2 space-y-1">
              {answer.lines.map((line) => (
                <div key={line} className="text-[11px] leading-relaxed text-muted-foreground">{line}</div>
              ))}
            </div>
            <div className="mt-2 text-[10px] font-medium text-slate-400">
              Sources: {answer.sourceTicketIds.slice(0, 5).join(', ') || 'none'}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-border bg-muted px-3 py-6 text-center text-xs text-muted-foreground">
            Try "Bandra top complaints" or "highest risk patterns".
          </div>
        )}
      </div>
    </section>
    <section className="grid gap-3 xl:col-span-2 md:grid-cols-4">
      <DrilldownCard title="Top Category" items={analytics.drilldowns.topCategories} tone="blue" />
      <DrilldownCard title="Studio Load" items={analytics.drilldowns.studioLoad} tone="blue" />
      <DrilldownCard title="Owner Load" items={analytics.drilldowns.ownerLoad} tone="blue" />
      <div className="rounded-lg border border-stone-900 bg-stone-950 p-4 text-white shadow-[0_18px_54px_rgba(15,23,42,0.18)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">Risk Drilldown</div>
        <div className="mt-2 text-3xl font-semibold">{analytics.drilldowns.riskRows.length}</div>
        <div className="mt-1 text-xs text-slate-300">High priority or breached tickets currently visible</div>
      </div>
    </section>
    <ChartPanel title="Priority / SLA drilldown">
      <div className="space-y-2">
        {analytics.drilldowns.riskRows.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">No high-risk tickets in the current view.</div>
        ) : analytics.drilldowns.riskRows.map((ticket) => (
          <div key={ticket.id} className="grid gap-2 rounded-lg border border-stone-200 bg-card px-3 py-2 text-xs shadow-sm md:grid-cols-[1fr_110px_150px] md:items-center">
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-950">{ticket.title}</div>
              <div className="truncate text-muted-foreground">{ticket.category} / {ticket.subCategory}</div>
            </div>
            <PriorityPill priority={ticket.priority} />
            <div className="space-y-1">
              <SlaCountdown slaDueAt={ticket.slaDueAt} status={ticket.status} noSla={isRecordOnlyTicket(ticket)} compact className="w-full justify-start ring-0" />
              <SlaPill state={getSlaState(ticket)} />
            </div>
          </div>
        ))}
      </div>
    </ChartPanel>
    <ChartPanel title="Priority distribution">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={analytics.byPriority} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
            {analytics.byPriority.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartPanel>
    <ChartPanel title="SLA health">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={analytics.bySla}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#1c1917" />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
    <ChartPanel title="Category mix">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={analytics.byCategory} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
    <ChartPanel title="Studio heatmap">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={analytics.byStudio}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={70} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
    <ChartPanel title="Created trend">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={analytics.byDate}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
    <ChartPanel title="Team workload">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={analytics.byAssignee} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  </div>
  );
};

const SmartBriefingList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div className="rounded-xl border border-blue-100 bg-card p-2.5">
    <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-blue-700">{title}</div>
    <div className="space-y-1">
      {(items.length ? items : ['No notable pattern']).slice(0, 3).map((item) => (
        <div key={item} className="truncate text-[11px] text-muted-foreground" title={item}>{item}</div>
      ))}
    </div>
  </div>
);

const ChartPanel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-lg border border-stone-200 bg-card/88 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.07)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/70">
    <h3 className="mb-3 font-serif text-base font-semibold text-stone-950 dark:text-stone-50">{title}</h3>
    {children}
  </section>
);

const DrilldownCard: React.FC<{ title: string; items: Array<{ name: string; value: number }>; tone: 'blue' }> = ({ title, items, tone }) => {
  const color = {
    blue: 'bg-blue-600',
  }[tone];
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="rounded-lg border border-stone-200 bg-card/88 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.07)] backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-slate-700">{item.name}</span>
              <span className="font-mono text-muted-foreground">{item.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number | string; icon: React.ReactNode; tone?: 'default' | 'danger' | 'warning' | 'success' | 'neutral' }> = ({
  label,
  value,
  icon,
  tone = 'default',
}) => {
  const toneClass = {
    default: 'text-stone-700 bg-stone-100',
    danger: 'text-slate-700 bg-muted',
    warning: 'text-amber-800 bg-amber-50',
    success: 'text-emerald-700 bg-emerald-50',
    neutral: 'text-indigo-700 bg-indigo-50',
  }[tone];
  return (
    <div className="group relative overflow-hidden rounded-lg border border-stone-200 bg-card/82 px-4 py-3 text-stone-900 shadow-[0_14px_34px_rgba(17,24,39,0.055)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(17,24,39,0.08)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </span>
      </div>
      <div className="mt-2 font-serif text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-stone-400">
    {icon}
    <p className="text-sm">{label}</p>
  </div>
);
