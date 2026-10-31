import { Router } from 'express';
import { requireAuth, requireRoles } from './security.js';

// F-007: students browse active internship and placement listings.
// Only OPEN listings are returned, so drafts and closed listings are never shown
// as active opportunities.
//
// F-008: optional filters, all combined with AND:
//   ?role=...     listing title contains the text (case-insensitive)
//   ?location=... listing location contains the text (case-insensitive)
//   ?minCgpa=...  listings whose required CGPA is at most this value;
//                 listings with no CGPA requirement are always included

const BASE_SQL = `SELECT id, title, company_name, description, location,
        listing_type, min_cgpa, created_at
 FROM internship_listings
 WHERE status = 'OPEN'`;

const ORDER_SQL = ' ORDER BY created_at DESC';

// Make "%" and "_" typed by the student match literally instead of acting as wildcards.
function likePattern(value) {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

function textFilter(value) {
  if (value === undefined) return { value: null };
  if (typeof value !== 'string' || value.length > 100) return { error: true };
  const trimmed = value.trim();
  return { value: trimmed === '' ? null : trimmed };
}

export function parseListingFilters(query = {}) {
  const role = textFilter(query.role);
  const location = textFilter(query.location);
  if (role.error || location.error) return { error: 'Filters must be short text values.' };

  let minCgpa = null;
  if (query.minCgpa !== undefined && query.minCgpa !== '') {
    if (typeof query.minCgpa !== 'string' || !/^\d+(\.\d+)?$/.test(query.minCgpa.trim())) {
      return { error: 'Minimum CGPA must be a number between 0 and 10.' };
    }
    minCgpa = Number(query.minCgpa);
    if (!(minCgpa >= 0 && minCgpa <= 10)) {
      return { error: 'Minimum CGPA must be a number between 0 and 10.' };
    }
  }

  return { filters: { role: role.value, location: location.value, minCgpa } };
}

export function buildListingsQuery({ role = null, location = null, minCgpa = null } = {}) {
  let sql = BASE_SQL;
  const params = [];

  if (role) {
    sql += ' AND title LIKE ?';
    params.push(likePattern(role));
  }
  if (location) {
    sql += ' AND location LIKE ?';
    params.push(likePattern(location));
  }
  if (minCgpa !== null) {
    sql += ' AND (min_cgpa IS NULL OR min_cgpa <= ?)';
    params.push(minCgpa);
  }

  return { sql: sql + ORDER_SQL, params };
}

export function createListingsRouter(dbPool) {
  const router = Router();

  router.get('/listings', requireAuth, requireRoles('STUDENT'), async (req, res, next) => {
    try {
      const parsed = parseListingFilters(req.query);
      if (parsed.error) return res.status(400).json({ message: parsed.error });

      const { sql, params } = buildListingsQuery(parsed.filters);
      const [rows] = await dbPool.execute(sql, params);
      return res.json({ listings: rows });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
