export type AccessRole = 'admin' | 'manager' | 'executive';

const ADMIN_DOMAIN = 'physique57india.com';
const EXECUTIVE_DOMAINS = new Set(['physique57mumbai.com', 'physique57bengaluru.com']);
const MANAGER_FIRST_NAMES = new Set(['pushyank', 'shifa', 'mrigakshi', 'vivaran']);

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function firstNameFromProfile(email?: string | null, fullName?: string | null): string {
  const fromName = normalize(fullName).split(/\s+/)[0] || '';
  if (fromName) return fromName;
  return normalize(email).split('@')[0]?.split(/[._-]+/)[0] || '';
}

function isAccessRole(value: unknown): value is AccessRole {
  return value === 'admin' || value === 'manager' || value === 'executive';
}

export function resolveAccessRole(profile: { email?: string | null; fullName?: string | null; role?: string | null }): AccessRole {
  if (isAccessRole(profile.role)) return profile.role;

  const email = normalize(profile.email);
  const domain = email.includes('@') ? email.split('@').pop() || '' : '';

  if (domain === ADMIN_DOMAIN) return 'admin';
  if (MANAGER_FIRST_NAMES.has(firstNameFromProfile(profile.email, profile.fullName))) return 'manager';
  if (EXECUTIVE_DOMAINS.has(domain)) return 'executive';

  return 'executive';
}
