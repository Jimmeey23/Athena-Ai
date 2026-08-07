import { describe, expect, it } from 'vitest';
import { htmlForChatTranscript, plainTextForChatTranscript, transcriptFileBaseName } from './chat-export';

describe('chat conversation exports', () => {
  const exportedAt = new Date('2026-06-02T09:30:00.000Z');
  const messages = [
    { role: 'assistant' as const, content: 'Hi Jimmeey, happy to help. What should we log today? 🙂' },
    { role: 'user' as const, content: 'instructor arrived late for class' },
    {
      role: 'assistant' as const,
      content: 'I drafted the ticket below. Please review it before publishing.',
      ticket: {
        title: 'Trainer punctuality issue <Bandra>',
        category: 'Trainer Feedback',
        subCategory: 'Trainer Punctuality Issues',
        priority: 'Low',
        studio: 'Supreme HQ, Bandra',
      },
    },
  ];

  it('creates stable readable plain text transcripts', () => {
    const text = plainTextForChatTranscript(messages, {
      conversationId: 'conversation-1',
      reporterName: 'Jimmeey Gondaa',
      exportedAt,
    });

    expect(text).toContain('Athena Conversation Export');
    expect(text).toContain('Conversation ID: conversation-1');
    expect(text).toContain('[Assistant]');
    expect(text).toContain('[User]');
    expect(text).toContain('Ticket draft: Trainer punctuality issue <Bandra>');
  });

  it('creates standalone escaped HTML transcripts', () => {
    const html = htmlForChatTranscript(messages, {
      conversationId: 'conversation-1',
      reporterName: 'Jimmeey Gondaa',
      exportedAt,
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Athena Conversation Export');
    expect(html).toContain('Trainer punctuality issue &lt;Bandra&gt;');
    expect(html).not.toContain('Trainer punctuality issue <Bandra>');
  });

  it('uses a date-stamped filename base', () => {
    expect(transcriptFileBaseName(exportedAt)).toBe('athena-chat-2026-06-02-0930');
  });
});
