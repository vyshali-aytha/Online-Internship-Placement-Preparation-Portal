import { Router } from 'express';
import {
  requireAuth,
  requireRoles,
  requireApprovedRecruiter,
} from './security.js';

// F-016: approved recruiters create and publish internship/placement listings.
// A listing is DRAFT until published (OPEN). Students only see OPEN listings
// (GET /api/student/listings), so publishing is what makes it available to them.

const LISTING_TYPES = ['Internship', 'Placement'];

const recruiterOnly = [
  requireAuth,
  requireRoles('RECRUITER'),
  requireApprovedRecruiter,
];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function recruiterId(req) {
  const value = req.auth?.sub;
  return typeof value === 'string' && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : null;
}

function listingId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value)
    && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
}

export function parseListing(body = {}) {
  const title = text(body.title);
  const companyName = text(body.companyName);
  const description = text(body.description);
  const location = text(body.location);
  const listingType = text(body.listingType);

  let minCgpa = null;
  if (body.minCgpa !== undefined && body.minCgpa !== null && body.minCgpa !== '') {
    minCgpa = Number(body.minCgpa);
  }

  const valid = title.length >= 2 && title.length <= 180
    && companyName.length >= 2 && companyName.length <= 150
    && description.length >= 1 && description.length <= 5000
    && location.length >= 1 && location.length <= 120
    && LISTING_TYPES.includes(listingType)
    && (minCgpa === null || (Number.isFinite(minCgpa) && minCgpa >= 0 && minCgpa <= 10));

  return valid
    ? { title, companyName, description, location, listingType, minCgpa }
    : null;
}

export function createRecruiterListingsRouter(dbPool) {
  const router = Router();

  // Create a listing. It is a DRAFT unless the recruiter asks to publish it now.
  // The owner always comes from the verified token, never from the request body.
  router.post('/recruiter/listings', ...recruiterOnly, async (req, res, next) => {
    try {
      const listing = parseListing(req.body);
      if (!listing) {
        return res.status(400).json({
          message: 'Provide title, company, description, location, and type (Internship or Placement). Minimum CGPA must be between 0 and 10.',
        });
      }

      const status = req.body.publish === true ? 'OPEN' : 'DRAFT';

      const [result] = await dbPool.execute(
        `INSERT INTO internship_listings
           (recruiter_id, title, company_name, description, location,
            listing_type, min_cgpa, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recruiterId(req), listing.title, listing.companyName,
          listing.description, listing.location, listing.listingType,
          listing.minCgpa, status,
        ]
      );

      return res.status(201).json({ id: result.insertId, status });
    } catch (error) {
      return next(error);
    }
  });

  // Publish one of the recruiter's own draft listings.
  router.post('/recruiter/listings/:id/publish', ...recruiterOnly, async (req, res, next) => {
    try {
      const id = listingId(req.params.id);
      if (!id) return res.status(400).json({ message: 'Listing ID is invalid.' });

      const [rows] = await dbPool.execute(
        'SELECT id, status FROM internship_listings WHERE id = ? AND recruiter_id = ? LIMIT 1',
        [id, recruiterId(req)]
      );

      // Another recruiter's listing looks exactly like a missing one.
      if (!rows[0]) return res.status(404).json({ message: 'Listing not found.' });

      if (rows[0].status === 'OPEN') return res.json({ id, status: 'OPEN' });
      if (rows[0].status === 'CLOSED') {
        return res.status(409).json({ message: 'A closed listing cannot be published again.' });
      }

      await dbPool.execute(
        `UPDATE internship_listings SET status = 'OPEN'
         WHERE id = ? AND recruiter_id = ? AND status = 'DRAFT'`,
        [id, recruiterId(req)]
      );

      return res.json({ id, status: 'OPEN' });
    } catch (error) {
      return next(error);
    }
  });

  // Close one of the recruiter's own open listings (students stop seeing it).
  router.post('/recruiter/listings/:id/close', ...recruiterOnly, async (req, res, next) => {
    try {
      const id = listingId(req.params.id);
      if (!id) return res.status(400).json({ message: 'Listing ID is invalid.' });

      const [rows] = await dbPool.execute(
        'SELECT id, status FROM internship_listings WHERE id = ? AND recruiter_id = ? LIMIT 1',
        [id, recruiterId(req)]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Listing not found.' });

      await dbPool.execute(
        `UPDATE internship_listings SET status = 'CLOSED'
         WHERE id = ? AND recruiter_id = ?`,
        [id, recruiterId(req)]
      );

      return res.json({ id, status: 'CLOSED' });
    } catch (error) {
      return next(error);
    }
  });

  // The recruiter's own listings, drafts included.
  router.get('/recruiter/listings', ...recruiterOnly, async (req, res, next) => {
    try {
      const [rows] = await dbPool.execute(
        `SELECT id, title, company_name, description, location, listing_type,
                min_cgpa, status, created_at
         FROM internship_listings
         WHERE recruiter_id = ?
         ORDER BY created_at DESC`,
        [recruiterId(req)]
      );
      return res.json({ listings: rows });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
