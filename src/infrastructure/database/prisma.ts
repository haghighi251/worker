/**
 * Re-exports the shared Prisma singleton from @aba/database.
 *
 * All database access in the worker goes through this import.
 * The schema and migrations are owned exclusively by packages/database —
 * never run db:push or db:migrate from the worker.
 */
export { prisma, createPrismaClient } from '@aba/database';
export type { User, Company, UserRole, UserStatus, CompanyStatus } from '@aba/database';
