import { Router } from 'express';
import { addNewCompany } from '@/application/controllers/company';

const companyRouter = Router();

companyRouter.get('/:symbol', addNewCompany);

export default companyRouter;