import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { TicketProvider } from './ticketing/TicketContext';
import { useTickets } from './ticketing/useTickets';
import { ChatInterface } from './ticketing/ChatInterface';
import { StandaloneMomencePanel } from './ticketing/StandaloneMomencePanel';
import { TicketDetailDrawer } from './ticketing/TicketDetailDrawer';
import { AuthGate } from './AuthGate';
import { LiveClock } from './LiveClock';
import { BackendAuthProvider } from '@/contexts/BackendAuthContext';
import { useBackendAuth } from '@/contexts/useBackendAuth';
import { BarChart3, Bell, Gauge, MessageSquareText, PanelRightClose, PanelRightOpen, Plus, RotateCcw, Settings, ShieldAlert, Sparkles, Tickets, Users, Workflow, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { ASSOCIATES, CATEGORIES, PRIORITY_SLA, cleanTicketTitle, getEmployee, getEscalationTarget, getSlaState, isClosedTicket, Ticket } from '@/lib/ticketing-data';
import {
  DepartmentSetting,
  EmployeeSetting,
  LocationSetting,
  RoutingRuleSetting,
  RoutingSettings,
  defaultRoutingSettings,
  loadRoutingSettings,
  physique57RoutingPresets,
  routingRuleId,
  saveRoutingSettings,
} from '@/lib/routing-settings';
import {
  EMPTY_ROUTING_FILTERS,
  applyRoutingRulePatch,
  buildCategoryRoutingRows,
  createCityRoutingRules,
  deleteCategoryRoutingRules,
  isCityRoutingRule,
  routingScopeKey,
  uniqueText,
  type CategoryRoutingRow,
  type RoutingScopeKey,
  type RoutingScopeSummary,
} from '@/lib/settings-routing-ops';
import { canOpenAppTab, visibleAppTabValues } from '@/lib/app-access';
import { isTrainerEvaluationProfileOnly } from '@/lib/trainer-profiles';
import { appSidebarClassName } from './app-layout-sidebar';
import { ThemeToggle } from './ThemeToggle';

const TicketDashboard = lazy(() =>
  import('./ticketing/TicketDashboard').then((module) => ({ default: module.TicketDashboard }))
);
const AiReportsPanel = lazy(() =>
  import('./ticketing/AiReportsPanel').then((module) => ({ default: module.AiReportsPanel }))
);
const TrainerProfilesPanel = lazy(() =>
  import('./ticketing/TrainerProfilesPanel').then((module) => ({ default: module.TrainerProfilesPanel }))
);

interface LazyTabErrorBoundaryProps {
  children: React.ReactNode;
  title: string;
  resetKey: string;
}

interface LazyTabErrorBoundaryState {
  error: Error | null;
}

class LazyTabErrorBoundary extends React.Component<LazyTabErrorBoundaryProps, LazyTabErrorBoundaryState> {
  state: LazyTabErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): LazyTabErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: LazyTabErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error) {
    console.error(`${this.props.title}: lazy tab failed to load`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-card p-5 text-center shadow-sm">
          <div className="text-sm font-semibold text-slate-950">{this.props.title}</div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            The local dev server served a stale module. Refresh this view to request the current bundle again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Refresh view
          </button>
        </div>
      </div>
    );
  }
}

const sideTabs = [
  { value: 'chat',          label: 'Chat Intake',      icon: MessageSquareText, group: 'workspace' },
  { value: 'queue',         label: 'My Work',          icon: Gauge,             group: 'workspace' },
  { value: 'notifications', label: 'Notifications',    icon: Bell,              group: 'analytics' },
  { value: 'tickets',       label: 'Submitted Tickets',icon: Tickets,           group: 'analytics' },
  { value: 'trainers',      label: 'Trainer Profiles', icon: Users,             group: 'analytics' },
  { value: 'reports',       label: 'Reports',          icon: BarChart3,         group: 'analytics' },
  { value: 'insights',      label: 'Insights',         icon: Sparkles,          group: 'analytics' },
  { value: 'momence',       label: 'Momence Ops',      icon: Workflow,          group: 'admin' },
  { value: 'settings',      label: 'Settings',         icon: Settings,          group: 'admin' },
];

const SIDEBAR_GROUPS: Array<{ key: string; label: string }> = [
  { key: 'workspace', label: 'Workspace' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'admin',     label: 'Admin' },
];

const AppLayout: React.FC = () => {
  return (
    <BackendAuthProvider>
      <AuthGate>
        <TicketProvider>
          <SupportShell />
        </TicketProvider>
      </AuthGate>
    </BackendAuthProvider>
  );
};

const SupportShell: React.FC = () => {
  const { user, profile, signOut, accessRole } = useBackendAuth();
  const { notifications, selectedTicket, setSelectedTicket } = useTickets();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chat');
  const [hasOpenedTickets, setHasOpenedTickets] = useState(false);
  const [chatResetVersion, setChatResetVersion] = useState(0);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [athenaTrainerMode, setAthenaTrainerMode] = useState(false);
  const userDisplayName = (
    profile?.full_name ||
    (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '') ||
    (typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : '') ||
    'Authenticated user'
  ).trim();

  const userInitials = userDisplayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('') || 'AU';

  const visibleTabs = useMemo(
    () => {
      const visibleValues = new Set<string>(visibleAppTabValues(accessRole));
      return sideTabs.filter((tab) => visibleValues.has(tab.value));
    },
    [accessRole]
  );

  useEffect(() => {
    if (!canOpenAppTab(accessRole, activeTab)) setActiveTab('chat');
  }, [accessRole, activeTab]);

  useEffect(() => {
    const syncAthenaMode = () => {
      setAthenaTrainerMode(document.documentElement.dataset.athenaMode === 'trainer');
    };
    syncAthenaMode();
    window.addEventListener('athena-mode-change', syncAthenaMode);
    return () => window.removeEventListener('athena-mode-change', syncAthenaMode);
  }, []);

  const openEmptyIntake = () => {
    setSelectedTicket(null);
    setActiveTab('chat');
    setChatResetVersion((version) => version + 1);
  };

  const goHome = () => {
    navigate('/');
    openEmptyIntake();
  };

  const handleTabChange = (value: string) => {
    if (!canOpenAppTab(accessRole, value)) {
      setActiveTab('chat');
      return;
    }
    setActiveTab(value);
    if (value === 'tickets') setHasOpenedTickets(true);
  };

  const startNewChat = () => {
    openEmptyIntake();
  };

  const sidebarExpanded = sidebarPinned || sidebarHovered;

  return (
      <div className="p57-app-bg flex h-screen w-screen flex-col overflow-hidden text-stone-950">
        {activeTab !== 'chat' && <header className={`z-20 flex-shrink-0 border-b px-4 py-1.5 shadow-[0_1px_0_rgba(15,23,42,0.06),0_12px_32px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition duration-500 ${
          athenaTrainerMode
            ? 'border-blue-100/60 bg-blue-50/92'
            : 'border-border/60 bg-card/96'
        }`}>
          <div className="flex w-full items-center gap-3">

            {/* Logo */}
            <button
              type="button"
              onClick={goHome}
              aria-label="Go to Chat Intake home"
              className="group athena-main-logo relative flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full border border-blue-200 bg-slate-950 text-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-[0_12px_28px_rgba(37,99,235,0.22)]"
            >
              <img
                src="/athena-ai-logo.png"
                alt="Athena"
                className="athena-logo-spin h-full w-full rounded-full object-cover"
              />
            </button>

            {/* Brand */}
            <div className="min-w-0 flex-shrink-0">
              <div className="flex items-baseline gap-0 leading-none">
                <h1 className="ml-1.5 text-[26px] font-black uppercase tracking-[0.26em] text-stone-900">
                  Athena
                </h1>
                <span className="ai-kinetic ml-0.5 text-[12px] font-bold">Ai</span>
              </div>
              <div className="ml-1.5 mt-0.5 flex items-center gap-2">
                <div className="h-px w-28 bg-gradient-to-r from-blue-500 via-cyan-400 to-transparent" />
                <p className={`text-[9.5px] font-semibold uppercase tracking-[0.22em] ${
                  athenaTrainerMode ? 'text-blue-600/80' : 'text-stone-400'
                }`}>
                  {athenaTrainerMode ? 'Instructor Intelligence' : 'Member Support OS'}
                </p>
              </div>
            </div>

            {/* Centre divider line */}
            <div className="mx-2 hidden h-7 w-px flex-shrink-0 bg-slate-200 md:block" />

            {/* Status pills */}
            <div className="hidden items-center gap-2 md:flex">
              <div className="p57-header-pill p57-header-pill-live">
                <span className="p57-status-dot p57-status-dot-live" />
                AI Ready
              </div>
              {athenaTrainerMode && (
                <div className="p57-header-pill p57-header-pill-mode">
                  <Zap className="h-2.5 w-2.5" />
                  Trainer Mode
                </div>
              )}
            </div>

            {/* Right cluster */}
            <div className="ml-auto hidden items-center gap-3 md:flex">

              {/* Keyboard hint */}
              <button
                type="button"
                onClick={startNewChat}
                title="Start a new chat"
                className="group flex items-center gap-1.5 rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Plus className="h-3 w-3 transition group-hover:rotate-90" style={{ transition: 'transform 0.2s' }} />
                New chat
                <kbd className="p57-kbd">N</kbd>
              </button>

              <div className="h-5 w-px bg-slate-200" />

              {/* Theme switcher */}
              <ThemeToggle />

              {/* Date / time */}
              <LiveClock />
            </div>
          </div>
        </header>}

        <main className="min-h-0 flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full min-h-0">
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <TabsContent forceMount value="chat" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                <ChatInterface
                  resetVersion={chatResetVersion}
                  onNewChat={startNewChat}
                  athenaTrainerMode={athenaTrainerMode}
                  onHome={goHome}
                  onOpenExistingTicket={(ticket) => {
                    setSelectedTicket(ticket);
                    setHasOpenedTickets(true);
                    setActiveTab('tickets');
                  }}
                />
              </TabsContent>
              <TabsContent value="queue" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {activeTab === 'queue' && <MyWorkPanel />}
              </TabsContent>
              <TabsContent value="tickets" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {(activeTab === 'tickets' || hasOpenedTickets) && (
                  <LazyTabErrorBoundary title="Submitted tickets could not load" resetKey={activeTab}>
                    <Suspense fallback={<div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Loading submitted tickets...</div>}>
                      <TicketDashboard />
                    </Suspense>
                  </LazyTabErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="trainers" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {activeTab === 'trainers' && (
                  <LazyTabErrorBoundary title="Trainer profiles could not load" resetKey={activeTab}>
                    <Suspense fallback={<div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Loading trainer profiles...</div>}>
                      <TrainerProfilesPanel />
                    </Suspense>
                  </LazyTabErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="notifications" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {activeTab === 'notifications' && <NotificationsPanel
                  onOpen={(ticket) => {
                    setSelectedTicket(ticket);
                    setHasOpenedTickets(true);
                  }}
                />}
              </TabsContent>
              <TabsContent value="reports" className="reports-print-root m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {activeTab === 'reports' && (
                  <LazyTabErrorBoundary title="Reports could not load" resetKey={activeTab}>
                    <Suspense fallback={<div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Loading reports...</div>}>
                      <AiReportsPanel />
                    </Suspense>
                  </LazyTabErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="insights" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {activeTab === 'insights' && <InsightsPanel />}
              </TabsContent>
              <TabsContent value="momence" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {accessRole === 'admin' && <MomenceOpsPanel />}
              </TabsContent>
              <TabsContent value="settings" className="m-0 h-full min-h-0 overflow-hidden data-[state=inactive]:hidden">
                {accessRole === 'admin' ? (
                  <SettingsPanel userEmail={userDisplayName} accessRole={accessRole} />
                ) : (
                  <UserSettingsPanel
                    userEmail={profile?.email || user?.email || userDisplayName}
                    userDisplayName={userDisplayName}
                    accessRole={accessRole}
                    team={profile?.team || ''}
                  />
                )}
              </TabsContent>
            </div>

            <aside
              onMouseEnter={() => setSidebarHovered(true)}
              onMouseLeave={() => setSidebarHovered(false)}
              className={appSidebarClassName(sidebarExpanded)}
            >
              {/* Online indicator + new chat */}
              <div className={`mb-3 flex items-center ${sidebarExpanded ? 'gap-2' : 'flex-col gap-2'}`}>
                <button
                  type="button"
                  onClick={startNewChat}
                  title="Start new chat"
                  className={`group flex h-10 min-h-10 items-center rounded-xl border text-xs font-semibold text-white transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 ${
                    athenaTrainerMode
                      ? 'border-blue-600 bg-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.28)] hover:bg-blue-700 focus:ring-blue-500/20'
                      : 'border-[#0a0f1e] bg-[#0a0f1e] shadow-[0_10px_24px_rgba(7,8,15,0.28)] hover:bg-slate-900 focus:ring-slate-500/20'
                  } ${sidebarExpanded ? 'flex-1 justify-start gap-2 px-3' : 'w-full justify-center px-0'}`}
                >
                  <RotateCcw className="h-3.5 w-3.5 flex-shrink-0 transition group-hover:rotate-180 duration-500" />
                  <span className={`${sidebarExpanded ? 'inline' : 'hidden'} truncate`}>New chat</span>
                </button>
                {/* Always-on blinking online badge */}
                <div
                  title="Athena AI online"
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50 shadow-[0_2px_8px_rgba(16,185,129,0.12)] ${
                    sidebarExpanded ? 'px-2.5 py-1.5' : 'h-10 w-full justify-center px-0'
                  }`}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {sidebarExpanded && <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Online</span>}
                </div>
              </div>

              {/* Grouped tab navigation */}
              <TabsList className="flex h-auto w-full flex-col gap-0.5 rounded-2xl border border-slate-100/90 bg-slate-50/70 p-1.5 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]">
                {SIDEBAR_GROUPS.map((group, groupIdx) => {
                  const groupTabs = visibleTabs.filter((t) => t.group === group.key);
                  if (groupTabs.length === 0) return null;
                  return (
                    <React.Fragment key={group.key}>
                      {groupIdx > 0 && (
                        <div className={`my-1 h-px ${sidebarExpanded ? 'mx-1' : 'mx-2'} bg-slate-200/70`} />
                      )}
                      {sidebarExpanded && (
                        <div className="px-2 pb-0.5 pt-1 text-[8.5px] font-bold uppercase tracking-[0.2em] text-slate-400">{group.label}</div>
                      )}
                      {groupTabs.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          title={!sidebarExpanded ? label : undefined}
                          className={`p57-tab-active-accent relative h-10 w-full rounded-xl text-xs font-semibold transition duration-150 ${
                            sidebarExpanded ? 'justify-start gap-3 px-3' : 'justify-center px-0'
                          } text-slate-500 hover:bg-card hover:text-foreground hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-[0_4px_12px_rgba(37,99,235,0.08)] dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[0_8px_20px_rgba(0,0,0,0.3)]`}
                        >
                          <span className="relative inline-flex shrink-0 items-center">
                            <Icon className="h-4 w-4" />
                            {value === 'notifications' && notifications.length > 0 && (
                              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-500 px-0.5 text-[8px] font-bold leading-none text-white ring-1 ring-white">
                                {notifications.length > 9 ? '9+' : notifications.length}
                              </span>
                            )}
                          </span>
                          <span className={`${sidebarExpanded ? 'inline' : 'hidden'} flex-1 truncate text-left`}>{label}</span>
                        </TabsTrigger>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TabsList>

              {/* User profile card */}
              <div className="mt-auto pt-4">
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-card shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
                  <div className={`flex items-center p-2.5 ${sidebarExpanded ? 'gap-2.5' : 'justify-center'}`}>
                    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-950 font-bold text-white shadow-[0_4px_10px_rgba(15,23,42,0.25)] ring-2 ring-white ${
                      sidebarExpanded ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-[12px]'
                    }`}>
                      {userInitials}
                    </div>
                    {sidebarExpanded && (
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold leading-tight text-foreground">{userDisplayName}</div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="truncate text-[10px] capitalize text-slate-400">{accessRole}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void signOut()}
                    className={`flex h-8 w-full items-center justify-center border-t border-slate-100 text-[11px] font-semibold text-slate-500 transition hover:bg-red-50 hover:text-red-600 ${
                      sidebarExpanded ? 'gap-1.5 px-3' : 'px-0'
                    }`}
                    aria-label="Sign out"
                  >
                    <span className={sidebarExpanded ? '' : 'hidden'}>Sign out</span>
                    <span className={sidebarExpanded ? 'hidden' : 'text-sm'}>⎋</span>
                  </button>
                </div>
              </div>
            </aside>

            <div className="fixed bottom-3 right-3 z-30 md:hidden">
              <TabsList className="h-11 rounded-2xl border border-border bg-card/90 p-1 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                {visibleTabs.slice(0, 5).map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    aria-label={label}
                    className={`h-9 rounded-xl px-2.5 text-slate-500 data-[state=active]:text-white ${
                      athenaTrainerMode ? 'data-[state=active]:bg-blue-600' : 'data-[state=active]:bg-blue-600'
                    }`}
                  >
                    <span className="relative">
                      <Icon className="h-4 w-4" />
                      {value === 'notifications' && notifications.length > 0 && (
                        <span className="absolute -right-2 -top-2 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white" />
                      )}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </main>
        <TicketDetailDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      </div>
  );
};

const WorkspacePanel: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="h-full overflow-y-auto px-5 py-5">
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold tracking-tight text-stone-950">{title}</h2>
        <p className="mt-0.5 text-[12.5px] text-stone-400">{description}</p>
      </div>
      {children}
    </div>
  </div>
);

const STAT_TONE = {
  default: { border: 'border-border',   accent: 'bg-slate-300',    value: 'text-stone-950', label: 'text-stone-400' },
  danger:  { border: 'border-red-200',     accent: 'bg-red-400',      value: 'text-red-700',   label: 'text-red-400/80' },
  blue:    { border: 'border-blue-200',    accent: 'bg-blue-400',     value: 'text-blue-800',  label: 'text-blue-400/90' },
  green:   { border: 'border-emerald-200', accent: 'bg-emerald-400',  value: 'text-emerald-800', label: 'text-emerald-400/90' },
} as const;

const StatCard: React.FC<{ label: string; value: string | number; tone?: keyof typeof STAT_TONE }> = ({ label, value, tone = 'default' }) => {
  const t = STAT_TONE[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-card/92 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.07)] transition hover:shadow-[0_12px_40px_rgba(15,23,42,0.10)] ${t.border}`}>
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${t.accent}`} />
      <div className={`text-[9.5px] font-bold uppercase tracking-[0.2em] ${t.label}`}>{label}</div>
      <div className={`mt-2 text-[28px] font-bold tabular-nums leading-none ${t.value}`}>{value}</div>
    </div>
  );
};

function normalizedIdentity(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function ticketOwnerIdentityKeys(ticket: Ticket): Set<string> {
  const owner = getEmployee(ticket.assignedTo);
  return new Set([
    normalizedIdentity(ticket.assignedTo),
    normalizedIdentity(owner?.email),
  ].filter(Boolean));
}

function userOwnsTicket(ticket: Ticket, identityValues: Set<string>): boolean {
  const ownerKeys = ticketOwnerIdentityKeys(ticket);
  for (const key of ownerKeys) {
    if (identityValues.has(key)) return true;
  }
  return false;
}

function userSupervisesTicket(ticket: Ticket, identityValues: Set<string>): boolean {
  const owner = getEmployee(ticket.assignedTo);
  if (!owner?.manager) return false;
  const supervisor = getEmployee(owner.manager);
  return [
    owner.manager,
    supervisor?.email,
  ].some((value) => identityValues.has(normalizedIdentity(value)));
}

function isDueToday(ticket: Ticket): boolean {
  if (isClosedTicket(ticket)) return false;
  const due = new Date(ticket.slaDueAt);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return due.toDateString() === now.toDateString() || due.getTime() < now.getTime();
}

const MyWorkPanel: React.FC = () => {
  const { tickets, setSelectedTicket } = useTickets();
  const { user, profile, accessRole } = useBackendAuth();
  const identityValues = useMemo(() => new Set([
    user?.id,
    user?.email,
    profile?.email,
    profile?.full_name,
    typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
    typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : null,
  ].filter(Boolean).map(normalizedIdentity)), [profile?.email, profile?.full_name, user]);
  const operationalTickets = tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket));
  const openTickets = operationalTickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status));
  const assignedToMe = sortByRisk(openTickets.filter((ticket) => userOwnsTicket(ticket, identityValues)));
  const supervisorReview = sortByRisk(openTickets.filter((ticket) => !userOwnsTicket(ticket, identityValues) && userSupervisesTicket(ticket, identityValues)));
  const dueToday = sortByDueDate(openTickets.filter((ticket) => isDueToday(ticket) && (userOwnsTicket(ticket, identityValues) || userSupervisesTicket(ticket, identityValues))));
  const breached = openTickets.filter((ticket) => getSlaState(ticket) === 'Breached');
  const atRisk = openTickets.filter((ticket) => getSlaState(ticket) === 'At Risk');
  const critical = openTickets.filter((ticket) => ticket.priority === 'Critical' || ticket.priority === 'High');
  const unassigned = openTickets.filter((ticket) => !ticket.assignedTo || ticket.assignedTo === '-' || ticket.assignedTo === 'Unassigned');
  const waitingOnMember = newestByDate(openTickets.filter((ticket) => ticket.status === 'Awaiting Member' && (userOwnsTicket(ticket, identityValues) || userSupervisesTicket(ticket, identityValues))));
  const avgAgeHours = averageAgeHours(openTickets);
  const queues = [
    { title: 'Assigned to Me', description: 'Tickets where you are the owner', tickets: assignedToMe, tone: 'blue' as const },
    { title: 'Due Today / Overdue', description: 'Owner or supervisor action needed', tickets: dueToday, tone: 'blue' as const },
    { title: 'Supervisor Review', description: 'Direct reports needing attention', tickets: supervisorReview, tone: 'blue' as const },
    { title: 'Waiting on Member', description: 'Follow-up path is blocked externally', tickets: waitingOnMember, tone: 'blue' as const },
  ];
  return (
    <WorkspacePanel title="My Work" description="Personal action center for owned tickets, supervisor review, and same-day SLA follow-up.">
      <div className="grid gap-3 md:grid-cols-6">
        <StatCard label="Mine" value={assignedToMe.length} tone="blue" />
        <StatCard label="Due Today" value={dueToday.length} tone="blue" />
        <StatCard label="Team Review" value={supervisorReview.length} tone="blue" />
        <StatCard label="Breached" value={breached.length} />
        <StatCard label="High Priority" value={critical.length} />
        <StatCard label="Avg Age" value={`${avgAgeHours}h`} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {queues.map((queue) => (
          <QueuePanel key={queue.title} {...queue} onOpen={setSelectedTicket} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <TriageTable title="My Highest Risk Work" tickets={sortByRisk([...assignedToMe, ...supervisorReview]).slice(0, 10)} onOpen={setSelectedTicket} />
        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.07)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldAlert className="h-4 w-4 text-blue-600" />
            Action Signals
          </div>
          <SignalRow label="Unassigned tickets" value={unassigned.length} tone={unassigned.length ? 'red' : 'green'} />
          <SignalRow label="At-risk tickets" value={atRisk.length} tone={atRisk.length ? 'blue' : 'green'} />
          <SignalRow label="Needs my action" value={assignedToMe.filter((ticket) => getSlaState(ticket) !== 'On Track').length} tone="blue" />
          <SignalRow label="Supervisor approvals" value={supervisorReview.length} tone={supervisorReview.length ? 'blue' : 'green'} />
          <SignalRow label="Manager-scope tickets" value={accessRole === 'manager' ? supervisorReview.length : 0} tone="blue" />
        </div>
      </div>
    </WorkspacePanel>
  );
};

const NotificationsPanel: React.FC<{ onOpen: (ticket: Ticket) => void }> = ({ onOpen }) => {
  const { notifications, clearAllNotifications } = useTickets();
  const criticalCount = notifications.filter((notification) => notification.level === 'critical').length;
  const warningCount = notifications.filter((notification) => notification.level === 'warning').length;

  return (
    <WorkspacePanel title="Notifications" description="Owner-only SLA notifications for tickets assigned to the signed-in team member.">
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Owner Alerts" value={notifications.length} tone={notifications.length ? 'blue' : 'green'} />
        <StatCard label="Breached" value={criticalCount} tone={criticalCount ? 'danger' : 'green'} />
        <StatCard label="At Risk" value={warningCount} tone={warningCount ? 'blue' : 'green'} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[0_18px_54px_rgba(15,23,42,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
          <h3 className="text-sm font-semibold">Ticket Owner Notifications</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300">{notifications.length} active</span>
            <button
              type="button"
              onClick={clearAllNotifications}
              disabled={notifications.length === 0}
              className="h-8 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear all notifications
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onOpen(notification.ticket)}
              className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 md:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={notification.level === 'critical' ? 'Breached' : 'At Risk'} tone={notification.level === 'critical' ? 'red' : 'blue'} />
                  <span className="text-[11px] font-mono text-slate-400">{notification.ticketId}</span>
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-slate-950">{notification.title}</div>
                <div className="mt-1 text-xs text-slate-500">{notification.message}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                <StatusPill value={notification.ticket.priority} tone={notification.ticket.priority === 'Critical' || notification.ticket.priority === 'High' ? 'red' : 'blue'} />
                <div className="truncate text-xs font-medium text-muted-foreground md:max-w-40">{notification.owner}</div>
              </div>
            </button>
          ))}
          {notifications.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto h-9 w-9 text-slate-300" />
              <div className="mt-3 text-sm font-semibold text-muted-foreground">No owner notifications</div>
              <div className="mt-1 text-xs text-slate-500">SLA alerts appear here only when the signed-in user owns the ticket.</div>
            </div>
          )}
        </div>
      </div>
    </WorkspacePanel>
  );
};

const InsightsPanel: React.FC = () => {
  const { tickets, setSelectedTicket } = useTickets();
  const operationalTickets = tickets.filter((ticket) => !isTrainerEvaluationProfileOnly(ticket));
  const open = operationalTickets.filter((ticket) => !isClosedTicket(ticket));
  const closed = operationalTickets.filter(isClosedTicket);
  const highRisk = sortByRisk(open.filter((ticket) => ['Critical', 'High'].includes(ticket.priority) || getSlaState(ticket) === 'Breached')).slice(0, 10);
  const topCategories = countBy(operationalTickets, (ticket) => ticket.category).slice(0, 8);
  const topSubCategories = countBy(operationalTickets, (ticket) => ticket.subCategory).slice(0, 8);
  const byStudio = countBy(operationalTickets, (ticket) => ticket.studio).slice(0, 8);
  const byAssignee = countBy(operationalTickets, (ticket) => ticket.assignedTo).slice(0, 8);
  const byStatus = countBy(operationalTickets, (ticket) => ticket.status);
  const byPriority = countBy(operationalTickets, (ticket) => ticket.priority);
  const bySla = countBy(operationalTickets, (ticket) => getSlaState(ticket));
  const createdTrend = createdTrendByDay(operationalTickets, 10);
  const resolutionRate = operationalTickets.length ? Math.round((closed.length / operationalTickets.length) * 100) : 0;
  return (
    <WorkspacePanel title="Insights" description="Quick signal view across submitted and historic tickets.">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total Tickets" value={operationalTickets.length} />
        <StatCard label="Open" value={open.length} tone="blue" />
        <StatCard label="Resolution Rate" value={`${resolutionRate}%`} tone="green" />
        <StatCard label="Studios" value={new Set(operationalTickets.map((ticket) => ticket.studio)).size} tone="blue" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <BreakdownCard title="Category Drivers" items={topCategories} total={operationalTickets.length} color="bg-blue-600" />
        <BreakdownCard title="Recurring Subcategories" items={topSubCategories} total={operationalTickets.length} color="bg-blue-600" />
        <BreakdownCard title="SLA Health" items={bySla} total={operationalTickets.length} color="bg-emerald-600" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <BreakdownCard title="Studio Workload" items={byStudio} total={operationalTickets.length} color="bg-cyan-600" />
        <BreakdownCard title="Team Workload" items={byAssignee} total={operationalTickets.length} color="bg-slate-700" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid gap-4">
          <BreakdownCard title="Status Funnel" items={byStatus} total={operationalTickets.length} color="bg-blue-600" compact />
          <BreakdownCard title="Priority Mix" items={byPriority} total={operationalTickets.length} color="bg-red-600" compact />
          <TrendCard title="Created Trend" items={createdTrend} />
        </div>
        <TriageTable title="Highest Risk Tickets" tickets={highRisk} onOpen={setSelectedTicket} />
      </div>
    </WorkspacePanel>
  );
};

function countBy(tickets: Ticket[], selector: (ticket: Ticket) => string | undefined) {
  return Object.entries(
    tickets.reduce<Record<string, number>>((acc, ticket) => {
      const key = selector(ticket) || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function newestByDate(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sortByDueDate(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime());
}

function riskWeight(ticket: Ticket) {
  const priority = { Critical: 4, High: 3, Medium: 2, Low: 1 }[ticket.priority] || 1;
  const sla = getSlaState(ticket) === 'Breached' ? 4 : getSlaState(ticket) === 'At Risk' ? 3 : 1;
  return priority + sla;
}

function sortByRisk(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => riskWeight(b) - riskWeight(a) || new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime());
}

function averageAgeHours(tickets: Ticket[]) {
  if (tickets.length === 0) return 0;
  const now = Date.now();
  const total = tickets.reduce((sum, ticket) => sum + Math.max(0, now - new Date(ticket.createdAt).getTime()), 0);
  return Math.round(total / tickets.length / 36e5);
}

function createdTrendByDay(tickets: Ticket[], days: number) {
  const now = new Date();
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - index - 1));
    const key = date.toISOString().slice(0, 10);
    return { key, name: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), value: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const ticket of tickets) {
    const key = new Date(ticket.createdAt).toISOString().slice(0, 10);
    const bucket = byKey.get(key);
    if (bucket) bucket.value += 1;
  }
  return buckets;
}

const QUEUE_TONE = {
  red:     { badge: 'border-red-200 bg-red-50 text-red-700',         dot: 'bg-red-400',     header: 'text-red-800' },
  blue:    { badge: 'border-blue-200 bg-blue-50 text-blue-700',      dot: 'bg-blue-400',    header: 'text-blue-800' },
  emerald: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400', header: 'text-emerald-800' },
} as const;

const QueuePanel: React.FC<{
  title: string;
  description: string;
  tickets: Ticket[];
  tone: keyof typeof QUEUE_TONE;
  onOpen: (ticket: Ticket) => void;
}> = ({ title, description, tickets, tone, onOpen }) => {
  const t = QUEUE_TONE[tone];
  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/92 shadow-[0_8px_32px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${t.dot}`} />
          <div>
            <h3 className={`text-[13px] font-semibold ${t.header}`}>{title}</h3>
            <p className="text-[11px] text-slate-400">{description}</p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${t.badge}`}>{tickets.length}</span>
      </div>
      <div className="space-y-0 divide-y divide-slate-50">
        {tickets.slice(0, 5).map((ticket) => (
          <TicketMiniRow key={ticket.id} ticket={ticket} onOpen={onOpen} />
        ))}
        {tickets.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-slate-400">Queue clear</div>
        )}
      </div>
    </section>
  );
};

const PRIORITY_STRIPE: Record<string, string> = {
  Critical: 'border-l-[3px] border-l-red-400',
  High:     'border-l-[3px] border-l-orange-400',
  Medium:   'border-l-[3px] border-l-blue-400',
  Low:      'border-l-[3px] border-l-slate-300',
};

const TicketMiniRow: React.FC<{ ticket: Ticket; onOpen: (ticket: Ticket) => void }> = ({ ticket, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(ticket)}
    className={`grid w-full gap-2 bg-card px-3 py-2.5 text-left text-xs transition hover:bg-slate-50 md:grid-cols-[1fr_auto] ${PRIORITY_STRIPE[ticket.priority] || ''}`}
  >
    <div className="min-w-0">
      <div className="truncate font-semibold text-foreground">{cleanTicketTitle(ticket.title)}</div>
      <div className="mt-0.5 truncate text-[10.5px] text-slate-400">{ticket.subCategory || ticket.category}</div>
    </div>
    <div className="flex flex-shrink-0 items-center gap-1">
      <StatusPill value={ticket.priority} tone={ticket.priority === 'Critical' || ticket.priority === 'High' ? 'red' : 'blue'} />
      <StatusPill value={getSlaState(ticket)} tone={getSlaState(ticket) === 'Breached' ? 'red' : getSlaState(ticket) === 'At Risk' ? 'blue' : 'green'} />
    </div>
  </button>
);

const TriageTable: React.FC<{ title: string; tickets: Ticket[]; onOpen: (ticket: Ticket) => void }> = ({ title, tickets, onOpen }) => (
  <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/92 shadow-[0_8px_32px_rgba(15,23,42,0.07)]">
    <div className="flex items-center justify-between border-b border-slate-100 bg-[#07080f] px-4 py-3 text-white">
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">{tickets.length}</span>
    </div>
    <div className="divide-y divide-slate-100">
      {tickets.map((ticket) => (
        <button
          type="button"
          key={ticket.id}
          onClick={() => onOpen(ticket)}
          className="grid w-full gap-3 px-4 py-3 text-left transition hover:text-slate-950 md:grid-cols-[1fr_120px_120px_140px]"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">{cleanTicketTitle(ticket.title)}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">{ticket.id} · {ticket.category} / {ticket.subCategory}</div>
          </div>
          <PlainDataValue value={ticket.priority} />
          <PlainDataValue value={getSlaState(ticket)} />
          <div className="truncate text-xs font-medium text-muted-foreground">{ticket.assignedTo}</div>
        </button>
      ))}
      {tickets.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">No tickets available for this view.</div>}
    </div>
  </section>
);

const StatusPill: React.FC<{ value: string; tone: 'red' | 'blue' | 'green' }> = ({ value, tone }) => {
  const className = {
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }[tone];
  return <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{value}</span>;
};

const PlainDataValue: React.FC<{ value: string }> = ({ value }) => (
  <span className="truncate text-xs font-medium text-muted-foreground">{value}</span>
);

const SignalRow: React.FC<{ label: string; value: number; tone: 'red' | 'blue' | 'green' }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-slate-950">{value}</span>
  </div>
);

const BAR_COLOR_MAP: Record<string, [string, string]> = {
  'bg-blue-600':    ['#2563eb', '#60a5fa'],
  'bg-emerald-600': ['#059669', '#34d399'],
  'bg-cyan-600':    ['#0891b2', '#22d3ee'],
  'bg-slate-700':   ['#334155', '#64748b'],
  'bg-red-600':     ['#dc2626', '#f87171'],
};

const BreakdownCard: React.FC<{ title: string; items: Array<{ name: string; value: number }>; total: number; color: string; compact?: boolean }> = ({
  title,
  items,
  total,
  color,
  compact,
}) => {
  const max = Math.max(1, ...items.map((item) => item.value));
  const [from, to] = BAR_COLOR_MAP[color] || ['#2563eb', '#60a5fa'];
  return (
    <section className="rounded-2xl border border-border/80 bg-card/92 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.06)] transition hover:shadow-[0_12px_40px_rgba(15,23,42,0.09)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        <span className="rounded-full border border-border bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{total}</span>
      </div>
      <div className="space-y-3">
        {items.slice(0, compact ? 5 : 8).map((item) => {
          const pct = Math.max(5, (item.value / max) * 100);
          return (
            <div key={item.name}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-muted-foreground">{item.name}</span>
                <span className="flex-shrink-0 font-mono font-semibold text-slate-500">{item.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100/80">
                <div
                  className="p57-bar-fill"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
                />
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400">No data yet.</div>
        )}
      </div>
    </section>
  );
};

const TrendCard: React.FC<{ title: string; items: Array<{ name: string; value: number }> }> = ({ title, items }) => {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="rounded-2xl border border-border/80 bg-card/92 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        <span className="rounded-full border border-border bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">{total} total</span>
      </div>
      <div className="flex h-24 items-end gap-1.5">
        {items.map((item, idx) => {
          const heightPct = Math.max(6, (item.value / max) * 100);
          const isLast = idx === items.length - 1;
          return (
            <div key={item.name} title={`${item.name}: ${item.value}`} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-90"
                style={{
                  height: `${heightPct}%`,
                  background: isLast
                    ? 'linear-gradient(to top, rgba(37,99,235,0.5), rgba(37,99,235,1))'
                    : 'linear-gradient(to top, rgba(37,99,235,0.15), rgba(37,99,235,0.55))',
                  boxShadow: isLast ? '0 0 8px rgba(37,99,235,0.3)' : undefined,
                }}
              />
              <div className="truncate text-[9px] font-medium text-slate-400">{item.name.split(' ').pop()}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const MomenceOpsPanel: React.FC = () => (
  <WorkspacePanel title="Momence Ops" description="Search any member or session and run direct Momence operations — no ticket required.">
    <div className="h-[calc(100vh-20rem)] min-h-[500px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
      <StandaloneMomencePanel />
    </div>
  </WorkspacePanel>
);

function collapseCategoryRouting(settings: RoutingSettings): RoutingSettings {
  const byKey = new Map<string, RoutingRuleSetting>();
  for (const rule of settings.routingRules) {
    const key = `${rule.category}__${rule.location || ''}`;
    const existing = byKey.get(key);
    const owners = uniqueText([...(existing?.owners || []), ...(rule.owners?.length ? rule.owners : [rule.owner])]);
    byKey.set(key, {
      ...(existing || rule),
      subCategory: '',
      owners: owners.length ? owners : [rule.owner].filter(Boolean),
      owner: owners[0] || existing?.owner || rule.owner,
      active: (existing?.active ?? false) || rule.active,
    });
  }
  return { ...settings, routingRules: Array.from(byKey.values()) };
}

function scopeLocation(scope: RoutingScopeKey): string {
  if (scope === 'mumbai') return 'Mumbai';
  if (scope === 'bengaluru') return 'Bengaluru';
  return '';
}

function selectValues(current: string, values: string[], includeBlank = false): string[] {
  const options = uniqueText([current, ...values]);
  return includeBlank ? ['', ...options] : options;
}

function createRoutingScopeRule(
  settings: RoutingSettings,
  category: string,
  scope: RoutingScopeKey,
  patch: Partial<RoutingRuleSetting>,
): RoutingRuleSetting {
  const requestedOwners = uniqueText(patch.owners?.length ? patch.owners : patch.owner ? [patch.owner] : []);
  const fallbackOwner = settings.employees.find((employee) => employee.active)?.name || ASSOCIATES[0]?.name || 'Nunu Yeptomi';
  const owners = requestedOwners.length ? requestedOwners : [fallbackOwner];
  const owner = owners[0] || fallbackOwner;
  const employee = settings.employees.find((item) => item.name === owner);
  const priority = patch.priority || 'Medium';
  const location = scopeLocation(scope);

  return {
    id: routingRuleId(category, location),
    category,
    subCategory: '',
    location,
    owner,
    owners,
    department: patch.department || employee?.department || settings.departments.find((department) => department.active)?.name || 'Sales & Client Servicing',
    escalation: patch.escalation || employee?.manager || getEscalationTarget(owner),
    priority,
    slaHours: patch.slaHours || PRIORITY_SLA[priority].hours,
    active: patch.active ?? true,
  };
}

function createRoutingCategoryRules(
  settings: RoutingSettings,
  category: string,
  patch: Partial<RoutingRuleSetting>,
): RoutingRuleSetting[] {
  const requestedOwners = uniqueText(patch.owners?.length ? patch.owners : patch.owner ? [patch.owner] : []);
  const fallbackOwner = settings.employees.find((employee) => employee.active)?.name || ASSOCIATES[0]?.name || 'Nunu Yeptomi';
  const owners = requestedOwners.length ? requestedOwners : [fallbackOwner];
  const owner = owners[0] || fallbackOwner;
  const employee = settings.employees.find((item) => item.name === owner);
  const priority = patch.priority || 'Medium';

  return createCityRoutingRules({
    category,
    owner,
    owners,
    department: patch.department || employee?.department || settings.departments.find((department) => department.active)?.name || 'Sales & Client Servicing',
    escalation: patch.escalation || employee?.manager || getEscalationTarget(owner),
    priority,
    slaHours: patch.slaHours || PRIORITY_SLA[priority].hours,
    active: patch.active ?? true,
  });
}

function nextRoutingCategoryName(rules: RoutingRuleSetting[]): string {
  const existing = new Set(rules.map((rule) => rule.category));
  let index = 1;
  while (existing.has(index === 1 ? 'New Routing Row' : `New Routing Row ${index}`)) index += 1;
  return index === 1 ? 'New Routing Row' : `New Routing Row ${index}`;
}

const UserSettingsPanel: React.FC<{
  userEmail: string;
  userDisplayName: string;
  accessRole: string;
  team: string;
}> = ({ userEmail, userDisplayName, accessRole, team }) => (
  <WorkspacePanel title="Settings" description="Your signed-in access profile and user-specific workspace controls.">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Signed in profile</div>
        <div className="mt-3 text-lg font-bold text-slate-950">{userDisplayName}</div>
        <div className="mt-1 text-sm text-slate-500">{userEmail}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Access level</div>
            <div className="mt-1 text-sm font-semibold capitalize text-foreground">{accessRole}</div>
          </div>
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Department scope</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{team || 'User-specific'}</div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-sm font-bold text-slate-950">Workspace access</div>
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          <div className="rounded-lg bg-slate-50 p-3">Ticket queues are limited by the signed-in user and assigned ownership rules.</div>
          <div className="rounded-lg bg-slate-50 p-3">Full routing, team directory, Momence Ops, and global admin controls are reserved for admin access.</div>
          {accessRole === 'manager' && (
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">Manager access includes team-member ticket visibility only inside the manager department scope.</div>
          )}
        </div>
      </div>
    </div>
  </WorkspacePanel>
);

const SettingsPanel: React.FC<{ userEmail: string; accessRole: string }> = ({ userEmail, accessRole }) => {
  const [settings, setSettings] = useState<RoutingSettings>(() => collapseCategoryRouting(defaultRoutingSettings()));
  const [activeSection, setActiveSection] = useState<'overview' | 'routing' | 'team' | 'catalog'>('overview');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const isAdmin = accessRole === 'admin';
  const employeeNames = useMemo(() => settings.employees.filter((item) => item.active).map((item) => item.name), [settings.employees]);
  const departments = useMemo(() => settings.departments.filter((item) => item.active).map((item) => item.name), [settings.departments]);
  const locations = useMemo(() => settings.locations.filter((item) => item.active).map((item) => item.name), [settings.locations]);
  const employeeLocations = useMemo(() => uniqueText(settings.employees.map((item) => item.location || '')), [settings.employees]);
  const employeeLocationOptions = useMemo(() => uniqueText([...employeeLocations, ...locations]), [employeeLocations, locations]);
  const categoryRoutingRows = useMemo(() => {
    const categoryOrder = new Map(Object.keys(CATEGORIES).map((category, index) => [category, index]));
    return buildCategoryRoutingRows(settings.routingRules, EMPTY_ROUTING_FILTERS).sort((a, b) => (
      (categoryOrder.get(a.category) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(b.category) ?? Number.MAX_SAFE_INTEGER) ||
      a.category.localeCompare(b.category)
    ));
  }, [settings.routingRules]);
  const activeRoutingRules = useMemo(() => settings.routingRules.filter((rule) => isCityRoutingRule(rule) && rule.active).length, [settings.routingRules]);
  const pausedRoutingRules = useMemo(() => settings.routingRules.filter((rule) => isCityRoutingRule(rule) && !rule.active).length, [settings.routingRules]);
  const escalationsConfigured = useMemo(
    () => settings.routingRules.filter((rule) => isCityRoutingRule(rule) && Boolean(rule.escalation)).length,
    [settings.routingRules]
  );
  const filteredEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    return settings.employees.filter((employee) => {
      if (!query) return true;
      return [employee.name, employee.email, employee.department, employee.role, employee.location, employee.manager]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [employeeQuery, settings.employees]);
  const filteredDepartments = useMemo(() => {
    const query = departmentQuery.trim().toLowerCase();
    if (!query) return settings.departments;
    return settings.departments.filter((department) => [department.name, department.description].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [departmentQuery, settings.departments]);
  const filteredLocations = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return settings.locations;
    return settings.locations.filter((location) => [location.name, location.city].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [locationQuery, settings.locations]);

  useEffect(() => {
    let mounted = true;
    loadRoutingSettings().then((loaded) => {
      if (mounted) setSettings(collapseCategoryRouting(loaded));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      await saveRoutingSettings(settings);
      setStatus('Settings saved to Supabase. New drafts will use this routing.');
    } catch (error) {
      setStatus(error instanceof Error ? `Settings not saved: ${error.message}` : 'Settings not saved: Supabase save failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateCategoryRow = (row: CategoryRoutingRow, patch: Partial<RoutingRuleSetting>) => {
    setSettings((current) => {
      const targetIds = new Set(
        current.routingRules
          .filter((rule) => (
            patch.category
              ? rule.category === row.category && !rule.subCategory
              : row.ruleIds.includes(rule.id)
          ))
          .map((rule) => rule.id)
      );

      if (targetIds.size === 0) {
        return {
          ...current,
          routingRules: [...createRoutingCategoryRules(current, row.category, patch), ...current.routingRules],
        };
      }

      return {
        ...current,
        routingRules: current.routingRules.map((rule) => (
          targetIds.has(rule.id) ? applyRoutingRulePatch(rule, patch, current.employees) : rule
        )),
      };
    });
  };

  const updateCategoryScope = (category: string, scope: RoutingScopeKey, patch: Partial<RoutingRuleSetting>) => {
    setSettings((current) => {
      const targetIds = new Set(
        current.routingRules
          .filter((rule) => rule.category === category && !rule.subCategory && routingScopeKey(rule) === scope)
          .map((rule) => rule.id)
      );

      if (targetIds.size === 0) {
        return {
          ...current,
          routingRules: [createRoutingScopeRule(current, category, scope, patch), ...current.routingRules],
        };
      }

      return {
        ...current,
        routingRules: current.routingRules.map((rule) => (
          targetIds.has(rule.id) ? applyRoutingRulePatch(rule, patch, current.employees) : rule
        )),
      };
    });
  };

  const updateEmployee = (id: string, patch: Partial<EmployeeSetting>) => {
    setSettings((current) => ({
      ...current,
      employees: current.employees.map((employee) => employee.id === id ? { ...employee, ...patch } : employee),
    }));
  };

  const updateDepartment = (id: string, patch: Partial<DepartmentSetting>) => {
    setSettings((current) => ({
      ...current,
      departments: current.departments.map((department) => department.id === id ? { ...department, ...patch } : department),
    }));
  };

  const updateLocation = (id: string, patch: Partial<LocationSetting>) => {
    setSettings((current) => ({
      ...current,
      locations: current.locations.map((location) => location.id === id ? { ...location, ...patch } : location),
    }));
  };

  const deleteCategoryRow = (category: string) => {
    setSettings((current) => ({
      ...current,
      routingRules: deleteCategoryRoutingRules(current.routingRules, category),
    }));
    setStatus(`Deleted ${category} routing entries in memory. Save settings to sync Supabase.`);
  };

  const deleteEmployee = (id: string) => {
    setSettings((current) => ({
      ...current,
      employees: current.employees.filter((employee) => employee.id !== id),
    }));
    setStatus('Employee entry deleted in memory. Save settings to sync Supabase.');
  };

  const deleteDepartment = (id: string) => {
    setSettings((current) => ({
      ...current,
      departments: current.departments.filter((department) => department.id !== id),
    }));
    setStatus('Department entry deleted in memory. Save settings to sync Supabase.');
  };

  const deleteLocation = (id: string) => {
    setSettings((current) => ({
      ...current,
      locations: current.locations.filter((location) => location.id !== id),
    }));
    setStatus('Location entry deleted in memory. Save settings to sync Supabase.');
  };

  const addRule = () => {
    setSettings((current) => ({
      ...current,
      routingRules: [...createRoutingCategoryRules(current, nextRoutingCategoryName(current.routingRules), {}), ...current.routingRules],
    }));
    setStatus('New city routing row added in memory. Save settings to sync Supabase.');
  };

  const applyPresets = () => {
    const presets = physique57RoutingPresets();
    setSettings((current) => {
      const byId = new Map(current.routingRules.map((rule) => [rule.id, rule]));
      for (const preset of presets) byId.set(preset.id, preset);
      return collapseCategoryRouting({ ...current, routingRules: Array.from(byId.values()) });
    });
    setStatus('Physique 57 routing presets applied. Review and save settings.');
  };

  const resetDefaults = () => {
    setSettings(collapseCategoryRouting(defaultRoutingSettings()));
    setStatus('Default routing restored in memory. Review and save settings to sync Supabase.');
  };

  const addEmployee = () => {
    setSettings((current) => ({
      ...current,
      employees: [
        {
          id: `employee-${Date.now()}`,
          name: 'New Employee',
          email: '',
          department: departments[0] || 'Sales & Client Servicing',
          role: '',
          location: locations[0] || '',
          manager: 'Mitali Kumar',
          active: true,
        },
        ...current.employees,
      ],
    }));
  };

  const addDepartment = () => {
    setSettings((current) => ({
      ...current,
      departments: [{ id: `department-${Date.now()}`, name: 'New Department', description: '', active: true }, ...current.departments],
    }));
  };

  const addLocation = () => {
    setSettings((current) => ({
      ...current,
      locations: [{ id: `location-${Date.now()}`, name: 'New Location', city: '', active: true }, ...current.locations],
    }));
  };

  return (
    <WorkspacePanel title="Settings" description="Admin-controlled routing, ownership, departments, employees, escalation and location intelligence.">
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid gap-3 border-b border-border bg-slate-50 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">Signed in</div>
              <div className="mt-1 truncate text-sm font-semibold text-stone-900">{userEmail}</div>
              <div className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${isAdmin ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-muted-foreground'}`}>
                {isAdmin ? 'Admin access' : 'Support read-only'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <SmallButton onClick={save} disabled={!isAdmin || saving}>{saving ? 'Saving...' : 'Save settings'}</SmallButton>
              {isAdmin && <SmallButton variant="outline" onClick={resetDefaults}>Reset defaults</SmallButton>}
            </div>
          </div>
          <div className="grid border-b border-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['overview', 'Overview', 'Health snapshot'],
              ['routing', 'Routing Rules', `${categoryRoutingRows.length} categories`],
              ['team', 'Team Directory', `${settings.employees.length} people`],
              ['catalog', 'Departments & Locations', `${settings.departments.length + settings.locations.length} entries`],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key as typeof activeSection)}
                className={`border-r border-border px-4 py-3 text-left transition last:border-r-0 ${activeSection === key ? 'bg-blue-50 text-blue-800' : 'bg-card text-muted-foreground hover:bg-slate-50'}`}
              >
                <div className="text-sm font-semibold">{label}</div>
                <div className="mt-0.5 text-xs opacity-70">{count}</div>
              </button>
            ))}
          </div>
          {status && <div className="px-4 py-3 text-xs font-semibold text-muted-foreground">{status}</div>}
        </div>

        <div className="min-w-0">
          {activeSection === 'overview' && (
            <SettingsSection title="Settings Overview">
              <SettingsTable headers={['Area', 'Current State', 'What It Controls', 'Recommended Action']} minWidth="min-w-[980px]">
                <tr className="border-b border-slate-100 last:border-b-0">
                  <SettingsTd>Routing coverage</SettingsTd>
                  <SettingsTd className="font-semibold text-foreground">{categoryRoutingRows.length} categories configured</SettingsTd>
                  <SettingsTd>Owner assignment for new intake tickets by category and city</SettingsTd>
                  <SettingsTd>Review top 10 high-volume categories monthly</SettingsTd>
                </tr>
                <tr className="border-b border-slate-100 last:border-b-0">
                  <SettingsTd>Active routing rules</SettingsTd>
                  <SettingsTd className="font-semibold text-foreground">{activeRoutingRules} active / {pausedRoutingRules} paused</SettingsTd>
                  <SettingsTd>Whether each routing rule can be used for assignment</SettingsTd>
                  <SettingsTd>Pause only temporary exceptions and keep active defaults</SettingsTd>
                </tr>
                <tr className="border-b border-slate-100 last:border-b-0">
                  <SettingsTd>Escalation paths</SettingsTd>
                  <SettingsTd className="font-semibold text-foreground">{escalationsConfigured} rules have escalation owners</SettingsTd>
                  <SettingsTd>Who gets escalated tickets when SLAs are at risk or breached</SettingsTd>
                  <SettingsTd>Ensure every active rule has an escalation owner</SettingsTd>
                </tr>
                <tr>
                  <SettingsTd>Directory readiness</SettingsTd>
                  <SettingsTd className="font-semibold text-foreground">{employeeNames.length} active owners across {departments.length} departments</SettingsTd>
                  <SettingsTd>Owner lists, reporting structure, and routing options</SettingsTd>
                  <SettingsTd>Keep manager and location fields updated for all active team members</SettingsTd>
                </tr>
              </SettingsTable>
            </SettingsSection>
          )}

          {activeSection === 'routing' && (
            <SettingsSection
              title="Issue Owner Routing"
              action={isAdmin ? (
                <div className="flex flex-wrap gap-2">
                  <SmallButton onClick={applyPresets}>Apply P57 presets</SmallButton>
                  <SmallButton variant="outline" onClick={resetDefaults}>Reset defaults</SmallButton>
                  <SmallButton onClick={addRule}>Add row</SmallButton>
                </div>
              ) : null}
            >
              <SettingsTable
                headers={['Category', 'Mumbai routing', 'Mumbai escalation', 'Bengaluru routing', 'Bengaluru escalation', 'Department', 'Priority', 'SLA', 'Active', 'Actions']}
                minWidth="min-w-[1740px]"
              >
                {categoryRoutingRows.slice(0, 160).map((row) => (
                  <tr key={row.category} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
                    <SettingsTd className="w-[220px]">
                      <SettingsInput disabled={!isAdmin} value={row.category} onChange={(category) => updateCategoryRow(row, { category })} />
                      <div className="mt-1 text-[10px] font-semibold text-slate-400">
                        {row.ruleIds.length} city rule{row.ruleIds.length === 1 ? '' : 's'}
                      </div>
                    </SettingsTd>
                    <SettingsTd className="w-[280px]">
                      <RoutingOwnersCell disabled={!isAdmin} scope={row.mumbai} employeeNames={employeeNames} onChange={(owners) => updateCategoryScope(row.category, 'mumbai', { owners, owner: owners[0] })} />
                    </SettingsTd>
                    <SettingsTd className="w-[210px]">
                      <SettingsSelect disabled={!isAdmin} value={row.mumbai.escalation} values={selectValues(row.mumbai.escalation, employeeNames)} onChange={(escalation) => updateCategoryScope(row.category, 'mumbai', { escalation })} />
                      {row.mumbai.mixed.escalation && <SettingsMixedHint />}
                    </SettingsTd>
                    <SettingsTd className="w-[280px]">
                      <RoutingOwnersCell disabled={!isAdmin} scope={row.bengaluru} employeeNames={employeeNames} onChange={(owners) => updateCategoryScope(row.category, 'bengaluru', { owners, owner: owners[0] })} />
                    </SettingsTd>
                    <SettingsTd className="w-[210px]">
                      <SettingsSelect disabled={!isAdmin} value={row.bengaluru.escalation} values={selectValues(row.bengaluru.escalation, employeeNames)} onChange={(escalation) => updateCategoryScope(row.category, 'bengaluru', { escalation })} />
                      {row.bengaluru.mixed.escalation && <SettingsMixedHint />}
                    </SettingsTd>
                    <SettingsTd className="w-[190px]">
                      <SettingsSelect disabled={!isAdmin} value={row.summary.department} values={selectValues(row.summary.department, departments)} onChange={(department) => updateCategoryRow(row, { department })} />
                      {row.summary.mixed.department && <SettingsMixedHint />}
                    </SettingsTd>
                    <SettingsTd className="w-[140px]">
                      <SettingsSelect disabled={!isAdmin} value={row.summary.priority} values={Object.keys(PRIORITY_SLA)} onChange={(priority) => updateCategoryRow(row, { priority: priority as RoutingRuleSetting['priority'] })} />
                      {row.summary.mixed.priority && <SettingsMixedHint />}
                    </SettingsTd>
                    <SettingsTd className="w-[100px]">
                      <SettingsInput disabled={!isAdmin} value={String(row.summary.slaHours)} onChange={(slaHours) => updateCategoryRow(row, { slaHours: Number(slaHours) || row.summary.slaHours })} />
                      {row.summary.mixed.slaHours && <SettingsMixedHint />}
                    </SettingsTd>
                    <SettingsTd className="w-[90px]">
                      <SettingsCheckbox disabled={!isAdmin} checked={row.summary.active} onChange={(active) => updateCategoryRow(row, { active })} />
                      {row.summary.mixed.active && <SettingsMixedHint />}
                    </SettingsTd>
                    <SettingsTd className="w-[110px]">
                      <SmallButton disabled={!isAdmin} variant="danger" onClick={() => deleteCategoryRow(row.category)}>Delete row</SmallButton>
                    </SettingsTd>
                  </tr>
                ))}
                {categoryRoutingRows.length === 0 && (
                  <SettingsEmptyRow colSpan={10}>No category routing rows match the current filters.</SettingsEmptyRow>
                )}
              </SettingsTable>
            </SettingsSection>
          )}

          {activeSection === 'team' && (
            <SettingsSection title="Employee Directory" action={isAdmin ? <SmallButton onClick={addEmployee}>Add employee</SmallButton> : null}>
              <div className="mb-4 rounded-lg border border-border bg-slate-50/80 p-4">
                <SettingsInput label="Search employees" value={employeeQuery} onChange={setEmployeeQuery} />
              </div>
              <SettingsTable
                headers={['Name', 'Email', 'Department', 'Manager', 'Role', 'Location', 'Active', 'Actions']}
                minWidth="min-w-[1290px]"
              >
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
                    <SettingsTd className="w-[170px]">
                      <SettingsInput disabled={!isAdmin} value={employee.name} onChange={(name) => updateEmployee(employee.id, { name })} />
                    </SettingsTd>
                    <SettingsTd className="w-[220px]">
                      <SettingsInput disabled={!isAdmin} value={employee.email || ''} onChange={(email) => updateEmployee(employee.id, { email })} />
                    </SettingsTd>
                    <SettingsTd className="w-[190px]">
                      <SettingsSelect disabled={!isAdmin} value={employee.department} values={departments} onChange={(department) => updateEmployee(employee.id, { department })} />
                    </SettingsTd>
                    <SettingsTd className="w-[190px]">
                      <SettingsSelect disabled={!isAdmin} value={employee.manager || ''} values={employeeNames} onChange={(manager) => updateEmployee(employee.id, { manager })} />
                    </SettingsTd>
                    <SettingsTd className="w-[200px]">
                      <SettingsInput disabled={!isAdmin} value={employee.role || ''} onChange={(role) => updateEmployee(employee.id, { role })} />
                    </SettingsTd>
                    <SettingsTd className="w-[210px]">
                      <SettingsSelect disabled={!isAdmin} value={employee.location || ''} values={employeeLocationOptions} onChange={(location) => updateEmployee(employee.id, { location })} />
                    </SettingsTd>
                    <SettingsTd className="w-[90px]">
                      <SettingsCheckbox disabled={!isAdmin} checked={employee.active} onChange={(active) => updateEmployee(employee.id, { active })} />
                    </SettingsTd>
                    <SettingsTd className="w-[110px]">
                      <SmallButton disabled={!isAdmin} variant="danger" onClick={() => deleteEmployee(employee.id)}>Delete</SmallButton>
                    </SettingsTd>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <SettingsEmptyRow colSpan={8}>No employees match the current filters.</SettingsEmptyRow>
                )}
              </SettingsTable>
            </SettingsSection>
          )}

          {activeSection === 'catalog' && (
            <SettingsSection title="Departments & Locations">
              <div className="mb-4 flex flex-wrap gap-2">
                {isAdmin && <SmallButton onClick={addDepartment}>Add department</SmallButton>}
                {isAdmin && <SmallButton onClick={addLocation}>Add location</SmallButton>}
              </div>
              <div className="mb-5 rounded-lg border border-border bg-slate-50/80 p-4">
                <SettingsInput label="Search departments" value={departmentQuery} onChange={setDepartmentQuery} />
              </div>
              <div className="mb-4 rounded-lg border border-border bg-slate-50/80 p-4">
                <SettingsInput label="Search locations" value={locationQuery} onChange={setLocationQuery} />
              </div>
              <SettingsList items={filteredDepartments} disabled={!isAdmin} onChange={updateDepartment} onDelete={deleteDepartment} />
              <div className="mt-5">
              <SettingsTable
                headers={['Studio / Location', 'City', 'Active', 'Actions']}
                minWidth="min-w-[790px]"
              >
                {filteredLocations.map((location) => (
                  <tr key={location.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
                    <SettingsTd className="w-[360px]">
                      <SettingsInput disabled={!isAdmin} value={location.name} onChange={(name) => updateLocation(location.id, { name })} />
                    </SettingsTd>
                    <SettingsTd className="w-[220px]">
                      <SettingsInput disabled={!isAdmin} value={location.city || ''} onChange={(city) => updateLocation(location.id, { city })} />
                    </SettingsTd>
                    <SettingsTd className="w-[90px]">
                      <SettingsCheckbox disabled={!isAdmin} checked={location.active} onChange={(active) => updateLocation(location.id, { active })} />
                    </SettingsTd>
                    <SettingsTd className="w-[110px]">
                      <SmallButton disabled={!isAdmin} variant="danger" onClick={() => deleteLocation(location.id)}>Delete</SmallButton>
                    </SettingsTd>
                  </tr>
                ))}
                {filteredLocations.length === 0 && (
                  <SettingsEmptyRow colSpan={4}>No locations match the current search.</SettingsEmptyRow>
                )}
              </SettingsTable>
              </div>
            </SettingsSection>
          )}
        </div>
      </div>
    </WorkspacePanel>
  );
};

const SettingsSection: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <div>
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">Changes here affect new ticket drafts, assignment, escalation and SLA routing.</p>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const SettingsTable: React.FC<{ headers: string[]; minWidth?: string; children: React.ReactNode }> = ({ headers, minWidth = 'min-w-[900px]', children }) => (
  <div className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left ${minWidth}`}>
        <thead className="bg-slate-100/90">
          <tr>
            {headers.map((header, index) => (
              <th key={`${header}-${index}`} scope="col" className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-card">
          {children}
        </tbody>
      </table>
    </div>
  </div>
);

const SettingsTd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`px-3 py-2 ${className}`}>
    {children}
  </td>
);

const SettingsEmptyRow: React.FC<{ colSpan: number; children: React.ReactNode }> = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
      {children}
    </td>
  </tr>
);

const SettingsMixedHint: React.FC = () => (
  <div className="mt-1 text-[10px] font-semibold text-amber-700">Mixed values in this category</div>
);

const RoutingOwnersCell: React.FC<{
  scope: RoutingScopeSummary;
  employeeNames: string[];
  disabled: boolean;
  onChange: (owners: string[]) => void;
}> = ({ scope, employeeNames, disabled, onChange }) => (
  <div>
    <SettingsMultiSelect
      disabled={disabled}
      values={employeeNames}
      selected={scope.owners}
      emptyText={`No ${scope.label.toLowerCase()} rule`}
      inline
      onChange={onChange}
    />
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-400">
      <span>{scope.ruleIds.length ? `${scope.ruleIds.length} rule${scope.ruleIds.length === 1 ? '' : 's'}` : 'Create on owner add'}</span>
      {scope.locations.length > 0 && <span>{scope.locations.join(', ')}</span>}
      {scope.mixed.owners && <span className="text-amber-700">Mixed pools</span>}
    </div>
  </div>
);

const SmallButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean; variant?: 'primary' | 'outline' | 'danger' | 'success' }> = ({ onClick, children, disabled, variant = 'primary' }) => {
  const classes = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-border bg-card text-muted-foreground hover:bg-slate-100',
    danger: 'bg-blue-700 text-white hover:bg-blue-800',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[variant];

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`rounded-md px-3 py-2 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${classes}`}>
      {children}
    </button>
  );
};

const SettingsInput: React.FC<{ label?: string; value: string; disabled?: boolean; onChange: (value: string) => void }> = ({ label, value, disabled, onChange }) => (
  <label className="block">
    {label && <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>}
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500"
    />
  </label>
);

const SettingsSelect: React.FC<{ label?: string; value: string; values: string[]; disabled?: boolean; onChange: (value: string) => void }> = ({ label, value, values, disabled, onChange }) => (
  <label className="block">
    {label && <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>}
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-500"
    >
      {values.map((item) => <option key={item || 'blank'} value={item}>{item || 'All'}</option>)}
    </select>
  </label>
);

const SettingsMultiSelect: React.FC<{
  label?: string;
  values: string[];
  selected: string[];
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  compact?: boolean;
  inline?: boolean;
  onChange: (value: string[]) => void;
}> = ({ label, values, selected, disabled, placeholder = 'Search options...', emptyText = 'No options selected', compact, inline, onChange }) => {
  const [query, setQuery] = useState('');
  const normalizedValues = uniqueText(values);
  const normalizedSelected = uniqueText(selected);
  const filtered = normalizedValues.filter((value) => value.toLowerCase().includes(query.toLowerCase())).slice(0, compact ? 4 : 18);
  const selectedSet = new Set(normalizedSelected);
  const availableValues = normalizedValues.filter((value) => !selectedSet.has(value));
  const toggle = (value: string) => {
    if (disabled) return;
    const next = selectedSet.has(value)
      ? normalizedSelected.filter((item) => item !== value)
      : [...normalizedSelected, value];
    onChange(next);
  };

  if (inline) {
    return (
      <div>
        {label && <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>}
        <div className="rounded-lg border border-border bg-slate-50 p-2">
          <div className="mb-2 flex min-h-7 flex-wrap gap-1.5">
            {normalizedSelected.length ? normalizedSelected.map((item) => (
              <button
                key={item}
                type="button"
                disabled={disabled}
                onClick={() => toggle(item)}
                className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 disabled:cursor-default"
              >
                {item} x
              </button>
            )) : <span className="px-1 py-1 text-xs text-slate-400">{emptyText}</span>}
          </div>
          <select
            value=""
            disabled={disabled || availableValues.length === 0}
            onChange={(event) => {
              if (event.target.value) toggle(event.target.value);
            }}
            className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs font-medium text-muted-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">Add owner...</option>
            {availableValues.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>}
      <div className="rounded-lg border border-border bg-slate-50 p-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {normalizedSelected.length ? normalizedSelected.map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => toggle(item)}
              className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 disabled:cursor-default"
            >
              {item}
            </button>
          )) : <span className="px-1 text-xs text-slate-400">{emptyText}</span>}
        </div>
        <input
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="mb-2 h-8 w-full rounded-md border border-border bg-card px-3 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-100"
        />
        <div className={`grid gap-1 overflow-y-auto ${compact ? 'max-h-20' : 'max-h-36 sm:grid-cols-2'}`}>
          {filtered.map((value) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(value)}
              className={`rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition ${selectedSet.has(value) ? 'bg-slate-950 text-white' : 'bg-card text-muted-foreground hover:bg-blue-50'} disabled:cursor-default disabled:opacity-60`}
            >
              {value}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-md bg-card px-2 py-2 text-[11px] font-semibold text-slate-400">No matching options</div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingsCheckbox: React.FC<{ label?: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, disabled, onChange }) => (
  <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
    {label}
  </label>
);

const SettingsList: React.FC<{
  items: DepartmentSetting[];
  disabled: boolean;
  onChange: (id: string, patch: Partial<DepartmentSetting>) => void;
  onDelete: (id: string) => void;
}> = ({ items, disabled, onChange, onDelete }) => (
  <SettingsTable
    headers={['Department', 'Description', 'Active', 'Actions']}
    minWidth="min-w-[870px]"
  >
    {items.map((item) => (
      <tr key={item.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
        <SettingsTd className="w-[240px]">
          <SettingsInput disabled={disabled} value={item.name} onChange={(name) => onChange(item.id, { name })} />
        </SettingsTd>
        <SettingsTd className="w-[420px]">
          <SettingsInput disabled={disabled} value={item.description || ''} onChange={(description) => onChange(item.id, { description })} />
        </SettingsTd>
        <SettingsTd className="w-[90px]">
          <SettingsCheckbox disabled={disabled} checked={item.active} onChange={(active) => onChange(item.id, { active })} />
        </SettingsTd>
        <SettingsTd className="w-[110px]">
          <SmallButton disabled={disabled} variant="danger" onClick={() => onDelete(item.id)}>Delete</SmallButton>
        </SettingsTd>
      </tr>
    ))}
    {items.length === 0 && (
      <SettingsEmptyRow colSpan={4}>No departments match the current search.</SettingsEmptyRow>
    )}
  </SettingsTable>
);

export default AppLayout;
