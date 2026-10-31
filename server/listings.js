import { Router } from 'express';
import { requireAuth, requireRoles } from './security.js';

// F-007: students browse active internship and placement listings.
// Only OPEN listings are returned, so drafts and closed listings are never shown
// as active opportunities. Both listing types (Internship, Placement) are included.

export const LISTINGS_SQL = `SELECT id, title, company_name, description, location,
        listing_type, min_cgpa, created_at
 FROM internship_listings
 WHERE status = 'OPEN'
 ORDER BY created_at DESC`;

export function createListingsRouter(dbPool) {
  const router = Router();

  router.get('/listings', requireAuth, requireRoles('STUDENT'), async (_req, res, next) => {
    try {
      const [rows] = await dbPool.execute(LISTINGS_SQL);
      return res.json({ listings: rows });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
