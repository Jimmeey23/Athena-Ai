export type TicketEmailAutomationEventType =
  | 'ticket_assigned'
  | 'sla_expiry';

export type TicketEmailAutomationTicket = {
  id: string;
  assigned_to: string;
  created_at: string;
  updated_at?: string | null;
  sla_due_at: string;
  status: string;
};

export type TicketEmailAutomationJob = {
  eventType: TicketEmailAutomationEventType;
  eventKey: string;
  ticketId: string;
};

type BuildTicketEmailAutomationJobsInput = {
  tickets: TicketEmailAutomationTicket[];
  existingEventKeys: Set<string>;
  assignmentTicketIds?: Set<string>;
  slaExpiryTicketIds?: Set<string>;
  now?: Date;
  timeZone?: string;
};

const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const CLOSED_STATUSES = new Set(['resolved', 'closed']);
export const SLA_REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

export function ticketEmailAutomationZonedDateKey(
  value: string | Date,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return [part('year'), part('month'), part('day')].filter(Boolean).join('-');
}

export function isTicketEmailAutomationOpen(ticket: Pick<TicketEmailAutomationTicket, 'status'>): boolean {
  return !CLOSED_STATUSES.has(ticket.status.trim().toLowerCase());
}

export function ticketEmailAutomationEventKey(
  eventType: TicketEmailAutomationEventType,
  ticket: TicketEmailAutomationTicket,
): string {
  if (eventType === 'sla_expiry') {
    // Keyed on sla_due_at so each SLA date only sends one reminder
    return `sla_expiry:${ticket.id}:${ticket.sla_due_at}`;
  }
  return `${eventType}:${ticket.id}:${ticket.assigned_to}:${ticket.created_at}`;
}

export function isTicketEmailAutomationDueToday(
  ticket: TicketEmailAutomationTicket,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): boolean {
  if (!isTicketEmailAutomationOpen(ticket)) return false;
  return Boolean(
    ticket.sla_due_at &&
      ticketEmailAutomationZonedDateKey(ticket.sla_due_at, timeZone) ===
        ticketEmailAutomationZonedDateKey(now, timeZone)
  );
}

export function isTicketSlaExpiringWithin3Hours(
  ticket: TicketEmailAutomationTicket,
  now = new Date(),
): boolean {
  if (!isTicketEmailAutomationOpen(ticket)) return false;
  if (!ticket.sla_due_at) return false;
  const slaMs = new Date(ticket.sla_due_at).getTime();
  if (Number.isNaN(slaMs)) return false;
  const nowMs = now.getTime();
  // SLA is in the future but within 3 hours
  return slaMs > nowMs && slaMs - nowMs <= SLA_REMINDER_WINDOW_MS;
}

export function buildTicketEmailAutomationJobs({
  tickets,
  existingEventKeys,
  assignmentTicketIds,
  slaExpiryTicketIds,
  now = new Date(),
}: BuildTicketEmailAutomationJobsInput): TicketEmailAutomationJob[] {
  const jobs: TicketEmailAutomationJob[] = [];

  for (const ticket of tickets) {
    if (!isTicketEmailAutomationOpen(ticket)) continue;

    const shouldSendAssignment = !assignmentTicketIds || assignmentTicketIds.has(ticket.id);
    const assignedKey = ticketEmailAutomationEventKey('ticket_assigned', ticket);
    if (shouldSendAssignment && !existingEventKeys.has(assignedKey)) {
      jobs.push({
        eventType: 'ticket_assigned',
        eventKey: assignedKey,
        ticketId: ticket.id,
      });
    }

    const shouldSendSlaExpiry = slaExpiryTicketIds ? slaExpiryTicketIds.has(ticket.id) : isTicketSlaExpiringWithin3Hours(ticket, now);
    if (shouldSendSlaExpiry) {
      const slaKey = ticketEmailAutomationEventKey('sla_expiry', ticket);
      if (!existingEventKeys.has(slaKey)) {
        jobs.push({
          eventType: 'sla_expiry',
          eventKey: slaKey,
          ticketId: ticket.id,
        });
      }
    }
  }

  return jobs;
}
