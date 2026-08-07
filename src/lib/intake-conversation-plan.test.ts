import { describe, expect, it } from 'vitest';
import {
  buildIntakeConversationPlan,
  buildNaturalSingleFieldPrompt,
  limitConversationalFieldBatch,
  serializeConversationPlan,
} from './intake-conversation-plan';

describe('intake conversation planning', () => {
  it('personalizes the plan with the reporter first name', () => {
    const plan = buildIntakeConversationPlan({
      initialText: 'Member said the 6:30 Barre class was affected because the AC stopped cooling.',
      reporterName: 'Priya Shah',
      context: {
        clientsAffected: 'Yes - directly affected',
      },
    });

    expect(plan.reporterFirstName).toBe('Priya');
    expect(plan.openingTone).toContain('Priya');
  });

  it('plans member and class follow-ups when clients and sessions were affected', () => {
    const plan = buildIntakeConversationPlan({
      initialText: 'AC stopped cooling and classes were affected during the evening schedule.',
      reporterName: 'Ayesha Patel',
      context: {
        clientsAffected: 'Yes - directly and indirectly affected',
      },
    });

    expect(plan.followUpFieldIds).toEqual(expect.arrayContaining([
      'memberName',
      'classType',
      'classImpactType',
      'classImpactDetails',
    ]));
    expect(serializeConversationPlan(plan)).toContain('Identify affected member');
    expect(serializeConversationPlan(plan)).toContain('Identify affected class/session');
    expect(serializeConversationPlan(plan)).toContain('Capture how the class/session was affected');
  });

  it('includes the client-impact check even for operational reports', () => {
    const plan = buildIntakeConversationPlan({
      initialText: 'Door lock not closing at Kwality.',
      reporterName: 'Priya Shah',
    });

    expect(plan.followUpFieldIds).toContain('clientsAffected');
    expect(serializeConversationPlan(plan)).toContain('Confirm whether any members were directly or indirectly affected');
  });

  it('captures trainer punctuality slot groups when late arrival is reported', () => {
    const plan = buildIntakeConversationPlan({
      initialText: 'Trainer arrived late and the 7:15 class started behind schedule.',
      reporterName: 'Priya Shah',
      context: {
        category: 'Trainer Feedback',
        subCategory: 'Trainer Punctuality Issues',
      },
    });

    expect(plan.followUpFieldIds).toEqual(expect.arrayContaining([
      'sessionId',
      'classType',
      'trainer',
      'classDateTime',
      'delayMinutes',
      'advanceNoticeGiven',
      'advanceNoticeTime',
      'latenessReason',
      'membersAffected',
      'serviceRecoveryNeeded',
      'serviceRecoveryAction',
    ]));
    const serialized = serializeConversationPlan(plan);
    expect(serialized).toContain('Identify the affected Momence session');
    expect(serialized).toContain('Capture trainer punctuality details');
    expect(serialized.indexOf('Identify the affected Momence session')).toBeLessThan(serialized.indexOf('Capture trainer punctuality details'));
  });
});

describe('conversational field batching', () => {
  it('asks client impact by itself when it is still unanswered', () => {
    expect(limitConversationalFieldBatch([
      { id: 'studio', label: 'Studio', type: 'select' },
      { id: 'clientsAffected', label: 'Were any clients affected?', type: 'select' },
      { id: 'incidentDateTime', label: 'When?', type: 'datetime-local' },
    ])).toEqual([
      { id: 'clientsAffected', label: 'Were any clients affected?', type: 'select' },
    ]);
  });

  it('keeps later turns to one field at a time', () => {
    expect(limitConversationalFieldBatch([
      { id: 'studio', label: 'Studio', type: 'select' },
      { id: 'incidentDateTime', label: 'When?', type: 'datetime-local' },
      { id: 'priority', label: 'Priority', type: 'select' },
    ])).toEqual([
      { id: 'studio', label: 'Studio', type: 'select' },
    ]);
  });

  it('holds the resolution-required question until it is the only remaining field', () => {
    expect(limitConversationalFieldBatch([
      { id: 'description', label: 'Describe the issue', type: 'textarea' },
      { id: 'resolutionRequired', label: 'Does this ticket require a resolution?', type: 'select' },
    ])).toEqual([
      { id: 'description', label: 'Describe the issue', type: 'textarea' },
    ]);

    expect(limitConversationalFieldBatch([
      { id: 'resolutionRequired', label: 'Does this ticket require a resolution?', type: 'select' },
    ])).toEqual([
      { id: 'resolutionRequired', label: 'Does this ticket require a resolution?', type: 'select' },
    ]);
  });
});

describe('natural single-field prompts', () => {
  it('turns compact select questions into chat copy instead of form copy', () => {
    expect(
      buildNaturalSingleFieldPrompt({
        field: {
          id: 'clientsAffected',
          label: 'Were any clients affected?',
          type: 'select',
          options: ['Yes - directly affected', 'No clients affected'],
        },
        reporterFirstName: 'Priya',
      })
    ).toBe('Priya, were any clients affected?');
  });

  it('asks for affected class details in context when a session was impacted', () => {
    expect(
      buildNaturalSingleFieldPrompt({
        field: {
          id: 'classImpactDetails',
          label: 'How was the class/session affected?',
          type: 'textarea',
        },
        reporterFirstName: 'Priya',
      })
    ).toContain('what changed for the affected class/session');
  });

  it('asks the resolution-required gate with the exact required copy', () => {
    expect(
      buildNaturalSingleFieldPrompt({
        field: {
          id: 'resolutionRequired',
          label: 'Does this ticket require a resolution?',
          type: 'select',
          options: ['Yes', 'No'],
        },
      })
    ).toBe('Does this ticket require a resolution?');
  });

  it('asks trainer punctuality follow-ups as slot-focused prompts', () => {
    expect(
      buildNaturalSingleFieldPrompt({
        field: {
          id: 'sessionId',
          label: 'Momence session',
          type: 'select',
          options: ['Session 1'],
        },
        reporterFirstName: 'Priya',
      })
    ).toContain('which exact Momence session should this late-arrival report be attached to');
    expect(
      buildNaturalSingleFieldPrompt({
        field: {
          id: 'advanceNoticeGiven',
          label: 'Was the late arrival pre-informed by the instructor?',
          type: 'select',
          options: ['Yes - before scheduled start', 'No advance notice'],
        },
        reporterFirstName: 'Priya',
      })
    ).toContain('did the instructor inform the studio in advance');
    expect(
      buildNaturalSingleFieldPrompt({
        field: {
          id: 'serviceRecoveryAction',
          label: 'Service recovery action',
          type: 'textarea',
        },
      })
    ).toContain('what service recovery was offered or taken');
  });
});
