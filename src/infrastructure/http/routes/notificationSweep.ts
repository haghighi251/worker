import { NextFunction, Request, Response, Router } from 'express';
import { config } from '@/infrastructure/shared/config';
import { triggerNotificationSweep } from '@/application/controllers/notificationSweep';

const notificationSweepRouter = Router();

/**
 * Protects the manual "run sweep now" trigger with a shared-secret header.
 * In production INTERNAL_API_KEY must be set — an unset key rejects every
 * caller there. In dev/test (no key configured, non-production) any caller
 * is allowed, matching how this endpoint is meant to be used for local
 * testing and E2E automation.
 */
export function requireInternalApiKey(req: Request, res: Response, next: NextFunction) {
  const isProduction = config.NODE_ENV === 'production';

  if (!config.INTERNAL_API_KEY) {
    if (isProduction) {
      return res.status(503).json({ success: false, error: 'INTERNAL_API_KEY is not configured.' });
    }
    return next();
  }

  if (req.header('x-internal-api-key') !== config.INTERNAL_API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid or missing internal API key.' });
  }

  return next();
}

notificationSweepRouter.post('/sweep', requireInternalApiKey, triggerNotificationSweep);

export default notificationSweepRouter;
