import { describe, expect, it } from 'vitest';
import { getGreetingQuickActions, isCasualGreeting } from './athena-chat-intent';

describe('Athena chat intent', () => {
  it('recognizes simple greetings as conversational messages', () => {
    expect(isCasualGreeting('hi')).toBe(true);
    expect(isCasualGreeting('hello athena')).toBe(true);
    expect(isCasualGreeting('good morning')).toBe(true);
  });

  it('does not treat actual issue reports as greetings', () => {
    expect(isCasualGreeting('hi, AC is not working in Bandra')).toBe(false);
    expect(isCasualGreeting('hello, member complained about a refund delay')).toBe(false);
  });

  it('offers quick intake actions for simple greetings', () => {
    expect(getGreetingQuickActions()).toEqual([
      { label: 'Complaint', value: 'Complaint', field: 'intakeRoute' },
      { label: 'Request', value: 'Request', field: 'intakeRoute' },
      { label: 'Feedback', value: 'Feedback', field: 'intakeRoute' },
    ]);
  });
});
