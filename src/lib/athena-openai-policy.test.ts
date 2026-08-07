import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Athena OpenAI policy', () => {
  const edgeSource = readFileSync(resolve(process.cwd(), 'supabase/functions/ticket-ai-chat/index.ts'), 'utf8');
  const sharedProviderSource = readFileSync(resolve(process.cwd(), 'supabase/functions/_shared/ai-provider.ts'), 'utf8');
  const trainerSummarySource = readFileSync(resolve(process.cwd(), 'supabase/functions/trainer-profile-summary/index.ts'), 'utf8');

  it('does not depend on FastRouter gateway credentials', () => {
    expect(edgeSource).not.toContain('GATEWAY_API_KEY');
    expect(edgeSource).not.toContain('ai.gateway.fastrouter.io');
  });

  it('uses gpt-5.4-mini for Athena AI features', () => {
    expect(edgeSource).toContain("const OPENAI_MODEL = 'gpt-5.4-mini'");
    expect(sharedProviderSource).toContain("'gpt-5.4-mini'");
    expect(trainerSummarySource).toContain("model: 'gpt-5.4-mini'");
    expect(trainerSummarySource).not.toContain('gpt-4o-mini');
  });

  it('uses the gpt-5 compatible completion token parameter', () => {
    expect(edgeSource).toContain('max_completion_tokens: 6000');
    expect(edgeSource).not.toContain('max_tokens: 6000');
    expect(trainerSummarySource).toContain('max_completion_tokens: 300');
    expect(trainerSummarySource).not.toContain('max_tokens: 300');
  });
});
