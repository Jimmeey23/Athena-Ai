import { describe, expect, it } from 'vitest';
import { shouldUseOptionButtons } from './intake-option-buttons';

describe('intake option buttons', () => {
  it('uses buttons for compact known single-select fields', () => {
    expect(shouldUseOptionButtons({ id: 'intakeRoute', optionCount: 4 })).toBe(true);
    expect(shouldUseOptionButtons({ id: 'priority', optionCount: 4 })).toBe(true);
    expect(shouldUseOptionButtons({ id: 'clientsAffected', optionCount: 5 })).toBe(true);
    expect(shouldUseOptionButtons({ id: 'classImpactType', optionCount: 8 })).toBe(true);
    expect(shouldUseOptionButtons({ id: 'resolutionRequirement', optionCount: 6 })).toBe(true);
    expect(shouldUseOptionButtons({ id: 'custom_context_select', optionCount: 4 })).toBe(true);
  });

  it('keeps large lists in dropdowns', () => {
    expect(shouldUseOptionButtons({ id: 'studio', optionCount: 12 })).toBe(false);
    expect(shouldUseOptionButtons({ id: 'studio', optionCount: 4 })).toBe(false);
    expect(shouldUseOptionButtons({ id: 'subCategory', optionCount: 18 })).toBe(false);
  });
});
