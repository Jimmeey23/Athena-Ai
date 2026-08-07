interface MoreInfoState {
  hasDetailForm: boolean;
  remainingMissingFieldCount: number;
  aiNeedsMoreInfo?: boolean;
}

interface AiDetailFormState {
  remainingMissingFieldCount: number;
  aiNeedsMoreInfo?: boolean;
  aiProposedFieldCount?: number;
}

const GENERIC_CATEGORIES = new Set(['', 'General Feedback', 'Miscellaneous']);

export function shouldHoldDraftForMoreInfo(state: MoreInfoState): boolean {
  return state.hasDetailForm || state.remainingMissingFieldCount > 0;
}

// AI drives, guard is a floor. Always accept the AI's form while deterministic gates are unmet,
// AND accept the AI's own contextual follow-up questions once the floor is satisfied — as long
// as the AI is genuinely asking for more (already-answered fields are pruned downstream, so this
// cannot loop). This lets the AI ask the incident-specific gaps the regex guard never models.
export function shouldAcceptAiDetailForm(state: AiDetailFormState): boolean {
  if (state.remainingMissingFieldCount > 0) return true;
  return Boolean(state.aiNeedsMoreInfo) && (state.aiProposedFieldCount ?? 0) > 0;
}

export function shouldReplaceInferredCategory(currentCategory?: string, inferredCategory?: string): boolean {
  if (!inferredCategory || inferredCategory === currentCategory) return false;
  return GENERIC_CATEGORIES.has(currentCategory || '');
}

export function shouldAcceptInferredSubCategory(
  currentCategory: string | undefined,
  inferredSubCategory: string | undefined,
  validSubCategories: string[] | undefined
): boolean {
  if (!inferredSubCategory || !currentCategory || !validSubCategories) return true;
  return validSubCategories.includes(inferredSubCategory);
}
