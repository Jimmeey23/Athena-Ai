export type NormalizedInboundEmail = {
  messageId: string;
  eventId?: string;
  eventType?: string;
  inboundInboxId?: string;
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  subject: string;
  text: string;
  html?: string;
  raw: unknown;
};

export type FreezeRequest =
  | {
      intent: 'freeze';
      freezeAt: string;
      unfreezeAt: string;
      membershipHint?: string;
      reason?: string;
    }
  | {
      intent: 'unsupported' | 'incomplete';
      reason: string;
    };

const QUALIFIED_FREEZE_RECIPIENT = 'freeze@physique57india.com';

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MEMBERSHIP_NAMES = [
  'Barre 1 month Unlimited',
  'Barre 2 week Unlimited',
  'Barre 3 months Unlimited',
  'Barre 6 month Unlimited',
  'Barre Annual Membership',
  'Newcomers 2 For 1',
  "Owner's Special - 2 for 1",
  'powerCycle 1 month Unlimited',
  'powerCycle 2 week Unlimited',
  'powerCycle 3 months Unlimited',
  'powerCycle 6 months Unlimited',
  'powerCycle Annual Membership',
  'Strength Lab 1 month Unlimited',
  'Strength Lab 2 week Unlimited',
  'Strength Lab 3 months Unlimited',
  'Strength Lab 6 months Unlimited',
  'Strength Lab Annual Membership',
  'Studio 1 Month Unlimited Membership',
  'Studio 10 Single Class Pack',
  'Studio 12 Class Package',
  'Studio 2 Week Unlimited Membership',
  'Studio 20 Single Class Pack',
  'Studio 3 Month U/L Monthly Installment',
  'Studio 3 Month Unlimited Membership',
  'Studio 30 Single Class Pack',
  'Studio 4 Class Package',
  'Studio 6 Month Unlimited Membership',
  'Studio 8 Class Package',
  'Studio Annual Membership - Monthly Intsallment',
  'Studio Annual Unlimited Membership',
  'Studio Extended 10 Single Class Pack',
  'Studio Happy Hour Private',
  'Studio Newcomers 2 Week Unlimited Membership',
  'Studio Private - Anisha (Single Class)',
  'Studio Private Class',
  'Studio Private Class X 10',
  'Studio Privates - Anisha x 10',
  'Studio Single Class',
  'Summer Bootcamp - Studio 6 Week Unlimited',
  'Virtual Private - Anisha',
  'Virtual Private Class',
  'Virtual Private Class X 10',
  'Virtual Privates - Anisha x 10',
];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeHex(value: string): string {
  return value.trim().replace(/^sha256=/i, '').toLowerCase();
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = normalizeHex(a);
  const right = normalizeHex(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function mailtrapWebhookSignature(rawBody: string, signingSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyMailtrapWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  signingSecret: string,
): Promise<boolean> {
  if (!signatureHeader?.trim() || !signingSecret.trim()) return false;
  const expected = await mailtrapWebhookSignature(rawBody, signingSecret);
  return timingSafeEqualHex(expected, signatureHeader);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function emailFromValue(value: unknown): { email: string; name?: string } {
  if (typeof value === 'string') {
    const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    const name = value.replace(/<[^>]+>/g, '').trim();
    return { email, name: name && name !== email ? name : undefined };
  }
  const record = asRecord(value);
  return {
    email: stringValue(record.email, record.address),
    name: stringValue(record.name) || undefined,
  };
}

export function normalizeInboundEmail(payload: unknown): NormalizedInboundEmail | null {
  return normalizeInboundEmails(payload)[0] || null;
}

export function normalizeInboundEmails(payload: unknown): NormalizedInboundEmail[] {
  const root = asRecord(payload);
  const candidates = Array.isArray(root.events) ? root.events.map(asRecord) : [root];

  return candidates.map((candidate): NormalizedInboundEmail | null => {
    const from = emailFromValue(candidate.from || candidate.sender || candidate.from_email || candidate.From);
    const to = Array.isArray(candidate.to)
      ? emailFromValue(candidate.to[0])
      : emailFromValue(candidate.to || candidate.recipient || candidate.To || candidate.inbound_inbox_address);
    const text = stringValue(
      candidate.text,
      candidate.text_body,
      candidate.body_text,
      candidate.plain,
      candidate.body,
      candidate.message,
    );
    const html = stringValue(candidate.html, candidate.html_body, candidate.body_html);
    const subject = stringValue(candidate.subject, candidate.Subject);
    const messageId = stringValue(candidate.message_id, candidate.messageId, candidate.event_id, candidate.id);
    const eventId = stringValue(candidate.event_id, candidate.eventId);
    const eventType = stringValue(candidate.event, candidate.type);
    const inboundInboxId = stringValue(candidate.inbound_inbox_id, candidate.inboundInboxId);

    if (!from.email || (!text && !html && !subject)) return null;

    return {
      messageId,
      eventId: eventId || undefined,
      eventType: eventType || undefined,
      inboundInboxId: inboundInboxId || undefined,
      fromEmail: from.email.toLowerCase(),
      fromName: from.name,
      toEmail: to.email.toLowerCase() || undefined,
      subject,
      text: text || stripHtml(html),
      html: html || undefined,
      raw: payload,
    };
  }).filter((email): email is NormalizedInboundEmail => Boolean(email));
}

export function isQualifiedFreezeRecipient(email: Pick<NormalizedInboundEmail, 'toEmail'>): boolean {
  return email.toEmail?.toLowerCase() === QUALIFIED_FREEZE_RECIPIENT;
}

function stripHtml(value: string): string {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isoDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function parseHumanDate(value: string, fallbackYear: number): string {
  const cleaned = value.trim().replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  const iso = cleaned.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dayMonth = cleaned.match(/\b(\d{1,2})\s+([a-z]+)\s*(20\d{2})?\b/i);
  if (dayMonth) {
    return isoDate(
      Number(dayMonth[3] || fallbackYear),
      MONTHS[dayMonth[2].toLowerCase()] || 0,
      Number(dayMonth[1]),
    );
  }

  const monthDay = cleaned.match(/\b([a-z]+)\s+(\d{1,2}),?\s*(20\d{2})?\b/i);
  if (monthDay) {
    return isoDate(
      Number(monthDay[3] || fallbackYear),
      MONTHS[monthDay[1].toLowerCase()] || 0,
      Number(monthDay[2]),
    );
  }

  return '';
}

function extractDateWindow(text: string, now = new Date()): { freezeAt: string; unfreezeAt: string } | null {
  const normalized = text.replace(/\s+/g, ' ');
  const range = normalized.match(/\bfrom\s+(.{3,30}?)(?:\s+(?:to|till|until|through)\s+|\s*-\s*)(.{3,30}?)(?:[.?!,\n]|$)/i);
  if (!range) return null;
  const fallbackYear = now.getFullYear();
  const freezeAt = parseHumanDate(range[1], fallbackYear);
  const unfreezeAt = parseHumanDate(range[2], fallbackYear);
  if (!freezeAt || !unfreezeAt) return null;
  return { freezeAt, unfreezeAt };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\bu\/l\b/g, 'unlimited').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function findMembershipHint(text: string): string | undefined {
  const normalized = normalizeText(text);
  return MEMBERSHIP_NAMES.find((name) => normalized.includes(normalizeText(name)));
}

function extractReason(text: string): string | undefined {
  const match = text.match(/\b(?:because|as|reason[:\s]+)(.{4,160})/i);
  if (match) return match[1].replace(/\s+/g, ' ').trim().replace(/[.?!]$/, '');
  const sentence = text.match(/\b(I am|I'm|I will be|travelling|traveling|medical|injury|away|out of town)\b[^.?!]*(?:[.?!]|$)/i);
  return sentence?.[0]?.replace(/\s+/g, ' ').trim().replace(/[.?!]$/, '');
}

export function extractFreezeRequest(
  email: Pick<NormalizedInboundEmail, 'subject' | 'text'> & Partial<Pick<NormalizedInboundEmail, 'fromEmail' | 'fromName'>>,
  now = new Date(),
): FreezeRequest {
  const combined = `${email.subject || ''}\n${email.text || ''}`.trim();
  if (!/\bfreeze|pause\b/i.test(combined)) {
    return { intent: 'unsupported', reason: 'Email does not appear to request a membership freeze.' };
  }

  const window = extractDateWindow(combined, now);
  if (!window) {
    return { intent: 'incomplete', reason: 'Freeze start and end dates were not found.' };
  }

  return {
    intent: 'freeze',
    ...window,
    membershipHint: findMembershipHint(combined),
    reason: extractReason(combined),
  };
}
