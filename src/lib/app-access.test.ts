import { describe, expect, it } from 'vitest';
import { visibleAppTabValues } from './app-access';

describe('visibleAppTabValues', () => {
  it('shows ticket workspaces to executive users without privileged tabs', () => {
    expect(visibleAppTabValues('executive')).toEqual([
      'chat',
      'queue',
      'notifications',
      'tickets',
      'trainers',
    ]);
  });

  it('shows manager ticket workspaces without full admin operations', () => {
    expect(visibleAppTabValues('manager')).toEqual([
      'chat',
      'queue',
      'notifications',
      'tickets',
      'trainers',
      'reports',
      'insights',
      'settings',
    ]);
  });

  it('shows every workspace to admin users', () => {
    expect(visibleAppTabValues('admin')).toEqual([
      'chat',
      'queue',
      'notifications',
      'tickets',
      'trainers',
      'reports',
      'insights',
      'momence',
      'settings',
    ]);
  });
});
