import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMomenceMemberToSessionForFree,
  addMomenceMemberToWaitlist,
  assignMomenceTag,
  cancelMomenceBooking,
  cancelMomenceRecurringBooking,
  checkInMomenceBooking,
  createMomenceMember,
  createMomenceReportRun,
  deleteMomenceMemberPhoneNumbers,
  freezeMomenceMembership,
  getMomenceCompatibleMemberships,
  getMomenceCheckoutPrices,
  getMomenceMemberMembershipHistory,
  getMomencePaymentTransaction,
  getMomenceReportRun,
  listMomenceAppointmentReservations,
  listMomenceMembers,
  listMomenceSales,
  loadMomenceTicketContext,
  mapMomenceMembershipToInsight,
  MomenceAppointmentReservation,
  MomenceMemberOption,
  MomenceMembershipInsight,
  MomenceSale,
  MomenceSessionOption,
  MomenceTicketContext,
  performMomenceCheckout,
  removeMomenceBookingCheckIn,
  removeScheduledMomenceMembershipUnfreeze,
  searchMomenceSessions,
  unassignMomenceTag,
  unfreezeMomenceMembership,
  updateMomenceMemberEmail,
  updateMomenceMemberName,
  updateMomenceMemberPhoneNumber,
  updateMomenceMembershipCredits,
} from '@/lib/momence-api';
import {
  createMomenceReportCard,
  deleteMomenceReportCard,
  listMomenceReportCards,
  MomenceReportCard,
  runMomenceReportCard,
} from '@/lib/momence-report-cards';
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tag,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

const emptyState: MomenceTicketContext = {
  memberships: [],
  memberBookings: [],
  notes: [],
  sessionBookings: [],
  tags: [],
  summary: {
    membershipOverview: { activeCount: 0, frozenCount: 0, memberships: [] },
    bookingOverview: {
      totalLoaded: 0,
      checkedInCount: 0,
      cancelledCount: 0,
      recentBookings: [],
    },
    noteOverview: { count: 0 },
    availableTagCount: 0,
    ticketContextLines: [],
  },
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function toApiDateTime(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object.');
  }
  return parsed as Record<string, unknown>;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.slice(-1)[0] };
}

async function confirmed(message: string, action: () => Promise<unknown>) {
  if (!window.confirm(message)) return false;
  await action();
  return true;
}

const TabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${
      active
        ? 'bg-slate-950 text-white shadow-sm'
        : 'border border-border bg-card text-muted-foreground hover:bg-muted'
    }`}
  >
    {icon}
    {label}
  </button>
);

const ActionBtn: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
}> = ({ children, onClick, disabled = false, loading = false, tone = 'primary' }) => {
  const colors = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40',
    danger: 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-40',
    neutral: 'border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed ${colors[tone]}`}
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
};

const Pill: React.FC<{ children: React.ReactNode; tone?: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' }> = ({ children, tone = 'slate' }) => {
  const colors = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    slate: 'border-border bg-muted text-muted-foreground',
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors[tone]}`}>{children}</span>;
};

const Toolbar: React.FC<{
  query: string;
  onQueryChange: (value: string) => void;
  children?: React.ReactNode;
  placeholder: string;
}> = ({ query, onQueryChange, children, placeholder }) => (
  <div className="flex flex-col gap-2 border-b border-border bg-card p-3 md:flex-row md:items-center">
    <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted px-3">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const FieldLine: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[98px_1fr] gap-2 border-b border-border py-1.5 text-xs last:border-0">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words text-foreground">{value || '-'}</span>
  </div>
);

export const StandaloneMomencePanel: React.FC = () => {
  const [activeView, setActiveView] = useState<'members' | 'sessions' | 'operations'>('members');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'with-active-membership'>('all');
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionType, setSessionType] = useState<'private' | 'fitness' | 'course' | 'special-event'>('private');
  const [members, setMembers] = useState<MomenceMemberOption[]>([]);
  const [sessions, setSessions] = useState<MomenceSessionOption[]>([]);
  const [selectedMember, setSelectedMember] = useState<MomenceMemberOption | null>(null);
  const [selectedSession, setSelectedSession] = useState<MomenceSessionOption | null>(null);
  const [data, setData] = useState<MomenceTicketContext>(emptyState);
  const [sales, setSales] = useState<MomenceSale[]>([]);
  const [appointments, setAppointments] = useState<MomenceAppointmentReservation[]>([]);
  const [reportRunId, setReportRunId] = useState('');
  const [reportJson, setReportJson] = useState('{\n  "reportType": "total-sales",\n  "hostId": 745,\n  "dateRange": {\n    "from": "2026-01-01T00:00:00.000Z",\n    "to": "2026-01-30T00:00:00.000Z"\n  },\n  "includeRefunds": true,\n  "saleTypes": ["membership"]\n}');
  const [checkoutMode, setCheckoutMode] = useState<'prices' | 'compatible' | 'checkout'>('prices');
  const [checkoutJson, setCheckoutJson] = useState('{\n  "memberId": 0,\n  "items": []\n}');
  const [operationResult, setOperationResult] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [freezeAt, setFreezeAt] = useState('');
  const [unfreezeAt, setUnfreezeAt] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [eventCreditsLeft, setEventCreditsLeft] = useState('');
  const [moneyCreditsLeft, setMoneyCreditsLeft] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateMember, setShowCreateMember] = useState(false);
  const [newMemberFirstName, setNewMemberFirstName] = useState('');
  const [newMemberLastName, setNewMemberLastName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [showMembershipHistory, setShowMembershipHistory] = useState(false);
  const [membershipHistory, setMembershipHistory] = useState<MomenceMembershipInsight[]>([]);
  const [loadingMembershipHistory, setLoadingMembershipHistory] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [reportCards, setReportCards] = useState<MomenceReportCard[]>([]);
  const [loadingReportCards, setLoadingReportCards] = useState(false);
  const [showCreateReportCard, setShowCreateReportCard] = useState(false);
  const [newReportCardTitle, setNewReportCardTitle] = useState('');
  const [runningReportCardId, setRunningReportCardId] = useState('');

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    setError(null);
    try {
      const query = memberQuery.trim();
      setMembers(await listMomenceMembers({
        query: query.length >= 2 ? query : undefined,
        pageSize: 40,
        filterPreset: memberFilter === 'with-active-membership' ? memberFilter : undefined,
      }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load Momence members.');
    } finally {
      setLoadingMembers(false);
    }
  }, [memberFilter, memberQuery]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      setSessions(await searchMomenceSessions(sessionQuery, { types: [sessionType] }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load Momence sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, [sessionQuery, sessionType]);

  const loadOperations = useCallback(async () => {
    setLoadingOperations(true);
    setError(null);
    try {
      const [nextSales, nextAppointments] = await Promise.all([
        listMomenceSales(0, 12),
        listMomenceAppointmentReservations(0, 12),
      ]);
      setSales(nextSales);
      setAppointments(nextAppointments);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load Momence operational data.');
    } finally {
      setLoadingOperations(false);
    }
  }, []);

  const loadReportCards = useCallback(async () => {
    setLoadingReportCards(true);
    setError(null);
    try {
      setReportCards(await listMomenceReportCards());
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load saved Momence report cards.');
    } finally {
      setLoadingReportCards(false);
    }
  }, []);

  const handleCreateReportCard = async () => {
    if (!newReportCardTitle.trim()) {
      setError('Give the report card a title.');
      return;
    }
    setActionLoading('create-report-card');
    setError(null);
    try {
      const parameters = parseJsonObject(reportJson);
      await createMomenceReportCard(newReportCardTitle, parameters);
      setNotice('Report card saved.');
      setShowCreateReportCard(false);
      setNewReportCardTitle('');
      await loadReportCards();
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to save report card.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunReportCard = async (card: MomenceReportCard) => {
    setRunningReportCardId(card.id);
    setError(null);
    try {
      const updated = await runMomenceReportCard(card);
      setReportCards((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to run report card.');
    } finally {
      setRunningReportCardId('');
    }
  };

  const handleDeleteReportCard = async (card: MomenceReportCard) => {
    const didRun = await confirmed(`Delete report card "${card.title}"?`, () => deleteMomenceReportCard(card.id));
    if (didRun) {
      setNotice('Report card deleted.');
      await loadReportCards();
    }
  };

  const loadContext = useCallback(async () => {
    if (!selectedMember && !selectedSession) {
      setData(emptyState);
      return;
    }
    setLoadingContext(true);
    setError(null);
    try {
      setData(await loadMomenceTicketContext({
        memberId: selectedMember?.id,
        sessionId: selectedSession?.id,
        includeTags: true,
      }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load selected Momence context.');
    } finally {
      setLoadingContext(false);
    }
  }, [selectedMember, selectedSession]);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadMembers(), 250);
    return () => window.clearTimeout(handle);
  }, [loadMembers]);

  useEffect(() => {
    const handle = window.setTimeout(() => void loadSessions(), 250);
    return () => window.clearTimeout(handle);
  }, [loadSessions]);

  useEffect(() => {
    if (activeView === 'operations' && sales.length === 0 && appointments.length === 0) void loadOperations();
  }, [activeView, appointments.length, loadOperations, sales.length]);

  useEffect(() => {
    if (activeView === 'operations' && reportCards.length === 0) void loadReportCards();
  }, [activeView, loadReportCards, reportCards.length]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (data.member) {
      setProfileFirstName(data.member.firstName || splitName(selectedMember?.label || '').firstName);
      setProfileLastName(data.member.lastName || splitName(selectedMember?.label || '').lastName);
      setProfileEmail(data.member.email || selectedMember?.email || '');
      setProfilePhone(data.member.phoneNumber || selectedMember?.phoneNumber || '');
      return;
    }
    if (selectedMember) {
      const parsedName = splitName(selectedMember.label);
      setProfileFirstName(parsedName.firstName);
      setProfileLastName(parsedName.lastName);
      setProfileEmail(selectedMember.email || '');
      setProfilePhone(selectedMember.phoneNumber || '');
    }
  }, [data.member, selectedMember]);

  useEffect(() => {
    setShowMembershipHistory(false);
    setMembershipHistory([]);
  }, [selectedMember?.id]);

  const toggleMembershipHistory = async () => {
    if (showMembershipHistory) {
      setShowMembershipHistory(false);
      return;
    }
    if (!selectedMember) return;
    setShowMembershipHistory(true);
    if (membershipHistory.length > 0) return;
    setLoadingMembershipHistory(true);
    setError(null);
    try {
      const rows = await getMomenceMemberMembershipHistory(selectedMember.id);
      setMembershipHistory(rows.map(mapMomenceMembershipToInsight));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to load membership history.');
    } finally {
      setLoadingMembershipHistory(false);
    }
  };

  const handleCreateMember = async () => {
    if (!newMemberFirstName.trim() || !newMemberLastName.trim()) {
      setError('First and last name are required to create a Momence member.');
      return;
    }
    setActionLoading('create-member');
    setError(null);
    setNotice(null);
    try {
      const didRun = await confirmed(`Create Momence member ${newMemberFirstName} ${newMemberLastName}?`, () => createMomenceMember({
        firstName: newMemberFirstName,
        lastName: newMemberLastName,
        email: newMemberEmail || undefined,
        phoneNumber: newMemberPhone || undefined,
      }));
      if (didRun) {
        setNotice('Momence member created.');
        setShowCreateMember(false);
        setNewMemberFirstName('');
        setNewMemberLastName('');
        setNewMemberEmail('');
        setNewMemberPhone('');
        await loadMembers();
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Unable to create Momence member.');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedMemberTagIds = useMemo(
    () => new Set((data.member?.customerTags || []).map((tag) => String(tag.id))),
    [data.member?.customerTags]
  );

  const matchingSessionBooking = useMemo(() => {
    if (!selectedMember) return undefined;
    return data.sessionBookings.find((booking) => String(booking.member?.id) === selectedMember.id && !booking.cancelledAt);
  }, [data.sessionBookings, selectedMember]);

  const runAction = async (key: string, message: string, action: () => Promise<unknown>) => {
    setActionLoading(key);
    setError(null);
    setNotice(null);
    try {
      const didRun = await confirmed(message, action);
      if (didRun) {
        setNotice('Momence action completed.');
        await Promise.all([loadContext(), loadMembers(), loadSessions()]);
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Momence action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const runJsonOperation = async (key: string, message: string, action: () => Promise<unknown>) => {
    setActionLoading(key);
    setError(null);
    setNotice(null);
    setOperationResult('');
    try {
      const didRun = await confirmed(message, action);
      if (didRun) setNotice('Momence operation completed.');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Momence operation failed.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted">
      <div className="shrink-0 border-b border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Momence Ops</div>
              <div className="text-sm font-semibold text-foreground">Live operations console</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadMembers();
              void loadSessions();
              if (activeView === 'operations') {
                void loadOperations();
                void loadReportCards();
              }
              void loadContext();
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMembers || loadingSessions || loadingContext ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <TabButton active={activeView === 'members'} icon={<Users className="h-3.5 w-3.5" />} label={`Members (${members.length})`} onClick={() => setActiveView('members')} />
          <TabButton active={activeView === 'sessions'} icon={<Calendar className="h-3.5 w-3.5" />} label={`Sessions (${sessions.length})`} onClick={() => setActiveView('sessions')} />
          <TabButton active={activeView === 'operations'} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Operations" onClick={() => setActiveView('operations')} />
        </div>
      </div>

      {(error || notice) && (
        <div className="shrink-0 border-b border-border bg-card px-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="ml-auto text-red-500"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="ml-auto text-emerald-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-h-0 overflow-y-auto border-r border-border bg-card">
          {activeView === 'members' && (
            <>
              <Toolbar query={memberQuery} onQueryChange={setMemberQuery} placeholder="Search loaded members by name, email, or phone">
                <select
                  value={memberFilter}
                  onChange={(event) => setMemberFilter(event.target.value as typeof memberFilter)}
                  className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-muted-foreground outline-none"
                >
                  <option value="all">All members</option>
                  <option value="with-active-membership">Active membership</option>
                </select>
                <ActionBtn tone="neutral" onClick={() => setShowCreateMember((value) => !value)}>
                  <Plus className="h-3 w-3" /> New member
                </ActionBtn>
              </Toolbar>
              {showCreateMember && (
                <div className="border-b border-border bg-muted px-4 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newMemberFirstName} onChange={(event) => setNewMemberFirstName(event.target.value)} placeholder="First name" className="h-9 rounded-lg border border-border bg-card px-2 text-xs outline-none" />
                    <input value={newMemberLastName} onChange={(event) => setNewMemberLastName(event.target.value)} placeholder="Last name" className="h-9 rounded-lg border border-border bg-card px-2 text-xs outline-none" />
                    <input value={newMemberEmail} onChange={(event) => setNewMemberEmail(event.target.value)} placeholder="Email (optional)" className="h-9 rounded-lg border border-border bg-card px-2 text-xs outline-none" />
                    <input value={newMemberPhone} onChange={(event) => setNewMemberPhone(event.target.value)} placeholder="Phone (optional)" className="h-9 rounded-lg border border-border bg-card px-2 text-xs outline-none" />
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <ActionBtn tone="neutral" onClick={() => setShowCreateMember(false)}>Cancel</ActionBtn>
                    <ActionBtn loading={actionLoading === 'create-member'} onClick={handleCreateMember}>Create member</ActionBtn>
                  </div>
                </div>
              )}
              <MemberTable
                members={members}
                selectedId={selectedMember?.id}
                loading={loadingMembers}
                onSelect={(member) => {
                  setSelectedMember(member);
                  setActiveView('members');
                }}
              />
            </>
          )}

          {activeView === 'sessions' && (
            <>
              <Toolbar query={sessionQuery} onQueryChange={setSessionQuery} placeholder="Filter sessions by class, instructor, studio, or date">
                <select
                  value={sessionType}
                  onChange={(event) => setSessionType(event.target.value as typeof sessionType)}
                  className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-muted-foreground outline-none"
                >
                  <option value="private">Private / hosted</option>
                  <option value="fitness">Class</option>
                  <option value="course">Course</option>
                  <option value="special-event">Special event</option>
                </select>
              </Toolbar>
              <SessionTable
                sessions={sessions}
                selectedId={selectedSession?.id}
                loading={loadingSessions}
                onSelect={(session) => {
                  setSelectedSession(session);
                  setActiveView('sessions');
                }}
              />
            </>
          )}

          {activeView === 'operations' && (
            <OperationsPanel
              sales={sales}
              appointments={appointments}
              loading={loadingOperations}
              reportRunId={reportRunId}
              setReportRunId={setReportRunId}
              reportJson={reportJson}
              setReportJson={setReportJson}
              checkoutMode={checkoutMode}
              setCheckoutMode={setCheckoutMode}
              checkoutJson={checkoutJson}
              setCheckoutJson={setCheckoutJson}
              operationResult={operationResult}
              actionLoading={actionLoading}
              runJsonOperation={runJsonOperation}
              onRefresh={loadOperations}
              transactionId={transactionId}
              setTransactionId={setTransactionId}
              onGetTransaction={() => runJsonOperation('get-transaction', 'Look up this Momence payment transaction?', async () => {
                const result = await getMomencePaymentTransaction(transactionId.trim());
                setOperationResult(JSON.stringify(result, null, 2));
              })}
              reportCards={reportCards}
              loadingReportCards={loadingReportCards}
              showCreateReportCard={showCreateReportCard}
              setShowCreateReportCard={setShowCreateReportCard}
              newReportCardTitle={newReportCardTitle}
              setNewReportCardTitle={setNewReportCardTitle}
              runningReportCardId={runningReportCardId}
              onCreateReportCard={handleCreateReportCard}
              onRunReportCard={handleRunReportCard}
              onDeleteReportCard={handleDeleteReportCard}
              onCreateReport={() => runJsonOperation('create-report', 'Create this Momence report run?', async () => {
                const result = await createMomenceReportRun(parseJsonObject(reportJson));
                setOperationResult(JSON.stringify(result, null, 2));
              })}
              onGetReport={() => runJsonOperation('get-report', 'Retrieve this Momence report run?', async () => {
                const result = await getMomenceReportRun(reportRunId.trim());
                setOperationResult(JSON.stringify(result, null, 2));
              })}
              onCheckoutOperation={() => runJsonOperation(checkoutMode, `Run Momence checkout ${checkoutMode} operation?`, async () => {
                const body = parseJsonObject(checkoutJson);
                const result = checkoutMode === 'prices'
                  ? await getMomenceCheckoutPrices(body)
                  : checkoutMode === 'compatible'
                    ? await getMomenceCompatibleMemberships(body)
                    : await performMomenceCheckout(body);
                setOperationResult(JSON.stringify(result, null, 2));
              })}
            />
          )}
        </div>

        <div className="min-h-0 overflow-y-auto bg-muted p-4">
          {loadingContext ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Loading selected context
            </div>
          ) : (
            <DetailPane
              selectedMember={selectedMember}
              selectedSession={selectedSession}
              data={data}
              selectedTagId={selectedTagId}
              setSelectedTagId={setSelectedTagId}
              selectedMemberTagIds={selectedMemberTagIds}
              matchingSessionBooking={matchingSessionBooking}
              profileFirstName={profileFirstName}
              profileLastName={profileLastName}
              profileEmail={profileEmail}
              profilePhone={profilePhone}
              setProfileFirstName={setProfileFirstName}
              setProfileLastName={setProfileLastName}
              setProfileEmail={setProfileEmail}
              setProfilePhone={setProfilePhone}
              freezeAt={freezeAt}
              unfreezeAt={unfreezeAt}
              freezeReason={freezeReason}
              setFreezeAt={setFreezeAt}
              setUnfreezeAt={setUnfreezeAt}
              setFreezeReason={setFreezeReason}
              eventCreditsLeft={eventCreditsLeft}
              moneyCreditsLeft={moneyCreditsLeft}
              setEventCreditsLeft={setEventCreditsLeft}
              setMoneyCreditsLeft={setMoneyCreditsLeft}
              actionLoading={actionLoading}
              runAction={runAction}
              showMembershipHistory={showMembershipHistory}
              loadingMembershipHistory={loadingMembershipHistory}
              membershipHistory={membershipHistory}
              onToggleMembershipHistory={toggleMembershipHistory}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const MemberTable: React.FC<{
  members: MomenceMemberOption[];
  selectedId?: string;
  loading: boolean;
  onSelect: (member: MomenceMemberOption) => void;
}> = ({ members, selectedId, loading, onSelect }) => (
  <div className="min-h-[360px]">
    <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(180px,1fr)_120px] border-b border-border bg-muted px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      <span>Member</span>
      <span>Contact</span>
      <span>Last seen</span>
    </div>
    {loading && members.length === 0 ? (
      <LoadingRows label="Loading members" />
    ) : members.length === 0 ? (
      <EmptyRows label="No Momence members returned." />
    ) : (
      members.map((member) => (
        <button
          key={member.id}
          type="button"
          onClick={() => onSelect(member)}
          className={`grid w-full grid-cols-[minmax(180px,1.4fr)_minmax(180px,1fr)_120px] gap-3 border-b border-border px-3 py-2.5 text-left text-xs transition hover:bg-blue-50 ${
            selectedId === member.id ? 'bg-blue-50' : 'bg-card'
          }`}
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">{member.label}</span>
            <span className="text-[10px] text-muted-foreground">#{member.id}</span>
          </span>
          <span className="min-w-0 truncate text-muted-foreground">{member.description}</span>
          <span className="text-muted-foreground">{formatDate(member.lastSeen)}</span>
        </button>
      ))
    )}
  </div>
);

const SessionTable: React.FC<{
  sessions: MomenceSessionOption[];
  selectedId?: string;
  loading: boolean;
  onSelect: (session: MomenceSessionOption) => void;
}> = ({ sessions, selectedId, loading, onSelect }) => (
  <div className="min-h-[360px]">
    <div className="grid grid-cols-[minmax(190px,1.4fr)_150px_minmax(130px,1fr)_minmax(120px,1fr)] border-b border-border bg-muted px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      <span>Session</span>
      <span>Starts</span>
      <span>Studio</span>
      <span>Instructor</span>
    </div>
    {loading && sessions.length === 0 ? (
      <LoadingRows label="Loading sessions" />
    ) : sessions.length === 0 ? (
      <EmptyRows label="No Momence sessions returned." />
    ) : (
      sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          onClick={() => onSelect(session)}
          className={`grid w-full grid-cols-[minmax(190px,1.4fr)_150px_minmax(130px,1fr)_minmax(120px,1fr)] gap-3 border-b border-border px-3 py-2.5 text-left text-xs transition hover:bg-blue-50 ${
            selectedId === session.id ? 'bg-blue-50' : 'bg-card'
          }`}
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">{session.classType}</span>
            <span className="text-[10px] text-muted-foreground">#{session.id}</span>
          </span>
          <span className="text-muted-foreground">{formatDate(session.startsAt)}</span>
          <span className="min-w-0 truncate text-muted-foreground">{session.studio || '-'}</span>
          <span className="min-w-0 truncate text-muted-foreground">{session.trainer || '-'}</span>
        </button>
      ))
    )}
    {loading && sessions.length > 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Refreshing sessions...</div>}
  </div>
);

const LoadingRows: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    {label}
  </div>
);

const EmptyRows: React.FC<{ label: string }> = ({ label }) => (
  <div className="py-16 text-center text-xs font-semibold text-muted-foreground">{label}</div>
);

const OperationsPanel: React.FC<{
  sales: MomenceSale[];
  appointments: MomenceAppointmentReservation[];
  loading: boolean;
  reportRunId: string;
  setReportRunId: (value: string) => void;
  reportJson: string;
  setReportJson: (value: string) => void;
  checkoutMode: 'prices' | 'compatible' | 'checkout';
  setCheckoutMode: (value: 'prices' | 'compatible' | 'checkout') => void;
  checkoutJson: string;
  setCheckoutJson: (value: string) => void;
  operationResult: string;
  actionLoading: string | null;
  runJsonOperation: (key: string, message: string, action: () => Promise<unknown>) => Promise<void>;
  onRefresh: () => Promise<void>;
  transactionId: string;
  setTransactionId: (value: string) => void;
  onGetTransaction: () => void;
  onCreateReport: () => void;
  onGetReport: () => void;
  onCheckoutOperation: () => void;
  reportCards: MomenceReportCard[];
  loadingReportCards: boolean;
  showCreateReportCard: boolean;
  setShowCreateReportCard: (value: boolean) => void;
  newReportCardTitle: string;
  setNewReportCardTitle: (value: string) => void;
  runningReportCardId: string;
  onCreateReportCard: () => void;
  onRunReportCard: (card: MomenceReportCard) => void;
  onDeleteReportCard: (card: MomenceReportCard) => void;
}> = ({
  sales,
  appointments,
  loading,
  reportRunId,
  setReportRunId,
  reportJson,
  setReportJson,
  checkoutMode,
  setCheckoutMode,
  checkoutJson,
  setCheckoutJson,
  operationResult,
  actionLoading,
  onRefresh,
  transactionId,
  setTransactionId,
  onGetTransaction,
  onCreateReport,
  onGetReport,
  onCheckoutOperation,
  reportCards,
  loadingReportCards,
  showCreateReportCard,
  setShowCreateReportCard,
  newReportCardTitle,
  setNewReportCardTitle,
  runningReportCardId,
  onCreateReportCard,
  onRunReportCard,
  onDeleteReportCard,
}) => (
  <div className="space-y-4 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-foreground">Host operations</div>
        <div className="text-xs text-muted-foreground">Sales, appointment reservations, reports, and checkout JSON actions.</div>
      </div>
      <ActionBtn tone="neutral" loading={loading} onClick={() => void onRefresh()}>
        Refresh
      </ActionBtn>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={<CreditCard className="h-3.5 w-3.5" />} title="Recent sales" count={sales.length} />
        <div className="space-y-2">
          {sales.slice(0, 8).map((sale) => (
            <div key={sale.id} className="rounded-xl border border-border bg-muted px-3 py-2 text-xs">
              <div className="font-semibold text-foreground">Sale #{sale.id}</div>
              <div className="mt-0.5 text-muted-foreground">{formatDate(sale.createdAt)} {sale.currency ? `· ${sale.currency}` : ''}</div>
            </div>
          ))}
          {sales.length === 0 && <div className="text-xs text-muted-foreground">No sales returned.</div>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />} title="Appointment reservations" count={appointments.length} />
        <div className="space-y-2">
          {appointments.slice(0, 8).map((appointment) => (
            <div key={appointment.id} className="rounded-xl border border-border bg-muted px-3 py-2 text-xs">
              <div className="font-semibold text-foreground">{appointment.service?.name || `Appointment #${appointment.id}`}</div>
              <div className="mt-0.5 text-muted-foreground">{formatDate(appointment.startsAt)}</div>
            </div>
          ))}
          {appointments.length === 0 && <div className="text-xs text-muted-foreground">No appointment reservations returned.</div>}
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={<FileText className="h-3.5 w-3.5" />} title="Dashboard report cards" count={reportCards.length} />
        <div className="flex items-center gap-2">
          <ActionBtn tone="neutral" loading={loadingReportCards} onClick={() => setShowCreateReportCard(!showCreateReportCard)}>
            {showCreateReportCard ? 'Cancel' : 'Save current JSON as card'}
          </ActionBtn>
        </div>
      </div>
      <div className="mb-1 text-xs text-muted-foreground">
        Save a report configuration once, then re-run it on demand instead of re-typing JSON every time.
      </div>
      {showCreateReportCard && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-dashed border-border bg-muted p-3">
          <input
            value={newReportCardTitle}
            onChange={(event) => setNewReportCardTitle(event.target.value)}
            placeholder="Card title, e.g. Monthly total sales"
            className="h-9 flex-1 rounded-lg border border-border bg-card px-2 text-xs outline-none"
          />
          <ActionBtn loading={actionLoading === 'create-report-card'} onClick={onCreateReportCard}>
            Save card
          </ActionBtn>
          <div className="w-full text-[11px] text-muted-foreground">Uses the JSON currently in the "Report runs" box below.</div>
        </div>
      )}
      <div className="space-y-2">
        {reportCards.map((card) => (
          <div key={card.id} className="rounded-xl border border-border bg-muted p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">{card.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {card.lastRunAt ? `Last run ${formatDate(card.lastRunAt)} · ${card.lastStatus || 'unknown'}` : 'Never run'}
                </div>
                {card.lastError && <div className="mt-0.5 text-[11px] text-red-600">{card.lastError}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ActionBtn tone="neutral" loading={runningReportCardId === card.id} onClick={() => onRunReportCard(card)}>
                  Run now
                </ActionBtn>
                <ActionBtn tone="danger" onClick={() => onDeleteReportCard(card)}>Delete</ActionBtn>
              </div>
            </div>
            {card.lastResult != null && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border bg-slate-950 p-2 text-[11px] text-slate-100">
                {JSON.stringify(card.lastResult, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {reportCards.length === 0 && !loadingReportCards && (
          <div className="text-xs text-muted-foreground">No saved report cards yet.</div>
        )}
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={<CreditCard className="h-3.5 w-3.5" />} title="Payment transaction lookup" />
        <div className="flex flex-wrap gap-2">
          <input
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="Transaction ID"
            className="h-9 w-40 rounded-lg border border-border px-2 text-xs outline-none"
          />
          <ActionBtn tone="neutral" disabled={!transactionId.trim()} loading={actionLoading === 'get-transaction'} onClick={onGetTransaction}>
            Look up transaction
          </ActionBtn>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={<FileText className="h-3.5 w-3.5" />} title="Report runs" />
        <textarea
          value={reportJson}
          onChange={(event) => setReportJson(event.target.value)}
          rows={9}
          className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-blue-400"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <ActionBtn loading={actionLoading === 'create-report'} onClick={onCreateReport}>Create report</ActionBtn>
          <input
            value={reportRunId}
            onChange={(event) => setReportRunId(event.target.value)}
            placeholder="Report run ID"
            className="h-8 w-36 rounded-lg border border-border px-2 text-xs outline-none"
          />
          <ActionBtn tone="neutral" disabled={!reportRunId.trim()} loading={actionLoading === 'get-report'} onClick={onGetReport}>Get report</ActionBtn>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <SectionTitle icon={<CreditCard className="h-3.5 w-3.5" />} title="Checkout JSON action" />
        <select
          value={checkoutMode}
          onChange={(event) => setCheckoutMode(event.target.value as 'prices' | 'compatible' | 'checkout')}
          className="mb-2 h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-muted-foreground outline-none"
        >
          <option value="prices">Get checkout prices</option>
          <option value="compatible">Get compatible memberships</option>
          <option value="checkout">Perform checkout</option>
        </select>
        <textarea
          value={checkoutJson}
          onChange={(event) => setCheckoutJson(event.target.value)}
          rows={9}
          className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-blue-400"
        />
        <div className="mt-2 flex justify-end">
          <ActionBtn tone={checkoutMode === 'checkout' ? 'danger' : 'primary'} loading={actionLoading === checkoutMode} onClick={onCheckoutOperation}>
            Run {checkoutMode}
          </ActionBtn>
        </div>
      </div>
    </div>

    {operationResult && (
      <pre className="max-h-80 overflow-auto rounded-2xl border border-border bg-slate-950 p-4 text-xs text-slate-100">
        {operationResult}
      </pre>
    )}
  </div>
);

const DetailPane: React.FC<{
  selectedMember: MomenceMemberOption | null;
  selectedSession: MomenceSessionOption | null;
  data: MomenceTicketContext;
  selectedTagId: string;
  setSelectedTagId: (value: string) => void;
  selectedMemberTagIds: Set<string>;
  matchingSessionBooking?: { id: number; checkedIn?: boolean; recurringBookingId?: number | null };
  profileFirstName: string;
  profileLastName: string;
  profileEmail: string;
  profilePhone: string;
  setProfileFirstName: (value: string) => void;
  setProfileLastName: (value: string) => void;
  setProfileEmail: (value: string) => void;
  setProfilePhone: (value: string) => void;
  freezeAt: string;
  unfreezeAt: string;
  freezeReason: string;
  setFreezeAt: (value: string) => void;
  setUnfreezeAt: (value: string) => void;
  setFreezeReason: (value: string) => void;
  eventCreditsLeft: string;
  moneyCreditsLeft: string;
  setEventCreditsLeft: (value: string) => void;
  setMoneyCreditsLeft: (value: string) => void;
  actionLoading: string | null;
  runAction: (key: string, message: string, action: () => Promise<unknown>) => Promise<void>;
  showMembershipHistory: boolean;
  loadingMembershipHistory: boolean;
  membershipHistory: MomenceMembershipInsight[];
  onToggleMembershipHistory: () => void;
}> = ({
  selectedMember,
  selectedSession,
  data,
  selectedTagId,
  setSelectedTagId,
  selectedMemberTagIds,
  matchingSessionBooking,
  profileFirstName,
  profileLastName,
  profileEmail,
  profilePhone,
  setProfileFirstName,
  setProfileLastName,
  setProfileEmail,
  setProfilePhone,
  freezeAt,
  unfreezeAt,
  freezeReason,
  setFreezeAt,
  setUnfreezeAt,
  setFreezeReason,
  eventCreditsLeft,
  moneyCreditsLeft,
  setEventCreditsLeft,
  setMoneyCreditsLeft,
  actionLoading,
  runAction,
  showMembershipHistory,
  loadingMembershipHistory,
  membershipHistory,
  onToggleMembershipHistory,
}) => {
  if (!selectedMember && !selectedSession) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center">
        <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-semibold text-muted-foreground">Select a member or session</div>
        <div className="mt-1 text-xs text-muted-foreground">Actions appear here after a table row is selected.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedMember && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <SectionTitle icon={<User className="h-3.5 w-3.5" />} title="Member profile" />
          <FieldLine label="Name" value={data.summary.member?.name || selectedMember.label} />
          <FieldLine label="Email" value={data.summary.member?.email || selectedMember.email} />
          <FieldLine label="Phone" value={data.summary.member?.phoneNumber || selectedMember.phoneNumber} />
          <FieldLine label="First seen" value={formatDate(data.summary.member?.firstSeen)} />
          <FieldLine label="Last seen" value={formatDate(data.summary.member?.lastSeen || selectedMember.lastSeen)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input value={profileFirstName} onChange={(event) => setProfileFirstName(event.target.value)} placeholder="First name" className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
            <input value={profileLastName} onChange={(event) => setProfileLastName(event.target.value)} placeholder="Last name" className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
            <input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="Email" className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
            <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="Phone number" className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionBtn loading={actionLoading === 'name'} onClick={() => runAction('name', `Update name for ${selectedMember.label}?`, () => updateMomenceMemberName(selectedMember.id, profileFirstName, profileLastName))}>Save name</ActionBtn>
            <ActionBtn loading={actionLoading === 'email'} onClick={() => runAction('email', `Update email for ${selectedMember.label}?`, () => updateMomenceMemberEmail(selectedMember.id, profileEmail))}><Mail className="h-3 w-3" /> Email</ActionBtn>
            <ActionBtn loading={actionLoading === 'phone'} onClick={() => runAction('phone', `Update phone for ${selectedMember.label}?`, () => updateMomenceMemberPhoneNumber(selectedMember.id, profilePhone))}><Phone className="h-3 w-3" /> Phone</ActionBtn>
            <ActionBtn tone="danger" loading={actionLoading === 'delete-phone'} onClick={() => runAction('delete-phone', `Delete all phone records for ${selectedMember.label}?`, () => deleteMomenceMemberPhoneNumbers(selectedMember.id))}>Delete phone</ActionBtn>
          </div>
        </div>
      )}

      {selectedSession && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />} title="Session" />
          <FieldLine label="Class" value={selectedSession.classType} />
          <FieldLine label="Starts" value={formatDate(selectedSession.startsAt)} />
          <FieldLine label="Studio" value={selectedSession.studio} />
          <FieldLine label="Instructor" value={selectedSession.trainer} />
          {selectedMember && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <ActionBtn loading={actionLoading === 'free'} onClick={() => runAction('free', `Add ${selectedMember.label} to ${selectedSession.classType} for free?`, () => addMomenceMemberToSessionForFree(selectedMember.id, selectedSession.id))}>Free booking</ActionBtn>
              <ActionBtn tone="neutral" loading={actionLoading === 'waitlist'} onClick={() => runAction('waitlist', `Add ${selectedMember.label} to the waitlist?`, () => addMomenceMemberToWaitlist(selectedMember.id, selectedSession.id))}>Waitlist</ActionBtn>
              {matchingSessionBooking && (
                <>
                  <ActionBtn tone="neutral" loading={actionLoading === 'checkin'} onClick={() => runAction('checkin', `${matchingSessionBooking.checkedIn ? 'Remove check-in for' : 'Check in'} ${selectedMember.label}?`, () => matchingSessionBooking.checkedIn ? removeMomenceBookingCheckIn(matchingSessionBooking.id) : checkInMomenceBooking(matchingSessionBooking.id))}>{matchingSessionBooking.checkedIn ? 'Undo check-in' : 'Check in'}</ActionBtn>
                  <ActionBtn tone="danger" loading={actionLoading === 'cancel'} onClick={() => runAction('cancel', `Cancel booking for ${selectedMember.label}?`, () => cancelMomenceBooking(matchingSessionBooking.id))}>Cancel booking</ActionBtn>
                  {matchingSessionBooking.recurringBookingId && (
                    <ActionBtn tone="danger" loading={actionLoading === 'cancel-recurring'} onClick={() => runAction('cancel-recurring', `Cancel recurring booking for ${selectedMember.label}?`, () => cancelMomenceRecurringBooking(matchingSessionBooking.recurringBookingId || matchingSessionBooking.id))}>Cancel recurring</ActionBtn>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {selectedMember && (data.summary.membershipOverview.memberships.length > 0 || showMembershipHistory) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <SectionTitle icon={<BadgeCheck className="h-3.5 w-3.5" />} title="Memberships" count={showMembershipHistory ? membershipHistory.length : data.summary.membershipOverview.memberships.length} />
            <ActionBtn tone="neutral" loading={loadingMembershipHistory} onClick={onToggleMembershipHistory}>
              {showMembershipHistory ? 'Show active only' : 'Show full history'}
            </ActionBtn>
          </div>
          {showMembershipHistory ? (
            <div className="space-y-2">
              {membershipHistory.map((membership) => (
                <div key={membership.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground">{membership.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {membership.validUntil ? `Valid until ${formatDate(membership.validUntil)}` : 'No expiry captured'}
                      </div>
                    </div>
                    <Pill tone={membership.status === 'Frozen' ? 'amber' : membership.status === 'Expired' ? 'slate' : 'emerald'}>{membership.status}</Pill>
                  </div>
                </div>
              ))}
              {membershipHistory.length === 0 && !loadingMembershipHistory && (
                <div className="text-xs text-muted-foreground">No membership history returned.</div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <input type="datetime-local" value={freezeAt} onChange={(event) => setFreezeAt(event.target.value)} className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
                <input type="datetime-local" value={unfreezeAt} onChange={(event) => setUnfreezeAt(event.target.value)} className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
                <input value={freezeReason} onChange={(event) => setFreezeReason(event.target.value)} placeholder="Freeze reason" className="h-9 rounded-lg border border-border px-2 text-xs outline-none" />
              </div>
              <div className="space-y-2">
                {data.summary.membershipOverview.memberships.map((membership) => (
              <div key={membership.id} className="rounded-xl border border-border bg-muted p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-foreground">{membership.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{membership.creditsLabel || membership.moneyCreditsLabel || membership.usageLabel || 'No credit data returned'}</div>
                  </div>
                  <Pill tone={membership.status === 'Frozen' ? 'amber' : 'emerald'}>{membership.status}</Pill>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input value={eventCreditsLeft} onChange={(event) => setEventCreditsLeft(event.target.value)} placeholder="Event credits left" className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none" />
                  <input value={moneyCreditsLeft} onChange={(event) => setMoneyCreditsLeft(event.target.value)} placeholder="Money credits left" className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {membership.status !== 'Frozen' ? (
                    <>
                      <ActionBtn loading={actionLoading === `freeze-now-${membership.id}`} onClick={() => runAction(`freeze-now-${membership.id}`, `Freeze ${membership.name} now?`, () => freezeMomenceMembership(selectedMember.id, membership.id, { reason: freezeReason || undefined }))}>Freeze now</ActionBtn>
                      <ActionBtn tone="neutral" disabled={!freezeAt} loading={actionLoading === `freeze-schedule-${membership.id}`} onClick={() => runAction(`freeze-schedule-${membership.id}`, `Schedule freeze for ${membership.name}?`, () => freezeMomenceMembership(selectedMember.id, membership.id, { freezeAt: toApiDateTime(freezeAt), unfreezeAt: toApiDateTime(unfreezeAt), reason: freezeReason || undefined }))}>Schedule freeze</ActionBtn>
                    </>
                  ) : (
                    <>
                      <ActionBtn tone="neutral" loading={actionLoading === `unfreeze-${membership.id}`} onClick={() => runAction(`unfreeze-${membership.id}`, `Unfreeze ${membership.name}?`, () => unfreezeMomenceMembership(selectedMember.id, membership.id))}>Unfreeze</ActionBtn>
                      {membership.scheduledUnfreezeAt && <ActionBtn tone="danger" loading={actionLoading === `remove-unfreeze-${membership.id}`} onClick={() => runAction(`remove-unfreeze-${membership.id}`, `Remove scheduled unfreeze for ${membership.name}?`, () => removeScheduledMomenceMembershipUnfreeze(selectedMember.id, membership.id))}>Remove scheduled</ActionBtn>}
                    </>
                  )}
                    <ActionBtn tone="neutral" disabled={!eventCreditsLeft && !moneyCreditsLeft} loading={actionLoading === `credits-${membership.id}`} onClick={() => runAction(`credits-${membership.id}`, `Update credits for ${membership.name}?`, () => updateMomenceMembershipCredits(selectedMember.id, membership.id, {
                      eventCreditsLeft: eventCreditsLeft ? Number(eventCreditsLeft) : undefined,
                      moneyCreditsLeft: moneyCreditsLeft ? Number(moneyCreditsLeft) : undefined,
                    }))}>Update credits</ActionBtn>
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      )}

      {selectedMember && data.tags.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <SectionTitle icon={<Tag className="h-3.5 w-3.5" />} title="Tags" count={data.tags.length} />
          <div className="relative">
            <select value={selectedTagId} onChange={(event) => setSelectedTagId(event.target.value)} className="h-9 w-full appearance-none rounded-lg border border-border bg-card px-2 pr-8 text-xs outline-none">
              <option value="">Select tag</option>
              {data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {selectedTagId && (
            <div className="mt-2 flex gap-2">
              <ActionBtn disabled={selectedMemberTagIds.has(selectedTagId)} loading={actionLoading === `assign-tag-${selectedTagId}`} onClick={() => runAction(`assign-tag-${selectedTagId}`, `Assign this tag to ${selectedMember.label}?`, () => assignMomenceTag(selectedMember.id, selectedTagId))}>Assign</ActionBtn>
              <ActionBtn tone="danger" disabled={!selectedMemberTagIds.has(selectedTagId)} loading={actionLoading === `remove-tag-${selectedTagId}`} onClick={() => runAction(`remove-tag-${selectedTagId}`, `Remove this tag from ${selectedMember.label}?`, () => unassignMomenceTag(selectedMember.id, selectedTagId))}>Remove</ActionBtn>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(data.member?.customerTags || []).map((tag) => <Pill key={tag.id} tone="blue">{tag.name}</Pill>)}
            {(data.member?.customerTags || []).length === 0 && <span className="text-xs text-muted-foreground">No tags assigned.</span>}
          </div>
        </div>
      )}

      {(data.summary.bookingOverview.recentBookings.length > 0 || data.sessionBookings.length > 0) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />} title="Loaded bookings" count={data.summary.bookingOverview.totalLoaded || data.sessionBookings.length} />
          <div className="space-y-2">
            {data.summary.bookingOverview.recentBookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-semibold text-foreground">{booking.classType}</span>
                <Pill tone={booking.checkedIn ? 'emerald' : booking.cancelled ? 'red' : 'slate'}>{booking.checkedIn ? 'In' : booking.cancelled ? 'Cancelled' : 'Booked'}</Pill>
              </div>
            ))}
            {data.sessionBookings.filter((booking) => !booking.cancelledAt).slice(0, 8).map((booking) => (
              <div key={booking.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-semibold text-foreground">{[booking.member?.firstName, booking.member?.lastName].filter(Boolean).join(' ') || `Booking #${booking.id}`}</span>
                <Pill tone={booking.checkedIn ? 'emerald' : 'slate'}>{booking.checkedIn ? 'In' : 'Booked'}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; count?: number }> = ({ icon, title, count }) => (
  <div className="mb-3 flex items-center gap-2">
    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</span>
    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</span>
    {count != null && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span>}
  </div>
);
