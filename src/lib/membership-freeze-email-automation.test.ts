import { describe, expect, it } from 'vitest';
import {
  extractFreezeRequest,
  isQualifiedFreezeRecipient,
  mailtrapWebhookSignature,
  normalizeInboundEmail,
  normalizeInboundEmails,
  verifyMailtrapWebhookSignature,
} from '../../supabase/functions/_shared/membership-freeze-email-automation';

describe('membership freeze email automation helpers', () => {
  it('verifies Mailtrap HMAC signatures against the raw body', async () => {
    const rawBody = JSON.stringify({
      from: { email: 'member@example.com', name: 'Asha Mehta' },
      subject: 'Freeze request',
      text: 'Please freeze from 2026-06-01 to 2026-06-15.',
    });
    const secret = '0123456789abcdef0123456789abcdef';
    const signature = await mailtrapWebhookSignature(rawBody, secret);

    await expect(verifyMailtrapWebhookSignature(rawBody, signature, secret)).resolves.toBe(true);
    await expect(verifyMailtrapWebhookSignature(`${rawBody}\n`, signature, secret)).resolves.toBe(false);
  });

  it('normalizes common inbound email payload shapes', () => {
    const normalized = normalizeInboundEmail({
      message_id: 'mailtrap-123',
      from: { email: 'member@example.com', name: 'Asha Mehta' },
      to: [{ email: 'freeze@physique57india.com' }],
      subject: 'Membership freeze',
      text: 'Please freeze my membership.',
      html: '<p>Please freeze my membership.</p>',
    });

    expect(normalized).toMatchObject({
      messageId: 'mailtrap-123',
      fromEmail: 'member@example.com',
      fromName: 'Asha Mehta',
      subject: 'Membership freeze',
      text: 'Please freeze my membership.',
    });
  });

  it('normalizes Mailtrap inbound event batches', () => {
    const normalized = normalizeInboundEmails({
      events: [
        {
          event: 'inbound_message_received',
          message_id: '8d2a4c16-9c7f-4a7e-8b51-8d2a4c169c7f',
          inbound_inbox_id: 1,
          inbound_inbox_address: 'hello@inbound.example.com',
          from: 'sender@example.com',
          to: 'hello@inbound.example.com',
          subject: 'Hello from a customer',
          timestamp: 1733497282,
        },
      ],
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      messageId: '8d2a4c16-9c7f-4a7e-8b51-8d2a4c169c7f',
      eventType: 'inbound_message_received',
      inboundInboxId: '1',
      fromEmail: 'sender@example.com',
      toEmail: 'hello@inbound.example.com',
      subject: 'Hello from a customer',
    });
  });

  it('qualifies only freeze inbox recipients', () => {
    expect(isQualifiedFreezeRecipient({ toEmail: 'freeze@physique57india.com' })).toBe(true);
    expect(isQualifiedFreezeRecipient({ toEmail: 'hello@physique57india.com' })).toBe(false);
    expect(isQualifiedFreezeRecipient({ toEmail: undefined })).toBe(false);
  });

  it('uses inbound inbox address as a recipient fallback', () => {
    const normalized = normalizeInboundEmail({
      event: 'inbound_message_received',
      message_id: 'mailtrap-inbound-1',
      inbound_inbox_address: 'freeze@physique57india.com',
      from: 'member@example.com',
      subject: 'Freeze request',
      text: 'Please freeze my membership from 1 June 2026 to 15 June 2026.',
    });

    expect(normalized).toMatchObject({
      toEmail: 'freeze@physique57india.com',
    });
    expect(isQualifiedFreezeRecipient(normalized!)).toBe(true);
  });

  it('extracts scheduled freeze dates from email text', () => {
    const request = extractFreezeRequest({
      fromEmail: 'member@example.com',
      fromName: 'Asha Mehta',
      subject: 'Freeze membership',
      text: 'Please freeze my Studio 3 Month Unlimited Membership from 1 June 2026 to 15 June 2026. I am travelling.',
    });

    expect(request).toMatchObject({
      intent: 'freeze',
      freezeAt: '2026-06-01',
      unfreezeAt: '2026-06-15',
      membershipHint: 'Studio 3 Month Unlimited Membership',
      reason: 'I am travelling',
    });
  });

  it('extracts freeze dates from concise member emails', () => {
    expect(extractFreezeRequest({
      fromEmail: 'tanya@example.com',
      subject: '',
      text: 'Hi\n\nI’d like to pause my membership from 26th May- 1st June.',
    }, new Date('2026-05-27T09:42:00+05:30'))).toMatchObject({
      intent: 'freeze',
      freezeAt: '2026-05-26',
      unfreezeAt: '2026-06-01',
    });

    expect(extractFreezeRequest({
      fromEmail: 'farah@example.com',
      subject: '',
      text: 'Hi please can you freeze my membership from 30th May to 30th June\n\nThank you\nFarah',
    }, new Date('2026-05-31T12:11:00+05:30'))).toMatchObject({
      intent: 'freeze',
      freezeAt: '2026-05-30',
      unfreezeAt: '2026-06-30',
    });
  });

  it('rejects non-freeze messages', () => {
    expect(extractFreezeRequest({
      fromEmail: 'member@example.com',
      subject: 'Question',
      text: 'What time is class today?',
    })).toMatchObject({
      intent: 'unsupported',
    });
  });
});
