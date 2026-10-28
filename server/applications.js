import { Router } from 'express';
import { pool } from './db.js';
import { requireAuth, requireRoles } from './security.js';

const router = Router();
const validId = (value) =>
  typeof value === 'string' && /^[1-9]\d*$/.test(value) &&
  Number.isSafeInteger(Number(value));

router.get('/listings', requireAuth, requireRoles('STUDENT'), async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, company_name, description, location, listing_type, created_at
       FROM internship_listings WHERE status = 'OPEN' ORDER BY created_at DESC`
    );
    return res.json({ listings: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/listings/:listingId/applications', requireAuth, requireRoles('STUDENT'), async (req, res, next) => {
  if (!validId(req.params.listingId)) {
    return res.status(400).json({ message: 'Listing ID is invalid.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [listings] = await connection.execute(
      `SELECT id FROM internship_listings
       WHERE id = ? AND status = 'OPEN' LIMIT 1 FOR UPDATE`,
      [req.params.listingId]
    );
    if (!listings[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Open listing not found.' });
    }

    const [students] = await connection.execute(
      `SELECT s.id, s.full_name, s.institutional_email, s.student_id, s.course,
              p.phone, p.location, p.headline, p.bio, p.cgpa, p.skills, p.projects,
              r.original_name, r.mime_type, r.file_size, r.file_data
       FROM students s
       LEFT JOIN student_profiles p ON p.student_id = s.id
       LEFT JOIN student_resumes r ON r.student_id = s.id
       WHERE s.id = ? LIMIT 1`,
      [req.auth.sub]
    );
    const student = students[0];

    if (!student) {
      await connection.rollback();
      return res.status(404).json({ message: 'Student account not found.' });
    }
    if (!student.original_name || !student.file_data) {
      await connection.rollback();
      return res.status(400).json({ message: 'Upload a resume before applying.' });
    }

    const profile = {
      full_name: student.full_name,
      institutional_email: student.institutional_email,
      student_id: student.student_id,
      course: student.course,
      phone: student.phone,
      location: student.location,
      headline: student.headline,
      bio: student.bio,
      cgpa: student.cgpa,
      skills: student.skills,
      projects: student.projects
    };

    const [result] = await connection.execute(
      `INSERT INTO applications
       (student_id, listing_id, profile_snapshot, resume_name,
        resume_mime_type, resume_file_size, resume_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.auth.sub, req.params.listingId, JSON.stringify(profile),
        student.original_name, student.mime_type, student.file_size, student.file_data
      ]
    );

    await connection.commit();
    return res.status(201).json({
      message: 'Application submitted successfully.',
      application: { id: result.insertId, listingId: Number(req.params.listingId), status: 'Applied' }
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'You have already applied to this listing.' });
    }
    return next(error);
  } finally {
    connection?.release();
  }
});

export default router;
