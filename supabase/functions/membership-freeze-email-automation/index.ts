import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import nodemailer from 'npm:nodemailer@6.9.16';
import {
  extractFreezeRequest,
  isQualifiedFreezeRecipient,
  normalizeInboundEmails,
  verifyMailtrapWebhookSignature,
  type NormalizedInboundEmail,
} from '../_shared/membership-freeze-email-automation.ts';

const MOMENCE_BASE_URL = 'https://api.momence.com/api/v2';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mailtrap-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type TokenResponse = {
  accessToken?: string;
  access_token?: string;
};

type MomenceMember = {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
};

type MomenceMembership = {
  id: number;
  type?: string;
  startDate?: string | null;
  endDate?: string | null;
  isFrozen?: boolean;
  freeze?: {
    freezedAt?: string | null;
    scheduledFreezeAt?: string | null;
    unfreezedScheduledAt?: string | null;
    unfrozenAt?: string | null;
  } | null;
  membership?: {
    id?: number;
    name?: string;
  } | null;
};

type PaginatedMomenceResponse<T> = {
  payload?: T[];
  data?: T[];
  items?: T[];
};

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

function payloadFrom<T>(response: PaginatedMomenceResponse<T> | T[]): T[] {
  if (Array.isArray(response)) return response;
  return response.payload || response.data || response.items || [];
}

async function getMomenceAccessToken(): Promise<string> {
  const staticToken = Deno.env.get('MOMENCE_ACCESS_TOKEN');
  if (staticToken) return staticToken;

  const form = new URLSearchParams({
    grant_type: 'password',
    username: requiredEnv('MOMENCE_USERNAME'),
    password: requiredEnv('MOMENCE_PASSWORD'),
  });

  const response = await fetch(`${MOMENCE_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${requiredEnv('MOMENCE_CLIENT_ID')}:${requiredEnv('MOMENCE_CLIENT_SECRET')}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Momence token request failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json() as TokenResponse;
  const token = data.access_token || data.accessToken;
  if (!token) throw new Error('Momence token response did not include an access token');
  return token;
}

async function momenceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getMomenceAccessToken();
  const response = await fetch(`${MOMENCE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Momence request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) as T : {} as T;
}

async function findMomenceMemberByEmail(email: string): Promise<MomenceMember> {
  const result = await momenceRequest<PaginatedMomenceResponse<MomenceMember>>(
    `/host/members?page=0&pageSize=100&sortOrder=DESC&sortBy=lastSeenAt&query=${encodeURIComponent(email)}`,
  );
  const members = payloadFrom(result);
  const exact = members.find((member) => (member.email || '').trim().toLowerCase() === email.trim().toLowerCase());
  const member = exact || members[0];
  if (!member?.id) throw new Error(`No Momence member found for ${email}`);
  return member;
}

async function getActiveMemberships(memberId: string | number): Promise<MomenceMembership[]> {
  const result = await momenceRequest<PaginatedMomenceResponse<MomenceMembership>>(
    `/host/members/${memberId}/bought-memberships/active?page=0&pageSize=200&includeFrozen=true`,
  );
  return payloadFrom(result);
}

function memberName(member: MomenceMember, fallbackName?: string): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || fallbackName || member.email || `Momence member ${member.id}`;
}

function membershipName(membership: MomenceMembership): string {
  return membership.membership?.name || membership.type || `Membership #${membership.id}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\bu\/l\b/g, 'unlimited').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function selectMembership(memberships: MomenceMembership[], hint?: string): MomenceMembership {
  const active = memberships.filter((membership) => !membership.isFrozen);
  if (hint) {
    const normalizedHint = normalizeText(hint);
    const match = active.find((membership) => normalizeText(membershipName(membership)).includes(normalizedHint));
    if (match) return match;
  }
  if (active.length === 1) return active[0];
  if (active.length === 0) throw new Error('No active unfrozen Momence membership found.');
  throw new Error('Multiple active memberships found; manual review required.');
}

function daysInclusive(startDate: string, endDate: string): number {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.ceil((end - start) / MS_PER_DAY) + 1;
}

function resumeDate(unfreezeAt: string): string {
  return new Date(Date.parse(unfreezeAt) + MS_PER_DAY).toISOString().slice(0, 10);
}

async function freezeMembership(input: {
  memberId: string | number;
  boughtMembershipId: string | number;
  freezeAt: string;
  unfreezeAt: string;
  reason?: string;
}) {
  return momenceRequest(`/host/members/${input.memberId}/bought-memberships/${input.boughtMembershipId}/membership-freeze`, {
    method: 'PUT',
    body: JSON.stringify({
      freezeType: 'scheduled',
      unfreezeType: 'scheduled',
      freezeAt: input.freezeAt,
      unfreezeAt: input.unfreezeAt,
      reason: input.reason || null,
    }),
  });
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
  const senderName = optionalEnv('MAILTRAP_FROM_NAME', 'SMTP_FROM_NAME') || 'Physique 57 India';
  const configuredFrom = optionalEnv('MAILTRAP_FROM_EMAIL', 'SMTP_FROM_EMAIL') || 'athena@physique57india.com';
  const emailMatch = configuredFrom.match(/<([^>]+)>/);
  const email = (emailMatch?.[1] || configuredFrom).trim();
  return `${senderName} <${email}>`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function confirmationEmail(input: {
  memberName: string;
  membershipName: string;
  freezeAt: string;
  unfreezeAt: string;
  resumeAt: string;
}) {
  const subject = 'Membership Freeze Confirmation — Physique 57 India';
  const text = [
    `Hi ${input.memberName},`,
    '',
    `Your membership freeze for ${input.membershipName} has been scheduled.`,
    `Freeze start: ${formatDate(input.freezeAt)}`,
    `Freeze end: ${formatDate(input.unfreezeAt)}`,
    `Resume date: ${formatDate(input.resumeAt)}`,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5">
      <h2 style="margin:0 0 12px">Membership Freeze Confirmation</h2>
      <p>Hi <strong>${input.memberName}</strong>, your membership freeze has been scheduled.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0">
        <tr><td>Membership</td><td><strong>${input.membershipName}</strong></td></tr>
        <tr><td>Freeze Start</td><td><strong>${formatDate(input.freezeAt)}</strong></td></tr>
        <tr><td>Freeze End</td><td><strong>${formatDate(input.unfreezeAt)}</strong></td></tr>
        <tr><td>Resume Date</td><td><strong>${formatDate(input.resumeAt)}</strong></td></tr>
      </table>
    </div>
  `;
  return { subject, text, html };
}

async function sendConfirmation(to: string, input: Parameters<typeof confirmationEmail>[0]) {
  const email = confirmationEmail(input);
  await smtpTransport().sendMail({
    from: senderFromHeader(),
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

function ticketMetadata(input: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    automation: {
      type: 'membership_freeze_email',
      ...input,
    },
    latestResolution: {
      reason: 'Automated membership freeze completed from inbound email request.',
      actionTaken: 'Momence membership freeze was applied automatically.',
      actionDate: now.slice(0, 10),
      resolutionSummary: 'Membership freeze completed in Momence and confirmation email sent.',
      outcome: 'Member membership freeze request completed.',
      closedAt: now,
    },
    closedAt: now,
  };
}

async function insertClosedTicket(
  admin: ReturnType<typeof createClient>,
  input: {
    email: NormalizedInboundEmail;
    member: MomenceMember;
    membership: MomenceMembership;
    freezeAt: string;
    unfreezeAt: string;
    resumeAt: string;
    requestedDays: number;
    reason?: string;
    sourceRef: string;
  },
) {
  const name = memberName(input.member, input.email.fromName);
  const packageName = membershipName(input.membership);
  const metadata = ticketMetadata({
    source_ref: input.sourceRef,
    mailtrap_message_id: input.email.messageId,
    sender_email: input.email.fromEmail,
    momence_member_id: input.member.id,
    bought_membership_id: input.membership.id,
    membership_name: packageName,
    freezeAt: input.freezeAt,
    unfreezeAt: input.unfreezeAt,
    resumeAt: input.resumeAt,
    requestedDays: input.requestedDays,
    reason: input.reason || null,
  });
  const { data, error } = await admin.from('tickets').insert({
    source_ref: input.sourceRef,
    title: `Automated membership freeze completed for ${name}`,
    description: [
      `Inbound email from ${input.email.fromEmail} requested a membership freeze.`,
      `Member: ${name}`,
      `Membership: ${packageName}`,
      `Freeze window: ${input.freezeAt} to ${input.unfreezeAt}`,
      input.reason ? `Reason: ${input.reason}` : null,
      '',
      `Original subject: ${input.email.subject}`,
    ].filter(Boolean).join('\n'),
    category: 'Pricing and Memberships',
    sub_category: 'Membership Pause and Freeze Policy',
    priority: 'Low',
    status: 'Closed',
    studio: 'Unspecified Studio',
    member_name: name,
    member_contact: input.email.fromEmail,
    reported_by: input.email.fromEmail,
    assigned_to: 'Akshay Rane',
    team: 'Sales & Client Servicing',
    tags: ['mailtrap-inbound', 'membership-freeze', 'automated', 'closed'],
    sentiment: 'Neutral',
    conversation_summary: input.email.text.slice(0, 1000),
    metadata,
  }).select('id').single();
  if (error?.code === '23505') {
    const { data: existing, error: existingError } = await admin
      .from('tickets')
      .select('id')
      .eq('source_ref', input.sourceRef)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return String((existing as { id: string }).id);
  }
  if (error) throw error;

  const ticketId = String((data as { id: string }).id);
  const { error: eventError } = await admin.from('ticket_events').insert({
    ticket_id: ticketId,
    event_type: 'automation_completed',
    actor: 'Mailtrap Freeze Automation',
    from_value: 'Inbound Email',
    to_value: 'Closed',
    metadata,
  });
  if (eventError) console.warn('ticket event insert failed', eventError);
  return ticketId;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('Mailtrap-Signature');
    const signingSecret = requiredEnv('MAILTRAP_WEBHOOK_SIGNING_SECRET');
    const verified = await verifyMailtrapWebhookSignature(rawBody, signature, signingSecret);
    if (!verified) return json({ error: 'Invalid Mailtrap signature' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = JSON.parse(rawBody);
    const emails = normalizeInboundEmails(payload);
    if (!emails.length) {
      return json({
        ok: true,
        skipped: true,
        reason: 'No parseable inbound email content was present in the Mailtrap webhook payload.',
      });
    }

    const results: Array<Record<string, unknown>> = [];
    for (const email of emails) {
      if (!isQualifiedFreezeRecipient(email)) {
        results.push({
          ok: true,
          skipped: true,
          messageId: email.messageId,
          reason: 'Email was not sent to freeze@physique57india.com.',
        });
        continue;
      }

      const requestDetails = extractFreezeRequest(email);
      if (requestDetails.intent !== 'freeze') {
        results.push({
          ok: true,
          skipped: true,
          messageId: email.messageId,
          reason: requestDetails.reason,
        });
        continue;
      }

      const sourceRef = `mailtrap-freeze:${email.messageId || `${email.fromEmail}:${requestDetails.freezeAt}:${requestDetails.unfreezeAt}`}`;
      const { data: existingTicket, error: existingTicketError } = await admin
        .from('tickets')
        .select('id')
        .eq('source_ref', sourceRef)
        .maybeSingle();
      if (existingTicketError) throw existingTicketError;
      if (existingTicket) {
        results.push({
          ok: true,
          skipped: true,
          messageId: email.messageId,
          reason: 'duplicate',
          ticketId: String((existingTicket as { id: string }).id),
        });
        continue;
      }

      const member = await findMomenceMemberByEmail(email.fromEmail);
      const memberships = await getActiveMemberships(member.id);
      const membership = selectMembership(memberships, requestDetails.membershipHint);
      const requestedDays = daysInclusive(requestDetails.freezeAt, requestDetails.unfreezeAt);
      if (requestedDays <= 0) {
        results.push({
          ok: false,
          messageId: email.messageId,
          error: 'Invalid freeze date window',
        });
        continue;
      }

      await freezeMembership({
        memberId: member.id,
        boughtMembershipId: membership.id,
        freezeAt: requestDetails.freezeAt,
        unfreezeAt: requestDetails.unfreezeAt,
        reason: requestDetails.reason,
      });

      const resumeAt = resumeDate(requestDetails.unfreezeAt);
      await sendConfirmation(email.fromEmail, {
        memberName: memberName(member, email.fromName),
        membershipName: membershipName(membership),
        freezeAt: requestDetails.freezeAt,
        unfreezeAt: requestDetails.unfreezeAt,
        resumeAt,
      });

      const ticketId = await insertClosedTicket(admin, {
        email,
        member,
        membership,
        freezeAt: requestDetails.freezeAt,
        unfreezeAt: requestDetails.unfreezeAt,
        resumeAt,
        requestedDays,
        reason: requestDetails.reason,
        sourceRef,
      });

      results.push({
        ok: true,
        messageId: email.messageId,
        ticketId,
        momenceMemberId: member.id,
        boughtMembershipId: membership.id,
        freezeAt: requestDetails.freezeAt,
        unfreezeAt: requestDetails.unfreezeAt,
        resumeAt,
      });
    }

    const failed = results.filter((result) => !result.ok);
    return json({
      ok: failed.length === 0,
      results,
    }, failed.length ? 422 : 200);
  } catch (error) {
    console.error('membership-freeze-email-automation failed', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
