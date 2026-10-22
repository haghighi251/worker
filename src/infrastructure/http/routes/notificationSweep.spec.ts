import { Request, Response } from 'express';
import { requireInternalApiKey } from '@/infrastructure/http/routes/notificationSweep';

jest.mock('@/infrastructure/shared/config', () => ({
  config: { NODE_ENV: 'test', INTERNAL_API_KEY: '' },
}));

import { config } from '@/infrastructure/shared/config';

function mockReq(headerValue?: string): Request {
  return { header: jest.fn().mockReturnValue(headerValue) } as unknown as Request;
}

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireInternalApiKey', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (config as any).NODE_ENV = 'test';
    (config as any).INTERNAL_API_KEY = '';
  });

  it('allows any caller in non-production when no key is configured', () => {
    const res = mockRes();
    requireInternalApiKey(mockReq(), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects every caller in production when no key is configured', () => {
    (config as any).NODE_ENV = 'production';
    const res = mockRes();

    requireInternalApiKey(mockReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('rejects a request with a missing or wrong key when one is configured', () => {
    (config as any).INTERNAL_API_KEY = 'secret';
    const res = mockRes();

    requireInternalApiKey(mockReq('wrong'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows a request with the correct key', () => {
    (config as any).INTERNAL_API_KEY = 'secret';
    const res = mockRes();

    requireInternalApiKey(mockReq('secret'), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
