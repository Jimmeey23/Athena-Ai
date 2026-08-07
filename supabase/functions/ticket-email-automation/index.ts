import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  buildTicketEmailAutomationJobs,
  SLA_REMINDER_WINDOW_MS,
  TicketEmailAutomationJob,
  TicketEmailAutomationTicket,
} from '../_shared/ticket-email-automation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ticket-email-automation-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RequestBody = {
  actor?: string;
  dryRun?: boolean;
  assignmentLookbackHours?: number;
  maxJobs?: number;
  testRecipientEmail?: string;
};

type AuditRow = {
  event_key: string;
  status: string;
  created_at?: string;
};

const DEFAULT_ASSIGNMENT_LOOKBACK_HOURS = 24;
const DEFAULT_MAX_JOBS = 100;
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
// Rows stuck in 'pending' (process died mid-send) stop blocking dedup after this window.
const PENDING_RETRY_WINDOW_MS = 10 * 60 * 1000;
const JOB_CONCURRENCY = 10;

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

function bearerToken(authorization: string): string {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function isAuthorized(request: Request, serviceRoleKey: string): boolean {
  const automationSecret = optionalEnv('TICKET_EMAIL_AUTOMATION_SECRET');
  const requestSecret = request.headers.get('x-ticket-email-automation-secret') || '';
  return (
    bearerToken(request.headers.get('authorization') || '') === serviceRoleKey ||
    Boolean(automationSecret && requestSecret && requestSecret === automationSecret)
  );
}

function hoursAgoIso(hours: number, now = new Date()): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

async function fetchExistingEventKeys(
  admin: ReturnType<typeof createClient>,
  jobs: TicketEmailAutomationJob[],
): Promise<Set<string>> {
  if (!jobs.length) return new Set();

  const keys = jobs.map((job) => job.eventKey);
  const { data, error } = await admin
    .from('ticket_email_notifications')
    .select('event_key,status,created_at')
    .in('event_key', keys);

  if (error) throw error;
  const pendingRetryCutoff = Date.now() - PENDING_RETRY_WINDOW_MS;
  return new Set(
    ((data || []) as AuditRow[])
      .filter((row) => {
        if (row.status === 'sent') return true;
        if (row.status === 'failed') return false;
        // Stale 'pending' rows never completed delivery; allow them to be retried.
        if (row.status === 'pending') {
          const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
          return createdAt > 0 && createdAt > pendingRetryCutoff;
        }
        return false;
      })
      .map((row) => row.event_key),
  );
}

async function invokeLifecycleEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  automationSecret: string,
  job: TicketEmailAutomationJob,
  actor: string,
  testRecipientEmail = '',
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ticket-email-notifications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      ...(automationSecret ? { 'x-ticket-email-automation-secret': automationSecret } : {}),
    },
    body: JSON.stringify({
      eventType: job.eventType,
      ticketId: job.ticketId,
      actor,
      ...(testRecipientEmail ? { testRecipientEmail } : {}),
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!isAuthorized(request, serviceRoleKey)) return json({ error: 'Unauthorized' }, 401);

    const body = await request.json().catch(() => ({})) as RequestBody;
    const now = new Date();
    const requestedLookback = Number(body.assignmentLookbackHours);
    const assignmentLookbackHours = Number.isFinite(requestedLookback)
      ? Math.max(1, Math.min(requestedLookback, 168))
      : DEFAULT_ASSIGNMENT_LOOKBACK_HOURS;
    const requestedMaxJobs = Number(body.maxJobs);
    const maxJobs = Number.isFinite(requestedMaxJobs)
      ? Math.max(1, Math.min(requestedMaxJobs, 500))
      : DEFAULT_MAX_JOBS;
    const candidateLimit = Math.min(Math.max(maxJobs * 5, 250), 1000);
    const actor = body.actor || 'SLA Automation';
    const testRecipientEmail = typeof body.testRecipientEmail === 'string' ? body.testRecipientEmail.trim() : '';

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const selectColumns = 'id,assigned_to,created_at,updated_at,sla_due_at,status';
    const closedStatuses = ['Resolved', 'Closed'];
    const closedStatusFilter = `(${closedStatuses.map((s) => `"${s}"`).join(',')})`;

    // Fetch recently created tickets for assignment notifications
    const { data: recentlyCreated, error: recentError } = await admin
      .from('tickets')
      .select(selectColumns)
      .not('status', 'in', closedStatusFilter)
      .gte('created_at', hoursAgoIso(assignmentLookbackHours, now))
      .order('created_at', { ascending: true })
      .limit(candidateLimit);
    if (recentError) throw recentError;

    // Fetch open tickets whose SLA expires within 3 hours
    const slaWindowEnd = new Date(now.getTime() + SLA_REMINDER_WINDOW_MS).toISOString();
    const { data: slaDueTickets, error: slaError } = await admin
      .from('tickets')
      .select(selectColumns)
      .not('status', 'in', closedStatusFilter)
      .gt('sla_due_at', now.toISOString())
      .lte('sla_due_at', slaWindowEnd)
      .order('sla_due_at', { ascending: true })
      .limit(candidateLimit);
    if (slaError) throw slaError;

    // Merge both result sets, deduped by id
    const ticketMap = new Map<string, TicketEmailAutomationTicket>();
    for (const t of ((recentlyCreated || []) as TicketEmailAutomationTicket[])) ticketMap.set(t.id, t);
    for (const t of ((slaDueTickets || []) as TicketEmailAutomationTicket[])) ticketMap.set(t.id, t);
    const tickets = Array.from(ticketMap.values());

    const assignmentTicketIds = new Set(
      ((recentlyCreated || []) as TicketEmailAutomationTicket[]).map((t) => t.id),
    );
    const slaExpiryTicketIds = new Set(
      ((slaDueTickets || []) as TicketEmailAutomationTicket[]).map((t) => t.id),
    );

    const potentialJobs = buildTicketEmailAutomationJobs({
      tickets,
      existingEventKeys: new Set(),
      assignmentTicketIds,
      slaExpiryTicketIds,
      now,
      timeZone: DEFAULT_TIME_ZONE,
    });
    const existingEventKeys = await fetchExistingEventKeys(admin, potentialJobs);
    const jobs = buildTicketEmailAutomationJobs({
      tickets,
      existingEventKeys,
      assignmentTicketIds,
      slaExpiryTicketIds,
      now,
      timeZone: DEFAULT_TIME_ZONE,
    }).slice(0, maxJobs);

    if (body.dryRun) {
      return json({
        ok: true,
        dryRun: true,
        ticketsScanned: tickets.length,
        assignmentCandidates: assignmentTicketIds.size,
        slaExpiryCandidates: slaExpiryTicketIds.size,
        jobs,
      });
    }

    const automationSecret = optionalEnv('TICKET_EMAIL_AUTOMATION_SECRET');
    const sent: unknown[] = [];
    const failed: { job: TicketEmailAutomationJob; error: string }[] = [];

    const dispatch = async (job: TicketEmailAutomationJob) => {
      try {
        sent.push(await invokeLifecycleEmail(supabaseUrl, serviceRoleKey, automationSecret, job, actor, testRecipientEmail));
      } catch (error) {
        failed.push({
          job,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    for (let index = 0; index < jobs.length; index += JOB_CONCURRENCY) {
      await Promise.all(jobs.slice(index, index + JOB_CONCURRENCY).map(dispatch));
    }

    return json({
      ok: failed.length === 0,
      ticketsScanned: tickets.length,
      jobsAttempted: jobs.length,
      sent,
      failed,
    }, failed.length ? 207 : 200);
  } catch (error) {
    console.error('ticket-email-automation failed', error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
