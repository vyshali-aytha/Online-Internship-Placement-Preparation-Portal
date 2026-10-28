import { Router } from 'express';
import { requireAuth, requireRoles } from './security.js';

function sqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseDateTime(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const milliseconds = Date.parse(value);

  return Number.isFinite(milliseconds)
    ? new Date(milliseconds)
    : null;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function createMockInterviewRouter(dbPool) {
  const router = Router();

  // Students can only see future slots that have not been booked.
  router.get(
    '/mock-interviews/slots',
    requireAuth,
    requireRoles('STUDENT'),
    async (_req, res, next) => {
      try {
        const [rows] = await dbPool.execute(`
          SELECT s.id, s.starts_at, s.ends_at
          FROM mock_interview_slots s
          LEFT JOIN mock_interview_bookings b ON b.slot_id = s.id
          WHERE b.id IS NULL
            AND s.starts_at > UTC_TIMESTAMP()
          ORDER BY s.starts_at ASC
        `);

        return res.json(rows);
      } catch (error) {
        return next(error);
      }
    }
  );

  // A slot is booked transactionally. A unique slot_id in the database
  // is the final protection against two students booking the same slot.
  router.post(
    '/mock-interviews/bookings',
    requireAuth,
    requireRoles('STUDENT'),
    async (req, res, next) => {
      const slotId = positiveId(req.body?.slotId);

      if (!slotId) {
        return res.status(400).json({
          message: 'A valid interview slot is required.',
        });
      }

      let connection;

      try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [slots] = await connection.execute(
          `SELECT id, starts_at
           FROM mock_interview_slots
           WHERE id = ? AND starts_at > UTC_TIMESTAMP()
           FOR UPDATE`,
          [slotId]
        );

        if (slots.length === 0) {
          await connection.rollback();

          return res.status(404).json({
            message: 'This interview slot does not exist or is no longer available.',
          });
        }

        const [result] = await connection.execute(
          `INSERT INTO mock_interview_bookings (slot_id, student_id)
           VALUES (?, ?)`,
          [slotId, req.auth.sub]
        );

        await connection.commit();

        return res.status(201).json({
          bookingId: result.insertId,
          slotId,
          message: 'Mock interview booked successfully.',
        });
      } catch (error) {
        if (connection) {
          try {
            await connection.rollback();
          } catch {
            // Preserve the original error.
          }
        }

        if (error?.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            message: 'This slot has already been booked. Choose another slot.',
          });
        }

        return next(error);
      } finally {
        connection?.release();
      }
    }
  );

  // Students can only retrieve bookings belonging to their own account.
  router.get(
    '/mock-interviews/my-bookings',
    requireAuth,
    requireRoles('STUDENT'),
    async (req, res, next) => {
      try {
        const [rows] = await dbPool.execute(
          `SELECT
             b.id AS booking_id,
             b.feedback,
             b.feedback_at,
             b.created_at,
             s.id AS slot_id,
             s.starts_at,
             s.ends_at
           FROM mock_interview_bookings b
           INNER JOIN mock_interview_slots s ON s.id = b.slot_id
           WHERE b.student_id = ?
           ORDER BY s.starts_at DESC`,
          [req.auth.sub]
        );

        return res.json(rows);
      } catch (error) {
        return next(error);
      }
    }
  );

  // Administrators create future slots for students to book.
  router.post(
    '/mock-interviews/admin/slots',
    requireAuth,
    requireRoles('ADMIN'),
    async (req, res, next) => {
      const startsAt = parseDateTime(req.body?.startsAt);
      const endsAt = parseDateTime(req.body?.endsAt);

      if (
        !startsAt ||
        !endsAt ||
        startsAt.getTime() <= Date.now() ||
        endsAt.getTime() <= startsAt.getTime()
      ) {
        return res.status(400).json({
          message: 'Provide a future start time and an end time after the start.',
        });
      }

      try {
        const [result] = await dbPool.execute(
          `INSERT INTO mock_interview_slots (starts_at, ends_at, created_by)
           VALUES (?, ?, ?)`,
          [
            sqlDateTime(startsAt),
            sqlDateTime(endsAt),
            req.auth.sub,
          ]
        );

        return res.status(201).json({
          id: result.insertId,
          starts_at: sqlDateTime(startsAt),
          ends_at: sqlDateTime(endsAt),
        });
      } catch (error) {
        if (error?.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            message: 'That interview slot already exists.',
          });
        }

        return next(error);
      }
    }
  );

  // Administrators can review all bookings and their current feedback.
  router.get(
    '/mock-interviews/admin/bookings',
    requireAuth,
    requireRoles('ADMIN'),
    async (_req, res, next) => {
      try {
        const [rows] = await dbPool.execute(
          `SELECT
             b.id AS booking_id,
             b.student_id,
             st.full_name,
             st.institutional_email,
             b.feedback,
             b.feedback_at,
             b.created_at,
             s.id AS slot_id,
             s.starts_at,
             s.ends_at
           FROM mock_interview_bookings b
           INNER JOIN mock_interview_slots s ON s.id = b.slot_id
           INNER JOIN students st ON st.id = b.student_id
           ORDER BY s.starts_at DESC`
        );

        return res.json(rows);
      } catch (error) {
        return next(error);
      }
    }
  );

  // Only authenticated administrators may create or update interview feedback.
  router.patch(
    '/mock-interviews/admin/bookings/:bookingId/feedback',
    requireAuth,
    requireRoles('ADMIN'),
    async (req, res, next) => {
      const bookingId = positiveId(req.params.bookingId);
      const feedback =
        typeof req.body?.feedback === 'string'
          ? req.body.feedback.trim()
          : '';

      if (!bookingId) {
        return res.status(400).json({
          message: 'A valid booking ID is required.',
        });
      }

      if (feedback.length < 1 || feedback.length > 5000) {
        return res.status(400).json({
          message: 'Feedback must contain between 1 and 5000 characters.',
        });
      }

      try {
        const [existing] = await dbPool.execute(
          'SELECT id FROM mock_interview_bookings WHERE id = ? LIMIT 1',
          [bookingId]
        );

        if (existing.length === 0) {
          return res.status(404).json({
            message: 'The interview booking was not found.',
          });
        }

        await dbPool.execute(
          `UPDATE mock_interview_bookings
           SET feedback = ?, feedback_by = ?, feedback_at = UTC_TIMESTAMP()
           WHERE id = ?`,
          [feedback, req.auth.sub, bookingId]
        );

        return res.json({
          bookingId,
          feedback,
          message: 'Interview feedback saved.',
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  return router;
}