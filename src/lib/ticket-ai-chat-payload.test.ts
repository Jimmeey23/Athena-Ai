import { describe, expect, it } from 'vitest';
import {
  ATHENA_PROMPT_PROFILE,
  buildAthenaDraftRequestBody,
  buildCompactChatMessages,
} from './ticket-ai-chat-payload';

describe('ticket AI chat payload', () => {
  it('adds the context preamble only to the latest user message', () => {
    const messages = [
      { id: 'greet', role: 'assistant' as const, content: 'Greeting' },
      { id: 'u-1', role: 'user' as const, content: 'Door is broken' },
      { id: 'a-1', role: 'assistant' as const, content: 'Need details' },
      { id: 'u-2', role: 'user' as const, content: 'At Bandra' },
    ];

    const compact = buildCompactChatMessages(messages, '[Context - Studio: Bandra]\n');

    expect(compact).toEqual([
      { role: 'user', content: 'Door is broken' },
      { role: 'assistant', content: 'Need details' },
      { role: 'user', content: '[Context - Studio: Bandra]\nAt Bandra' },
    ]);
  });

  it('builds a compact server-owned prompt request without prompt text or master data', () => {
    const body = buildAthenaDraftRequestBody({
      aiProvider: 'openai',
      conversationId: 'conversation-1',
      debugTrace: true,
      context: { studio: 'Supreme HQ, Bandra' },
      intakeContract: { missingFields: ['clientsAffected'] },
      messages: [{ id: 'u-1', role: 'user', content: 'AC is not cooling' }],
      preamble: '[Context - Studio: Bandra]\n',
    });

    expect(body).toMatchObject({
      action: 'draftTicket',
      draftOnly: true,
      approved: false,
      aiProvider: 'openai',
      debugTrace: true,
      promptProfile: ATHENA_PROMPT_PROFILE,
      conversationId: 'conversation-1',
      context: { studio: 'Supreme HQ, Bandra' },
      intakeContract: { missingFields: ['clientsAffected'] },
      messages: [
        { role: 'user', content: '[Context - Studio: Bandra]\nAC is not cooling' },
      ],
    });
    expect(body).not.toHaveProperty('instructions');
    expect(body).not.toHaveProperty('masterData');
  });
});
