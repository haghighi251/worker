import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { prisma } from '@/infrastructure/database/prisma';
import companyRouter from '@/infrastructure/http/routes/company';
import { setupLogging } from '@/infrastructure/logs/logging';

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
  } catch (error) {
    console.error('[Worker] Failed to connect to database:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Gracefully disconnect Prisma on shutdown
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

bootstrap();

export default app;
