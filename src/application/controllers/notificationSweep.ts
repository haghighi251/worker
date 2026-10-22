import { NextFunction, Request, Response } from 'express';
import { runNotificationDigestSweep } from '@domain/services/notificationDigestSweep';

/**
 * POST /internal/notifications/sweep
 *
 * Forces an immediate notification digest sweep, bypassing the claim guard
 * that normally limits it to once per NOTIFICATION_DIGEST_INTERVAL_HOURS.
 * Exists for E2E test automation and for ops recovery after a failed
 * night's run — not part of the customer-facing API.
 */
export async function triggerNotificationSweep(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const summary = await runNotificationDigestSweep({ force: true });
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}
