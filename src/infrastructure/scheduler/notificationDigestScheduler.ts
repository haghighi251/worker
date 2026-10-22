import cron, { ScheduledTask } from 'node-cron';
import { config } from '@/infrastructure/shared/config';
import { runNotificationDigestSweep } from '@domain/services/notificationDigestSweep';

let task: ScheduledTask | null = null;

/**
 * Ticks on NOTIFICATION_DIGEST_CRON (default: once daily). The tick's
 * cadence is just how often we *check* for due packages — actual per-service
 * re-notification frequency is governed by runNotificationDigestSweep's own
 * claim guard and each package's nextNotifyAt.
 */
export function startNotificationDigestScheduler(): void {
  task = cron.schedule(config.NOTIFICATION_DIGEST_CRON, () => {
    runNotificationDigestSweep()
      .then((summary) => console.log('[Worker] Notification digest sweep tick complete:', summary))
      .catch((error) => console.error('[Worker] Notification digest sweep tick failed:', error?.message));
  });
}

export function stopNotificationDigestScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
