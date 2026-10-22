import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { prisma } from '@/infrastructure/database/prisma';
import companyRouter from '@/infrastructure/http/routes/company';
import notificationSweepRouter from '@/infrastructure/http/routes/notificationSweep';
import { setupLogging } from '@/infrastructure/logs/logging';
import { startPackageScanConsumer, stopPackageScanConsumer } from '@/infrastructure/kafka/consumers/packageScanConsumer';
import {
  startVulnerabilityNotificationPendingConsumer,
  stopVulnerabilityNotificationPendingConsumer,
} from '@/infrastructure/kafka/consumers/vulnerabilityNotificationPendingConsumer';
import { disconnectKafkaProducer } from '@/infrastructure/kafka/kafkaClient';
import {
  startNotificationDigestScheduler,
  stopNotificationDigestScheduler,
} from '@/infrastructure/scheduler/notificationDigestScheduler';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

setupLogging(app);
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

/** Health endpoint — used by Docker and monitoring to verify the service is up */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, service: 'worker', status: 'ok' });
});

app.use('/company', companyRouter);
app.use('/internal/notifications', notificationSweepRouter);

/** Catch-all for unmatched routes */
app.get('/', (_req: Request, res: Response) => {
  res.json({ success: false, error: 'Please use a valid endpoint.' });
});

// ── Global error handler ──────────────────────────────────────────────────────

export type RequestError = Error & { status?: number };

app.use((error: RequestError, _req: Request, res: Response, _next: NextFunction) => {
  const status  = error.status ?? 500;
  const message = error.message ?? 'Something went wrong.';
  console.error(`[Worker] Error: ${message}`);
  res.status(status).json({ success: false, error: message });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 8001;

async function bootstrap() {
  try {
    // Verify the database connection before accepting traffic
    await prisma.$connect();
    console.log('[Worker] PostgreSQL connected via Prisma');

    app.listen(port, () => {
      console.log(`🚀 Worker service ready at http://localhost:${port}`);
    });

    // Deliberately not awaited: a Kafka broker that's briefly unreachable
    // should never stop this service from serving HTTP traffic. kafkajs
    // retries the connection with backoff internally; failures are logged.
    startPackageScanConsumer()
      .then(() => console.log('[Worker] package.scan consumer started'))
      .catch((error) => console.error('[Worker] Failed to start package.scan consumer:', error?.message));

    startVulnerabilityNotificationPendingConsumer()
      .then(() => console.log('[Worker] vulnerability.notification.pending consumer started'))
      .catch((error) =>
        console.error('[Worker] Failed to start vulnerability.notification.pending consumer:', error?.message),
      );

    startNotificationDigestScheduler();
    console.log('[Worker] Notification digest scheduler started');
  } catch (error) {
    console.error('[Worker] Failed to connect to database:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

async function shutdown() {
  stopNotificationDigestScheduler();
  await Promise.allSettled([
    prisma.$disconnect(),
    stopPackageScanConsumer(),
    stopVulnerabilityNotificationPendingConsumer(),
    disconnectKafkaProducer(),
  ]);
  process.exit(0);
}

// Gracefully disconnect Prisma and Kafka on shutdown
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

bootstrap();

export default app;
