import { describe, expect, it } from 'vitest';
import {
  shouldAcceptAiDetailForm,
  shouldAcceptInferredSubCategory,
  shouldHoldDraftForMoreInfo,
  shouldReplaceInferredCategory,
} from './intake-response-state';

describe('shouldHoldDraftForMoreInfo', () => {
  it('does not block drafting for an AI-only more-info flag when deterministic requirements are complete', () => {
    expect(shouldHoldDraftForMoreInfo({
      hasDetailForm: false,
      remainingMissingFieldCount: 0,
      aiNeedsMoreInfo: true,
    })).toBe(false);
  });

  it('blocks drafting when there are actionable missing fields', () => {
    expect(shouldHoldDraftForMoreInfo({
      hasDetailForm: false,
      remainingMissingFieldCount: 1,
      aiNeedsMoreInfo: false,
    })).toBe(true);
  });
});

describe('shouldAcceptAiDetailForm', () => {
  it('rejects AI-only follow-up forms after deterministic intake requirements are complete', () => {
    expect(shouldAcceptAiDetailForm({
      remainingMissingFieldCount: 0,
    })).toBe(false);
  });

  it('allows AI forms while deterministic required fields are still missing', () => {
    expect(shouldAcceptAiDetailForm({
      remainingMissingFieldCount: 2,
    })).toBe(true);
  });

  it('accepts the AI contextual follow-up form once the floor is met when the AI asks for more', () => {
    expect(shouldAcceptAiDetailForm({
      remainingMissingFieldCount: 0,
      aiNeedsMoreInfo: true,
      aiProposedFieldCount: 2,
    })).toBe(true);
  });

  it('does not accept an empty AI follow-up form even when the AI flags more info', () => {
    expect(shouldAcceptAiDetailForm({
      remainingMissingFieldCount: 0,
      aiNeedsMoreInfo: true,
      aiProposedFieldCount: 0,
    })).toBe(false);
  });
});

describe('shouldReplaceInferredCategory', () => {
  it('preserves a meaningful existing category during follow-up detail submissions', () => {
    expect(shouldReplaceInferredCategory('Repair and Maintenance', 'App & Digital')).toBe(false);
  });

  it('allows a generic category to be refined by inference', () => {
    expect(shouldReplaceInferredCategory('General Feedback', 'Repair and Maintenance')).toBe(true);
  });
});

describe('shouldAcceptInferredSubCategory', () => {
  it('rejects a subcategory that does not belong to the preserved category', () => {
    expect(shouldAcceptInferredSubCategory(
      'Repair and Maintenance',
      'App Crash',
      ['General Maintenance Delays', 'Door Lock Issues']
    )).toBe(false);
  });

  it('accepts a subcategory that belongs to the current category', () => {
    expect(shouldAcceptInferredSubCategory(
      'Repair and Maintenance',
      'General Maintenance Delays',
      ['General Maintenance Delays', 'Door Lock Issues']
    )).toBe(true);
  });
});
