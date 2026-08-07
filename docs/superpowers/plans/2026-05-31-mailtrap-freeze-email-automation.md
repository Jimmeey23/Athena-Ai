# Mailtrap Freeze Email Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mailtrap-signed inbound email webhook that automatically applies eligible membership freeze requests in Momence and records the result as a closed Athena ticket.

**Architecture:** Put signature verification and email parsing in a pure shared module with Vitest coverage. Add a Supabase Edge Function that verifies Mailtrap, normalizes inbound email payloads, extracts freeze dates/member intent, looks up the member and active memberships in Momence, applies the freeze via Momence, sends a confirmation email through the existing Mailtrap SMTP pattern, and inserts a Closed ticket plus ticket event for audit.

**Tech Stack:** Supabase Edge Functions/Deno, TypeScript, Vitest, Momence API, Mailtrap webhook signatures and SMTP.

---

### Task 1: Shared Parser and Signature Helpers

**Files:**
- Create: `supabase/functions/_shared/membership-freeze-email-automation.ts`
- Create: `src/lib/membership-freeze-email-automation.test.ts`

- [ ] Add tests for Mailtrap HMAC-SHA256 verification using raw body bytes.
- [ ] Add tests that normalize common inbound payload shapes into sender email, subject, text, and message id.
- [ ] Add tests that extract scheduled freeze windows from plain text.
- [ ] Implement only the pure helpers needed by those tests.

### Task 2: Edge Function

**Files:**
- Create: `supabase/functions/membership-freeze-email-automation/index.ts`

- [ ] Read `request.text()` before JSON parsing.
- [ ] Verify `Mailtrap-Signature` using `MAILTRAP_WEBHOOK_SIGNING_SECRET`.
- [ ] Reject missing/invalid signatures with 401.
- [ ] Normalize inbound email and reject non-freeze or incomplete requests with a closed/failed audit ticket only when sender email is known.
- [ ] Use Momence password/client credentials from existing `MOMENCE_*` secrets.
- [ ] Search member by sender email, load active memberships with `includeFrozen=true`, choose the only active eligible membership or exact name match from the email.
- [ ] Apply scheduled freeze using `/host/members/{memberId}/bought-memberships/{id}/membership-freeze`.
- [ ] Send confirmation via Mailtrap SMTP using existing SMTP env names.
- [ ] Insert a `Closed` ticket with `latestResolution` metadata and a `ticket_events` automation event.

### Task 3: Verification

**Files:**
- Test: `src/lib/membership-freeze-email-automation.test.ts`
- Build: project build

- [ ] Run `npm test -- src/lib/membership-freeze-email-automation.test.ts --run`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
