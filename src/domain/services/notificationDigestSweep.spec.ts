import { ActivityEventType, NotificationRecipientKind, ServicePackageStatus, ServiceStatus } from '@aba/database';
import { runNotificationDigestSweep } from '@domain/services/notificationDigestSweep';
import { prisma } from '@/infrastructure/database/prisma';
import { resolveNotificationRecipients } from '@domain/services/notificationRecipients';
import { sendVulnerabilityDigestEmail } from '@/infrastructure/email/emailService';

jest.mock('@/infrastructure/database/prisma', () => ({
  prisma: {
    $executeRawUnsafe: jest.fn(),
    servicePackageNotificationState: { findMany: jest.fn(), updateMany: jest.fn() },
    vulnerabilityOnPackage: { findMany: jest.fn() },
    activityLog: { create: jest.fn() },
    notificationLog: { create: jest.fn() },
  },
}));
jest.mock('@domain/services/notificationRecipients');
jest.mock('@/infrastructure/email/emailService');
jest.mock('@/infrastructure/shared/config', () => ({
  config: { NOTIFICATION_DIGEST_INTERVAL_HOURS: 24 },
}));

const mockedExecuteRaw = (prisma as any).$executeRawUnsafe as jest.Mock;
const mockedFindMany = (prisma as any).servicePackageNotificationState.findMany as jest.Mock;
const mockedUpdateMany = (prisma as any).servicePackageNotificationState.updateMany as jest.Mock;
const mockedVulnLinks = (prisma as any).vulnerabilityOnPackage.findMany as jest.Mock;
const mockedActivityLogCreate = (prisma as any).activityLog.create as jest.Mock;
const mockedNotificationLogCreate = (prisma as any).notificationLog.create as jest.Mock;
const mockedResolveRecipients = resolveNotificationRecipients as jest.Mock;
const mockedSendDigest = sendVulnerabilityDigestEmail as jest.Mock;

function dueState(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 1,
    servicePackage: {
      packageId: overrides.packageId ?? 10,
      serviceId: overrides.serviceId ?? 100,
      package: { name: overrides.packageName ?? 'lodash', version: overrides.packageVersion ?? '4.17.15' },
      service: { id: overrides.serviceId ?? 100, name: overrides.serviceName ?? 'checkout-api', companyId: overrides.companyId ?? 1 },
    },
  };
}

describe('runNotificationDigestSweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExecuteRaw.mockResolvedValue(1);
    mockedFindMany.mockResolvedValue([]);
    mockedVulnLinks.mockResolvedValue([]);
    mockedResolveRecipients.mockResolvedValue([]);
    mockedSendDigest.mockResolvedValue(undefined);
  });

  describe('the claim guard', () => {
    it('skips the whole sweep when the claim affects zero rows', async () => {
      mockedExecuteRaw.mockResolvedValue(0);

      const summary = await runNotificationDigestSweep();

      expect(summary.claimed).toBe(false);
      expect(mockedFindMany).not.toHaveBeenCalled();
    });

    it('bypasses the claim entirely when forced', async () => {
      const summary = await runNotificationDigestSweep({ force: true });

      expect(summary.claimed).toBe(true);
      expect(mockedExecuteRaw).not.toHaveBeenCalled();
    });

    it('proceeds when the claim succeeds', async () => {
      mockedExecuteRaw.mockResolvedValue(1);

      const summary = await runNotificationDigestSweep();

      expect(summary.claimed).toBe(true);
      expect(mockedFindMany).toHaveBeenCalled();
    });
  });

  it('queries only unmuted, due, active packages on active services', async () => {
    await runNotificationDigestSweep();

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          muted: false,
          OR: [{ nextNotifyAt: null }, { nextNotifyAt: { lte: expect.any(Date) } }],
          servicePackage: {
            status: ServicePackageStatus.ACTIVE,
            service: { status: ServiceStatus.ACTIVE },
          },
        }),
      }),
    );
  });

  it('does nothing when there are no due packages', async () => {
    mockedFindMany.mockResolvedValue([]);

    const summary = await runNotificationDigestSweep();

    expect(summary.servicesSwept).toBe(0);
    expect(mockedSendDigest).not.toHaveBeenCalled();
  });

  it('skips a service (no email, no state change, no log) when every package resolves clean on live recheck', async () => {
    mockedFindMany.mockResolvedValue([dueState({ id: 1, packageId: 10, serviceId: 100 })]);
    mockedVulnLinks.mockResolvedValue([]); // no longer vulnerable

    const summary = await runNotificationDigestSweep();

    expect(summary.servicesSwept).toBe(1);
    expect(summary.servicesSkippedEmptyAfterRecheck).toBe(1);
    expect(mockedResolveRecipients).not.toHaveBeenCalled();
    expect(mockedSendDigest).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('logs a skip and does NOT advance nextNotifyAt when there are zero recipients', async () => {
    mockedFindMany.mockResolvedValue([dueState({ id: 1, packageId: 10, serviceId: 100, companyId: 7 })]);
    mockedVulnLinks.mockResolvedValue([{ packageId: 10 }]);
    mockedResolveRecipients.mockResolvedValue([]);

    const summary = await runNotificationDigestSweep();

    expect(summary.servicesSkippedNoRecipients).toBe(1);
    expect(mockedSendDigest).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalled();
    expect(mockedActivityLogCreate).toHaveBeenCalledWith({
      data: {
        eventType: ActivityEventType.NOTIFICATION_SKIPPED,
        companyId: 7,
        serviceId: 100,
        metadata: { reason: 'no_recipients', packageCount: 1 },
      },
    });
  });

  it('sends one combined email per recipient, logs each, and advances state once', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-26T08:00:00.000Z'));

    mockedFindMany.mockResolvedValue([
      dueState({ id: 1, packageId: 10, serviceId: 100, companyId: 7, packageName: 'lodash', packageVersion: '4.17.15' }),
      dueState({ id: 2, packageId: 11, serviceId: 100, companyId: 7, packageName: 'express', packageVersion: '4.16.0' }),
    ]);
    mockedVulnLinks.mockResolvedValue([
      { packageId: 10 }, { packageId: 10 }, // 2 vulns for lodash
      { packageId: 11 }, // 1 vuln for express
    ]);
    mockedResolveRecipients.mockResolvedValue([
      { userId: 1, email: 'owner@co.com', firstName: 'Ada', kind: NotificationRecipientKind.PRIMARY_OWNER },
      { userId: 2, email: 'admin@co.com', firstName: 'Bob', kind: NotificationRecipientKind.TEAM_BUSINESS_ADMIN },
    ]);

    const summary = await runNotificationDigestSweep();

    expect(summary.emailsSent).toBe(2);
    expect(mockedSendDigest).toHaveBeenCalledTimes(2);
    expect(mockedSendDigest).toHaveBeenCalledWith('owner@co.com', 'Ada', 'checkout-api', [
      { packageName: 'lodash', packageVersion: '4.17.15', vulnerabilityCount: 2 },
      { packageName: 'express', packageVersion: '4.16.0', vulnerabilityCount: 1 },
    ]);
    expect(mockedSendDigest).toHaveBeenCalledWith('admin@co.com', 'Bob', 'checkout-api', expect.any(Array));

    expect(mockedNotificationLogCreate).toHaveBeenCalledTimes(2);
    expect(mockedNotificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 7,
        serviceId: 100,
        recipientKind: NotificationRecipientKind.PRIMARY_OWNER,
        recipientUserId: 1,
        recipientEmail: 'owner@co.com',
        packageCount: 2,
      }),
    });

    expect(mockedActivityLogCreate).toHaveBeenCalledWith({
      data: {
        eventType: ActivityEventType.NOTIFICATION_SENT,
        companyId: 7,
        serviceId: 100,
        metadata: { packageCount: 2, recipientCount: 2 },
      },
    });

    // Advances both included states together, once, to now + 24h.
    expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: {
        lastNotifiedAt: new Date('2026-07-26T08:00:00.000Z'),
        nextNotifyAt: new Date('2026-07-27T08:00:00.000Z'),
      },
    });

    jest.useRealTimers();
  });

  it('excludes only the resolved package when one of several has been fixed, but still notifies about the rest', async () => {
    mockedFindMany.mockResolvedValue([
      dueState({ id: 1, packageId: 10, serviceId: 100, companyId: 7 }),
      dueState({ id: 2, packageId: 11, serviceId: 100, companyId: 7, packageName: 'express', packageVersion: '4.16.0' }),
    ]);
    mockedVulnLinks.mockResolvedValue([{ packageId: 11 }]); // packageId 10 no longer vulnerable
    mockedResolveRecipients.mockResolvedValue([
      { userId: 1, email: 'owner@co.com', firstName: 'Ada', kind: NotificationRecipientKind.PRIMARY_OWNER },
    ]);

    await runNotificationDigestSweep();

    expect(mockedSendDigest).toHaveBeenCalledWith('owner@co.com', 'Ada', 'checkout-api', [
      { packageName: 'express', packageVersion: '4.16.0', vulnerabilityCount: 1 },
    ]);
    expect(mockedUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [2] } } }),
    );
  });

  it('continues sweeping other services when one service throws', async () => {
    mockedFindMany.mockResolvedValue([
      dueState({ id: 1, packageId: 10, serviceId: 100, companyId: 7 }),
      dueState({ id: 2, packageId: 20, serviceId: 200, companyId: 7, serviceName: 'billing-api' }),
    ]);
    mockedVulnLinks.mockImplementation(({ where }: any) => {
      if (where.packageId.in.includes(10)) throw new Error('db blip');
      return Promise.resolve([{ packageId: 20 }]);
    });
    mockedResolveRecipients.mockResolvedValue([
      { userId: 1, email: 'owner@co.com', firstName: 'Ada', kind: NotificationRecipientKind.PRIMARY_OWNER },
    ]);

    const summary = await runNotificationDigestSweep();

    expect(summary.errors).toBe(1);
    expect(summary.servicesSwept).toBe(2);
    expect(mockedSendDigest).toHaveBeenCalledTimes(1);
    expect(mockedSendDigest).toHaveBeenCalledWith('owner@co.com', 'Ada', 'billing-api', expect.any(Array));
  });
});
