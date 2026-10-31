import { Router } from 'express';
import {
  requireAuth,
  requireRoles,
  requireApprovedRecruiter,
} from './security.js';

// F-017: approved recruiters view applicants for THEIR OWN listings and mark them
// Shortlisted or Rejected. Ownership is checked in the database query every time
// (the listing's recruiter_id must equal the recruiter in the verified token), and a
// listing that belongs to someone else looks exactly like one that does not exist.
// The student's application tracker (GET /api/student/applications) reads the same
// applications.status column, so a change here shows up there immediately.

const DECISIONS = ['Shortlisted', 'Rejected'];
// Statuses the recruiter may change. Interview/Selected are set elsewhere and are
// not overwritten from this screen.
const CHANGEABLE = ['Applied', 'Shortlisted', 'Rejected'];

const recruiterOnly = [
  requireAuth,
  requireRoles('RECRUITER'),
  requireApprovedRecruiter,
];

function positiveId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value)
    && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
}

function recruiterId(req) {
  return positiveId(req.auth?.sub);
}

function readSnapshot(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
}

// Only what a recruiter needs to review a candidate. No phone number, no resume
// file contents, no password data.
function presentApplicant(row) {
  const profile = readSnapshot(row.profile_snapshot);
  return {
    applicationId: row.id,
    status: row.status,
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
    resumeName: row.resume_name,
    student: {
      fullName: profile.full_name ?? null,
      email: profile.institutional_email ?? null,
      studentId: profile.student_id ?? null,
      course: profile.course ?? null,
      cgpa: profile.cgpa ?? null,
      location: profile.location ?? null,
      headline: profile.headline ?? null,
      skills: profile.skills ?? null,
      projects: profile.projects ?? null,
    },
  };
}

export function createRecruiterApplicantsRouter(dbPool) {
  const router = Router();

  router.get('/recruiter/listings/:listingId/applicants', ...recruiterOnly, async (req, res, next) => {
    try {
      const listingId = positiveId(req.params.listingId);
      if (!listingId) return res.status(400).json({ message: 'Listing ID is invalid.' });

      const [owned] = await dbPool.execute(
        'SELECT id, title FROM internship_listings WHERE id = ? AND recruiter_id = ? LIMIT 1',
        [listingId, recruiterId(req)]
      );
      if (!owned[0]) return res.status(404).json({ message: 'Listing not found.' });

      const [rows] = await dbPool.execute(
        `SELECT a.id, a.status, a.applied_at, a.updated_at, a.resume_name, a.profile_snapshot
         FROM applications a
         JOIN internship_listings l ON l.id = a.listing_id
         WHERE a.listing_id = ? AND l.recruiter_id = ?
         ORDER BY a.applied_at ASC`,
        [listingId, recruiterId(req)]
      );

      return res.json({
        listing: { id: owned[0].id, title: owned[0].title },
        applicants: rows.map(presentApplicant),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/recruiter/applications/:applicationId/status', ...recruiterOnly, async (req, res, next) => {
    try {
      const applicationId = positiveId(req.params.applicationId);
      if (!applicationId) return res.status(400).json({ message: 'Application ID is invalid.' });

      const status = req.body?.status;
      if (!DECISIONS.includes(status)) {
        return res.status(400).json({ message: 'Status must be Shortlisted or Rejected.' });
      }

      const [rows] = await dbPool.execute(
        `SELECT a.id, a.status
         FROM applications a
         JOIN internship_listings l ON l.id = a.listing_id
         WHERE a.id = ? AND l.recruiter_id = ? LIMIT 1`,
        [applicationId, recruiterId(req)]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Application not found.' });

      if (!CHANGEABLE.includes(rows[0].status)) {
        return res.status(409).json({
          message: `An application in "${rows[0].status}" status cannot be changed here.`,
        });
      }

      const [result] = await dbPool.execute(
        'UPDATE applications SET status = ? WHERE id = ? AND status = ?',
        [status, applicationId, rows[0].status]
      );
      if (result.affectedRows === 0) {
        return res.status(409).json({ message: 'The application was changed by someone else. Reload and try again.' });
      }

      return res.json({ id: applicationId, status });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
