import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';

// F-020: prospective recruiters submit an account request.
// The request is always stored as PENDING. It grants no recruiter access
// until an administrator approves it (recruiter login and
// /api/recruiter/access both check the live status in recruiter_requests).

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validRequest({ fullName, email, companyName, password }) {
  return fullName.length >= 2
    && fullName.length <= 100
    && companyName.length >= 2
    && companyName.length <= 150
    && email.length <= 255
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && typeof password === 'string'
    && password.length >= 12
    && Buffer.byteLength(password, 'utf8') <= 72; // bcrypt limit, same as student rule
}

export function createRecruiterRequestRouter(dbPool, { limit = 5 } = {}) {
  const router = Router();

  const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  router.post('/recruiter-requests', submitLimiter, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const fullName = text(body.fullName);
      const companyName = text(body.companyName);
      const email = text(body.email).toLowerCase();
      const password = body.password;

      if (!validRequest({ fullName, email, companyName, password })) {
        return res.status(400).json({
          message: 'Please check the submitted fields.',
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // The status is fixed to PENDING here; a client-supplied status is ignored.
      const [result] = await dbPool.execute(
        `INSERT INTO recruiter_requests
           (full_name, email, company_name, password_hash, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [fullName, email, companyName, passwordHash]
      );

      return res.status(201).json({
        id: result.insertId,
        email,
        status: 'PENDING',
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'A request with this email already exists.',
        });
      }
      return next(error);
    }
  });

  return router;
}
