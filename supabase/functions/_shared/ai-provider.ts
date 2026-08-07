export type AiProvider = 'deepseek' | 'openai' | 'claude';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
}

export interface JsonAiRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

type EnvReader = (name: string) => string | undefined;

const PROVIDERS = new Set<AiProvider>(['deepseek', 'openai', 'claude']);

function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeAiProvider(value?: string | null, fallback: AiProvider = 'openai'): AiProvider {
  const normalized = clean(value || undefined).toLowerCase();
  return PROVIDERS.has(normalized as AiProvider) ? normalized as AiProvider : fallback;
}

export function resolveAiProviderConfig(env: EnvReader, requestedProvider?: string | null): AiProviderConfig | null {
  const provider = normalizeAiProvider(requestedProvider || env('AI_PROVIDER') || env('LLM_PROVIDER'));

  if (provider === 'openai') {
    const apiKey = clean(env('OPENAI_API_KEY'));
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      model: clean(env('OPENAI_MODEL')) || 'gpt-5.4-mini',
      baseUrl: trimTrailingSlash(clean(env('OPENAI_BASE_URL')) || 'https://api.openai.com/v1'),
      maxTokens: Number(clean(env('OPENAI_MAX_TOKENS'))) || 3000,
    };
  }

  if (provider === 'claude') {
    const apiKey = clean(env('ANTHROPIC_API_KEY') || env('CLAUDE_API_KEY'));
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      model: clean(env('ANTHROPIC_MODEL') || env('CLAUDE_MODEL')) || 'claude-haiku-4-5',
      baseUrl: trimTrailingSlash(clean(env('ANTHROPIC_BASE_URL') || env('CLAUDE_BASE_URL')) || 'https://api.anthropic.com/v1'),
      maxTokens: Number(clean(env('ANTHROPIC_MAX_TOKENS') || env('CLAUDE_MAX_TOKENS'))) || 3000,
    };
  }

  const apiKey = clean(env('DEEPSEEK_API_KEY'));
  if (!apiKey) return null;
  return {
    provider: 'deepseek',
    apiKey,
    model: clean(env('DEEPSEEK_MODEL')) || 'deepseek-v4-pro',
    baseUrl: trimTrailingSlash(clean(env('DEEPSEEK_BASE_URL')) || 'https://api.deepseek.com'),
    maxTokens: Number(clean(env('DEEPSEEK_MAX_TOKENS'))) || 3000,
  };
}

export function buildJsonAiRequest(
  config: AiProviderConfig,
  systemContent: string,
  userContent: string,
  temperature: number,
): JsonAiRequest {
  if (config.provider === 'claude') {
    return {
      url: `${config.baseUrl}/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: config.model,
        max_tokens: config.maxTokens,
        temperature,
        system: systemContent,
        messages: [{ role: 'user', content: userContent }],
      },
    };
  }

  return {
    url: `${config.baseUrl}/chat/completions`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: config.model,
      response_format: { type: 'json_object' },
      temperature,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
    },
  };
}

export function extractJsonAiText(provider: AiProvider, data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const value = data as Record<string, unknown>;

  if (provider === 'claude') {
    const content = Array.isArray(value.content) ? value.content : [];
    const textBlock = content.find((item) => (
      item &&
      typeof item === 'object' &&
      (item as Record<string, unknown>).type === 'text' &&
      typeof (item as Record<string, unknown>).text === 'string'
    )) as Record<string, unknown> | undefined;
    return typeof textBlock?.text === 'string' ? textBlock.text.trim() : '';
  }

  const choices = Array.isArray(value.choices) ? value.choices : [];
  const first = choices[0];
  if (!first || typeof first !== 'object') return '';
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') return '';
  const content = (message as Record<string, unknown>).content;
  return typeof content === 'string' ? content.trim() : '';
}

export async function callJsonAi(
  env: EnvReader,
  fetcher: typeof fetch,
  input: {
    provider?: string | null;
    systemContent: string;
    userContent: string;
    temperature?: number;
  },
): Promise<{ content: string; provider: AiProvider; model: string } | null> {
  const config = resolveAiProviderConfig(env, input.provider);
  if (!config) return null;

  const request = buildJsonAiRequest(
    config,
    input.systemContent,
    input.userContent,
    input.temperature ?? 0.2,
  );
  const response = await fetcher(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    console.error(`${config.provider} AI request failed`, response.status, await response.text());
    return null;
  }

  const data = await response.json();
  return {
    content: extractJsonAiText(config.provider, data),
    provider: config.provider,
    model: config.model,
  };
}
