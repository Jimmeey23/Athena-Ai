import { describe, expect, it } from 'vitest';
import {
  buildJsonAiRequest,
  extractJsonAiText,
  resolveAiProviderConfig,
} from './ai-provider';

const env = (values: Record<string, string>) => (name: string) => values[name];

describe('AI provider selection', () => {
  it('defaults to OpenAI gpt-5.4-mini when no provider is requested', () => {
    const config = resolveAiProviderConfig(env({ OPENAI_API_KEY: 'openai-key' }));

    expect(config).toMatchObject({
      provider: 'openai',
      apiKey: 'openai-key',
      model: 'gpt-5.4-mini',
      baseUrl: 'https://api.openai.com/v1',
    });
  });

  it('supports OpenAI-compatible request bodies for DeepSeek and OpenAI', () => {
    const config = resolveAiProviderConfig(env({ OPENAI_API_KEY: 'openai-key' }), 'openai');
    expect(config).not.toBeNull();

    const request = buildJsonAiRequest(config!, 'system prompt', 'user prompt', 0.2);

    expect(request.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer openai-key');
    expect(request.body).toMatchObject({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
  });

  it('supports Claude messages requests', () => {
    const config = resolveAiProviderConfig(env({ ANTHROPIC_API_KEY: 'claude-key' }), 'claude');
    expect(config).not.toBeNull();

    const request = buildJsonAiRequest(config!, 'system prompt', 'user prompt', 0.1);

    expect(request.url).toBe('https://api.anthropic.com/v1/messages');
    expect(request.headers['x-api-key']).toBe('claude-key');
    expect(request.body).toMatchObject({
      model: 'claude-haiku-4-5',
      system: 'system prompt',
      temperature: 0.1,
    });
  });

  it('extracts text from OpenAI-compatible and Claude responses', () => {
    expect(extractJsonAiText('deepseek', { choices: [{ message: { content: '{"ok":true}' } }] })).toBe('{"ok":true}');
    expect(extractJsonAiText('claude', { content: [{ type: 'text', text: '{"ok":true}' }] })).toBe('{"ok":true}');
  });
});
