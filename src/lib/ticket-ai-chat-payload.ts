type ChatRole = 'user' | 'assistant';

export interface ChatPayloadMessage {
  id?: string;
  role: ChatRole;
  content: string;
}

export interface RelatedTicketSummary {
  title: string;
  status: string;
  createdAt?: string;
  studio?: string;
  category?: string;
}

export interface AthenaDraftRequestInput {
  aiProvider?: string;
  conversationId?: string | null;
  debugTrace?: boolean;
  context: Record<string, unknown>;
  intakeContract?: Record<string, unknown>;
  messages: ChatPayloadMessage[];
  preamble?: string;
  relatedTickets?: RelatedTicketSummary[];
}

export const ATHENA_PROMPT_PROFILE = 'athena-intake-v1';

const DEFAULT_MESSAGE_LIMIT = 6;
const MAX_MESSAGE_CHARS = 3000;

function truncateMessageContent(content: string): string {
  if (content.length <= MAX_MESSAGE_CHARS) return content;

  const edgeLength = Math.floor((MAX_MESSAGE_CHARS - 40) / 2);
  return [
    content.slice(0, edgeLength).trimEnd(),
    '[...message truncated for token budget...]',
    content.slice(-edgeLength).trimStart(),
  ].join('\n');
}

export function buildCompactChatMessages(
  messages: ChatPayloadMessage[],
  preamble = '',
  limit = DEFAULT_MESSAGE_LIMIT,
): Array<{ role: ChatRole; content: string }> {
  const compact = messages
    .filter((message) => message.id !== 'greet')
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: truncateMessageContent(message.content),
    }));

  if (!preamble || compact.length === 0) return compact;

  let latestUserIndex = -1;
  for (let index = compact.length - 1; index >= 0; index -= 1) {
    if (compact[index].role === 'user') {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return compact;

  return compact.map((message, index) => (
    index === latestUserIndex
      ? { ...message, content: `${preamble}${message.content}` }
      : message
  ));
}

export function buildAthenaDraftRequestBody(input: AthenaDraftRequestInput) {
  return {
    action: 'draftTicket' as const,
    draftOnly: true,
    approved: false,
    aiProvider: input.aiProvider,
    debugTrace: input.debugTrace === true,
    promptProfile: ATHENA_PROMPT_PROFILE,
    messages: buildCompactChatMessages(input.messages, input.preamble),
    conversationId: input.conversationId,
    context: input.context,
    intakeContract: input.intakeContract || {},
    relatedTickets: input.relatedTickets || [],
  };
}
