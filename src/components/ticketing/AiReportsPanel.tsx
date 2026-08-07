import React, { useEffect, useMemo, useState } from 'react';
import { useTickets } from './useTickets';
import { backendSupabase } from '@/lib/backend-supabase';
import {
  ALL_REPORT_DEFINITIONS,
  DEFAULT_REPORT_FILTERS,
  GeneratedReport,
  REPORT_BRAND,
  ReportDefinition,
  ReportFilters,
  ReportId,
  ReportNarrative,
  ReportPeriod,
  ReportSection,
  TicketReportEvent,
  buildReport,
  csvForReport,
  fallbackNarrativeForReport,
  htmlForReport,
  isTrainerReportId,
  jsonForReport,
  normalizeReportNarrativeResponse,
  paginateReportRows,
  reportPayloadForNarrative,
  reportFileSlug,
  reportRuntimeErrorMessage,
} from '@/lib/ai-reports';
import { CATEGORIES, STATUSES, Ticket } from '@/lib/ticketing-data';
import { isTrainerEvaluationProfileOnly } from '@/lib/trainer-profiles';
import { invokeTicketingFunction, withTimeout } from '@/lib/ticketing-functions';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronLeft,
  CheckCircle2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FileJson,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  MessageSquareText,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TrendingUp,
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

type PeriodPreset = '7d' | '30d' | '90d' | 'month' | 'quarter' | 'custom';

interface TicketEventRow {
  id: string;
  ticket_id: string;
  event_type: string;
  actor?: string | null;
  from_value?: string | null;
  to_value?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const CHART_COLORS = ['#2563eb', '#1d4ed8', '#0ea5e9', '#334155', '#64748b', '#475569', '#0891b2', '#0284c7'];
const PRIORITIES: Ticket['priority'][] = ['Critical', 'High', 'Medium', 'Low'];
const SLA_STATES = ['Breached', 'At Risk', 'On Track', 'Closed', 'Not Required'];
const REPORT_NARRATIVE_TIMEOUT_MS = 30000;
const SOURCE_TYPES: Array<{ value: ReportFilters['sourceType']; label: string }> = [
  { value: 'all', label: 'Live + Historic' },
  { value: 'live', label: 'Live only' },
  { value: 'historic', label: 'Historic only' },
];

type ReportFamilyId = 'executive' | 'client_feedback' | 'trainer' | 'studio_ops' | 'revenue';

interface ReportFamily {
  id: ReportFamilyId;
  title: string;
  description: string;
  primaryReportId: ReportId;
  reportIds: ReportId[];
  icon: React.ComponentType<{ className?: string }>;
}

const REPORT_FAMILIES: ReportFamily[] = [
  {
    id: 'executive',
    title: 'Executive Operations',
    description: 'Leadership KPIs, open risk, SLA health, and accountable follow-up.',
    primaryReportId: 'executive_operations_summary',
    reportIds: ['executive_operations_summary', 'sla_health_breach_risk', 'status_funnel_backlog_aging', 'owner_workload_accountability'],
    icon: TrendingUp,
  },
  {
    id: 'client_feedback',
    title: 'Client Feedback & Retention',
    description: 'Member sentiment, complaints, recurring drivers, and retention risk.',
    primaryReportId: 'member_feedback_sentiment_report',
    reportIds: ['member_feedback_sentiment_report', 'complaint_retention_risk_report', 'category_driver_analysis', 'recurring_subcategory_analysis'],
    icon: MessageSquareText,
  },
  {
    id: 'trainer',
    title: 'Trainer Performance',
    description: 'Scorecards, consolidated trainer reports, member feedback, and coaching priorities.',
    primaryReportId: 'trainer_performance_consolidated',
    reportIds: ['trainer_performance_consolidated', 'trainer_scorecard_trend', 'trainer_member_feedback_consolidated', 'trainer_coaching_priority_report', 'instructor_class_experience_feedback'],
    icon: GraduationCap,
  },
  {
    id: 'studio_ops',
    title: 'Studio Operations',
    description: 'Studio space performance, facilities, routing load, and handoff risk.',
    primaryReportId: 'studio_space_performance',
    reportIds: ['studio_space_performance', 'facility_studio_tools_environment_issues', 'department_routing_load', 'escalation_handoff_report'],
    icon: Building2,
  },
  {
    id: 'revenue',
    title: 'Revenue & Partnerships',
    description: 'Membership service requests, hosted class intelligence, and conversion signals.',
    primaryReportId: 'request_membership_service_report',
    reportIds: ['request_membership_service_report', 'hosted_class_partnership_intelligence', 'sales_consultation_conversion_signals'],
    icon: BarChart3,
  },
];

const PRIMARY_REPORT_IDS = new Set(REPORT_FAMILIES.flatMap((family) => family.reportIds));

function familyForReport(reportId: ReportId): ReportFamily {
  return REPORT_FAMILIES.find((family) => family.reportIds.includes(reportId)) || REPORT_FAMILIES[0];
}

function reportDefinition(reportId: ReportId): ReportDefinition {
  return ALL_REPORT_DEFINITIONS.find((definition) => definition.id === reportId) || ALL_REPORT_DEFINITIONS[0];
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod(): ReportPeriod {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return { from: formatDateInput(from), to: formatDateInput(to) };
}

function periodForPreset(preset: PeriodPreset): ReportPeriod {
  const now = new Date();
  const from = new Date(now);
  if (preset === '7d') from.setDate(now.getDate() - 6);
  if (preset === '30d') from.setDate(now.getDate() - 29);
  if (preset === '90d') from.setDate(now.getDate() - 89);
  if (preset === 'month') from.setDate(1);
  if (preset === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    from.setMonth(quarterStartMonth, 1);
  }
  return { from: formatDateInput(from), to: formatDateInput(now) };
}

function mapEvent(row: TicketEventRow): TicketReportEvent {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    eventType: row.event_type,
    actor: row.actor,
    fromValue: row.from_value,
    toValue: row.to_value,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function uniqueSorted(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value)))).sort((a, b) => a.localeCompare(b));
}

function downloadText(filename: string, text: string, contentType: string) {
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

function printReport(report: GeneratedReport) {
  const html = htmlForReport(report);
  const printWindow = window.open('', '_blank', 'width=1280,height=900');
  if (!printWindow) {
    downloadText(`${reportFileSlug(report)}.html`, html, 'text/html;charset=utf-8');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 350);
}

export const AiReportsPanel: React.FC = () => {
  const { tickets, loading, error, refresh, setSelectedTicket } = useTickets();
  const operationalTickets = useMemo(() => tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket)), [tickets]);
  const [selectedReportId, setSelectedReportId] = useState<ReportId>('executive_operations_summary');
  const [activeFamilyId, setActiveFamilyId] = useState<ReportFamilyId>('executive');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [period, setPeriod] = useState<ReportPeriod>(() => defaultPeriod());
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [events, setEvents] = useState<TicketReportEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [narrative, setNarrative] = useState<ReportNarrative | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAdvancedReports, setShowAdvancedReports] = useState(false);

  const activeFamily = useMemo(
    () => REPORT_FAMILIES.find((family) => family.id === activeFamilyId) || familyForReport(selectedReportId),
    [activeFamilyId, selectedReportId]
  );
  const activeFamilyReports = useMemo(
    () => activeFamily.reportIds.map(reportDefinition),
    [activeFamily]
  );
  const advancedReports = useMemo(
    () => ALL_REPORT_DEFINITIONS.filter((definition) => !PRIMARY_REPORT_IDS.has(definition.id)),
    []
  );
  const reportTickets = useMemo(
    () => isTrainerReportId(selectedReportId) ? tickets : operationalTickets,
    [operationalTickets, selectedReportId, tickets]
  );

  const options = useMemo(() => ({
    studios: uniqueSorted(reportTickets.map((ticket) => ticket.studio)),
    categories: uniqueSorted([...Object.keys(CATEGORIES), ...reportTickets.map((ticket) => ticket.category)]),
    owners: uniqueSorted(reportTickets.map((ticket) => ticket.assignedTo)),
    sentiments: uniqueSorted(reportTickets.map((ticket) => ticket.sentiment || 'Unspecified')),
  }), [reportTickets]);

  useEffect(() => {
    let cancelled = false;
    const ids = tickets.filter((ticket) => !ticket.tags.includes('historic')).map((ticket) => ticket.id).filter(Boolean);
    if (ids.length === 0) {
      setEvents([]);
      return;
    }

    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError('');
      try {
        const rows: TicketEventRow[] = [];
        for (let index = 0; index < ids.length; index += 100) {
          const batch = ids.slice(index, index + 100);
          const { data, error: eventError } = await backendSupabase
            .from('ticket_events')
            .select('id,ticket_id,event_type,actor,from_value,to_value,metadata,created_at')
            .in('ticket_id', batch)
            .order('created_at', { ascending: true });
          if (eventError) throw eventError;
          rows.push(...((data || []) as TicketEventRow[]));
        }
        if (!cancelled) setEvents(rows.map(mapEvent));
      } catch (eventLoadError) {
        if (!cancelled) {
          setEvents([]);
          setEventsError(reportRuntimeErrorMessage(eventLoadError, 'Ticket event data could not be reached'));
        }
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [tickets]);

  const report = useMemo(() => {
    const built = buildReport({
      reportId: selectedReportId,
      tickets: reportTickets,
      events,
      period,
      filters,
    });
    return narrative ? { ...built, narrative } : built;
  }, [events, filters, narrative, period, reportTickets, selectedReportId]);

  const ticketById = useMemo(() => new Map(reportTickets.map((ticket) => [ticket.id, ticket])), [reportTickets]);

  const setFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setNarrative(null);
    setSummaryError('');
  };

  const setPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset !== 'custom') setPeriod(periodForPreset(preset));
    setNarrative(null);
    setSummaryError('');
  };

  const selectReport = (reportId: ReportId) => {
    setSelectedReportId(reportId);
    setActiveFamilyId(familyForReport(reportId).id);
    setNarrative(null);
    setSummaryError('');
  };

  const selectFamily = (family: ReportFamily) => {
    setActiveFamilyId(family.id);
    setSelectedReportId(family.primaryReportId);
    setNarrative(null);
    setSummaryError('');
  };

  const generateAiSummary = async () => {
    if (report.reportTickets === 0) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const { data, error: invokeError } = await withTimeout(
        invokeTicketingFunction('ticket-ai-chat', {
          body: {
            ...reportPayloadForNarrative(report),
            aiProvider: 'openai',
          },
        }),
        REPORT_NARRATIVE_TIMEOUT_MS,
        'Athena report summary timed out'
      );
      if (invokeError) throw invokeError;
      setNarrative(normalizeReportNarrativeResponse(data, report));
    } catch (summaryError) {
      setNarrative(fallbackNarrativeForReport(report));
      setSummaryError(reportRuntimeErrorMessage(summaryError, 'Athena summary service could not be reached. Showing computed summary instead.'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const exportCsv = () => downloadText(`${reportFileSlug(report)}.csv`, csvForReport(report), 'text/csv;charset=utf-8');
  const exportJson = () => downloadText(`${reportFileSlug(report)}.json`, jsonForReport(report), 'application/json;charset=utf-8');
  const exportHtml = () => downloadText(`${reportFileSlug(report)}.html`, htmlForReport(report), 'text/html;charset=utf-8');

  return (
    <div className="ai-reports-shell flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="report-screen-only flex-shrink-0 border-b border-border bg-card/95 px-5 py-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <FileText className="h-4 w-4" />
              {REPORT_BRAND.product}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Build a Report</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Guided reports with computed source data first, optional Athena executive summaries, and detailed drilldowns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing || loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh data
            </button>
            <button
              type="button"
              onClick={generateAiSummary}
              disabled={summaryLoading || report.reportTickets === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className={`h-3.5 w-3.5 ${summaryLoading ? 'animate-pulse' : ''}`} />
              {summaryLoading ? 'Generating...' : 'Generate AI summary'}
            </button>
            <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              CSV
            </button>
            <button type="button" onClick={exportJson} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
              <FileJson className="h-3.5 w-3.5" />
              JSON
            </button>
            <button type="button" onClick={exportHtml} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
              <FileText className="h-3.5 w-3.5" />
              HTML
            </button>
            <button type="button" onClick={() => printReport(report)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
              <Printer className="h-3.5 w-3.5" />
              Print/PDF
            </button>
          </div>
        </div>

      </header>

      <main className="ai-report-print min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1540px] gap-5">
          <ReportPrintHeader report={report} />
          {(error || eventsError) && (
            <div className="grid gap-2">
              {error && <AlertMessage tone="danger" text={error} />}
              {eventsError && <AlertMessage tone="warning" text={`Event data unavailable: ${eventsError}. Lifecycle reports will use ticket metadata fallback.`} />}
            </div>
          )}

          <section className="report-screen-only rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">1. Choose a report family</h3>
                <p className="mt-1 text-xs text-muted-foreground">Five core report families stay visible. Detailed and advanced reports remain available without cluttering the first view.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedReports((current) => !current)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-card"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {showAdvancedReports ? 'Hide advanced reports' : 'Advanced reports'}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {REPORT_FAMILIES.map((family) => (
                <ReportFamilyButton
                  key={family.id}
                  family={family}
                  selected={family.id === activeFamily.id}
                  reportCount={family.reportIds.length}
                  onSelect={() => selectFamily(family)}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-2 lg:grid-cols-5">
              {activeFamilyReports.map((definition) => (
                <ReportPresetButton
                  key={definition.id}
                  definition={definition}
                  selected={definition.id === selectedReportId}
                  onSelect={() => selectReport(definition.id)}
                />
              ))}
            </div>
            {showAdvancedReports && (
              <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Advanced Report Catalog
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {advancedReports.map((definition) => (
                    <ReportPresetButton
                      key={definition.id}
                      definition={definition}
                      selected={definition.id === selectedReportId}
                      onSelect={() => selectReport(definition.id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="report-screen-only rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">2. Set report scope</h3>
                <p className="mt-1 text-xs text-muted-foreground">Keep the core scope visible. Use advanced filters only when the report needs narrowing.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((current) => !current)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-card"
              >
                <Filter className="h-3.5 w-3.5" />
                {showAdvancedFilters ? 'Hide filters' : 'More filters'}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <FilterSelect label="Report preset" value={selectedReportId} values={activeFamilyReports.map((definition) => [definition.id, definition.title])} onChange={(value) => selectReport(value as ReportId)} />
              <FilterSelect label="Period" value={periodPreset} values={[
                ['7d', '7 days'],
                ['30d', '30 days'],
                ['90d', '90 days'],
                ['month', 'This month'],
                ['quarter', 'This quarter'],
                ['custom', 'Custom'],
              ]} onChange={(value) => setPreset(value as PeriodPreset)} />
              <DateInput label="From" value={period.from} onChange={(value) => {
                setPeriodPreset('custom');
                setPeriod((current) => ({ ...current, from: value }));
                setNarrative(null);
                setSummaryError('');
              }} />
              <DateInput label="To" value={period.to} onChange={(value) => {
                setPeriodPreset('custom');
                setPeriod((current) => ({ ...current, to: value }));
                setNarrative(null);
                setSummaryError('');
              }} />
              <FilterSelect label="Source" value={filters.sourceType} values={SOURCE_TYPES.map((item) => [item.value, item.label])} onChange={(value) => setFilter('sourceType', value as ReportFilters['sourceType'])} />
            </div>
            {showAdvancedFilters && (
              <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                <TextFilter value={filters.query} onChange={(value) => setFilter('query', value)} />
                <FilterSelect label="Studio" value={filters.studio} values={['All', ...options.studios]} onChange={(value) => setFilter('studio', value)} />
                <FilterSelect label="Category" value={filters.category} values={['All', ...options.categories]} onChange={(value) => setFilter('category', value)} />
                <FilterSelect label="Priority" value={filters.priority} values={['All', ...PRIORITIES]} onChange={(value) => setFilter('priority', value)} />
                <FilterSelect label="Status" value={filters.status} values={['All', ...STATUSES]} onChange={(value) => setFilter('status', value)} />
                <FilterSelect label="Owner" value={filters.owner} values={['All', ...options.owners]} onChange={(value) => setFilter('owner', value)} />
                <FilterSelect label="SLA" value={filters.sla} values={['All', ...SLA_STATES]} onChange={(value) => setFilter('sla', value)} />
                <input
                  value={filters.tag}
                  onChange={(event) => setFilter('tag', event.target.value)}
                  placeholder="Tag"
                  className="h-11 rounded-xl border border-border bg-card px-3 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            )}
          </section>

          {loading && reportTickets.length === 0 ? (
            <EmptyState label="Loading tickets for reporting..." />
          ) : report.reportTickets === 0 ? (
            <EmptyState label="No tickets match the selected report period and filters." />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="grid gap-5">
                <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                          <BarChart3 className="h-4 w-4" />
                          {report.definition.group}
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{report.definition.title}</h1>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{report.definition.description}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-slate-50 px-4 py-3 text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Period</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{report.period.from} to {report.period.to}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{report.reportTickets} report tickets · {report.allTicketsInPeriod} period tickets</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Detailed KPIs</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Computed from the filtered source register and report-specific logic.</p>
                    </div>
                    <ReportBadge tone="neutral" minWidth="min-w-[84px]">Computed</ReportBadge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
                    {report.metrics.slice(0, 10).map((metric) => (
                      <MetricCard key={metric.id} metric={metric} />
                    ))}
                  </div>
                </section>

                <section className="grid gap-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Detailed Analysis</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Charts, ranked drivers, and trainer intelligence stay detailed below the simplified builder.</p>
                    </div>
                  </div>
                  <div className="grid gap-5 2xl:grid-cols-2">
                    {report.sections.map((section) => (
                      <ReportSectionPanel key={section.id} section={section} />
                    ))}
                  </div>
                </section>

                <SourceRowsTable report={report} ticketById={ticketById} onOpen={setSelectedTicket} />
              </div>

              <aside className="report-screen-only min-h-0">
                <NarrativePanel
                  report={report}
                  eventsLoading={eventsLoading}
                  summaryLoading={summaryLoading}
                  summaryError={summaryError}
                  onGenerate={generateAiSummary}
                />
              </aside>
            </div>
          )}
          <ReportPrintFooter />
        </div>
      </main>
    </div>
  );
};

const ReportFamilyButton: React.FC<{
  family: ReportFamily;
  selected: boolean;
  reportCount: number;
  onSelect: () => void;
}> = ({ family, selected, reportCount, onSelect }) => {
  const Icon = family.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group min-h-[132px] rounded-2xl border p-4 text-left transition ${
        selected
          ? 'border-slate-300 bg-slate-950 text-white shadow-sm'
          : 'border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? 'bg-white/10 text-white' : 'bg-slate-100 text-muted-foreground group-hover:bg-slate-950 group-hover:text-white'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${selected ? 'border-white/15 bg-white/10 text-slate-100' : 'border-border bg-slate-50 text-muted-foreground'}`}>
          {reportCount} reports
        </span>
      </div>
      <div className="mt-4 text-sm font-semibold">{family.title}</div>
      <p className={`mt-2 text-xs leading-relaxed ${selected ? 'text-slate-300' : 'text-muted-foreground'}`}>{family.description}</p>
    </button>
  );
};

const ReportPresetButton: React.FC<{
  definition: ReportDefinition;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}> = ({ definition, selected, onSelect, compact = false }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`group w-full rounded-xl border text-left transition ${
      selected
        ? 'border-blue-200 bg-blue-50 shadow-sm'
        : 'border-border bg-card hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
    } ${compact ? 'p-2.5' : 'p-3'}`}
  >
    <div className="flex items-start gap-2">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold leading-snug text-foreground">{definition.title}</span>
        {!compact && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{definition.bestFor}</span>}
      </span>
      <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-blue-700' : 'text-slate-300'}`} />
    </div>
  </button>
);

const ReportPrintHeader: React.FC<{ report: GeneratedReport }> = ({ report }) => (
  <div className="report-print-brand">
    <div>
      <div className="report-print-brand-label">Physique 57 India</div>
      <div className="report-print-brand-title">{report.definition.title}</div>
      <div className="report-print-brand-subtitle">{report.definition.description}</div>
    </div>
    <div className="report-print-brand-meta">
      {REPORT_BRAND.product}<br />
      {report.period.from} to {report.period.to}<br />
      {report.reportTickets} report tickets
    </div>
  </div>
);

const ReportPrintFooter: React.FC = () => (
  <div className="report-print-footer">
    <span>{REPORT_BRAND.footer}</span>
    <span>{REPORT_BRAND.context}</span>
  </div>
);

const FilterSelect: React.FC<{
  label: string;
  value: string;
  values: Array<string | readonly [string, string]> | readonly string[];
  onChange: (value: string) => void;
}> = ({ label, value, values, onChange }) => (
  <label className="min-w-0">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      aria-label={label}
    >
      {values.map((item) => {
        const optionValue = Array.isArray(item) ? item[0] : item;
        const optionLabel = Array.isArray(item) ? item[1] : item;
        return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
      })}
    </select>
  </label>
);

const DateInput: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="min-w-0">
    <span className="sr-only">{label}</span>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-xl border border-border bg-card px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      aria-label={label}
    />
  </label>
);

const TextFilter: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div className="relative md:col-span-2 xl:col-span-1">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search"
      className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
    />
  </div>
);

const AlertMessage: React.FC<{ tone: 'warning' | 'danger'; text: string }> = ({ tone, text }) => (
  <div className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs ${
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'
  }`}>
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <span>{text}</span>
  </div>
);

const MetricCard: React.FC<{ metric: GeneratedReport['metrics'][number] }> = ({ metric }) => {
  const accent = {
    neutral: 'bg-slate-300 text-slate-700',
    success: 'bg-emerald-500 text-emerald-700',
    warning: 'bg-amber-500 text-amber-700',
    danger: 'bg-red-500 text-red-700',
    info: 'bg-blue-500 text-blue-700',
  }[metric.tone || 'neutral'];
  return (
    <div className="min-h-[132px] rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</div>
        <span className={`h-2 w-2 rounded-full ${accent.split(' ')[0]}`} />
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${accent.split(' ')[1]}`}>{metric.value}</div>
      {metric.description && <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{metric.description}</div>}
    </div>
  );
};

const ReportSectionPanel: React.FC<{ section: ReportSection }> = ({ section }) => (
  <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
      <ReportBadge tone="neutral" minWidth="min-w-[68px]">{section.kind}</ReportBadge>
    </div>
    {section.kind === 'line' ? (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={section.rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    ) : section.kind === 'donut' ? (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={section.rows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
            {section.rows.map((row, index) => (
              <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    ) : section.kind === 'bar' ? (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={section.rows} layout={section.rows.length > 5 ? 'vertical' : 'horizontal'} margin={section.rows.length > 5 ? { left: 24 } : undefined}>
          <CartesianGrid strokeDasharray="3 3" horizontal={section.rows.length <= 5} vertical={section.rows.length > 5} />
          {section.rows.length > 5 ? (
            <>
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={135} tickLine={false} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            </>
          )}
          <Tooltip />
          <Bar dataKey="value" radius={section.rows.length > 5 ? [0, 8, 8, 0] : [8, 8, 0, 0]} fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <RankedRows rows={section.rows} />
    )}
  </section>
);

const RankedRows: React.FC<{ rows: ReportSection['rows'] }> = ({ rows }) => {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.slice(0, 12).map((row) => (
        <div key={`${row.name}-${row.secondaryValue || ''}`} className="rounded-xl border border-border bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-foreground">{row.name}</span>
            <span className="font-mono text-muted-foreground">{row.value}{row.percent != null ? ` · ${row.percent}%` : ''}</span>
          </div>
          {row.secondaryValue && <div className="mt-1 truncate text-[11px] text-muted-foreground">{row.secondaryValue}</div>}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
            <div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const SourceRowsTableMarkup: React.FC<{
  rows: GeneratedReport['sourceRows'];
  ticketById: Map<string, Ticket>;
  onOpen: (ticket: Ticket) => void;
  interactive?: boolean;
}> = ({ rows, ticketById, onOpen, interactive = true }) => (
  <div className="report-source-table-wrap overflow-x-auto">
    <table className="report-source-table w-full min-w-[1280px] table-fixed text-left text-xs">
      <colgroup>
        <col className="w-[280px]" />
        <col className="w-[116px]" />
        <col className="w-[100px]" />
        <col className="w-[116px]" />
        <col className="w-[104px]" />
        <col className="w-[240px]" />
        <col className="w-[160px]" />
        <col className="w-[160px]" />
        <col className="w-[116px]" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        <tr>
          {['Ticket', 'Status', 'Priority', 'SLA', 'Source', 'Category', 'Studio', 'Owner', 'Created'].map((heading) => (
            <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const ticket = ticketById.get(row.ticketId);
          return (
            <tr
              key={row.ticketId}
              onClick={() => interactive && ticket && onOpen(ticket)}
              className={`h-16 border-b border-slate-100 ${interactive && ticket ? 'cursor-pointer hover:text-foreground' : ''}`}
            >
              <td className="h-16 px-4 py-2 align-middle">
                <div className="flex h-10 min-w-0 flex-col justify-center">
                  <div className="truncate font-semibold text-foreground" title={row.title}>{row.title}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-400">{row.ticketId}</div>
                </div>
              </td>
              <td className="h-16 whitespace-nowrap px-4 py-2 align-middle font-medium text-slate-700">{row.status}</td>
              <td className="h-16 whitespace-nowrap px-4 py-2 align-middle font-medium text-slate-700">{row.priority}</td>
              <td className="h-16 whitespace-nowrap px-4 py-2 align-middle font-medium text-slate-700">{row.slaState}</td>
              <td className="h-16 whitespace-nowrap px-4 py-2 align-middle font-medium text-slate-700">{row.sourceType}</td>
              <td className="h-16 px-4 py-2 align-middle">
                <div className="flex h-10 min-w-0 flex-col justify-center">
                  <div className="truncate font-medium text-slate-700" title={row.category}>{row.category}</div>
                  <div className="truncate text-[11px] text-muted-foreground" title={row.subCategory}>{row.subCategory}</div>
                </div>
              </td>
              <td className="h-16 truncate px-4 py-2 align-middle text-muted-foreground" title={row.studio}>{row.studio}</td>
              <td className="h-16 truncate px-4 py-2 align-middle text-muted-foreground" title={row.owner}>{row.owner}</td>
              <td className="h-16 whitespace-nowrap px-4 py-2 align-middle text-muted-foreground tabular-nums">{new Date(row.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const SourceRowsTable: React.FC<{
  report: GeneratedReport;
  ticketById: Map<string, Ticket>;
  onOpen: (ticket: Ticket) => void;
}> = ({ report, ticketById, onOpen }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pagination = useMemo(
    () => paginateReportRows(report.sourceRows, page, pageSize),
    [page, pageSize, report.sourceRows]
  );

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), pagination.totalPages));
  }, [pagination.totalPages]);

  useEffect(() => {
    setPage(1);
  }, [
    report.definition.id,
    report.period.from,
    report.period.to,
    report.filters.category,
    report.filters.owner,
    report.filters.priority,
    report.filters.query,
    report.filters.sentiment,
    report.filters.sla,
    report.filters.sourceType,
    report.filters.status,
    report.filters.studio,
    report.filters.tag,
  ]);

  return (
    <section className="report-source-section overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white"><Table2 className="h-4 w-4" /></span>
            Source Ticket Register
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Primary report table with every source row behind the computed metrics.</p>
        </div>
        <div className="report-screen-controls flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-lg border border-border bg-slate-50 px-3 text-xs font-semibold text-muted-foreground tabular-nums">
            {pagination.startRow}-{pagination.endRow} of {pagination.totalRows}
          </span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            aria-label="Rows per page"
          >
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
          </select>
          <div className="flex items-center rounded-lg border border-border bg-card p-1">
            <PaginationButton label="First page" disabled={pagination.page <= 1} onClick={() => setPage(1)}><ChevronsLeft className="h-3.5 w-3.5" /></PaginationButton>
            <PaginationButton label="Previous page" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /></PaginationButton>
            <span className="px-2 text-xs font-semibold text-muted-foreground">{pagination.page} / {pagination.totalPages}</span>
            <PaginationButton label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}><ChevronRight className="h-3.5 w-3.5" /></PaginationButton>
            <PaginationButton label="Last page" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)}><ChevronsRight className="h-3.5 w-3.5" /></PaginationButton>
          </div>
        </div>
      </div>
      <div className="report-screen-table">
        <SourceRowsTableMarkup rows={pagination.rows} ticketById={ticketById} onOpen={onOpen} />
      </div>
      <div className="report-print-table">
        <SourceRowsTableMarkup rows={report.sourceRows} ticketById={ticketById} onOpen={onOpen} interactive={false} />
      </div>
    </section>
  );
};

const PaginationButton: React.FC<{
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}> = ({ children, disabled, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-slate-100 hover:text-foreground disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
    aria-label={label}
  >
    {children}
  </button>
);

type ReportBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const ReportBadge: React.FC<{ children: React.ReactNode; tone?: ReportBadgeTone; minWidth?: string }> = ({
  children,
  tone = 'neutral',
  minWidth = 'min-w-[72px]',
}) => {
  const toneClass = {
    neutral: 'border-border bg-slate-50 text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone];
  return (
    <span className={`inline-flex h-6 ${minWidth} items-center justify-center rounded-md border px-2 text-[11px] font-semibold leading-none ${toneClass}`}>
      {children}
    </span>
  );
};

const NarrativePanel: React.FC<{
  report: GeneratedReport;
  eventsLoading: boolean;
  summaryLoading: boolean;
  summaryError: string;
  onGenerate: () => void;
}> = ({ report, eventsLoading, summaryLoading, summaryError, onGenerate }) => {
  const narrative = report.narrative || fallbackNarrativeForReport(report);
  const generatedByAi = Boolean(report.narrative?.generatedByAi);
  return (
    <div className="sticky top-5 flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-slate-950 p-4 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            {generatedByAi ? 'Athena AI Summary' : 'Computed Summary'}
          </div>
          {generatedByAi ? <Sparkles className="h-4 w-4 text-slate-300" /> : <CheckCircle2 className="h-4 w-4 text-slate-300" />}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-100">{narrative.summary}</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          {generatedByAi
            ? 'AI narrative generated from deterministic KPIs, sections, data-quality notes, and top source rows.'
            : 'Computed summary is available immediately. Generate an AI summary when the report is ready to share.'}
        </div>
        {summaryError && (
          <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {summaryError}
          </div>
        )}
        <button
          type="button"
          onClick={onGenerate}
          disabled={summaryLoading || report.reportTickets === 0}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className={`h-3.5 w-3.5 ${summaryLoading ? 'animate-pulse' : ''}`} />
          {summaryLoading ? 'Generating Athena summary...' : generatedByAi ? 'Regenerate AI summary' : 'Upgrade with Athena'}
        </button>
      </section>

      <NarrativeList title="Findings" items={narrative.findings} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
      <NarrativeList title="Risks" items={narrative.risks} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} />
      <NarrativeList title="Recommended Actions" items={narrative.recommendedActions} icon={<FileText className="h-4 w-4 text-slate-700" />} />
      <NarrativeList title="Data Quality Notes" items={Array.from(new Set([...report.dataQualityNotes, ...narrative.dataQualityNotes]))} icon={<CalendarDays className="h-4 w-4 text-blue-600" />} />
      <NarrativeList title="Assumptions" items={report.assumptions} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />

      <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
        Event data: {eventsLoading ? 'Loading ticket lifecycle events...' : 'Loaded when available. Historic imports may not include events.'}
      </div>
    </div>
  );
};

const NarrativeList: React.FC<{ title: string; items: string[]; icon: React.ReactNode }> = ({ title, items, icon }) => (
  <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</h3>
    <div className="flex flex-col gap-2">
      {(items.length ? items : ['No specific items generated for this section.']).map((item) => (
        <div key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{item}</div>
      ))}
    </div>
  </section>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-card/70 text-center">
    <BarChart3 className="h-10 w-10 text-slate-300" />
    <div className="mt-3 text-sm font-semibold text-slate-700">{label}</div>
    <div className="mt-1 text-xs text-muted-foreground">Adjust the report period or filters to widen the dataset.</div>
  </div>
);

export default AiReportsPanel;
