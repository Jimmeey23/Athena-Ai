type ChatRole = 'user' | 'assistant';

export interface ExportableTicketDraft {
  title?: string;
  category?: string;
  subCategory?: string;
  priority?: string;
  studio?: string;
}

export interface ExportableDetailForm {
  title?: string;
  fields?: Array<{
    label?: string;
    id?: string;
    required?: boolean;
  }>;
}

export interface ExportableChatMessage {
  role: ChatRole;
  content: string;
  ticket?: ExportableTicketDraft | null;
  ticketId?: string;
  published?: boolean;
  detailForm?: ExportableDetailForm | null;
}

export interface ChatTranscriptExportOptions {
  conversationId?: string | null;
  reporterName?: string;
  exportedAt?: Date;
}

function exportDate(options?: ChatTranscriptExportOptions): Date {
  return options?.exportedAt || new Date();
}

function displayDate(date: Date): string {
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function messageRoleLabel(role: ChatRole): string {
  return role === 'user' ? 'User' : 'Assistant';
}

function ticketSummary(ticket?: ExportableTicketDraft | null): string[] {
  if (!ticket) return [];
  return [
    `Ticket draft: ${ticket.title || 'Untitled draft'}`,
    ticket.category || ticket.subCategory ? `Route: ${[ticket.category, ticket.subCategory].filter(Boolean).join(' / ')}` : '',
    ticket.priority ? `Priority: ${ticket.priority}` : '',
    ticket.studio ? `Studio: ${ticket.studio}` : '',
  ].filter(Boolean);
}

function detailFormSummary(form?: ExportableDetailForm | null): string[] {
  if (!form?.fields?.length) return [];
  return [
    `Detail form: ${form.title || 'Required details'}`,
    ...form.fields.map((field) => (
      `- ${field.label || field.id || 'Field'}${field.required ? ' *' : ''}`
    )),
  ];
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlParagraphs(value: string): string {
  return htmlEscape(value)
    .split('\n')
    .map((line) => line.trim() ? line : '&nbsp;')
    .join('<br>');
}

export function transcriptFileBaseName(date = new Date()): string {
  const iso = date.toISOString();
  return `athena-chat-${iso.slice(0, 10)}-${iso.slice(11, 16).replace(':', '')}`;
}

export function plainTextForChatTranscript(
  messages: ExportableChatMessage[],
  options: ChatTranscriptExportOptions = {},
): string {
  const exportedAt = exportDate(options);
  const header = [
    'Athena Conversation Export',
    `Exported: ${displayDate(exportedAt)}`,
    options.reporterName ? `Reporter: ${options.reporterName}` : '',
    options.conversationId ? `Conversation ID: ${options.conversationId}` : '',
  ].filter(Boolean);

  const body = messages.map((message) => {
    const lines = [
      `[${messageRoleLabel(message.role)}]`,
      message.content.trim(),
      ...ticketSummary(message.ticket),
      message.published && message.ticketId ? `Published ticket: ${message.ticketId}` : '',
      ...detailFormSummary(message.detailForm),
    ].filter(Boolean);
    return lines.join('\n');
  });

  return [...header, '', ...body].join('\n\n');
}

export function htmlForChatTranscript(
  messages: ExportableChatMessage[],
  options: ChatTranscriptExportOptions = {},
): string {
  const exportedAt = exportDate(options);
  const metaRows = [
    ['Exported', displayDate(exportedAt)],
    options.reporterName ? ['Reporter', options.reporterName] : null,
    options.conversationId ? ['Conversation ID', options.conversationId] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const messageHtml = messages.map((message) => {
    const isUser = message.role === 'user';
    const extraLines = [
      ...ticketSummary(message.ticket),
      message.published && message.ticketId ? `Published ticket: ${message.ticketId}` : '',
      ...detailFormSummary(message.detailForm),
    ].filter(Boolean);
    return `
      <article class="message ${isUser ? 'user' : 'assistant'}">
        <div class="role">${htmlEscape(messageRoleLabel(message.role))}</div>
        <div class="bubble">${htmlParagraphs(message.content.trim())}</div>
        ${extraLines.length ? `<div class="meta">${htmlParagraphs(extraLines.join('\n'))}</div>` : ''}
      </article>
    `;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Athena Conversation Export</title>
  <style>
    body { margin: 0; background: #f3f4f6; color: #0f172a; font-family: Inter, "Plus Jakarta Sans", Arial, sans-serif; }
    main { max-width: 920px; margin: 0 auto; padding: 32px 20px; }
    header { border-bottom: 1px solid #dbe3ef; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { margin: 0 0 10px; font-size: 24px; line-height: 1.2; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; color: #475569; font-size: 13px; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .message { margin: 0 0 16px; }
    .message.user { text-align: right; }
    .role { margin: 0 0 5px; color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .bubble, .meta { display: inline-block; max-width: 76%; border: 1px solid #e2e8f0; border-radius: 16px; padding: 11px 13px; background: #fff; text-align: left; font-size: 13px; line-height: 1.6; box-shadow: 0 12px 32px rgba(15, 23, 42, .07); }
    .user .bubble { background: #eff6ff; border-color: #bfdbfe; }
    .meta { display: block; max-width: 76%; margin-top: 6px; color: #475569; background: #f8fafc; box-shadow: none; }
    .user .meta { margin-left: auto; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Athena Conversation Export</h1>
      <dl>
        ${metaRows.map(([label, value]) => `<dt>${htmlEscape(label)}</dt><dd>${htmlEscape(value)}</dd>`).join('\n        ')}
      </dl>
    </header>
    ${messageHtml}
  </main>
</body>
</html>`;
}
