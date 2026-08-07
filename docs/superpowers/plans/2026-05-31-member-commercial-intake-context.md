# Member Commercial Intake Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Athena from drafting superficial tickets for member/package/payment/class-access incidents before studio, Momence member, membership, session, and resolution context are collected.

**Architecture:** Keep the AI dynamic by enhancing the system prompt with contextual completeness rules while adding deterministic required-field guards for the issue family. The guard requires existing canonical fields only when the report involves a member-facing commercial/class-access dispute, so the response remains issue-driven instead of hardcoded.

**Tech Stack:** Vite React, TypeScript, Vitest, Supabase Edge Functions/Deno TypeScript.

---

### Task 1: Add Regression Coverage

**Files:**
- Modify: `src/lib/intake-rules.test.ts`
- Test: `src/lib/intake-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('requires commercial Momence context for member package and class access disputes', () => {
  const fields = getMissingIntakeFields({
    intakeRoute: 'Complaint',
    category: 'Pricing and Memberships',
    subCategory: 'Refund and Cancellation Policy Issue',
    description: 'Client Shaziya Andhyrujina on a 3-month unlimited package was denied first Power Cycle entry and requested a refund.',
    priority: 'High',
    reportedBy: 'Front Desk',
  });

  expect(fields).toEqual(expect.arrayContaining([
    'studio',
    'memberName',
    'membership',
    'classType',
    'incidentDateTime',
    'desiredResolution',
    'memberSentiment',
  ]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/intake-rules.test.ts --run`

Expected: FAIL because at least `studio`, `membership`, `classType`, `incidentDateTime`, or `memberSentiment` is missing.

### Task 2: Implement Deterministic Required Fields

**Files:**
- Modify: `src/lib/intake-rules.ts`
- Modify: `supabase/functions/ticket-ai-chat/index.ts`
- Test: `src/lib/intake-rules.test.ts`

- [ ] **Step 1: Add a member-commercial incident detector**

Add a local boolean near the existing `membershipSpecific` logic that detects member-facing membership, payment, refund, package, policy, class access, or eligibility disputes.

- [ ] **Step 2: Require existing canonical fields**

When the detector is true, require `studio`, `memberName`, `membership`, `classType`, `incidentDateTime`, `desiredResolution`, and `memberSentiment` if those values are missing.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- src/lib/intake-rules.test.ts --run`

Expected: PASS.

### Task 3: Enhance Athena Prompt

**Files:**
- Modify: `supabase/functions/ticket-ai-chat/index.ts`
- Test: `supabase/functions/_shared/ai-provider.test.ts` if provider behavior is touched; otherwise no provider test needed.

- [ ] **Step 1: Add dynamic completeness instruction**

Update `ATHENA_SYSTEM_PROMPT` to state that member/package/payment/refund/class-access incidents must collect the operational verification context from Momence where possible: studio, selected member, active package, purchase/payment details available in context, relevant class/session, policy communication, resolution offered, member sentiment, and requested outcome.

- [ ] **Step 2: Keep prompt non-hardcoded**

Ensure the prompt says to reason by issue family and missing context, not by specific names, studios, or canned responses.

### Task 4: Verify

**Files:**
- Test: `src/lib/intake-rules.test.ts`
- Test: `supabase/functions/_shared/ai-provider.test.ts` only if needed

- [ ] **Step 1: Run targeted test**

Run: `npm test -- src/lib/intake-rules.test.ts --run`

Expected: PASS.

- [ ] **Step 2: Run changed-area tests if quick**

Run: `npm test -- --run`

Expected: PASS, unless unrelated pre-existing failures are present.
