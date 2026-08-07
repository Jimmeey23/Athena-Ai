import { describe, expect, it } from 'vitest';
import { buildTrainerFallbackSummary } from './trainer-summary';

describe('trainer summary fallback', () => {
  it('generates a useful coaching summary without an AI provider response', () => {
    const summary = buildTrainerFallbackSummary({
      trainerName: 'Pranjali Jain',
      averageScore: 86,
      reviewCount: 3,
      topStrengths: ['Energy and vocals', 'Musicality'],
      attentionAreas: ['Hands-on corrections'],
      trend: 'improving',
      classTypes: ['Studio Barre 57'],
      studios: ['Kwality House, Kemps Corner'],
    });

    expect(summary).toContain('Pranjali Jain');
    expect(summary).toContain('86%');
    expect(summary).toContain('3 assessments');
    expect(summary).toContain('Energy and vocals');
    expect(summary).toContain('Hands-on corrections');
    expect(summary).toContain('improving');
  });
});
