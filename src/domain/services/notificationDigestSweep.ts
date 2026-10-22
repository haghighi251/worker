import {
  ActivityEventType,
  ServicePackageStatus,
  ServiceStatus,
} from '@aba/database';
import { prisma } from '@/infrastructure/database/prisma';
import { config } from '@/infrastructure/shared/config';
import { resolveNotificationRecipients } from '@domain/services/notificationRecipients';
import { sendVulnerabilityDigestEmail, DigestPackageItem } from '@/infrastructure/email/emailService';

export interface SweepSummary {
  claimed: boolean;
  servicesSwept: number;
  emailsSent: number;
  servicesSkippedEmptyAfterRecheck: number;
  servicesSkippedNoRecipients: number;
  errors: number;
}

interface DueState {
  id: number;
  servicePackage: {
    packageId: number;
    serviceId: number;
    package: { name: string; version: string };
    service: { id: number; name: string; companyId: number };
  };
}

function emptySummary(claimed: boolean): SweepSummary {
  return {
    claimed,
    servicesSwept: 0,
    emailsSent: 0,
    servicesSkippedEmptyAfterRecheck: 0,
    servicesSkippedNoRecipients: 0,
    errors: 0,
  };
}

/**
 * Atomically claims this sweep run. Uses a conditional UPDATE rather than an
 * advisory lock: Postgres row-level locking on the UPDATE means at most one
 * concurrent transaction can affect the row, so if multiple worker replicas'
 * cron ticks fire around the same time, only one of them actually runs the
 * sweep — the rest see zero rows affected and skip. `force: true` (used by
 * the manual "run now" endpoint and by tests) bypasses this entirely.
 */
async function claimSweepRun(force: boolean): Promise<boolean> {
  if (force) return true;

  const affected = await prisma.$executeRawUnsafe(
    `UPDATE notification_sweep_state
     SET "lastSweptAt" = NOW()
     WHERE id = 1 AND ("lastSweptAt" IS NULL OR "lastSweptAt" < NOW() - INTERVAL '1 hour' * $1)`,
    config.NOTIFICATION_DIGEST_INTERVAL_HOURS,
  );

  return affected > 0;
}

/**
 * The daily notification digest sweep: finds every unmuted, due
 * ServicePackageNotificationState, groups it by service, and for each
 * service sends ONE combined email per recipient listing every still-
 * vulnerable package — never one email per package. This is the only place
 * that turns a detected vulnerability into an actual notification; neither
 * aba-bl's scan logic nor this service's own Kafka consumer send email.
 */
export async function runNotificationDigestSweep(
  options: { force?: boolean } = {},
): Promise<SweepSummary> {
  const claimed = await claimSweepRun(!!options.force);
  if (!claimed) {
    console.log('[Worker] Notification digest sweep already run recently, skipping this tick.');
    return emptySummary(false);
  }

  const summary = emptySummary(true);

  const dueStates: DueState[] = await prisma.servicePackageNotificationState.findMany({
    where: {
      muted: false,
      OR: [{ nextNotifyAt: null }, { nextNotifyAt: { lte: new Date() } }],
      servicePackage: {
        status: ServicePackageStatus.ACTIVE,
        service: { status: ServiceStatus.ACTIVE },
      },
    },
    select: {
      id: true,
      servicePackage: {
        select: {
          packageId: true,
          serviceId: true,
          package: { select: { name: true, version: true } },
          service: { select: { id: true, name: true, companyId: true } },
        },
      },
    },
  });

  const statesByServiceId = new Map<number, DueState[]>();
  for (const state of dueStates) {
    const serviceId = state.servicePackage.serviceId;
    const bucket = statesByServiceId.get(serviceId);
    if (bucket) {
      bucket.push(state);
    } else {
      statesByServiceId.set(serviceId, [state]);
    }
  }

  for (const [serviceId, states] of statesByServiceId) {
    try {
      await sweepOneService(serviceId, states, summary);
    } catch (error) {
      summary.errors++;
      console.error(
        `[Worker] Notification digest sweep failed for service ${serviceId}:`,
        (error as Error)?.message,
      );
    }
  }

  return summary;
}

async function sweepOneService(
  serviceId: number,
  states: DueState[],
  summary: SweepSummary,
): Promise<void> {
  summary.servicesSwept++;

  // Re-check live vulnerability data — a package fixed since detection is
  // simply excluded, not just "still marked due."
  const packageIds = states.map((s) => s.servicePackage.packageId);
  const links = await prisma.vulnerabilityOnPackage.findMany({
    where: { packageId: { in: packageIds } },
    select: { packageId: true },
  });

  const vulnCountByPackageId = new Map<number, number>();
  for (const link of links) {
    vulnCountByPackageId.set(link.packageId, (vulnCountByPackageId.get(link.packageId) ?? 0) + 1);
  }

  const includedStates = states.filter((s) => vulnCountByPackageId.has(s.servicePackage.packageId));

  if (includedStates.length === 0) {
    summary.servicesSkippedEmptyAfterRecheck++;
    return;
  }

  const { name: serviceName, companyId } = includedStates[0].servicePackage.service;
  const recipients = await resolveNotificationRecipients(serviceId);

  if (recipients.length === 0) {
    summary.servicesSkippedNoRecipients++;
    // Deliberately does NOT advance nextNotifyAt — the issue genuinely was
    // never communicated, so tomorrow's sweep should retry as soon as a
    // recipient exists.
    await prisma.activityLog.create({
      data: {
        eventType: ActivityEventType.NOTIFICATION_SKIPPED,
        companyId,
        serviceId,
        metadata: { reason: 'no_recipients', packageCount: includedStates.length },
      },
    });
    return;
  }

  const digestPackages: DigestPackageItem[] = includedStates.map((s) => ({
    packageName: s.servicePackage.package.name,
    packageVersion: s.servicePackage.package.version,
    vulnerabilityCount: vulnCountByPackageId.get(s.servicePackage.packageId) ?? 0,
  }));

  await Promise.allSettled(
    recipients.map(async (recipient) => {
      try {
        await sendVulnerabilityDigestEmail(recipient.email, recipient.firstName, serviceName, digestPackages);
        summary.emailsSent++;
        await prisma.notificationLog.create({
          data: {
            companyId,
            serviceId,
            recipientKind: recipient.kind,
            recipientUserId: recipient.userId,
            recipientEmail: recipient.email,
            packageCount: digestPackages.length,
            details: digestPackages as unknown as object,
          },
        });
      } catch (error) {
        console.error(
          `[Worker] Failed to send digest to ${recipient.email} for service ${serviceId}:`,
          (error as Error)?.message,
        );
      }
    }),
  );

  await prisma.activityLog.create({
    data: {
      eventType: ActivityEventType.NOTIFICATION_SENT,
      companyId,
      serviceId,
      metadata: { packageCount: digestPackages.length, recipientCount: recipients.length },
    },
  });

  const now = new Date();
  const nextNotifyAt = new Date(now.getTime() + config.NOTIFICATION_DIGEST_INTERVAL_HOURS * 60 * 60 * 1000);
  await prisma.servicePackageNotificationState.updateMany({
    where: { id: { in: includedStates.map((s) => s.id) } },
    data: { lastNotifiedAt: now, nextNotifyAt },
  });
}
