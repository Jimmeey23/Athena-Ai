---
name: AI model config
description: Model and token settings for all three AI providers in Athena ticketing assistant.
---

File: `supabase/functions/_shared/ai-provider.ts`
- OpenAI default: `gpt-4o-mini`, maxTokens: 3000
- Claude default: `claude-haiku-4-5`, maxTokens: 3000
- DeepSeek default: `deepseek-v4-pro`, maxTokens: 3000

**Why:** User requested gpt-4o-mini as the active Athena model. 3000 tokens is conservative but sufficient for ticket intake JSON responses.
**How to apply:** All three providers stay in sync. Override per-provider via env vars (OPENAI_MODEL, ANTHROPIC_MODEL, DEEPSEEK_MODEL, *_MAX_TOKENS).
