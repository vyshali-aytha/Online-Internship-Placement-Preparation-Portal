import { Router } from 'express';
import {
  requireAuth,
  requireRoles,
  requireApprovedRecruiter,
} from './security.js';

export function createRbacRouter(dbPool) {
  const router = Router();

  // Recruiter access is permitted only while the database status
  // is APPROVED. The status is checked on every request.
  router.get(
    '/recruiter/access',
    requireAuth,
    requireRoles('RECRUITER'),
    requireApprovedRecruiter,
    (req, res) => {
      return res.status(200).json({
        id: req.auth.sub,
        role: 'RECRUITER',
        approved: true,
      });
    }
  );

  // The request list is never public and exposes no password hashes.
  router.get(
    '/admin/recruiter-requests',
    requireAuth,
    requireRoles('ADMIN'),
    async (req, res, next) => {
      try {
        const [rows] = await dbPool.execute(
          `SELECT id, full_name, email, company_name, status,
                  created_at, reviewed_at, reviewed_by
           FROM recruiter_requests
           WHERE status = 'PENDING'
           ORDER BY created_at ASC`
        );

        return res.status(200).json(rows);
      } catch (error) {
        return next(error);
      }
    }
  );

  return router;
}