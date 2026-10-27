import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { rateLimit } from 'express-rate-limit';
import { pool } from './db.js';
import { requireAuth, requireRoles, signJwt } from './security.js';

const router = Router();
const otpLifetimeMinutes = 10;
const maximumAttempts = 5;
const resendDelaySeconds = 60;
const loginMaximumAttempts = 5;

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

function normalizedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function allowedInstitutionDomains() {
  return (process.env.INSTITUTION_EMAIL_DOMAINS || '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

function isInstitutionalEmail(email) {
  const domain = email.split('@')[1] || '';
  return allowedInstitutionDomains().includes(domain);
}

function otpDigest(email, otp) {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('OTP_HMAC_SECRET must contain at least 32 characters.');
  }
  return createHmac('sha256', secret).update(`${email}:${otp}`).digest('hex');
}

function createMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) {
    throw new Error('Email delivery is not configured.');
  }
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass: password },
  });
}

function validRegistration(body) {
  return typeof body.fullName === 'string'
    && body.fullName.trim().length >= 2
    && body.fullName.trim().length <= 120
    && typeof body.studentId === 'string'
    && body.studentId.trim().length >= 1
    && body.studentId.trim().length <= 64
    && typeof body.course === 'string'
    && body.course.trim().length >= 2
    && body.course.trim().length <= 120
    && typeof body.password === 'string'
    && body.password.length >= 12
    && Buffer.byteLength(body.password, 'utf8') <= 72;
}

router.post('/register/request-otp', requestLimiter, async (req, res, next) => {
  try {
    const email = normalizedEmail(req.body.email);
    if (!validRegistration(req.body) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter valid registration details. Passwords must be at least 12 characters.' });
    }
    if (!isInstitutionalEmail(email)) {
      const domains = allowedInstitutionDomains();
      const domainHint = domains.length > 0
        ? ` Use an email ending in ${domains.map((domain) => `@${domain}`).join(' or ')}.`
        : ' Institutional domains are not configured.';
      return res.status(400).json({
        message: `This email domain is not allowed.${domainHint}`,
      });
    }

    const [existingStudents] = await pool.execute(
      'SELECT id FROM students WHERE institutional_email = ? OR student_id = ? LIMIT 1',
      [email, req.body.studentId.trim()],
    );
    if (existingStudents.length > 0) {
      return res.status(409).json({ message: 'An account already exists for these registration details.' });
    }

    const [existingOtp] = await pool.execute(
      'SELECT sent_at FROM registration_otps WHERE institutional_email = ? LIMIT 1',
      [email],
    );
    if (existingOtp.length > 0) {
      const sentAt = new Date(existingOtp[0].sent_at).getTime();
      if (Date.now() - sentAt < resendDelaySeconds * 1000) {
        return res.status(429).json({ message: 'Please wait a minute before requesting another code.' });
      }
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await pool.execute(
      `INSERT INTO registration_otps
        (institutional_email, full_name, student_id, course, password_hash, otp_digest, expires_at, sent_at, failed_attempts)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), UTC_TIMESTAMP(), 0)
       ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name), student_id = VALUES(student_id), course = VALUES(course),
        password_hash = VALUES(password_hash), otp_digest = VALUES(otp_digest),
        expires_at = VALUES(expires_at), sent_at = VALUES(sent_at), failed_attempts = 0`,
      [email, req.body.fullName.trim(), req.body.studentId.trim(), req.body.course.trim(), passwordHash,
        otpDigest(email, otp), otpLifetimeMinutes],
    );

    try {
      const mailer = createMailer();
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your OIPP registration code',
        text: `Your verification code is ${otp}. It expires in ${otpLifetimeMinutes} minutes. If you did not request this, ignore this email.`,
      });
    } catch (error) {
      console.error('OTP email delivery failed:', error.message);

      await pool.execute(
        'DELETE FROM registration_otps WHERE institutional_email = ?',
        [email]
      );

      return res.status(503).json({
        message: 'We could not send the verification email. Please try again later.'
      });
    }

    return res.status(202).json({ message: 'Verification code sent to your institutional email.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/register/verify-otp', verifyLimiter, async (req, res, next) => {
  const email = normalizedEmail(req.body.email);
  const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: 'Enter the six-digit code sent to your email.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT * FROM registration_otps WHERE institutional_email = ? FOR UPDATE',
      [email],
    );
    const challenge = rows[0];
    if (!challenge) {
      await connection.rollback();
      return res.status(400).json({ message: 'This code is invalid or expired. Request a new code.' });
    }

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await connection.execute('DELETE FROM registration_otps WHERE institutional_email = ?', [email]);
      await connection.commit();
      return res.status(400).json({ message: 'This code has expired. Request a new code.' });
    }

    if (challenge.failed_attempts >= maximumAttempts) {
      await connection.execute('DELETE FROM registration_otps WHERE institutional_email = ?', [email]);
      await connection.commit();
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
    }

    const submittedDigest = Buffer.from(otpDigest(email, otp), 'hex');
    const savedDigest = Buffer.from(challenge.otp_digest, 'hex');
    const matches = submittedDigest.length === savedDigest.length
      && timingSafeEqual(submittedDigest, savedDigest);
    if (!matches) {
      const nextAttempts = challenge.failed_attempts + 1;
      if (nextAttempts >= maximumAttempts) {
        await connection.execute('DELETE FROM registration_otps WHERE institutional_email = ?', [email]);
      } else {
        await connection.execute(
          'UPDATE registration_otps SET failed_attempts = ? WHERE institutional_email = ?',
          [nextAttempts, email],
        );
      }
      await connection.commit();
      return res.status(400).json({ message: 'That code is incorrect. Check it and try again.' });
    }

    await connection.execute(
      `INSERT INTO students (full_name, institutional_email, student_id, course, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [challenge.full_name, email, challenge.student_id, challenge.course, challenge.password_hash],
    );
    await connection.execute('DELETE FROM registration_otps WHERE institutional_email = ?', [email]);
    await connection.commit();
    return res.status(201).json({ message: 'Your student account is verified and ready.' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Failed to roll back OTP verification transaction:', rollbackError);
      }
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account already exists for these registration details.' });
    }
    return next(error);
  } finally {
    connection?.release();
  }
});

router.post('/login', async (req, res, next) => {
  const email = normalizedEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, password_hash, failed_login_attempts, locked_until
       FROM students WHERE institutional_email = ? LIMIT 1 FOR UPDATE`,
      [email],
    );
    const student = rows[0];

    if (!student) {
      await connection.rollback();
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const lockedUntil = student.locked_until ? new Date(student.locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      await connection.rollback();
      return res.status(423).json({ message: 'Account temporarily locked. Try again later.' });
    }

    const passwordMatches = await bcrypt.compare(password, student.password_hash);
    if (!passwordMatches) {
      const failedAttempts = (student.failed_login_attempts || 0) + 1;
      await connection.execute(
        `UPDATE students
         SET failed_login_attempts = ?, locked_until = ?
         WHERE id = ?`,
        [
          failedAttempts,
          failedAttempts >= loginMaximumAttempts
            ? new Date(Date.now() + lockoutDurationMinutes() * 60 * 1000)
            : null,
          student.id,
        ],
      );
      await connection.commit();
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    await connection.execute(
      'UPDATE students SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [student.id],
    );
    await connection.commit();

    return res.json({
      token: signJwt(String(student.id), 'student'),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Failed to roll back login transaction:', rollbackError);
      }
    }
    return next(error);
  } finally {
    connection?.release();
  }
});

router.post('/recruiter/login', async (req, res, next) => {
  const email = normalizedEmail(req.body?.email);
  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.',
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, password_hash, status
       FROM recruiter_requests
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    const recruiter = rows[0];

    if (
      !recruiter ||
      typeof recruiter.password_hash !== 'string' ||
      !(await bcrypt.compare(password, recruiter.password_hash))
    ) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    if (
      typeof recruiter.status !== 'string' ||
      recruiter.status.toUpperCase() !== 'APPROVED'
    ) {
      return res.status(403).json({
        message: 'Recruiter account is not approved.',
      });
    }

    return res.json({
      token: signJwt(String(recruiter.id), 'RECRUITER'),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        message: 'Recruiter account storage has not been initialized.',
      });
    }

    return next(error);
  }
});
router.post('/admin/login', adminLoginLimiter, async (req, res, next) => {
  const email = normalizedEmail(req.body?.email);
  const password =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  const configuredEmail = normalizedEmail(process.env.ADMIN_EMAIL);
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';

  const validHash =
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash);

  if (
    !configuredEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ||
    !validHash
  ) {
    return res.status(503).json({
      message: 'Administrator login is not configured.',
    });
  }

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.',
    });
  }

  try {
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (email !== configuredEmail || !passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    return res.json({
      token: signJwt(`admin:${configuredEmail}`, 'ADMIN'),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
  } catch (error) {
    return next(error);
  }
});
router.get('/me', requireAuth, requireRoles('STUDENT'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM students WHERE id = ? LIMIT 1',
      [req.auth.sub],
    );
    if (!rows[0]) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    return res.json({ id: rows[0].id, role: req.auth.role });
  } catch (error) {
    return next(error);
  }
});

function lockoutDurationMinutes() {
  const configured = Number(process.env.LOGIN_LOCKOUT_MINUTES);
  return Number.isInteger(configured) && configured > 0 ? configured : 15;
}

export default router;