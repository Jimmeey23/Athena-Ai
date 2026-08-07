import { describe, expect, it } from 'vitest';
import { buildGuardFieldDefinition, getGuardFieldType } from './intake-fields';

describe('intake field guard definitions', () => {
  it('returns the canonical type for guard fields', () => {
    expect(getGuardFieldType('clientsAffected')).toBe('select');
    expect(getGuardFieldType('incidentDateTime')).toBe('datetime-local');
    expect(getGuardFieldType('appErrorObserved')).toBe('textarea');
    expect(getGuardFieldType('reportedTime')).toBe('datetime-local');
    expect(getGuardFieldType('serviceRecoveryNeeded')).toBe('select');
  });

  it('builds placeholder-free guard field definitions', () => {
    expect(buildGuardFieldDefinition('resolutionRequired')).toEqual({
      id: 'resolutionRequired',
      label: '',
      type: 'select',
      required: true,
    });
    expect(buildGuardFieldDefinition('custom_snake_case')).toEqual({
      id: 'custom_snake_case',
      label: '',
      type: 'text',
      required: true,
    });
  });
});
