# OpenAI AI Configuration

Athena AI now uses OpenAI directly for AI-backed features.

## Model

The ticket intake edge function and trainer profile summary function use:

```bash
gpt-5.4-mini
```

## Required Supabase Secret

Set `OPENAI_API_KEY` on the Supabase project that hosts the edge functions:

```bash
supabase secrets set OPENAI_API_KEY=... --project-ref nujgmxqefoumhhreqzxm
```

`GATEWAY_API_KEY`, FastRouter, DeepSeek, Claude, and browser-side provider switching are not required for Athena AI.

## Deployment

Deploy the updated functions after setting the secret:

```bash
supabase functions deploy ticket-ai-chat --project-ref nujgmxqefoumhhreqzxm
supabase functions deploy trainer-profile-summary --project-ref nujgmxqefoumhhreqzxm
```
