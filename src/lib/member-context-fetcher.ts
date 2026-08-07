import { searchMomenceMembers, getMomenceMemberMemberships, getMomenceMemberBookings } from './momence-api';
import type { Ticket } from './ticketing-data';

export interface MemberMembershipSummary {
  name: string;
  creditsRemaining?: number;
  expiresAt?: string;
  isFrozen?: boolean;
}

export interface MemberRecentClass {
  sessionName: string;
  date: string;
  trainer?: string;
  studio?: string;
}

export interface MemberContextSnapshot {
  memberName: string;
  momenceId?: string;
  memberships: MemberMembershipSummary[];
  recentClasses: MemberRecentClass[];
  recentTickets: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  hasPastRefund: boolean;
  hasOpenTickets: boolean;
  repeatComplainant: boolean;
}

export async function fetchMemberContext(
  memberName: string,
  allTickets: Ticket[],
): Promise<MemberContextSnapshot | null> {
  const query = memberName.trim();
  if (!query || query.length < 2) return null;

  // Match past tickets by first name (case-insensitive)
  const firstWord = query.split(/\s+/)[0].toLowerCase();
  const memberTickets = allTickets
    .filter((t) => t.memberName?.toLowerCase().includes(firstWord))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Parallel: search Momence for member + their memberships
  let momenceId: string | undefined;
  let memberships: MemberMembershipSummary[] = [];
  let recentClasses: MemberRecentClass[] = [];

  try {
    const members = await searchMomenceMembers(query);
    const topMember = members[0] ?? null;

    if (topMember) {
      momenceId = topMember.id;

      const [membershipResults, bookingResults] = await Promise.allSettled([
        getMomenceMemberMemberships(topMember.id),
        getMomenceMemberBookings(topMember.id),
      ]);

      if (membershipResults.status === 'fulfilled') {
        memberships = membershipResults.value.slice(0, 4).map((m) => ({
          name: m.membership?.name ?? 'Unknown package',
          creditsRemaining: m.eventCreditsLeft ?? undefined,
          expiresAt: m.endDate ?? undefined,
          isFrozen: m.isFrozen ?? false,
        }));
      }

      if (bookingResults.status === 'fulfilled') {
        recentClasses = bookingResults.value
          .filter((b) => !b.cancelledAt)
          .slice(0, 5)
          .map((b) => ({
            sessionName: b.session?.name ?? 'Unknown class',
            date: b.session?.startsAt?.slice(0, 10) ?? '',
            trainer: b.session?.teacher
              ? `${b.session.teacher.firstName ?? ''} ${b.session.teacher.lastName ?? ''}`.trim()
              : undefined,
            studio: b.session?.inPersonLocation?.name ?? undefined,
          }));
      }
    }
  } catch {
    // Momence unavailable — continue with ticket history only
  }

  const hasPastRefund = memberTickets.some((t) =>
    /refund|waiver|money back/i.test(`${t.category} ${t.subCategory} ${t.title}`)
  );
  const hasOpenTickets = memberTickets.some((t) => !['Resolved', 'Closed'].includes(t.status));
  const repeatComplainant = memberTickets.filter((t) =>
    /complaint|complain/i.test(t.category)
  ).length >= 2;

  return {
    memberName: query,
    momenceId,
    memberships,
    recentClasses,
    recentTickets: memberTickets.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      status: t.status,
      createdAt: t.createdAt,
    })),
    hasPastRefund,
    hasOpenTickets,
    repeatComplainant,
  };
}
