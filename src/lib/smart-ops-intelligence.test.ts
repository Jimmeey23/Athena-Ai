import { describe, expect, it } from 'vitest';
import {
  buildDuplicatePatternInsights,
  buildIntakeCopilotState,
  buildNaturalLanguageAnalyticsAnswer,
  buildRecommendedResolutionSteps,
  optimizeIntakePromptForAthena,
  buildResolutionAssistant,
  buildSmartOpsBriefing,
  buildSmartTicketIntelligence,
  buildVoiceExtractionHints,
} from './smart-ops-intelligence';
import { Ticket } from './ticketing-data';

const baseTicket: Ticket = {
  id: 'P57-100',
  title: 'Member refund complaint',
  description: 'Member reported frustration after a billing issue.',
  category: 'Billing & Membership',
  subCategory: 'Refund Request',
  priority: 'High',
  status: 'New',
  studio: 'Supreme HQ, Bandra',
  assignedTo: 'Client Success',
  team: 'Sales & Client Servicing',
  tags: ['ai-approved'],
  createdAt: '2026-06-06T08:00:00.000Z',
  slaDueAt: '2026-06-06T10:00:00.000Z',
  sentiment: 'Negative',
  memberName: 'Asha Mehta',
  classType: 'Barre 57',
};

function ticket(overrides: Partial<Ticket>): Ticket {
  return { ...baseTicket, ...overrides };
}

describe('smart ops intelligence', () => {
  it('scores draft risk, explains urgency, and suggests playbook actions', () => {
    const intelligence = buildSmartTicketIntelligence({
      draft: baseTicket,
      similarTickets: [
        ticket({ id: 'P57-090', title: 'Earlier refund issue', createdAt: '2026-06-05T08:00:00.000Z' }),
      ],
    });

    expect(intelligence.riskScore).toBeGreaterThanOrEqual(80);
    expect(intelligence.riskLevel).toBe('High');
    expect(intelligence.urgencyExplanation).toContain('High priority');
    expect(intelligence.playbook.title).toBe('Retention recovery');
    expect(intelligence.nextBestQuestions).toContain('What outcome did the member request?');
    expect(intelligence.quickActions.map((action) => action.label)).toContain('Suggest reply');
  });

  it('builds an ops briefing with top risks, patterns, studio hotspots, and owner warnings', () => {
    const briefing = buildSmartOpsBriefing([
      baseTicket,
      ticket({ id: 'P57-101', category: 'Facilities', subCategory: 'AC Temperature', studio: 'Supreme HQ, Bandra', title: 'AC too warm', description: 'Member reported hot studio.', priority: 'Medium' }),
      ticket({ id: 'P57-102', category: 'Facilities', subCategory: 'AC Temperature', studio: 'Supreme HQ, Bandra', title: 'AC issue repeated', description: 'Another member reported AC issue.', priority: 'High', assignedTo: 'Operations' }),
      ticket({ id: 'P57-103', category: 'Trainer Feedback', subCategory: 'Music', studio: 'Kwality House, Kemps Corner', title: 'Music concern', description: 'Member disliked playlist.', priority: 'Low', assignedTo: 'Client Success' }),
    ]);

    expect(briefing.topRisks[0].ticketId).toBe('P57-100');
    expect(briefing.repeatedPatterns[0]).toContain('Facilities / AC Temperature');
    expect(briefing.studioHotspots[0]).toContain('Supreme HQ, Bandra');
    expect(briefing.ownerWarnings.length).toBeGreaterThan(0);
    expect(briefing.nextActions[0]).toMatch(/Follow up|Review|Resolve/);
  });

  it('answers natural-language analytics questions from local ticket data', () => {
    const answer = buildNaturalLanguageAnalyticsAnswer('What are Bandra top complaints this month?', [
      baseTicket,
      ticket({ id: 'P57-104', category: 'Facilities', subCategory: 'AC Temperature', studio: 'Supreme HQ, Bandra', title: 'AC issue', description: 'Warm room.', priority: 'Medium' }),
      ticket({ id: 'P57-105', category: 'Facilities', subCategory: 'AC Temperature', studio: 'Kwality House, Kemps Corner', title: 'Other studio AC', description: 'Warm room.', priority: 'Medium' }),
    ]);

    expect(answer.title).toContain('Supreme HQ, Bandra');
    expect(answer.lines[0]).toContain('Billing & Membership / Refund Request');
    expect(answer.sourceTicketIds).toEqual(['P57-100', 'P57-104']);
  });

  it('extracts voice hints without creating static member or session values', () => {
    const hints = buildVoiceExtractionHints('Asha said she was angry about the Bandra barre class refund yesterday');

    expect(hints).toContain('📍 Supreme HQ, Bandra');
    expect(hints).toContain('⚡ High priority signal detected');
    expect(hints).toContain('🏋️ Session context detected');
  });

  it('builds an intake copilot state that asks for Momence-linked context first', () => {
    const copilot = buildIntakeCopilotState({
      context: {
        category: 'Trainer Feedback',
        subCategory: 'Class Feedback',
        description: 'Member said the barre session felt rushed.',
      },
      currentText: 'member mentioned the instructor and class',
      pendingFieldLabel: 'Member feedback',
    });

    expect(copilot.completionScore).toBeLessThan(70);
    expect(copilot.nextQuestion).not.toContain('Which Momence member');
    expect(copilot.nextQuestion).toContain('live Momence context');
    expect(copilot.missingItems).toContain('Momence member');
    expect(copilot.missingItems).toContain('Momence session');
    expect(copilot.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(copilot.suggestions[0]).toMatch(/Member reported|Member stated|Client expressed/);
  });

  it('detects exact duplicates and repeated ticket patterns without static matching rules', () => {
    const insights = buildDuplicatePatternInsights(baseTicket, [
      ticket({ id: 'P57-111', title: 'Member refund complaint', description: 'Member reported frustration after a billing issue.' }),
      ticket({ id: 'P57-112', title: 'Refund follow-up', description: 'Member reported refund frustration again.', memberName: 'Asha Mehta' }),
      ticket({ id: 'P57-113', title: 'Other refund issue', description: 'Another member reported refund concern.', memberName: 'Nisha', studio: 'Supreme HQ, Bandra' }),
      ticket({ id: 'P57-114', title: 'AC concern', description: 'Warm studio.', category: 'Facilities', subCategory: 'AC Temperature', memberName: 'Ria' }),
    ]);

    expect(insights.exactDuplicateIds).toEqual(['P57-111']);
    expect(insights.similarTicketIds).toContain('P57-112');
    expect(insights.patternSummary).toContain('Billing & Membership / Refund Request');
    expect(insights.memberRepeatSummary).toContain('Asha Mehta');
    expect(insights.recommendedAction).toMatch(/Merge|Link|Review/);
  });

  it('builds a resolution assistant with reply, actions, and closure checks', () => {
    const assistant = buildResolutionAssistant(baseTicket, Date.parse('2026-06-06T09:30:00.000Z'));

    expect(assistant.title).toContain('Resolution Assistant');
    expect(assistant.slaState).toBe('At Risk');
    expect(assistant.owner).toBe('Client Success');
    expect(assistant.suggestedMemberReply).toContain('Asha Mehta');
    expect(assistant.nextActions.length).toBeGreaterThanOrEqual(3);
    expect(assistant.closureChecklist).toContain('Member outcome or requested resolution is documented.');
  });

  it('builds recommended resolution steps for Athena ticket drafts', () => {
    const steps = buildRecommendedResolutionSteps(baseTicket);

    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps[0]).toMatch(/Acknowledge|Confirm|Route/);
    expect(steps.join(' ')).toContain('Momence');
  });

  it('optimizes only the rough user-entered text without adding sections or placeholders', () => {
    const optimized = optimizeIntakePromptForAthena('mat class at kemps was too packed and member wants call');

    expect(optimized).toBe('Studio Mat 57 class at Kwality House, Kemps Corner was overcrowded and member requested a call.');
    expect(optimized).not.toContain('Known context');
    expect(optimized).not.toContain('Athena task');
    expect(optimized).not.toContain('Do not invent');
  });

  it('expands common studio, class, and operations shorthand for the optimize button', () => {
    expect(optimizeIntakePromptForAthena('bandra ac not cooling and member wants refund')).toBe(
      'Supreme HQ, Bandra AC not cooling properly and member requested a refund.'
    );
    expect(optimizeIntakePromptForAthena('pc at hq not working client says too cold')).toBe(
      'Studio PowerCycle class at Supreme HQ, Bandra not functioning client reported uncomfortably cold.'
    );
    expect(optimizeIntakePromptForAthena('bb at blr w/o trainer and fd wants whatsapp')).toBe(
      'Studio Back Body Blaze class at Kenkere House, Bengaluru without trainer and front desk requested a WhatsApp follow-up.'
    );
  });

  it('rewrites rough all-caps member requests into documentation voice', () => {
    expect(optimizeIntakePromptForAthena('CLIENT SMITA MODI WANTS A REFUND')).toBe(
      'Client Smita Modi requested a refund.'
    );
  });
});
