import { Router } from 'express';
import {
  requireAuth,
  requireRoles,
  requireApprovedRecruiter,
} from './security.js';

function dateOnlyString(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ? null : trimmed;
}

function normalizeBranchFilter(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();

  if (!normalized || /^(all|all branches)$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

export function createRbacRouter(dbPool) {
  const router = Router();

  router.get(
    '/admin/placement-summary',
    requireAuth,
    requireRoles('ADMIN'),
    async (req, res, next) => {
      const startDate = dateOnlyString(req.query?.startDate);
      const endDate = dateOnlyString(req.query?.endDate);
      const branchFilter = normalizeBranchFilter(req.query?.branch);

      if (
        (req.query?.startDate !== undefined && !startDate) ||
        (req.query?.endDate !== undefined && !endDate)
      ) {
        return res.status(400).json({
          message: 'Start date and end date must be valid YYYY-MM-DD values.',
        });
      }

      if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({
          message: 'The start date must be before or equal to the end date.',
        });
      }

      try {
        const values = [];
        let whereClause = 'WHERE 1 = 1';

        if (branchFilter) {
          whereClause += ' AND LOWER(TRIM(s.course)) = ?';
          values.push(branchFilter.toLowerCase());
        }

        if (startDate) {
          whereClause += ' AND DATE(a.applied_at) >= ?';
          values.push(startDate);
        }

        if (endDate) {
          whereClause += ' AND DATE(a.applied_at) <= ?';
          values.push(endDate);
        }

        const [summaryRows] = await dbPool.execute(
          `SELECT COUNT(*) AS total_applications,
                  SUM(CASE WHEN a.status = 'Selected' THEN 1 ELSE 0 END) AS total_offers
           FROM applications a
           INNER JOIN students s ON s.id = a.student_id
           ${whereClause}`,
          values,
        );

        const [branchRows] = await dbPool.execute(
          `SELECT DISTINCT TRIM(course) AS branch
           FROM students
           WHERE course IS NOT NULL
             AND TRIM(course) <> ''
           ORDER BY TRIM(course) ASC`
        );

        const totalApplications = Number(summaryRows[0]?.total_applications || 0);
        const totalOffers = Number(summaryRows[0]?.total_offers || 0);
        const selectionRate = totalApplications === 0
          ? 0
          : Number(((totalOffers / totalApplications) * 100).toFixed(2));

        return res.status(200).json({
          totalApplications,
          totalOffers,
          selectionRate,
          branch: branchFilter || 'All Branches',
          startDate: startDate || null,
          endDate: endDate || null,
          branches: branchRows.map((row) => row.branch).filter(Boolean),
          note: 'Selected is used as the offer-count proxy because the system does not maintain a separate offers table.',
        });
      } catch (error) {
        return next(error);
      }
    }
  );

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