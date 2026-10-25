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

  router.patch(
    '/admin/recruiter-requests/:id/status',
    requireAuth,
    requireRoles('ADMIN'),
    async (req, res, next) => {
      const id = Number(req.params.id);
      const action =
        typeof req.body?.status === 'string'
          ? req.body.status.trim().toUpperCase()
          : '';

      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !['APPROVED', 'REJECTED'].includes(action)
      ) {
        return res.status(400).json({
          message: 'Request ID and decision action must be valid.',
        });
      }

      let connection;
      try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
          `SELECT id, status
           FROM recruiter_requests
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        );
        const request = rows[0];

        if (!request) {
          await connection.rollback();
          return res.status(404).json({
            message: 'Recruiter request not found.',
          });
        }

        if (request.status !== 'PENDING') {
          await connection.rollback();
          return res.status(409).json({
            message: 'Recruiter request has already been decided.',
          });
        }

        await connection.execute(
          `UPDATE recruiter_requests
           SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = NULL
           WHERE id = ? AND status = 'PENDING'`,
          [action, id]
        );
        await connection.commit();

        return res.status(200).json({
          id,
          status: action,
          reviewedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (connection) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            console.error('Recruiter decision rollback failed:', rollbackError);
          }
        }
        return next(error);
      } finally {
        connection?.release();
      }
    }
  );

  return router;
}