export type AppAccessRole = 'admin' | 'manager' | 'executive' | string;

export const APP_TAB_VALUES = [
  'chat',
  'queue',
  'notifications',
  'tickets',
  'trainers',
  'reports',
  'insights',
  'momence',
  'settings',
] as const;

export type AppTabValue = typeof APP_TAB_VALUES[number];

const ADMIN_ONLY_TAB_VALUES = new Set<AppTabValue>(['momence']);
const MANAGER_TAB_VALUES = new Set<AppTabValue>(['reports', 'insights', 'settings']);
const EXECUTIVE_TAB_VALUES = new Set<AppTabValue>([]);

export function visibleAppTabValues(accessRole: AppAccessRole): AppTabValue[] {
  if (accessRole === 'admin') return [...APP_TAB_VALUES];

  return APP_TAB_VALUES.filter((value) => {
    if (ADMIN_ONLY_TAB_VALUES.has(value)) return false;
    if (MANAGER_TAB_VALUES.has(value)) return accessRole === 'manager' || EXECUTIVE_TAB_VALUES.has(value);
    return true;
  });
}

export function canOpenAppTab(accessRole: AppAccessRole, value: string): boolean {
  return visibleAppTabValues(accessRole).includes(value as AppTabValue);
}
