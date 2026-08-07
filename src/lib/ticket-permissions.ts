import { getEmployee, getEscalationTarget } from './ticketing-data';

type AccessRole = 'admin' | 'manager' | 'executive' | string;

interface StatusPermissionTicket {
  assignedTo?: string | null;
}

interface VisibilityPermissionTicket {
  createdBy?: string | null;
  assignedTo?: string | null;
  reportedBy?: string | null;
  team?: string | null;
}

interface StatusPermissionInput {
  accessRole: AccessRole;
  identityValues: Iterable<string>;
  ticket: StatusPermissionTicket;
}

interface ResolutionPermissionInput {
  accessRole: AccessRole;
  identityValues: Iterable<string>;
  ticket: StatusPermissionTicket;
}

interface VisibilityPermissionInput {
  accessRole: AccessRole;
  identityValues: Iterable<string>;
  teamMemberIdentityValues?: Iterable<string>;
  departmentValues?: Iterable<string>;
  ticket: VisibilityPermissionTicket;
}

function normalizeIdentity(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function ticketOwnerKeys(assignedTo?: string | null): Set<string> {
  const ownerName = normalizeIdentity(assignedTo);
  const owner = assignedTo ? getEmployee(assignedTo) : undefined;
  return new Set([
    ownerName,
    normalizeIdentity(owner?.email),
  ].filter(Boolean));
}

function employeeKeys(name?: string | null): Set<string> {
  const normalizedName = normalizeIdentity(name);
  const employee = name ? getEmployee(name) : undefined;
  const baseName = normalizedName.replace(/\s+-\s+.*$/, '').trim();
  return new Set([
    normalizedName,
    baseName,
    normalizeIdentity(employee?.email),
  ].filter(Boolean));
}

function immediateSupervisorKeys(assignedTo?: string | null): Set<string> {
  const owner = assignedTo ? getEmployee(assignedTo) : undefined;
  return employeeKeys(owner?.manager || (assignedTo ? getEscalationTarget(assignedTo) : undefined));
}

export function canUpdateTicketStatus({ accessRole, identityValues, ticket }: StatusPermissionInput): boolean {
  void accessRole;

  const allowedKeys = new Set([
    ...ticketOwnerKeys(ticket.assignedTo),
    ...immediateSupervisorKeys(ticket.assignedTo),
  ]);
  if (allowedKeys.size === 0) return false;

  for (const identity of identityValues) {
    if (allowedKeys.has(normalizeIdentity(identity))) return true;
  }

  return false;
}

export function canEditTicketResolution({ accessRole, identityValues, ticket }: ResolutionPermissionInput): boolean {
  void accessRole;

  const allowedKeys = new Set([
    ...ticketOwnerKeys(ticket.assignedTo),
    ...immediateSupervisorKeys(ticket.assignedTo),
  ]);
  if (allowedKeys.size === 0) return false;

  for (const identity of identityValues) {
    if (allowedKeys.has(normalizeIdentity(identity))) return true;
  }

  return false;
}

export function canAccessTicket({
  accessRole,
  identityValues,
  teamMemberIdentityValues = [],
  departmentValues = [],
  ticket,
}: VisibilityPermissionInput): boolean {
  if (accessRole === 'admin') return true;

  const ticketKeys = new Set([
    normalizeIdentity(ticket.createdBy),
    normalizeIdentity(ticket.reportedBy),
    ...ticketOwnerKeys(ticket.assignedTo),
  ].filter(Boolean));

  for (const identity of identityValues) {
    if (ticketKeys.has(normalizeIdentity(identity))) return true;
  }

  if (accessRole === 'manager') {
    const departmentKeys = new Set(Array.from(departmentValues, normalizeIdentity).filter(Boolean));
    const ticketTeam = normalizeIdentity(ticket.team);
    if (departmentKeys.size > 0 && (!ticketTeam || !departmentKeys.has(ticketTeam))) return false;

    const teamMemberKeys = new Set(Array.from(teamMemberIdentityValues, normalizeIdentity).filter(Boolean));
    if (teamMemberKeys.size > 0) {
      for (const ticketKey of ticketKeys) {
        if (teamMemberKeys.has(ticketKey)) return true;
      }
    }
  }

  return false;
}
