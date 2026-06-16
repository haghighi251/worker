import { NextFunction, Request, Response } from 'express';
import { prisma } from '@/infrastructure/database/prisma';

/**
 * GET /company/:id
 *
 * Returns basic company info by ID.
 * Used by worker health checks and future Kafka consumer payloads
 * that need to resolve a companyId to a Company record.
 */
export async function getCompanyById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid company id.' });
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found.' });
    }

    return res.status(200).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
}
