import { NotificationRecipientKind, UserRole, UserStatus } from '@aba/database';
import { resolveNotificationRecipients } from '@domain/services/notificationRecipients';
import { prisma } from '@/infrastructure/database/prisma';

jest.mock('@/infrastructure/database/prisma', () => ({
  prisma: {
    service: { findUnique: jest.fn() },
    teamMembership: { findMany: jest.fn() },
  },
}));

const mockedService = (prisma as any).service.findUnique as jest.Mock;
const mockedTeamMembership = (prisma as any).teamMembership.findMany as jest.Mock;

describe('resolveNotificationRecipients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when the service does not exist', async () => {
    mockedService.mockResolvedValue(null);

    const result = await resolveNotificationRecipients(999);

    expect(result).toEqual([]);
    expect(mockedTeamMembership).not.toHaveBeenCalled();
  });

  it('includes the primary owner when set and active', async () => {
    mockedService.mockResolvedValue({
      company: {
        primaryOwner: { id: 1, email: 'owner@co.com', firstName: 'Ada', status: UserStatus.ACTIVE },
      },
      environment: { teamId: 20 },
    });
    mockedTeamMembership.mockResolvedValue([]);

    const result = await resolveNotificationRecipients(5);

    expect(result).toEqual([
      { userId: 1, email: 'owner@co.com', firstName: 'Ada', kind: NotificationRecipientKind.PRIMARY_OWNER },
    ]);
  });

  it('excludes the primary owner when set but inactive', async () => {
    mockedService.mockResolvedValue({
      company: {
        primaryOwner: { id: 1, email: 'owner@co.com', firstName: 'Ada', status: UserStatus.SUSPENDED },
      },
      environment: { teamId: 20 },
    });
    mockedTeamMembership.mockResolvedValue([]);

    const result = await resolveNotificationRecipients(5);

    expect(result).toEqual([]);
  });

  it('excludes the primary owner when the company has none set', async () => {
    mockedService.mockResolvedValue({
      company: { primaryOwner: null },
      environment: { teamId: 20 },
    });
    mockedTeamMembership.mockResolvedValue([]);

    const result = await resolveNotificationRecipients(5);

    expect(result).toEqual([]);
  });

  it('includes every active BUSINESS_ADMIN linked to the environment team', async () => {
    mockedService.mockResolvedValue({
      company: { primaryOwner: null },
      environment: { teamId: 20 },
    });
    mockedTeamMembership.mockResolvedValue([
      { user: { id: 10, email: 'admin1@co.com', firstName: 'Bob' } },
      { user: { id: 11, email: 'admin2@co.com', firstName: 'Cy' } },
    ]);

    const result = await resolveNotificationRecipients(5);

    expect(mockedTeamMembership).toHaveBeenCalledWith({
      where: {
        teamId: 20,
        user: { role: UserRole.BUSINESS_ADMIN, status: UserStatus.ACTIVE },
      },
      select: { user: { select: { id: true, email: true, firstName: true } } },
    });
    expect(result).toEqual([
      { userId: 10, email: 'admin1@co.com', firstName: 'Bob', kind: NotificationRecipientKind.TEAM_BUSINESS_ADMIN },
      { userId: 11, email: 'admin2@co.com', firstName: 'Cy', kind: NotificationRecipientKind.TEAM_BUSINESS_ADMIN },
    ]);
  });

  it('combines the primary owner and team admins into one list', async () => {
    mockedService.mockResolvedValue({
      company: {
        primaryOwner: { id: 1, email: 'owner@co.com', firstName: 'Ada', status: UserStatus.ACTIVE },
      },
      environment: { teamId: 20 },
    });
    mockedTeamMembership.mockResolvedValue([
      { user: { id: 10, email: 'admin1@co.com', firstName: 'Bob' } },
    ]);

    const result = await resolveNotificationRecipients(5);

    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe(NotificationRecipientKind.PRIMARY_OWNER);
    expect(result[1].kind).toBe(NotificationRecipientKind.TEAM_BUSINESS_ADMIN);
  });
});
