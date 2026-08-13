import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getAccessToken } from '../_shared/momence-common.ts';

const MOMENCE_BASE_URL = 'https://api.momence.com/api/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-signature, x-webhook-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

// Momence's webhook docs (api.docs.momence.com/reference/outoging-webhooks,
// .../reference/webhooks-reference) describe three verification headers but
// do not fully specify the signing scheme. We treat x-webhook-secret as a
// shared-secret check, and additionally verify x-webhook-signature as an
// HMAC-SHA256 (hex) of the raw request body keyed by that same secret. If
// Momence's actual signing key/string ever differs, this signature check
// will start rejecting valid deliveries — the secret check alone remains a
// safety net in that case.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

interface MomenceWebhookEnvelope {
  timestamp?: string;
  event?: string;
  payload?: Record<string, unknown>;
}

function parseEnvelope(rawBody: string): MomenceWebhookEnvelope {
  const outer = JSON.parse(rawBody) as Record<string, unknown>;
  if (typeof outer.event === 'string') return outer as MomenceWebhookEnvelope;
  if (typeof outer.payload === 'string') return JSON.parse(outer.payload) as MomenceWebhookEnvelope;
  return outer as MomenceWebhookEnvelope;
}

async function momenceGet<T>(path: string): Promise<T | null> {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${MOMENCE_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

interface SessionSummary {
  className?: string;
  studio?: string;
  teacherName?: string;
  startsAt?: string;
}

async function fetchSessionSummary(sessionId: unknown): Promise<SessionSummary | null> {
  if (sessionId == null) return null;
  const session = await momenceGet<{
    name?: string;
    type?: string;
    startsAt?: string;
    teacher?: { firstName?: string; lastName?: string } | null;
    inPersonLocation?: { name?: string } | null;
  }>(`/host/sessions/${sessionId}`);
  if (!session) return null;
  return {
    className: session.name || session.type,
    studio: session.inPersonLocation?.name,
    teacherName: [session.teacher?.firstName, session.teacher?.lastName].filter(Boolean).join(' ') || undefined,
    startsAt: session.startsAt,
  };
}

interface MemberSummary {
  name?: string;
  email?: string;
}

async function fetchMemberSummary(memberId: unknown): Promise<MemberSummary | null> {
  if (memberId == null) return null;
  const member = await momenceGet<{ firstName?: string; lastName?: string; email?: string }>(`/host/members/${memberId}`);
  if (!member) return null;
  return {
    name: [member.firstName, member.lastName].filter(Boolean).join(' ') || undefined,
    email: member.email,
  };
}

interface PaymentTransactionSummary {
  amountInCurrency?: number;
  currency?: string;
  memberId?: number;
}

async function fetchPaymentTransactionSummary(transactionId: unknown): Promise<PaymentTransactionSummary | null> {
  if (transactionId == null) return null;
  const transaction = await momenceGet<{ amountInCurrency?: number; currency?: string; member?: { id?: number } }>(`/host/payment-transactions/${transactionId}`);
  if (!transaction) return null;
  return {
    amountInCurrency: transaction.amountInCurrency,
    currency: transaction.currency,
    memberId: transaction.member?.id,
  };
}

interface TicketDraft {
  title: string;
  description: string;
  category: string;
  sub_category: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  studio?: string;
  trainer?: string;
  class_type?: string;
  class_date_time?: string;
  member_name?: string;
  member_contact?: string;
  tags: string[];
  sentiment?: string;
  metadata: Record<string, unknown>;
}

async function buildTicketDraft(event: string, payload: Record<string, unknown>): Promise<TicketDraft | null> {
  if (event === 'session-booking-cancelled' && payload.isLateCancellation) {
    const [session, member] = await Promise.all([
      fetchSessionSummary(payload.sessionId),
      fetchMemberSummary(payload.targetMemberId ?? payload.payingMemberId),
    ]);
    return {
      title: `Late cancellation · ${member?.name || `Member #${payload.targetMemberId ?? payload.payingMemberId ?? 'unknown'}`} · ${session?.className || `Session #${payload.sessionId}`}`,
      description: `Momence reported a late cancellation.\n\nSession: ${session?.className || payload.sessionId}\nStudio: ${session?.studio || 'Unknown'}\nInstructor: ${session?.teacherName || 'Unknown'}\nCancelled at: ${payload.cancelledAt || 'Unknown'}\nBooking ID: ${payload.sessionBookingId}`,
      category: 'Booking & Schedule',
      sub_category: 'Late Cancellation Fee',
      priority: 'Low',
      studio: session?.studio,
      trainer: session?.teacherName,
      class_type: session?.className,
      class_date_time: session?.startsAt,
      member_name: member?.name,
      member_contact: member?.email,
      tags: ['momence-webhook', 'late-cancellation'],
      metadata: { source: 'momence-webhook', event, sessionBookingId: payload.sessionBookingId, sessionId: payload.sessionId },
    };
  }

  if (event === 'session-booking-no-show') {
    const [session, member] = await Promise.all([
      fetchSessionSummary(payload.sessionId),
      fetchMemberSummary(payload.memberId),
    ]);
    return {
      title: `No-show · ${member?.name || `Member #${payload.memberId}`} · ${session?.className || `Session #${payload.sessionId}`}`,
      description: `Momence reported a no-show.\n\nSession: ${session?.className || payload.sessionId}\nStudio: ${session?.studio || 'Unknown'}\nInstructor: ${session?.teacherName || 'Unknown'}\nScheduled at: ${session?.startsAt || 'Unknown'}\nBooking ID: ${payload.sessionBookingId}`,
      category: 'Booking & Schedule',
      sub_category: 'No-Show Dispute',
      priority: 'Low',
      studio: session?.studio,
      trainer: session?.teacherName,
      class_type: session?.className,
      class_date_time: session?.startsAt,
      member_name: member?.name,
      member_contact: member?.email,
      tags: ['momence-webhook', 'no-show'],
      metadata: { source: 'momence-webhook', event, sessionBookingId: payload.sessionBookingId, sessionId: payload.sessionId },
    };
  }

  if (event === 'payment-transaction-failed') {
    const transaction = await fetchPaymentTransactionSummary(payload.id);
    const member = await fetchMemberSummary(transaction?.memberId);
    const amountLabel = transaction?.amountInCurrency != null
      ? `${transaction.amountInCurrency} ${transaction.currency || ''}`.trim()
      : 'Unknown amount';
    return {
      title: `Failed payment · ${member?.name || `Transaction #${payload.id}`}`,
      description: `Momence reported a failed payment transaction.\n\nTransaction ID: ${payload.id}\nAmount: ${amountLabel}\nMember: ${member?.name || 'Unknown'} (${member?.email || 'no email on file'})`,
      category: 'Billing & Membership',
      sub_category: 'Failed Payment',
      priority: 'High',
      member_name: member?.name,
      member_contact: member?.email,
      tags: ['momence-webhook', 'failed-payment'],
      sentiment: 'Negative',
      metadata: { source: 'momence-webhook', event, transactionId: payload.id },
    };
  }

  return null;
}

const ACTIONABLE_EVENTS = new Set(['session-booking-cancelled', 'session-booking-no-show', 'payment-transaction-failed']);

const PRIORITY_SLA_HOURS: Record<TicketDraft['priority'], number> = {
  Critical: 2,
  High: 8,
  Medium: 24,
  Low: 72,
};

function slaDueAt(priority: TicketDraft['priority']): string {
  const hours = PRIORITY_SLA_HOURS[priority];
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let webhookSecret: string;
  try {
    webhookSecret = requiredEnv('MOMENCE_WEBHOOK_SECRET');
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Server misconfigured' }, 500);
  }

  const providedSecret = request.headers.get('x-webhook-secret') || '';
  if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const rawBody = await request.text();
  const providedSignature = request.headers.get('x-webhook-signature') || '';
  if (providedSignature) {
    const expectedSignature = await hmacSha256Hex(webhookSecret, rawBody);
    if (!timingSafeEqual(providedSignature.toLowerCase(), expectedSignature)) {
      return json({ error: 'Invalid signature' }, 401);
    }
  }

  let envelope: MomenceWebhookEnvelope;
  try {
    envelope = parseEnvelope(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const eventType = envelope.event;
  const eventPayload = envelope.payload || {};
  if (!eventType) return json({ error: 'Missing event type' }, 400);

  const requestId = request.headers.get('x-webhook-request-id') || `${eventType}:${crypto.randomUUID()}`;

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error: insertError } = await admin
    .from('momence_webhook_events')
    .insert({ request_id: requestId, event_type: eventType, payload: eventPayload })
    .select('id')
    .maybeSingle();

  if (insertError) {
    if (insertError.code === '23505') {
      // Duplicate delivery (Momence retry) - already processed, ack without reprocessing.
      return json({ ok: true, duplicate: true });
    }
    return json({ error: insertError.message }, 500);
  }

  if (!ACTIONABLE_EVENTS.has(eventType)) {
    return json({ ok: true, processed: false });
  }

  try {
    const draft = await buildTicketDraft(eventType, eventPayload);
    if (!draft) return json({ ok: true, processed: false });

    const { data: ticket, error: ticketError } = await admin
      .from('tickets')
      .insert({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        sub_category: draft.sub_category,
        priority: draft.priority,
        status: 'New',
        studio: draft.studio || 'Unspecified Studio',
        trainer: draft.trainer,
        class_type: draft.class_type,
        class_date_time: draft.class_date_time,
        member_name: draft.member_name,
        member_contact: draft.member_contact,
        assigned_to: 'Unassigned',
        team: 'Member Experience',
        tags: draft.tags,
        sentiment: draft.sentiment,
        metadata: draft.metadata,
        sla_due_at: slaDueAt(draft.priority),
      })
      .select('id')
      .single();

    if (ticketError) throw new Error(ticketError.message);

    await admin
      .from('momence_webhook_events')
      .update({ ticket_id: ticket.id })
      .eq('id', inserted?.id);

    return json({ ok: true, processed: true, ticketId: ticket.id });
  } catch (error) {
    return json({ ok: true, processed: false, error: error instanceof Error ? error.message : 'Ticket creation failed' });
  }
});
