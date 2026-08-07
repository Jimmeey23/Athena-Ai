# Ticket Review Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a richer ticket pre-publish review experience with routing rationale, confidence indicators, duplicate warnings, and Momence context chips.

**Architecture:** Put deterministic review logic in a pure `src/lib/ticket-review.ts` helper with Vitest coverage, then render the resulting view model in `TicketPreviewCard`. Load Momence context opportunistically from the existing chat context and pass duplicate candidates from the existing duplicate matcher without blocking publish.

**Tech Stack:** Vite, React, TypeScript, Vitest, existing ticket and Momence helpers.

---

### Task 1: Add Review View Model

**Files:**
- Create: `src/lib/ticket-review.ts`
- Create: `src/lib/ticket-review.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests proving `buildTicketReviewInsights()` returns confidence scores, routing rationale, Momence chips, and duplicate warning details.

- [ ] **Step 2: Verify red**

Run: `npm run test -- src/lib/ticket-review.test.ts`

Expected: fail because `src/lib/ticket-review.ts` does not exist.

- [ ] **Step 3: Implement helper**

Implement a pure helper that accepts draft ticket, optional context, optional Momence summary, and optional duplicate ticket. Return:
- confidence scores for classification, priority, routing, SLA, and Momence context
- rationale lines
- Momence chips
- duplicate warning object
- review sections for member voice, routing, SLA, and follow-up

- [ ] **Step 4: Verify green**

Run: `npm run test -- src/lib/ticket-review.test.ts`

Expected: pass.

### Task 2: Wire Review Data Into Chat Drafts

**Files:**
- Modify: `src/components/ticketing/ChatInterface.tsx`
- Modify: `src/components/ticketing/TicketPreviewCard.tsx`

- [ ] **Step 1: Load Momence summary for selected context**

When a draft preview has `memberId` or `sessionId`, load `loadMomenceTicketContext()` in a non-blocking effect and keep failures as a soft warning.

- [ ] **Step 2: Compute duplicate candidate for each draft**

Use `findExistingSubmittedTicket()` against the merged draft/context and pass the candidate into the preview.

- [ ] **Step 3: Render review UI**

Show duplicate warning, confidence strip, routing rationale, Momence chips, and grouped review sections above the publish action. Keep existing edit/publish/discard callbacks unchanged.

### Task 3: Verify

**Files:**
- All changed files.

- [ ] **Step 1:** `npm run test -- src/lib/ticket-review.test.ts`
- [ ] **Step 2:** `npm run test`
- [ ] **Step 3:** `npm run lint`
- [ ] **Step 4:** `npm run build`
