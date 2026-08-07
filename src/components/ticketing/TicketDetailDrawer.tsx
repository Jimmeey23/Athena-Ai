import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ticket,
  PRIORITY_SLA,
  STATUSES,
  ASSOCIATES,
  CATEGORIES,
  STUDIOS,
  TRAINERS,
  RESOLUTION_ESCALATION_OPTIONS,
  RESOLUTION_FOLLOW_UP_CHANNELS,
  RESOLUTION_MEMBER_RESPONSES,
  RESOLUTION_PATHWAYS,
  RESOLUTION_STAGES,
  getEscalationTarget,
} from '@/lib/ticketing-data';
import { buildTicketEditPatch } from '@/lib/ticket-editing';
import { canSelectStatusFromTicket, validateTicketStatusUpdate } from '@/lib/ticket-status-lifecycle';
import { TicketStatusUpdateInput } from './TicketContext';
import { useTickets } from './useTickets';
import { X, Clock, MapPin, User, Calendar, Tag, MessageSquare, Phone, Lock, Pencil, Save, Trash2, Link2, Plus } from 'lucide-react';
import { MomenceAutomationPanel } from './MomenceAutomationPanel';
import { backendSupabase } from '@/lib/backend-supabase';
import { MomenceMemberTicketField, MomenceSessionTicketField } from './MomenceTicketEntityFields';
import { buildResolutionAssistant } from '@/lib/smart-ops-intelligence';
import { todayLocalDateKey, safeFormatDate, safeFormatDateOnly, safeParseDate } from '@/lib/date-utils';

interface Props {
  ticket: Ticket | null;
  onClose: () => void;
}

interface TicketAttachmentRecord {
  path?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  publicUrl?: string;
  uploadedAt?: string;
}

function readTicketAttachments(ticket: Ticket): TicketAttachmentRecord[] {
  const raw = (ticket.metadata as Record<string, unknown> | undefined)?.attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is TicketAttachmentRecord => Boolean(entry && typeof entry === 'object'));
}

function defaultStatusValues(ticket?: Ticket | null): TicketStatusUpdateInput {
  return {
    status: ticket?.status || 'New',
    reason: '',
    actionTaken: '',
    actionDate: todayLocalDateKey(),
    followUps: [],
    comments: '',
    notes: '',
    resolutionSummary: '',
    outcome: '',
  };
}

function tagsFromInput(value: string): string[] {
  return Array.from(new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean)));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function getDisplayResolutionSteps(ticket: Ticket, assistantSteps: string[]): string[] {
  const planned = stringArray(ticket.metadata?.resolutionPlan?.steps);
  if (planned.length) return planned;
  const recommended = stringArray(ticket.metadata?.recommendedResolutionSteps);
  if (recommended.length) return recommended;
  return stringArray(assistantSteps);
}

function stepsFromTextarea(value: string): string[] {
  return Array.from(new Set(
    value
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
  ));
}

function inferResolutionPathway(ticket: Ticket): string {
  const text = `${ticket.category} ${ticket.subCategory} ${ticket.description}`.toLowerCase();
  if (/billing|payment|refund|invoice|charge|package|membership/.test(text)) return 'Billing adjustment';
  if (/momence|booking|waitlist|class|session|attendance|check.?in/.test(text)) return 'Momence correction';
  if (/repair|maintenance|ac|hvac|clean|facility|equipment/.test(text)) return 'Operations repair';
  if (/trainer|instructor|cue|class quality|music|form/.test(text)) return 'Training coaching';
  if (/partnership|hosted|event|influencer|partner/.test(text)) return 'Partnership follow-up';
  if (/policy|terms|rule|cancellation/.test(text)) return 'Policy clarification';
  return 'Member communication';
}

function defaultResolutionFields(ticket: Ticket) {
  const plan = ticket.metadata?.resolutionPlan;
  return {
    stage: plan?.stage || (ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'Resolved pending confirmation' : 'Not started'),
    pathway: plan?.pathway || inferResolutionPathway(ticket),
    owner: plan?.owner || ticket.assignedTo,
    targetDate: plan?.targetDate || '',
    memberFollowUpChannel: plan?.memberFollowUpChannel || 'WhatsApp',
    memberResponse: plan?.memberResponse || 'Not captured',
    escalationNeeded: plan?.escalationNeeded || 'No escalation needed',
  };
}

function selectValues(values: readonly string[], current: string): string[] {
  return current && !values.includes(current) ? [current, ...values] : [...values];
}

function appendSuggestion(current: string, suggestion: string): string {
  const trimmed = current.trim();
  if (!trimmed) return suggestion;
  if (trimmed.includes(suggestion)) return current;
  return `${current.trimEnd()}\n${suggestion}`;
}

export const TicketDetailDrawer: React.FC<Props> = ({ ticket, onClose }) => {
  const { updateTicket, updateTicketStatus, updateTicketResolutionPlan, canUpdateTicketStatus, canEditTicketResolution, deleteTicket } = useTickets();
  const [editingLinkedContext, setEditingLinkedContext] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [resolutionSaving, setResolutionSaving] = useState(false);
  const [resolutionError, setResolutionError] = useState('');
  const [resolutionStepsText, setResolutionStepsText] = useState('');
  const [resolutionOwnerNotes, setResolutionOwnerNotes] = useState('');
  const [resolutionStage, setResolutionStage] = useState('');
  const [resolutionPathway, setResolutionPathway] = useState('');
  const [resolutionOwner, setResolutionOwner] = useState('');
  const [resolutionTargetDate, setResolutionTargetDate] = useState('');
  const [resolutionFollowUpChannel, setResolutionFollowUpChannel] = useState('');
  const [resolutionMemberResponse, setResolutionMemberResponse] = useState('');
  const [resolutionEscalation, setResolutionEscalation] = useState('');
  const [editValues, setEditValues] = useState<Partial<Ticket>>({});
  const [statusValues, setStatusValues] = useState<TicketStatusUpdateInput>(() => defaultStatusValues(ticket));
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const ticketIdRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [updatedElsewhere, setUpdatedElsewhere] = useState(false);
  const ticketAttachments = useMemo(() => ticket ? readTicketAttachments(ticket) : [], [ticket]);
  const resolutionAssistant = useMemo(() => ticket ? buildResolutionAssistant(ticket) : null, [ticket]);
  const resolutionSteps = useMemo(() => (
    ticket ? getDisplayResolutionSteps(ticket, resolutionAssistant?.nextActions || []) : []
  ), [resolutionAssistant?.nextActions, ticket]);
  const resolutionStepsKey = resolutionSteps.join('\n');
  const storedResolutionFields = useMemo(() => ticket ? defaultResolutionFields(ticket) : null, [ticket]);

  useEffect(() => {
    const nextId = ticket?.id || null;
    const isNewTicket = nextId !== ticketIdRef.current;
    ticketIdRef.current = nextId;

    if (!ticket) {
      setUpdatedElsewhere(false);
      return;
    }

    // Preserve unsaved work when a concurrent realtime update (or a self-echo
    // after saving) replaces the `ticket` prop for the same ticket.
    const statusDirty = statusValues.status !== ticket.status ||
      Boolean(statusValues.reason.trim()) ||
      Boolean(statusValues.actionTaken.trim()) ||
      Boolean(statusValues.resolutionSummary?.trim()) ||
      Boolean(statusValues.outcome?.trim()) ||
      Boolean(statusValues.comments?.trim()) ||
      Boolean(statusValues.notes?.trim()) ||
      Boolean((statusValues.followUps || []).some((followUp) => followUp.date?.trim() || followUp.notes?.trim()));
    const resolutionDirty = resolutionStepsText !== resolutionStepsKey ||
      resolutionOwnerNotes !== (ticket.metadata?.resolutionPlan?.ownerNotes || '') ||
      resolutionStage !== (storedResolutionFields?.stage || '') ||
      resolutionPathway !== (storedResolutionFields?.pathway || '') ||
      resolutionOwner !== (storedResolutionFields?.owner || '') ||
      resolutionTargetDate !== (storedResolutionFields?.targetDate || '') ||
      resolutionFollowUpChannel !== (storedResolutionFields?.memberFollowUpChannel || '') ||
      resolutionMemberResponse !== (storedResolutionFields?.memberResponse || '') ||
      resolutionEscalation !== (storedResolutionFields?.escalationNeeded || '');
    const editDirty = editing && Object.keys(editValues).some((key) => {
      const value = editValues[key as keyof Partial<Ticket>];
      return value !== ticket[key as keyof Ticket];
    });
    const hasUnsavedEdits = statusDirty || resolutionDirty || editDirty;

    if (!isNewTicket && hasUnsavedEdits) {
      setUpdatedElsewhere(true);
      return;
    }

    setUpdatedElsewhere(false);
    setEditingLinkedContext(false);
    setEditing(false);
    setEditValues(ticket || {});
    setEditError('');
    setStatusValues(defaultStatusValues(ticket));
    setStatusError('');
    setResolutionError('');
  }, [ticket]);

  useEffect(() => {
    // Never overwrite in-progress resolution edits on realtime updates.
    if (resolutionStepsText !== resolutionStepsKey ||
        resolutionOwnerNotes !== (ticket?.metadata?.resolutionPlan?.ownerNotes || '') ||
        resolutionStage !== (storedResolutionFields?.stage || '') ||
        resolutionPathway !== (storedResolutionFields?.pathway || '') ||
        resolutionOwner !== (storedResolutionFields?.owner || '') ||
        resolutionTargetDate !== (storedResolutionFields?.targetDate || '') ||
        resolutionFollowUpChannel !== (storedResolutionFields?.memberFollowUpChannel || '') ||
        resolutionMemberResponse !== (storedResolutionFields?.memberResponse || '') ||
        resolutionEscalation !== (storedResolutionFields?.escalationNeeded || '')) {
      return;
    }
    setResolutionStepsText(resolutionStepsKey);
    setResolutionOwnerNotes(ticket?.metadata?.resolutionPlan?.ownerNotes || '');
    setResolutionStage(storedResolutionFields?.stage || '');
    setResolutionPathway(storedResolutionFields?.pathway || '');
    setResolutionOwner(storedResolutionFields?.owner || '');
    setResolutionTargetDate(storedResolutionFields?.targetDate || '');
    setResolutionFollowUpChannel(storedResolutionFields?.memberFollowUpChannel || '');
    setResolutionMemberResponse(storedResolutionFields?.memberResponse || '');
    setResolutionEscalation(storedResolutionFields?.escalationNeeded || '');
    setResolutionError('');
  }, [
    resolutionStepsKey,
    storedResolutionFields?.escalationNeeded,
    storedResolutionFields?.memberFollowUpChannel,
    storedResolutionFields?.memberResponse,
    storedResolutionFields?.owner,
    storedResolutionFields?.pathway,
    storedResolutionFields?.stage,
    storedResolutionFields?.targetDate,
    ticket?.id,
    ticket?.metadata?.resolutionPlan?.ownerNotes,
  ]);

  useEffect(() => {
    let cancelled = false;
    const paths = ticketAttachments.map((attachment) => attachment.path).filter(Boolean) as string[];
    if (paths.length === 0) {
      setAttachmentUrls({});
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      paths.map(async (path) => {
        const { data, error } = await backendSupabase.storage
          .from('ticket-attachments')
          .createSignedUrl(path, 60 * 60);
        return [path, error ? '' : data?.signedUrl || ''] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setAttachmentUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))));
    });

    return () => {
      cancelled = true;
    };
  }, [ticket?.id, ticketAttachments]);

  useEffect(() => {
    if (!ticket) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, ticket?.id]);

  if (!ticket) return null;

  const priorityMeta = PRIORITY_SLA[ticket.priority];
  const currentValues = { ...ticket, ...editValues };
  const subCategories = CATEGORIES[currentValues.category || ticket.category] || ['Other'];
  const statusAllowed = canUpdateTicketStatus(ticket);
  const resolutionAllowed = canEditTicketResolution(ticket);
  const statusChanged = statusValues.status !== ticket.status;
  const statusValidationErrors = statusAllowed ? validateTicketStatusUpdate(ticket, statusValues) : [];
  const statusInputStarted = statusChanged ||
    Boolean(statusValues.reason.trim()) ||
    Boolean(statusValues.actionTaken.trim()) ||
    Boolean(statusValues.resolutionSummary?.trim()) ||
    Boolean(statusValues.outcome?.trim()) ||
    Boolean(statusValues.comments?.trim()) ||
    Boolean(statusValues.notes?.trim()) ||
    Boolean((statusValues.followUps || []).some((followUp) => followUp.date?.trim() || followUp.notes?.trim()));
  const statusReady = statusAllowed && statusValidationErrors.length === 0;
  const latestResolution = ticket.metadata?.latestResolution;
  const resolutionHistory = Array.isArray(ticket.metadata?.resolutionHistory)
    ? ticket.metadata.resolutionHistory
    : [];
  const followUpHistory = Array.isArray(ticket.metadata?.followUpHistory)
    ? ticket.metadata.followUpHistory
    : [];
  const resolutionChanged = resolutionStepsText !== resolutionStepsKey ||
    resolutionOwnerNotes !== (ticket.metadata?.resolutionPlan?.ownerNotes || '') ||
    resolutionStage !== (storedResolutionFields?.stage || '') ||
    resolutionPathway !== (storedResolutionFields?.pathway || '') ||
    resolutionOwner !== (storedResolutionFields?.owner || '') ||
    resolutionTargetDate !== (storedResolutionFields?.targetDate || '') ||
    resolutionFollowUpChannel !== (storedResolutionFields?.memberFollowUpChannel || '') ||
    resolutionMemberResponse !== (storedResolutionFields?.memberResponse || '') ||
    resolutionEscalation !== (storedResolutionFields?.escalationNeeded || '');
  const ownerName = resolutionOwner || ticket.assignedTo;
  const supervisorName = getEscalationTarget(ownerName);
  const quickReplies = {
    reason: [
      `Member follow-up required for ${ticket.category}.`,
      `SLA review required before ${safeFormatDateOnly(ticket.slaDueAt)}.`,
      'Owner is updating the resolution path after member communication.',
    ],
    actionTaken: [
      `Reviewed ticket context and assigned next action to ${ownerName}.`,
      `Contacted member via ${resolutionFollowUpChannel || 'WhatsApp'} and documented response.`,
      `Escalated to ${supervisorName} for immediate supervisor review.`,
    ],
    resolutionSummary: [
      'Member concern was addressed and next steps were communicated.',
      'Operational correction completed and member update sent.',
      'Issue resolved with owner confirmation and supervisor visibility.',
    ],
    outcome: [
      'Member accepted the resolution and no further action is pending.',
      'Member response is pending after written follow-up.',
      'Internal action completed; monitor for repeat feedback.',
    ],
    comments: [
      'Keep ticket open until member confirms.',
      `Supervisor visibility: ${supervisorName}.`,
      'No additional member follow-up needed at this stage.',
    ],
    notes: [
      `Owner: ${ownerName}.`,
      `Immediate supervisor: ${supervisorName}.`,
      `SLA target: ${safeFormatDate(ticket.slaDueAt)}.`,
    ],
    steps: resolutionAssistant?.nextActions || [
      'Confirm member concern and preferred follow-up channel.',
      'Complete the internal correction or owner action.',
      'Send member update and document response.',
    ],
    ownerNotes: [
      `Owner ${ownerName} to complete the next action before SLA target.`,
      `${supervisorName} to review if action is blocked.`,
      'Document member response before resolving or closing.',
    ],
    followUp: [
      'Send a written update and ask member to confirm.',
      'Call member after internal owner confirms completion.',
      'Check whether the same concern has repeated.',
    ],
  };
  const saveEdits = async () => {
    setSaving(true);
    setEditError('');
    try {
      await updateTicket(ticket.id, buildTicketEditPatch(ticket, editValues));
      setEditing(false);
      setUpdatedElsewhere(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to save ticket edits.');
    } finally {
      setSaving(false);
    }
  };

  const removeTicket = async () => {
    if (!window.confirm(`Delete ticket ${ticket.id}? This permanently removes the submitted ticket from the backend.`)) return;
    await deleteTicket(ticket.id);
    onClose();
  };

  const submitStatusUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusReady) {
      setStatusError(statusValidationErrors.join(' '));
      return;
    }
    setStatusSaving(true);
    setStatusError('');
    try {
      await updateTicketStatus(ticket.id, statusValues);
      setStatusValues(defaultStatusValues({ ...ticket, status: statusValues.status }));
      setUpdatedElsewhere(false);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Unable to update ticket status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const saveResolutionPlan = async () => {
    if (!resolutionAllowed) {
      setResolutionError('Only the assigned owner or their immediate supervisor can edit resolver fields.');
      return;
    }
    setResolutionSaving(true);
    setResolutionError('');
    try {
      await updateTicketResolutionPlan(ticket.id, {
        steps: stepsFromTextarea(resolutionStepsText),
        stage: resolutionStage,
        pathway: resolutionPathway,
        owner: resolutionOwner,
        targetDate: resolutionTargetDate,
        memberFollowUpChannel: resolutionFollowUpChannel,
        memberResponse: resolutionMemberResponse,
        escalationNeeded: resolutionEscalation,
        ownerNotes: resolutionOwnerNotes,
      });
      setUpdatedElsewhere(false);
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : 'Unable to save resolution plan.');
    } finally {
      setResolutionSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket ${ticket.id}`}
        tabIndex={-1}
        className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-background z-50 shadow-2xl overflow-y-auto border-l border-border outline-none"
      >
        {updatedElsewhere && (
          <div className="z-10 border-b border-blue-100 bg-blue-50 px-5 py-2 text-xs font-medium text-blue-800">
            This ticket was updated elsewhere. Your unsaved edits have been kept.
          </div>
        )}
        <div className="sticky top-0 bg-background/92 backdrop-blur-xl border-b border-border px-5 py-4 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded text-white ${priorityMeta.color}`}>
                {ticket.priority}
              </span>
            </div>
            {editing ? (
              <input
                value={currentValues.title || ''}
                onChange={(event) => setEditValues((values) => ({ ...values, title: event.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            ) : (
              <h3 className="font-bold text-foreground leading-snug pr-2">{ticket.title}</h3>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {editing ? (
              <>
                <button onClick={saveEdits} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-950 px-2.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-40">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving' : 'Save'}
                </button>
                <button onClick={() => { setEditing(false); setEditValues(ticket); setUpdatedElsewhere(false); }} className="h-8 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button onClick={removeTicket} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <form onSubmit={submitStatusUpdate} className="rounded-2xl border border-border bg-muted/80 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status and resolution</label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status changes require reason and action taken. Follow-up-only saves need a complete date and note.
                </p>
              </div>
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                Current: {ticket.status}
              </span>
            </div>

            {!statusAllowed && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Resolver fields are locked. Only the assigned owner or their immediate supervisor can change status and resolution details.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <EditSelect
                label="New status"
                value={statusValues.status}
                values={STATUSES.filter((status) => canSelectStatusFromTicket(ticket, status))}
                disabled={!statusAllowed}
                onChange={(status) => setStatusValues((values) => ({ ...values, status: status as Ticket['status'] }))}
              />
              <EditText
                label="Action date"
                value={statusValues.actionDate}
                type="date"
                disabled={!statusAllowed}
                onChange={(actionDate) => setStatusValues((values) => ({ ...values, actionDate }))}
              />
              <div className="md:col-span-2">
                <EditText
                  label="Reason for status change"
                  value={statusValues.reason}
                  disabled={!statusAllowed}
                  suggestions={quickReplies.reason}
                  onChange={(reason) => setStatusValues((values) => ({ ...values, reason }))}
                />
              </div>
              <div className="md:col-span-2">
                <EditTextarea
                  label="Action taken"
                  value={statusValues.actionTaken}
                  rows={3}
                  disabled={!statusAllowed}
                  suggestions={quickReplies.actionTaken}
                  onChange={(actionTaken) => setStatusValues((values) => ({ ...values, actionTaken }))}
                />
              </div>
              {(statusValues.status === 'Resolved' || statusValues.status === 'Closed') && (
                <>
                  <div className="md:col-span-2">
                    <EditTextarea
                      label="Resolution summary"
                      value={statusValues.resolutionSummary || ''}
                      rows={3}
                      disabled={!statusAllowed}
                      suggestions={quickReplies.resolutionSummary}
                      onChange={(resolutionSummary) => setStatusValues((values) => ({ ...values, resolutionSummary }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <EditTextarea
                      label="Final outcome"
                      value={statusValues.outcome || ''}
                      rows={3}
                      disabled={!statusAllowed}
                      suggestions={quickReplies.outcome}
                      onChange={(outcome) => setStatusValues((values) => ({ ...values, outcome }))}
                    />
                  </div>
                </>
              )}
              <EditText
                label="Comments"
                value={statusValues.comments || ''}
                disabled={!statusAllowed}
                suggestions={quickReplies.comments}
                onChange={(comments) => setStatusValues((values) => ({ ...values, comments }))}
              />
              <div className="md:col-span-2">
                <EditTextarea
                  label="Internal notes"
                  value={statusValues.notes || ''}
                  rows={3}
                  disabled={!statusAllowed}
                  suggestions={quickReplies.notes}
                  onChange={(notes) => setStatusValues((values) => ({ ...values, notes }))}
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Follow-up dates and notes</label>
                  <button
                    type="button"
                    disabled={!statusAllowed}
                    onClick={() => setStatusValues((values) => ({
                      ...values,
                      followUps: [...(values.followUps || []), { date: '', notes: '' }],
                    }))}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add follow-up
                  </button>
                </div>
                {(statusValues.followUps || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-background px-3 py-3 text-xs text-muted-foreground">
                    No follow-up dates added.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(statusValues.followUps || []).map((followUp, index) => (
                      <div key={index} className="grid gap-2 rounded-xl border border-border bg-background p-2 md:grid-cols-[150px_1fr_auto]">
                        <input
                          type="date"
                          value={followUp.date || ''}
                          disabled={!statusAllowed}
                          onChange={(event) => setStatusValues((values) => ({
                            ...values,
                            followUps: (values.followUps || []).map((item, itemIndex) => (
                              itemIndex === index ? { ...item, date: event.target.value } : item
                            )),
                          }))}
                          className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-muted disabled:text-muted-foreground"
                        />
                        <textarea
                          value={followUp.notes || ''}
                          rows={2}
                          disabled={!statusAllowed}
                          placeholder="Follow-up note"
                          onChange={(event) => setStatusValues((values) => ({
                            ...values,
                            followUps: (values.followUps || []).map((item, itemIndex) => (
                              itemIndex === index ? { ...item, notes: event.target.value } : item
                            )),
                          }))}
                          className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-muted disabled:text-muted-foreground"
                        />
                        <button
                          type="button"
                          disabled={!statusAllowed}
                          onClick={() => setStatusValues((values) => ({
                            ...values,
                            followUps: (values.followUps || []).filter((_, itemIndex) => itemIndex !== index),
                          }))}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-2 text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Remove follow-up"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="md:col-span-3">
                          <QuickSuggestions
                            suggestions={quickReplies.followUp}
                            disabled={!statusAllowed}
                            onPick={(suggestion) => setStatusValues((values) => ({
                              ...values,
                              followUps: (values.followUps || []).map((item, itemIndex) => (
                                itemIndex === index ? { ...item, notes: appendSuggestion(item.notes || '', suggestion) } : item
                              )),
                            }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {latestResolution && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-card px-3 py-2 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Latest resolution note</div>
                <div className="mt-1">Reason: {latestResolution.reason}</div>
                <div className="mt-0.5">Action: {latestResolution.actionTaken}</div>
                {latestResolution.resolutionSummary && <div className="mt-0.5">Resolution: {latestResolution.resolutionSummary}</div>}
                {latestResolution.outcome && <div className="mt-0.5">Outcome: {latestResolution.outcome}</div>}
                {latestResolution.closedAt && <div className="mt-0.5">Closed: {safeFormatDate(latestResolution.closedAt)}</div>}
              </div>
            )}

            {followUpHistory.length > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Saved follow-ups</div>
                <div className="mt-2 space-y-1.5">
                  {followUpHistory.slice(0, 8).map((followUp, index) => (
                    <div key={`${followUp.date}-${followUp.createdAt}-${index}`} className="grid gap-1 border-t border-border pt-1.5 first:border-t-0 first:pt-0 md:grid-cols-[110px_1fr]">
                      <span className="font-semibold text-foreground">{followUp.date}</span>
                      <span>{followUp.notes}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resolutionHistory.length > 1 && (
              <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Resolution history</div>
                <div className="mt-2 space-y-2">
                  {resolutionHistory.slice(1, 6).map((entry, index) => (
                    <div key={`${entry.createdAt}-${index}`} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                      <div className="font-semibold text-foreground">{entry.previousStatus} → {entry.status}</div>
                      <div className="mt-0.5">{entry.actionTaken}</div>
                      {entry.resolutionSummary && <div className="mt-0.5 text-muted-foreground">{entry.resolutionSummary}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {statusError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {statusError}
              </div>
            )}

            {!statusError && statusInputStarted && statusValidationErrors.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {statusValidationErrors.join(' ')}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={!statusReady || statusSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {statusSaving ? 'Saving...' : 'Save ticket update'}
              </button>
            </div>
          </form>

          {resolutionAssistant && (
            <div className="rounded-2xl border border-blue-100 bg-card p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">{resolutionAssistant.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{resolutionAssistant.priorityReason}</p>
                </div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  {resolutionAssistant.slaState}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                {resolutionAssistant.suggestedMemberReply}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next actions</div>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {resolutionAssistant.nextActions.map((action) => (
                      <li key={action} className="rounded-lg border border-border bg-muted px-2 py-1.5">{action}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Closure checklist</div>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {resolutionAssistant.closureChecklist.map((item) => (
                      <li key={item} className="flex gap-1.5 rounded-lg border border-border bg-muted px-2 py-1.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground">Resolution plan</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Structured owner plan, member response path, and next actions. Editable by assigned owner {ownerName} and immediate supervisor {supervisorName}.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{resolutionStage || 'Not started'}</span>
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{resolutionPathway || 'Member communication'}</span>
                {ticket.metadata?.resolutionPlan?.updatedAt && (
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Updated {safeFormatDate(ticket.metadata.resolutionPlan.updatedAt)}
                  </span>
                )}
              </div>
            </div>

            {!resolutionAllowed && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Resolver fields are locked. Only the assigned owner or their immediate supervisor can edit this plan.
              </div>
            )}

            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <EditSelect
                  label="Resolution stage"
                  value={resolutionStage}
                  values={selectValues(RESOLUTION_STAGES, resolutionStage)}
                  disabled={!resolutionAllowed}
                  onChange={setResolutionStage}
                />
                <EditSelect
                  label="Resolution pathway"
                  value={resolutionPathway}
                  values={selectValues(RESOLUTION_PATHWAYS, resolutionPathway)}
                  disabled={!resolutionAllowed}
                  onChange={setResolutionPathway}
                />
                <EditSelect
                  label="Resolution owner"
                  value={resolutionOwner}
                  values={selectValues(ASSOCIATES.map((associate) => associate.name), resolutionOwner)}
                  disabled={!resolutionAllowed}
                  onChange={setResolutionOwner}
                />
                <EditText
                  label="Target resolution date"
                  value={resolutionTargetDate}
                  type="date"
                  disabled={!resolutionAllowed}
                  onChange={setResolutionTargetDate}
                />
                <EditSelect
                  label="Member follow-up channel"
                  value={resolutionFollowUpChannel}
                  values={selectValues(RESOLUTION_FOLLOW_UP_CHANNELS, resolutionFollowUpChannel)}
                  disabled={!resolutionAllowed}
                  onChange={setResolutionFollowUpChannel}
                />
                <EditSelect
                  label="Member response"
                  value={resolutionMemberResponse}
                  values={selectValues(RESOLUTION_MEMBER_RESPONSES, resolutionMemberResponse)}
                  disabled={!resolutionAllowed}
                  onChange={setResolutionMemberResponse}
                />
                <div className="md:col-span-2">
                  <EditSelect
                    label="Escalation requirement"
                    value={resolutionEscalation}
                    values={selectValues(RESOLUTION_ESCALATION_OPTIONS, resolutionEscalation)}
                    disabled={!resolutionAllowed}
                    onChange={setResolutionEscalation}
                  />
                </div>
              </div>
              <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recommended steps
                <textarea
                  value={resolutionStepsText}
                  rows={7}
                  disabled={!resolutionAllowed}
                  onChange={(event) => setResolutionStepsText(event.target.value)}
                  className="rounded-xl border border-border bg-muted px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-muted disabled:text-muted-foreground"
                />
                <QuickSuggestions
                  suggestions={quickReplies.steps}
                  disabled={!resolutionAllowed}
                  onPick={(suggestion) => setResolutionStepsText((value) => appendSuggestion(value, suggestion))}
                />
              </label>
              <EditTextarea
                label="Owner / manager notes"
                value={resolutionOwnerNotes}
                rows={3}
                disabled={!resolutionAllowed}
                suggestions={quickReplies.ownerNotes}
                onChange={setResolutionOwnerNotes}
              />
            </div>

            {resolutionError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {resolutionError}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={saveResolutionPlan}
                disabled={!resolutionAllowed || !resolutionChanged || resolutionSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-stone-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {resolutionSaving ? 'Saving...' : 'Save resolution plan'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Assigned To</label>
            <select
              value={editing ? currentValues.assignedTo : ticket.assignedTo}
              onChange={(e) => {
                const found = ASSOCIATES.find((a) => a.name === e.target.value);
                if (editing) setEditValues((values) => ({ ...values, assignedTo: e.target.value, team: found?.team || ticket.team }));
                else {
                  setEditError('');
                  updateTicket(ticket.id, { assignedTo: e.target.value, team: found?.team || ticket.team })
                    .catch((error) => setEditError(error instanceof Error ? error.message : 'Unable to update assignment.'));
                }
              }}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
            >
              {ASSOCIATES.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} — {a.role}
                </option>
              ))}
            </select>
          </div>

          {editError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {editError}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Description</label>
            {editing ? (
              <textarea
                value={currentValues.description || ''}
                onChange={(event) => setEditValues((values) => ({ ...values, description: event.target.value }))}
                rows={10}
                className="w-full rounded-2xl border border-border bg-muted/80 p-4 text-sm leading-relaxed text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            ) : (
              <FormattedTicketText text={ticket.description} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {editing ? (
              <>
                <EditSelect label="Category" value={currentValues.category || ''} values={Object.keys(CATEGORIES)} onChange={(value) => setEditValues((state) => ({ ...state, category: value, subCategory: CATEGORIES[value]?.[0] || 'Other' }))} />
                <EditSelect label="Sub-category" value={currentValues.subCategory || ''} values={subCategories} onChange={(value) => setEditValues((state) => ({ ...state, subCategory: value }))} />
                <EditSelect label="Studio" value={currentValues.studio || ''} values={STUDIOS} onChange={(value) => setEditValues((state) => ({ ...state, studio: value }))} />
                <EditSelect label="Priority" value={currentValues.priority || ''} values={['Critical', 'High', 'Medium', 'Low']} onChange={(value) => setEditValues((state) => ({ ...state, priority: value as Ticket['priority'] }))} />
                <EditSelect label="Instructor" value={currentValues.trainer || ''} values={['', ...TRAINERS]} onChange={(value) => setEditValues((state) => ({ ...state, trainer: value || undefined }))} />
                <MomenceSessionTicketField
                  classType={currentValues.classType}
                  classDateTime={currentValues.classDateTime}
                  trainer={currentValues.trainer}
                  studio={currentValues.studio}
                  onSelect={(session) => {
                    setEditValues((state) => ({
                      ...state,
                      classType: session.classType || session.label,
                      classDateTime: session.startsAt || undefined,
                      trainer: session.trainer || state.trainer,
                      studio: session.studio || state.studio,
                    }));
                  }}
                  onClear={() => {
                    setEditValues((state) => ({
                      ...state,
                      classType: undefined,
                      classDateTime: undefined,
                    }));
                  }}
                />
                <MomenceMemberTicketField
                  memberName={currentValues.memberName}
                  memberContact={currentValues.memberContact}
                  onSelect={(member) => {
                    setEditValues((state) => ({
                      ...state,
                      memberName: member.name || member.label,
                      memberContact: member.email || member.phoneNumber || member.description || undefined,
                    }));
                  }}
                  onClear={() => {
                    setEditValues((state) => ({
                      ...state,
                      memberName: undefined,
                      memberContact: undefined,
                    }));
                  }}
                />
                <EditText label="Reported By" value={currentValues.reportedBy || ''} onChange={(value) => setEditValues((state) => ({ ...state, reportedBy: value || undefined }))} />
                <EditSelect label="Sentiment" value={currentValues.sentiment || ''} values={['', 'Positive', 'Neutral', 'Negative', 'Angry']} onChange={(value) => setEditValues((state) => ({ ...state, sentiment: value ? value as Ticket['sentiment'] : undefined }))} />
                <EditText label="Tags" value={(currentValues.tags || []).join(', ')} onChange={(value) => setEditValues((state) => ({ ...state, tags: tagsFromInput(value) }))} />
              </>
            ) : (
              <>
                <Field icon={<Tag className="w-3.5 h-3.5" />} label="Category" value={ticket.category} />
                <Field icon={<Tag className="w-3.5 h-3.5" />} label="Sub-category" value={ticket.subCategory} />
                <Field icon={<MapPin className="w-3.5 h-3.5" />} label="Studio" value={ticket.studio} />
              </>
            )}
            <Field icon={<Clock className="w-3.5 h-3.5" />} label="SLA Due" value={safeFormatDate(ticket.slaDueAt)} />
            <Field icon={<User className="w-3.5 h-3.5" />} label="Owner" value={ticket.assignedTo} />
            <Field icon={<User className="w-3.5 h-3.5" />} label="Next Escalation" value={getEscalationTarget(ticket.assignedTo)} />
            {ticket.reportedBy && <Field icon={<MessageSquare className="w-3.5 h-3.5" />} label="Reported By" value={ticket.reportedBy} />}
            {ticket.sentiment && <Field icon={<MessageSquare className="w-3.5 h-3.5" />} label="Sentiment" value={ticket.sentiment} />}
          </div>

          {!editing && (ticket.memberName || ticket.memberContact || ticket.classType || ticket.classDateTime || ticket.trainer) && (
            <div className="rounded-lg border border-border bg-muted p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  Locked creation context
                </div>
                <button
                  type="button"
                  onClick={() => setEditingLinkedContext((value) => !value)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                >
                  <Pencil className="w-3 h-3" />
                  {editingLinkedContext ? 'Hide edit' : 'Edit linked context'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {ticket.memberName && <Field icon={<User className="w-3.5 h-3.5" />} label="Member" value={ticket.memberName} />}
                {ticket.memberContact && <Field icon={<Phone className="w-3.5 h-3.5" />} label="Contact" value={ticket.memberContact} />}
                {ticket.classType && <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Session" value={ticket.classType} />}
                {ticket.classDateTime && <Field icon={<Clock className="w-3.5 h-3.5" />} label="Session Time" value={safeFormatDate(ticket.classDateTime)} />}
                {ticket.trainer && <Field icon={<User className="w-3.5 h-3.5" />} label="Instructor" value={ticket.trainer} />}
              </div>
            </div>
          )}

          {editingLinkedContext && <MomenceAutomationPanel ticket={ticket} />}

          {ticketAttachments.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Attachments</label>
              <div className="space-y-2">
                {ticketAttachments.map((attachment, index) => (
                  <a
                    key={`${attachment.path || attachment.publicUrl || attachment.fileName || 'attachment'}-${index}`}
                    href={(attachment.path && attachmentUrls[attachment.path]) || attachment.publicUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                      <span className="truncate">{attachment.fileName || `Attachment ${index + 1}`}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {attachment.size ? `${Math.max(1, Math.round(attachment.size / 1024))} KB` : 'File'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {ticket.tags.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {ticket.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border text-xs text-muted-foreground">
            Created {safeFormatDate(ticket.createdAt)}
          </div>
        </div>
      </div>
    </>
  );
};

const Field: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div>
    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <div className="text-sm text-foreground">{value}</div>
  </div>
);

const QuickSuggestions: React.FC<{ suggestions?: string[] | readonly string[]; disabled?: boolean; onPick: (suggestion: string) => void }> = ({ suggestions = [], disabled, onPick }) => {
  const cleaned = Array.from(new Set(suggestions.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 3);
  if (cleaned.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {cleaned.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onPick(suggestion)}
          className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10.5px] font-semibold normal-case tracking-normal text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

const EditText: React.FC<{ label: string; value: string; type?: string; disabled?: boolean; suggestions?: string[] | readonly string[]; onChange: (value: string) => void }> = ({ label, value, type = 'text', disabled, suggestions, onChange }) => (
  <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
    {label}
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-muted disabled:text-muted-foreground"
    />
    {type !== 'date' && (
      <QuickSuggestions
        suggestions={suggestions}
        disabled={disabled}
        onPick={(suggestion) => onChange(appendSuggestion(value, suggestion))}
      />
    )}
  </label>
);

const EditTextarea: React.FC<{ label: string; value: string; rows?: number; disabled?: boolean; suggestions?: string[] | readonly string[]; onChange: (value: string) => void }> = ({ label, value, rows = 3, disabled, suggestions, onChange }) => (
  <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
    {label}
    <textarea
      value={value}
      rows={rows}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-muted disabled:text-muted-foreground"
    />
    <QuickSuggestions
      suggestions={suggestions}
      disabled={disabled}
      onPick={(suggestion) => onChange(appendSuggestion(value, suggestion))}
    />
  </label>
);

const EditSelect: React.FC<{ label: string; value: string; values: string[] | readonly string[]; disabled?: boolean; onChange: (value: string) => void }> = ({ label, value, values, disabled, onChange }) => (
  <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
    {label}
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-muted disabled:text-muted-foreground"
    >
      {values.map((item) => (
        <option key={item} value={item}>{item || 'None'}</option>
      ))}
    </select>
  </label>
);

const FormattedTicketText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let bullets: string[] = [];
  const headingLabels = new Set([
    'Instructor Evaluation Brief',
    'Evaluation Snapshot',
    'Weighted Scorecard',
    'Demonstrated Strengths',
    'Coaching Attention Areas',
    'Evaluator / Training Notes',
    'Coaching Plan And Follow-up',
    'Routing Context',
  ]);

  const flushBullets = () => {
    if (bullets.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="my-2 list-disc space-y-1 pl-5">
        {bullets.map((line, index) => (
          <li key={index}>{line.replace(/^[-*]\s+/, '').trim()}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      elements.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line);
      return;
    }
    flushBullets();
    if (headingLabels.has(line)) {
      const isTitle = line === 'Instructor Evaluation Brief';
      elements.push(
        <div
          key={`heading-${index}`}
          className={isTitle ? 'mb-3 text-sm font-bold uppercase tracking-wider text-foreground' : 'mb-1 mt-3 text-xs font-bold uppercase tracking-wider text-blue-700'}
        >
          {line}
        </div>
      );
      return;
    }
    elements.push(<p key={`p-${index}`} className="mb-2">{line}</p>);
  });
  flushBullets();

  return (
    <div className="rounded-2xl border border-border bg-muted/80 p-4 text-sm leading-relaxed text-foreground shadow-inner shadow-stone-200/50">
      {elements}
    </div>
  );
};
