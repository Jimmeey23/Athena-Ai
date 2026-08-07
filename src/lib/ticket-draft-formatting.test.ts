import { describe, expect, it } from 'vitest';
import {
  buildOperationalTicketDescription,
  draftDescriptionNeedsRewrite,
  normalizeDraftContextForSource,
  summarizeOperationalReport,
} from './ticket-draft-formatting';

const lateInstructorEmail = [
  'Hi All,',
  '',
  'This is to inform you that the instructor, Siddhartha, arrived at the Kenkere studio at 7:02 AM for the 7:15 AM class because he woke up late.',
  '',
  'Best,',
  '',
  'Team Physique 57',
].join('\n');

describe('ticket draft formatting', () => {
  it('summarizes internal email-style input instead of pasting it verbatim', () => {
    expect(summarizeOperationalReport(lateInstructorEmail)).toBe(
      'Instructor Siddhartha arrived at the Kenkere studio at 7:02 AM for the 7:15 AM class because he woke up late.'
    );
  });

  it('normalizes stale multi-value context using explicit details from the source text', () => {
    expect(normalizeDraftContextForSource({
      studio: 'Kwality House, Kemps Corner | Supreme HQ, Bandra',
      trainer: 'Simran Dutt | Reshma Sharma',
      classType: 'Studio Mat 57 | Studio PowerCycle',
      clientsAffected: 'No clients affected',
    }, lateInstructorEmail)).toMatchObject({
      studio: 'Kenkere House, Bengaluru',
      trainer: 'Siddhartha Kusuma',
      classType: undefined,
      clientsAffected: 'No clients affected',
    });
  });

  it('formats internal reports as actionable summaries, not member feedback', () => {
    const context = normalizeDraftContextForSource({
      intakeRoute: 'Internal Reporting',
      category: 'Trainer Feedback',
      subCategory: 'Trainer Punctuality Issues',
      studio: 'Kwality House, Kemps Corner | Supreme HQ, Bandra',
      trainer: 'Simran Dutt | Reshma Sharma',
      classType: 'Studio Mat 57 | Studio PowerCycle',
      clientsAffected: 'No clients affected',
    }, lateInstructorEmail);

    const description = buildOperationalTicketDescription({
      sourceText: lateInstructorEmail,
      context,
      category: 'Trainer Feedback',
      subCategory: 'Trainer Punctuality Issues',
    });

    expect(description).toContain('Internal report summary: Instructor Siddhartha arrived');
    expect(description).toContain('- Studio: Kenkere House, Bengaluru');
    expect(description).toContain('- Instructor: Siddhartha Kusuma');
    expect(description).not.toContain('Hi All');
    expect(description).not.toContain('Best,');
    expect(description).not.toContain('Member feedback summary');
    expect(description).not.toContain('Kwality House, Kemps Corner | Supreme HQ, Bandra');
    expect(description).not.toContain('Studio Mat 57 | Studio PowerCycle');
    expect(description).not.toContain('Next step:');
    expect(description).not.toContain('Athena review note');
  });

  it('flags raw email and member-feedback labels for rewrite on internal reports', () => {
    expect(draftDescriptionNeedsRewrite(`Member feedback summary: ${lateInstructorEmail}`, 'Internal Reporting')).toBe(true);
    expect(draftDescriptionNeedsRewrite(`Summary: ${lateInstructorEmail}`, 'Internal Reporting', lateInstructorEmail)).toBe(true);
    expect(draftDescriptionNeedsRewrite('Internal report summary: Instructor was late.', 'Internal Reporting')).toBe(false);
    expect(draftDescriptionNeedsRewrite('Issue summary: Next step: Assigned owner to review and confirm the follow-up action.')).toBe(true);
  });
});
