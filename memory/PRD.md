# Athena – AI Ticketing Assistant (Physique 57 India)

## Original Problem Statement
"Why is the AI agent not collecting all the information before generating the ticket draft, see the example attached"

Three conversation exports were provided (1148.txt, 1202.html, 1725.html) — all showing the same scenario ("Instructor arrived late for the barre class") where the agent skipped client-impact confirmation and member details, jumping straight to a minimal draft.

## Architecture
- **Frontend**: React + TypeScript (Vite), hosted on Supabase
- **Backend**: Supabase Edge Functions (Deno/TypeScript)
  - `ticket-ai-chat/index.ts` — main AI intake edge function
  - `_shared/ai-provider.ts` — OpenAI / Claude / DeepSeek provider abstraction
- **AI Models**: GPT-4o-mini (OpenAI), claude-haiku-4-5 (Claude), deepseek-v4-pro (DeepSeek)
- **Database**: Supabase Postgres
- **Key lib files**: `src/lib/intake-rules.ts`, `src/lib/intake-conversation-plan.ts`, `src/components/ticketing/ChatInterface.tsx`

## Root Cause (Fixed – 2026-06-07)

### The Bug
The AI model was returning `clientsAffected: "Not confirmed yet"` inside `inferredContext` (even though the user had never been asked). This value was:
1. **Server-side**: Merged into `aiContext` before calling `requiredFieldsForIssue()`, making the guard treat `clientsAffected` as already answered → removed it from `guardedMissingFields`
2. **Frontend-side**: Picked up by `normalizeInferredContext()` and stored in the `context` state → caused `intakeContract.missingFields` to omit `clientsAffected` on the next turn

The cascade: `clientsAffected` was never asked → `hasConfirmedAffectedClients()` returned false → `memberName` was never required → tickets were drafted without any member/impact data.

## What Was Implemented (2026-06-07)

### Fix 1 – Server guard (`ticket-ai-chat/index.ts`)
Strip `clientsAffected` from `aiResponse.inferredContext` before computing `guardedMissingFields`, unless it was already confirmed by the user in a prior turn (i.e. present in `effectiveBodyContext`).

### Fix 2 – Frontend (`ChatInterface.tsx` – `normalizeInferredContext`)
Removed `assignString('clientsAffected')` from the inferred-context normalizer. `clientsAffected` can now only enter the context state through explicit user form submission.

### Fix 3 – System prompt (`ATHENA_SYSTEM_PROMPT`)
Three additions:
- **PRE-DRAFT CHECKLIST**: 5 conditions that must ALL be true before setting `needsMoreInfo: false` (clientsAffected answered, memberName if yes, studio, incident-specific custom fields, resolutionRequired)
- **CLIENT IMPACT CHECK**: Added CRITICAL instruction to never set `clientsAffected` in `inferredContext`
- **Schema instruction**: Removed `clientsAffected` from the `inferredContext` JSON schema definition and added explicit prohibition in the `askAiForIntake` system content

### Fix 4 – JSON schema
Removed `clientsAffected` from the `inferredContext` schema passed to the AI so the model no longer has a valid slot to put it in.

## Expected Correct Flow (post-fix)
For "Instructor arrived late for the barre class":
1. Ask `clientsAffected` (standalone button select)
2. If "Yes…" → ask `memberName` (Momence member search) + `studio`
3. Ask incident-specific fields: `classType`, delay duration, advance notice, reason, member reaction
4. Ask `resolutionRequired`
5. Generate draft with complete context

## Prioritized Backlog
- P0: ~~clientsAffected bypass bug~~ ✅ FIXED
- P1: Anti-loop regression (seen in 0435 export – "what did the member report in their own words?" repeated 4+ times)
- P1: Ensure AI always collects all 5 incident-specific custom fields for trainer issues before drafting
- P2: Model upgrade consideration (GPT-4o-mini / Claude Haiku may need stronger model for complex intake flows)
- P2: Add integration tests for conversation flow completeness
