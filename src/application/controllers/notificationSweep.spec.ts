import { Request, Response } from 'express';
import { triggerNotificationSweep } from '@/application/controllers/notificationSweep';
import { runNotificationDigestSweep } from '@domain/services/notificationDigestSweep';

jest.mock('@domain/services/notificationDigestSweep');
const mockedSweep = runNotificationDigestSweep as jest.Mock;

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('triggerNotificationSweep', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forces a sweep and returns its summary', async () => {
    const summary = { claimed: true, servicesSwept: 1, emailsSent: 1, servicesSkippedEmptyAfterRecheck: 0, servicesSkippedNoRecipients: 0, errors: 0 };
    mockedSweep.mockResolvedValue(summary);
    const res = mockRes();

    await triggerNotificationSweep({} as Request, res, next);

    expect(mockedSweep).toHaveBeenCalledWith({ force: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: summary });
  });

  it('forwards errors to the error-handling middleware', async () => {
    const error = new Error('boom');
    mockedSweep.mockRejectedValue(error);
    const res = mockRes();

    await triggerNotificationSweep({} as Request, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
