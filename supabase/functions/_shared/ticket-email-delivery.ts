type TicketEmailDeliveryEnvelopeInput = {
  ownerEmail: string;
  escalationEmail?: string | null;
  subject: string;
  testRecipientEmail?: string;
};

type TicketEmailDeliveryEnvelope = {
  to: string;
  cc?: string;
  subject: string;
};

export function ticketEmailDeliveryEnvelope({
  ownerEmail,
  escalationEmail,
  subject,
  testRecipientEmail = '',
}: TicketEmailDeliveryEnvelopeInput): TicketEmailDeliveryEnvelope {
  const testTo = testRecipientEmail.trim();
  if (testTo) {
    return {
      to: testTo,
      cc: undefined,
      subject: `[TEST REDIRECT] ${subject}`,
    };
  }

  return {
    to: ownerEmail,
    cc: escalationEmail && escalationEmail !== ownerEmail ? escalationEmail : undefined,
    subject,
  };
}
