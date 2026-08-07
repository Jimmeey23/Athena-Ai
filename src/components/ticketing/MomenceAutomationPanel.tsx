import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMomenceMemberToSessionForFree,
  addMomenceMemberToWaitlist,
  assignMomenceTag,
  cancelMomenceBooking,
  checkInMomenceBooking,
  freezeMomenceMembership,
  loadMomenceTicketContext,
  MomenceMemberOption,
  MomenceSessionOption,
  MomenceTicketContext,
  removeScheduledMomenceMembershipUnfreeze,
  removeMomenceBookingCheckIn,
  scheduleMomenceMembershipUnfreeze,
  searchMomenceMembers,
  searchMomenceSessions,
  unfreezeMomenceMembership,
  unassignMomenceTag,
} from '@/lib/momence-api';
import { Ticket } from '@/lib/ticketing-data';
import { BadgeCheck, Calendar, CheckCircle2, Loader2, Tag, User, XCircle } from 'lucide-react';

interface Props {
  ticket: Ticket;
}

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
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function toApiDateTime(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

async function confirmed(message: string, action: () => Promise<unknown>) {
  if (!window.confirm(message)) return false;
  await action();
  return true;
}

export const MomenceAutomationPanel: React.FC<Props> = ({ ticket }) => {
  const [memberQuery, setMemberQuery] = useState(ticket.memberName || '');
  const [sessionQuery, setSessionQuery] = useState(ticket.classType || '');
  const [memberOptions, setMemberOptions] = useState<MomenceMemberOption[]>([]);
  const [sessionOptions, setSessionOptions] = useState<MomenceSessionOption[]>([]);
  const [selectedMember, setSelectedMember] = useState<MomenceMemberOption | null>(null);
  const [selectedSession, setSelectedSession] = useState<MomenceSessionOption | null>(null);
  const [data, setData] = useState<MomenceTicketContext>(emptyState);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [freezeAt, setFreezeAt] = useState('');
  const [unfreezeAt, setUnfreezeAt] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setMemberQuery(ticket.memberName || '');
    setSessionQuery(ticket.classType || '');
    setSelectedMember(null);
    setSelectedSession(null);
    setData(emptyState);
    setFreezeAt('');
    setUnfreezeAt('');
    setFreezeReason('');
    setError(null);
    setNotice(null);
  }, [ticket.id, ticket.memberName, ticket.classType]);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      if (memberQuery.trim().length < 2) {
        setMemberOptions([]);
        return;
      }
      try {
        setMemberOptions(await searchMomenceMembers(memberQuery));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Member search failed');
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [memberQuery]);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      try {
        setSessionOptions(await searchMomenceSessions(sessionQuery));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Session search failed');
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [sessionQuery]);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      setData(await loadMomenceTicketContext({
        memberId: selectedMember?.id,
        sessionId: selectedSession?.id,
        includeTags: true,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Momence context');
    } finally {
      setLoading(false);
    }
  }, [selectedMember, selectedSession]);

  useEffect(() => {
    if (selectedMember || selectedSession) loadContext();
  }, [loadContext, selectedMember, selectedSession]);

  const runAction = async (key: string, message: string, action: () => Promise<unknown>) => {
    setActionLoading(key);
    setError(null);
    setNotice(null);
    try {
      const didRun = await confirmed(message, action);
      if (didRun) {
        setNotice('Momence action completed.');
        await loadContext();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Momence action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedMemberTagIds = useMemo(() => {
    return new Set((data.member?.customerTags || []).map((tag) => String(tag.id)));
  }, [data.member?.customerTags]);

  const matchingSessionBooking = useMemo(() => {
    if (!selectedMember) return undefined;
    return data.sessionBookings.find((booking) => String(booking.member?.id) === selectedMember.id && !booking.cancelledAt);
  }, [data.sessionBookings, selectedMember]);

  return (
    <div className="rounded-lg border border-border bg-slate-50 dark:bg-slate-950/40 p-3 space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Momence Automations</div>
        <p className="text-xs text-muted-foreground">
          Select the live Momence member and session before running operations.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</div>}
      {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{notice}</div>}

      <div className="grid grid-cols-1 gap-2">
        <SearchBox<MomenceMemberOption>
          icon={<User className="w-3.5 h-3.5" />}
          label="Member"
          query={memberQuery}
          onQueryChange={setMemberQuery}
          options={memberOptions}
          selectedLabel={selectedMember?.label}
          onSelect={setSelectedMember}
        />
        <SearchBox<MomenceSessionOption>
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="Session"
          query={sessionQuery}
          onQueryChange={setSessionQuery}
          options={sessionOptions}
          selectedLabel={selectedSession?.label}
          onSelect={setSelectedSession}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton disabled={!selectedMember || !selectedSession} loading={actionLoading === 'free'} onClick={() => {
          if (!selectedMember || !selectedSession) return;
          runAction(
            'free',
            `Add ${selectedMember.label} to ${selectedSession.classType} for free in Momence?`,
            () => addMomenceMemberToSessionForFree(selectedMember.id, selectedSession.id)
          );
        }}>
          Add Free Booking
        </ActionButton>
        <ActionButton disabled={!selectedMember || !selectedSession} loading={actionLoading === 'waitlist'} onClick={() => {
          if (!selectedMember || !selectedSession) return;
          runAction(
            'waitlist',
            `Add ${selectedMember.label} to the waitlist for ${selectedSession.classType}?`,
            () => addMomenceMemberToWaitlist(selectedMember.id, selectedSession.id)
          );
        }}>
          Add Waitlist
        </ActionButton>
        {matchingSessionBooking && (
          <>
            <ActionButton loading={actionLoading === 'checkin'} onClick={() => {
              runAction(
                'checkin',
                `${matchingSessionBooking.checkedIn ? 'Remove check-in for' : 'Check in'} ${selectedMember?.label}?`,
                () => matchingSessionBooking.checkedIn
                  ? removeMomenceBookingCheckIn(matchingSessionBooking.id)
                  : checkInMomenceBooking(matchingSessionBooking.id)
              );
            }}>
              {matchingSessionBooking.checkedIn ? 'Remove Check-in' : 'Check In'}
            </ActionButton>
            <ActionButton tone="danger" loading={actionLoading === 'cancel'} onClick={() => {
              runAction(
                'cancel',
                `Cancel the Momence booking for ${selectedMember?.label}? This will not refund by default.`,
                () => cancelMomenceBooking(matchingSessionBooking.id)
              );
            }}>
              Cancel Booking
            </ActionButton>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <InfoBlock title="Member Context" icon={<User className="w-3.5 h-3.5" />}>
          {loading ? <LoadingLine /> : data.summary.member ? (
            <div className="space-y-2">
              <Metric label="Name" value={data.summary.member.name} />
              <Metric label="Contact" value={[data.summary.member.email, data.summary.member.phoneNumber].filter(Boolean).join(' · ') || 'Not returned'} />
              <Metric label="First Seen" value={formatDate(data.summary.member.firstSeen)} />
              <Metric label="Last Seen" value={formatDate(data.summary.member.lastSeen)} />
              <div className="flex flex-wrap gap-1">
                {data.summary.member.tags.map((tag) => (
                  <span key={tag} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{tag}</span>
                ))}
                {data.summary.member.tags.length === 0 && <span className="text-[11px] text-slate-400">No tags returned</span>}
              </div>
            </div>
          ) : <EmptyLine text="No Momence member selected." />}
        </InfoBlock>

        <InfoBlock title="Active Memberships" icon={<BadgeCheck className="w-3.5 h-3.5" />}>
          {data.summary.membershipOverview.memberships.length ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-card/70 p-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Freeze at</span>
                  <input
                    type="datetime-local"
                    value={freezeAt}
                    onChange={(event) => setFreezeAt(event.target.value)}
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Unfreeze at</span>
                  <input
                    type="datetime-local"
                    value={unfreezeAt}
                    onChange={(event) => setUnfreezeAt(event.target.value)}
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Reason</span>
                  <input
                    value={freezeReason}
                    onChange={(event) => setFreezeReason(event.target.value)}
                    placeholder="Medical, travel, billing exception..."
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"
                  />
                </label>
              </div>
              {data.summary.membershipOverview.memberships.slice(0, 5).map((membership) => (
            <div key={membership.id} className="rounded-md border border-border bg-card p-2">
              <div className="text-xs font-medium text-foreground">
                {membership.name}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {membership.status} · {membership.type || 'membership'} · Ends {formatDate(membership.validUntil)}
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                {membership.creditsLabel && <div>{membership.creditsLabel}</div>}
                {membership.moneyCreditsLabel && <div>{membership.moneyCreditsLabel}</div>}
                {membership.usageLabel && <div>{membership.usageLabel}</div>}
                {membership.usagePeriodLabel && <div>{membership.usagePeriodLabel}</div>}
                {membership.freezeLabel && <div>{membership.freezeLabel}</div>}
                {membership.scheduledUnfreezeAt && <div>Scheduled unfreeze {formatDate(membership.scheduledUnfreezeAt)}</div>}
                {membership.declinedRenewalLabel && <div className="text-red-600">{membership.declinedRenewalLabel}</div>}
              </div>
              {selectedMember && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ActionButton loading={actionLoading === `freeze-now-${membership.id}`} onClick={() => {
                    runAction(
                      `freeze-now-${membership.id}`,
                      `Freeze ${membership.name} now in Momence${unfreezeAt ? ` and schedule unfreeze for ${unfreezeAt}` : ''}?`,
                      () => freezeMomenceMembership(selectedMember.id, membership.id, {
                        unfreezeAt: toApiDateTime(unfreezeAt),
                        reason: freezeReason,
                      })
                    );
                  }}>
                    Freeze Now
                  </ActionButton>
                  <ActionButton disabled={!freezeAt} loading={actionLoading === `schedule-freeze-${membership.id}`} onClick={() => {
                    runAction(
                      `schedule-freeze-${membership.id}`,
                      `Schedule freeze for ${membership.name} at ${freezeAt}?`,
                      () => freezeMomenceMembership(selectedMember.id, membership.id, {
                        freezeAt: toApiDateTime(freezeAt),
                        unfreezeAt: toApiDateTime(unfreezeAt),
                        reason: freezeReason,
                      })
                    );
                  }}>
                    Schedule Freeze
                  </ActionButton>
                  <ActionButton loading={actionLoading === `unfreeze-${membership.id}`} onClick={() => {
                    runAction(
                      `unfreeze-${membership.id}`,
                      `Unfreeze or remove scheduled freeze for ${membership.name}?`,
                      () => unfreezeMomenceMembership(selectedMember.id, membership.id)
                    );
                  }}>
                    Unfreeze
                  </ActionButton>
                  <ActionButton disabled={!unfreezeAt} loading={actionLoading === `schedule-unfreeze-${membership.id}`} onClick={() => {
                    runAction(
                      `schedule-unfreeze-${membership.id}`,
                      `Schedule unfreeze for ${membership.name} at ${unfreezeAt}?`,
                      () => scheduleMomenceMembershipUnfreeze(selectedMember.id, membership.id, toApiDateTime(unfreezeAt) || unfreezeAt)
                    );
                  }}>
                    Schedule Unfreeze
                  </ActionButton>
                  {membership.scheduledUnfreezeAt && (
                    <ActionButton tone="danger" loading={actionLoading === `remove-unfreeze-${membership.id}`} onClick={() => {
                      runAction(
                        `remove-unfreeze-${membership.id}`,
                        `Remove scheduled unfreeze for ${membership.name}?`,
                        () => removeScheduledMomenceMembershipUnfreeze(selectedMember.id, membership.id)
                      );
                    }}>
                      Remove Scheduled Unfreeze
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
              ))}
            </div>
          ) : <EmptyLine text="No active memberships loaded." />}
        </InfoBlock>

        <InfoBlock title="Session Context" icon={<Calendar className="w-3.5 h-3.5" />}>
          {data.summary.session ? (
            <div className="space-y-1">
              <Metric label="Session" value={data.summary.session.classType} />
              <Metric label="Starts" value={formatDate(data.summary.session.startsAt)} />
              <Metric label="Instructor" value={data.summary.session.trainer || 'Not returned'} />
              <Metric label="Studio" value={data.summary.session.studio || 'Not returned'} />
              <Metric label="Booked" value={data.summary.session.fillRateLabel || 'Not returned'} />
              <Metric label="Waitlist" value={data.summary.session.waitlistLabel || 'Not returned'} />
              <Metric
                label="Selected member"
                value={data.summary.session.matchingMemberBookingId
                  ? `Booked${data.summary.session.matchingMemberCheckedIn ? ' · checked in' : ''}`
                  : 'No active booking match'}
              />
            </div>
          ) : <EmptyLine text="No Momence session selected." />}
        </InfoBlock>

        <InfoBlock title="Member Sessions & Notes" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
          <div className="mb-2 grid grid-cols-3 gap-1 text-center">
            <TinyStat label="Loaded" value={String(data.summary.bookingOverview.totalLoaded)} />
            <TinyStat label="Checked in" value={String(data.summary.bookingOverview.checkedInCount)} />
            <TinyStat label="Cancelled" value={String(data.summary.bookingOverview.cancelledCount)} />
          </div>
          {data.summary.bookingOverview.lastVisit && (
            <div className="mb-1 rounded bg-slate-50 p-1.5 text-[11px] text-muted-foreground dark:bg-slate-950">
              Last visit: {data.summary.bookingOverview.lastVisit.classType} · {formatDate(data.summary.bookingOverview.lastVisit.startsAt)}
            </div>
          )}
          {data.summary.bookingOverview.nextBooking && (
            <div className="mb-1 rounded bg-emerald-50 p-1.5 text-[11px] text-emerald-700">
              Next booking: {data.summary.bookingOverview.nextBooking.classType} · {formatDate(data.summary.bookingOverview.nextBooking.startsAt)}
            </div>
          )}
          {data.summary.bookingOverview.recentBookings.slice(0, 3).map((booking) => (
            <div key={booking.id} className="text-[11px] text-muted-foreground">
              {booking.classType} · {formatDate(booking.startsAt)}{booking.checkedIn ? ' · checked in' : ''}
            </div>
          ))}
          {data.summary.noteOverview.latestNote && (
            <div className="mt-1 rounded bg-card p-1.5 text-[11px] text-muted-foreground">
              Latest note: {data.summary.noteOverview.latestNote}
            </div>
          )}
          {!data.memberBookings.length && !data.notes.length && <EmptyLine text="No bookings or notes loaded." />}
        </InfoBlock>

        {data.summary.ticketContextLines.length > 0 && (
          <InfoBlock title="Athena Context Lines" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            <div className="space-y-1">
              {data.summary.ticketContextLines.slice(0, 10).map((line) => (
                <div key={line} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-muted-foreground dark:bg-slate-950">
                  {line}
                </div>
              ))}
            </div>
          </InfoBlock>
        )}
      </div>

      {selectedMember && data.tags.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedTagId}
            onChange={(event) => setSelectedTagId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">Select Momence tag</option>
            {data.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <ActionButton disabled={!selectedTagId} loading={actionLoading === 'tag'} onClick={() => {
            if (!selectedTagId || !selectedMember) return;
            const hasTag = selectedMemberTagIds.has(selectedTagId);
            runAction(
              'tag',
              `${hasTag ? 'Remove' : 'Assign'} this Momence tag for ${selectedMember.label}?`,
              () => hasTag ? unassignMomenceTag(selectedMember.id, selectedTagId) : assignMomenceTag(selectedMember.id, selectedTagId)
            );
          }}>
            <Tag className="w-3 h-3" />
            {selectedMemberTagIds.has(selectedTagId) ? 'Remove' : 'Assign'}
          </ActionButton>
        </div>
      )}
    </div>
  );
};

const SearchBox = <TOption extends { id: string; label: string; description: string }>({
  icon,
  label,
  query,
  onQueryChange,
  options,
  selectedLabel,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: TOption[];
  selectedLabel?: string;
  onSelect: (option: TOption) => void;
}) => (
  <div>
    <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </label>
    <input
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder={`Search Momence ${label.toLowerCase()}`}
      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {selectedLabel && <div className="mt-1 text-[11px] font-medium text-emerald-700">Selected: {selectedLabel}</div>}
    {options.length > 0 && (
      <div className="mt-1 max-h-24 overflow-y-auto rounded-md border border-border bg-card">
        {options.slice(0, 5).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            className="block w-full border-b border-slate-100 px-2 py-1.5 text-left text-xs last:border-0 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            <div className="font-medium text-foreground">{option.label}</div>
            <div className="text-[11px] text-muted-foreground">{option.description}</div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const InfoBlock: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-md border border-border bg-card p-2">
    <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {title}
    </div>
    {children}
  </div>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-2 text-[11px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium text-foreground">{value}</span>
  </div>
);

const TinyStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded bg-slate-50 px-1.5 py-1 dark:bg-slate-950">
    <div className="text-xs font-semibold text-foreground">{value}</div>
    <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
  </div>
);

const ActionButton: React.FC<{
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'danger';
  onClick: () => void;
}> = ({ children, disabled, loading, tone = 'default', onClick }) => (
  <button
    type="button"
    disabled={disabled || loading}
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
      tone === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-blue-600 text-white hover:bg-blue-700'
    }`}
  >
    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
    {children}
  </button>
);

const LoadingLine = () => (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <Loader2 className="w-3 h-3 animate-spin" />
    Loading from Momence...
  </div>
);

const EmptyLine: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-1 text-xs text-slate-400">
    <XCircle className="w-3 h-3" />
    {text}
  </div>
);
