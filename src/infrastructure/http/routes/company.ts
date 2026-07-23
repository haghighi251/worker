import { Router } from 'express';
import { getCompanyById } from '@/application/controllers/company';

/**
 * Company routes — used internally by the worker to resolve company data
 * from the shared PostgreSQL database via Prisma.
 */
const companyRouter = Router();

companyRouter.get('/:id', getCompanyById);

export default companyRouter;
