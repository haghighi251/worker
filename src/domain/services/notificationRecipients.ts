import { NotificationRecipientKind, UserRole, UserStatus } from '@aba/database';
import { prisma } from '@/infrastructure/database/prisma';

export interface NotificationRecipient {
  userId: number;
  email: string;
  firstName: string | null;
  kind: NotificationRecipientKind;
}

/**
 * Resolves who should receive a service's vulnerability digest:
 *  1. The company's single designated primary owner, if set and active.
 *  2. Every active BUSINESS_ADMIN user linked (via TeamMembership) to the
 *     team that owns the service's environment — zero, one, or many.
 *
 * Always resolved fresh at send time, never cached, so a team reassignment
 * or a primary-owner change is reflected on the very next sweep.
 */
export async function resolveNotificationRecipients(
  serviceId: number,
): Promise<NotificationRecipient[]> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      company: {
        select: {
          primaryOwner: {
            select: { id: true, email: true, firstName: true, status: true },
          },
        },
      },
      environment: { select: { teamId: true } },
    },
  });

  if (!service) return [];

  const recipients: NotificationRecipient[] = [];

  const owner = service.company.primaryOwner;
  if (owner && owner.status === UserStatus.ACTIVE) {
    recipients.push({
      userId: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      kind: NotificationRecipientKind.PRIMARY_OWNER,
    });
  }

  const teamAdminMemberships = await prisma.teamMembership.findMany({
    where: {
      teamId: service.environment.teamId,
      user: { role: UserRole.BUSINESS_ADMIN, status: UserStatus.ACTIVE },
    },
    select: {
      user: { select: { id: true, email: true, firstName: true } },
    },
  });

  for (const membership of teamAdminMemberships) {
    recipients.push({
      userId: membership.user.id,
      email: membership.user.email,
      firstName: membership.user.firstName,
      kind: NotificationRecipientKind.TEAM_BUSINESS_ADMIN,
    });
  }

  return recipients;
}
