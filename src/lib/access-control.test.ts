import { describe, expect, it } from 'vitest';
import { resolveAccessRole } from './access-control';

describe('resolveAccessRole', () => {
  it('gives full admin access to physique57india.com users', () => {
    expect(resolveAccessRole({ email: 'ops@physique57india.com', fullName: 'Ops User' })).toBe('admin');
  });

  it('uses explicit backend profile roles before domain defaults', () => {
    expect(resolveAccessRole({ email: 'mitali@physique57india.com', fullName: 'Mitali Kumar', role: 'manager' })).toBe('manager');
  });

  it('promotes named managers on city domains to manager access', () => {
    expect(resolveAccessRole({ email: 'pushyank@physique57bengaluru.com', fullName: 'Pushyank Nahar' })).toBe('manager');
    expect(resolveAccessRole({ email: 'mrigakshi@physique57mumbai.com', fullName: 'Mrigakshi Jaiswal' })).toBe('manager');
  });

  it('gives city-domain users executive access by default', () => {
    expect(resolveAccessRole({ email: 'frontdesk@physique57mumbai.com', fullName: 'Front Desk' })).toBe('executive');
    expect(resolveAccessRole({ email: 'associate@physique57bengaluru.com', fullName: 'Studio Associate' })).toBe('executive');
  });
});
