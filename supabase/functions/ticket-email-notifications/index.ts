import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import nodemailer from 'npm:nodemailer@6.9.16';
import {
  buildTicketLifecycleEmail,
  TicketEmailEventType,
  TicketEmailPerson,
  TicketEmailSummary,
} from './email-template.ts';
import { ticketEmailDeliveryEnvelope } from '../_shared/ticket-email-delivery.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  eventType?: TicketEmailEventType;
  ticketId?: string;
  actor?: string;
  ownerEmail?: string;
  escalationEmail?: string;
  testRecipientEmail?: string;
};

type TicketRow = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  sub_category: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  studio: string;
  assigned_to: string;
  team: string;
  member_name?: string | null;
  member_contact?: string | null;
  reported_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  sla_due_at: string;
  metadata?: Record<string, unknown> | null;
};

type EmployeeRow = {
  name: string;
  email?: string | null;
  manager?: string | null;
};

type NotificationAuditRow = {
  status: string;
  created_at?: string;
};

const VALID_EVENTS = new Set<TicketEmailEventType>([
  'ticket_assigned',
  'sla_expiry',
]);

// Rows stuck in 'pending' (process died between insert and status update) become
// retryable again after this window, so a permanently-stuck email is eventually re-sent.
const PENDING_RETRY_WINDOW_MS = 10 * 60 * 1000;

let cachedSmtpTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function smtpTransport() {
  if (cachedSmtpTransport) return cachedSmtpTransport;
  const port = Number(optionalEnv('MAILTRAP_SMTP_PORT', 'SMTP_PORT') || 2525);
  cachedSmtpTransport = nodemailer.createTransport({
    host: requiredEnv('MAILTRAP_SMTP_HOST'),
    port,
    secure: port === 465,
    auth: {
      user: requiredEnv('MAILTRAP_SMTP_USER'),
      pass: requiredEnv('MAILTRAP_SMTP_PASS'),
    },
  });
  return cachedSmtpTransport;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function optionalEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return '';
}

function ticketSummary(row: TicketRow): TicketEmailSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    subCategory: row.sub_category,
    priority: row.priority,
    status: row.status,
    studio: row.studio,
    assignedTo: row.assigned_to,
    team: row.team,
    memberName: row.member_name,
    memberContact: row.member_contact,
    reportedBy: row.reported_by,
    createdAt: row.created_at,
    slaDueAt: row.sla_due_at,
  };
}

function routingMetadata(row: TicketRow): Record<string, unknown> {
  const metadata = row.metadata || {};
  const routing = metadata.routing;
  return routing && typeof routing === 'object' ? routing as Record<string, unknown> : {};
}

function eventKey(eventType: TicketEmailEventType, row: TicketRow): string {
  // Must match the automation's key format so dedup works across both functions.
  if (eventType === 'sla_expiry') {
    return `sla_expiry:${row.id}:${row.sla_due_at}`;
  }
  return `${eventType}:${row.id}:${row.assigned_to}:${row.created_at}`;
}

function byName(employees: EmployeeRow[]): Map<string, EmployeeRow> {
  return new Map(employees.map((employee) => [employee.name.trim().toLowerCase(), employee]));
}

function person(name: string, employeeByName: Map<string, EmployeeRow>, fallbackEmail = ''): TicketEmailPerson {
  const employee = employeeByName.get(name.trim().toLowerCase());
  return {
    name,
    email: employee?.email || fallbackEmail || null,
  };
}

function emailHint(value?: string): string {
  const email = value?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error || '');
  const value = error as { message?: unknown; details?: unknown; hint?: unknown };
  return [value.message, value.details, value.hint].filter(Boolean).map(String).join(' ');
}

function bearerToken(authorization: string): string {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function isTrustedServerRequest(request: Request, serviceRoleKey: string): boolean {
  const automationSecret = optionalEnv('TICKET_EMAIL_AUTOMATION_SECRET');
  const requestSecret = request.headers.get('x-ticket-email-automation-secret') || '';
  return (
    bearerToken(request.headers.get('authorization') || '') === serviceRoleKey ||
    Boolean(automationSecret && requestSecret && requestSecret === automationSecret)
  );
}

function isMissingAuditTableError(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error);
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /ticket_email_notifications/i.test(message) &&
      /could not find|schema cache|does not exist/i.test(message)
  );
}

function smtpTransport() {
  if (cachedSmtpTransport) return cachedSmtpTransport;
  const port = Number(optionalEnv('MAILTRAP_SMTP_PORT', 'SMTP_PORT') || 2525);
  cachedSmtpTransport = nodemailer.createTransport({
    host: requiredEnv('MAILTRAP_SMTP_HOST'),
    port,
    secure: port === 465,
    auth: {
      user: requiredEnv('MAILTRAP_SMTP_USER'),
      pass: requiredEnv('MAILTRAP_SMTP_PASS'),
    },
  });
  return cachedSmtpTransport;
}

function smtpTransport() {
  const port = Number(optionalEnv('MAILTRAP_SMTP_PORT', 'SMTP_PORT') || 2525);
  return nodemailer.createTransport({
    host: requiredEnv('MAILTRAP_SMTP_HOST'),
    port,
    secure: port === 465,
    auth: {
      user: requiredEnv('MAILTRAP_SMTP_USER'),
      pass: requiredEnv('MAILTRAP_SMTP_PASS'),
    },
  });
}

function senderFromHeader(): string {
  const senderName = optionalEnv('MAILTRAP_FROM_NAME', 'SMTP_FROM_NAME') || 'Physique 57 Support Desk';
  const configuredFrom = optionalEnv('MAILTRAP_FROM_EMAIL', 'SMTP_FROM_EMAIL') || 'athena@physique57india.com';
  const emailMatch = configuredFrom.match(/<([^>]+)>/);
  const email = (emailMatch?.[1] || configuredFrom).trim();
  return `${senderName} <${email}>`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json() as RequestBody;
    if (!body.eventType || !VALID_EVENTS.has(body.eventType)) return json({ error: 'Invalid eventType' }, 400);
    if (!body.ticketId?.trim()) return json({ error: 'ticketId is required' }, 400);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('authorization') || '';

    if (!isTrustedServerRequest(request, serviceRoleKey)) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .select('id,title,description,category,sub_category,priority,status,studio,assigned_to,team,member_name,member_contact,reported_by,created_at,updated_at,sla_due_at,metadata')
      .eq('id', body.ticketId)
      .single();

    if (ticketError) throw ticketError;
    if (!ticket) return json({ error: 'Ticket not found' }, 404);
    const ticketRow = ticket as TicketRow;
    const routing = routingMetadata(ticketRow);
    const configuredEscalation = typeof routing.next_escalation === 'string' ? routing.next_escalation : '';

    const { data: employees, error: employeesError } = await admin
      .from('employees')
      .select('name,email,manager')
      .eq('active', true);
    if (employeesError) throw employeesError;

    const employeeByName = byName((employees || []) as EmployeeRow[]);
    const ownerRecord = employeeByName.get(ticketRow.assigned_to.trim().toLowerCase());
    const escalationName = configuredEscalation || ownerRecord?.manager || '';
    const fallbackTo = optionalEnv('TICKET_EMAIL_FALLBACK_TO', 'MAILTRAP_FALLBACK_TO');
    const owner = person(ticketRow.assigned_to, employeeByName, emailHint(body.ownerEmail) || fallbackTo);
    const escalation = escalationName ? person(escalationName, employeeByName, emailHint(body.escalationEmail)) : null;
    const testRecipientEmail = emailHint(body.testRecipientEmail) || optionalEnv('TICKET_EMAIL_TEST_TO');

    if (escalationName && !escalation?.email) {
      console.warn(
        `Escalation contact ${escalationName} has no configured email for ticket ${ticketRow.id}; continuing with owner-only delivery`,
      );
    }

    if (!owner.email) {
      return json({
        error: `No email configured for ticket owner ${ticketRow.assigned_to}`,
        ticketId: ticketRow.id,
      }, 422);
    }

    const key = eventKey(body.eventType, ticketRow);
    let auditTableAvailable = true;
    const { error: insertError } = await admin.from('ticket_email_notifications').insert({
      ticket_id: ticketRow.id,
      event_type: body.eventType,
      event_key: key,
      owner_name: owner.name,
      owner_email: owner.email,
      escalation_name: escalation?.name || null,
      escalation_email: escalation?.email || null,
      actor: body.actor || null,
      status: 'pending',
    });

    let duplicateFailedNotificationRetry = false;
    if (insertError?.code === '23505') {
      const { data: existingNotification, error: existingNotificationError } = await admin
        .from('ticket_email_notifications')
        .select('status,created_at')
        .eq('event_key', key)
        .maybeSingle();
      if (existingNotificationError) throw existingNotificationError;
      const existing = existingNotification as NotificationAuditRow | null;
      const existingStatus = existing?.status || '';
      const createdAt = existing?.created_at ? new Date(existing.created_at).getTime() : 0;
      const stalePending = existingStatus === 'pending' && createdAt > 0 &&
        Date.now() - createdAt > PENDING_RETRY_WINDOW_MS;

      if (existingStatus === 'sent' || (existingStatus === 'pending' && !stalePending)) {
        return json({ skipped: true, reason: 'duplicate', eventKey: key, status: existingStatus });
      }

      // Atomically claim a 'failed' (or stale 'pending') row so concurrent
      // invocations can never double-send: only the winner transitions to 'pending'.
      const { data: claimed, error: claimError } = await admin
        .from('ticket_email_notifications')
        .update({
          owner_name: owner.name,
          owner_email: owner.email,
          escalation_name: escalation?.name || null,
          escalation_email: escalation?.email || null,
          actor: body.actor || null,
          status: 'pending',
          error: null,
        })
        .eq('event_key', key)
        .or(existingStatus === 'failed' ? 'status.eq.failed' : `and(status.eq.pending,created_at.lt.${new Date(Date.now() - PENDING_RETRY_WINDOW_MS).toISOString()})`)
        .select('id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) {
        return json({ skipped: true, reason: 'duplicate', eventKey: key, status: existingStatus });
      }
      duplicateFailedNotificationRetry = true;
    }
    if (insertError && !duplicateFailedNotificationRetry) {
      if (isMissingAuditTableError(insertError)) {
        auditTableAvailable = false;
        console.warn('ticket_email_notifications audit table unavailable; sending email without audit row', insertError);
      } else {
        throw insertError;
      }
    }

    const email = buildTicketLifecycleEmail({
      eventType: body.eventType,
      ticket: ticketSummary(ticketRow),
      owner,
      escalation,
      appUrl: optionalEnv('ATHENA_APP_URL', 'SITE_URL', 'PUBLIC_SITE_URL'),
      actor: body.actor,
    });

    try {
      const delivery = ticketEmailDeliveryEnvelope({
        ownerEmail: owner.email,
        escalationEmail: escalation?.email,
        subject: email.subject,
        testRecipientEmail,
      });

      await smtpTransport().sendMail({
        from: senderFromHeader(),
        to: delivery.to,
        cc: delivery.cc,
        subject: delivery.subject,
        html: email.html,
        text: email.text,
      });

      if (auditTableAvailable) {
        const { error: updateError } = await admin
          .from('ticket_email_notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
          .eq('event_key', key);
        if (updateError) {
          console.warn('ticket_email_notifications sent-status update failed', updateError);
        }
      }

      return json({ ok: true, eventKey: key, auditRecorded: auditTableAvailable });
    } catch (mailError) {
      const message = mailError instanceof Error ? mailError.message : String(mailError);
      if (auditTableAvailable) {
        const { error: updateError } = await admin
          .from('ticket_email_notifications')
          .update({ status: 'failed', error: message })
          .eq('event_key', key);
        if (updateError) {
          console.warn('ticket_email_notifications failed-status update failed', updateError);
        }
      }
      return json({ error: message, eventKey: key }, 502);
    }
  } catch (error) {
    console.error('ticket-email-notifications failed', error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
