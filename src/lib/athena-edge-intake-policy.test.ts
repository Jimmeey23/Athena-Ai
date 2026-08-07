import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Athena edge intake policy', () => {
  const source = readFileSync(resolve(process.cwd(), 'supabase/functions/ticket-ai-chat/index.ts'), 'utf8');

  it('does not force a fixed commercial verification bundle before AI drafting', () => {
    expect(source).not.toContain('the owner usually needs: studio, selected Momence member, active package/membership, relevant Momence purchase/payment context');
    expect(source).not.toMatch(/if \(commercialVerification\)[\s\S]*momencePurchaseContext/);
  });

  it('uses OpenAI gpt-5.4-mini directly without the FastRouter gateway key', () => {
    expect(source).not.toContain('GATEWAY_API_KEY');
    expect(source).not.toContain('ai.gateway.fastrouter.io');
    expect(source).toContain("Deno.env.get('OPENAI_API_KEY')");
    expect(source).toContain("const OPENAI_MODEL = 'gpt-5.4-mini'");
    expect(source).toContain('https://api.openai.com/v1/chat/completions');
  });
});
