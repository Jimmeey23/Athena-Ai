---
name: ChatInterface smart features
description: Smart UX features added to the chat input area and message list.
---

Features added in `src/components/ticketing/ChatInterface.tsx`:
1. **isUrgentInput** — useMemo that detects high-urgency keywords in the input, shows an orange warning banner above the textarea
2. **capturedContextSummary** — useMemo that builds a compact summary of captured context fields (studio, category, member, priority) shown as pills above the textarea
3. **Quick-start prompts** — shown below greeting when messages.length === 1 (fresh chat) as clickable example prompts
4. **Quick answers chips** — visibleChips (select field options) now render as a larger "Quick answers" grid with "tap to select" label instead of small pills
5. **Voice hints** — buildVoiceExtractionHints improved to only show on strong signals, no longer shows the always-on Momence hint

**Why:** User requested more AI smart features and better field question display.
**How to apply:** All features are purely client-side (no API calls) — computed from input/context state.
