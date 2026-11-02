import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { pool } from './db.js';
import { requireAuth, requireRoles } from './security.js';
import { allowedResumeTypes, resumeMatchesSignature, validateProfile } from './student-validation.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const router = Router();
const maximumResumeSize = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maximumResumeSize, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, allowedResumeTypes.get(extension) === file.mimetype);
  },
});

router.get('/profile', requireAuth, requireRoles('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.full_name, s.institutional_email, s.student_id, s.course,
              p.phone, p.location, p.headline, p.bio, p.cgpa, p.skills, p.projects,
              p.updated_at
       FROM students s
       LEFT JOIN student_profiles p ON p.student_id = s.id
       WHERE s.id = ? LIMIT 1`,
      [req.auth.sub],
    );
    if (!rows[0]) return res.status(404).json({ message: 'Student profile not found.' });
    return res.json({ profile: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/profile', requireAuth, requireRoles('student'), async (req, res, next) => {
  try {
    const profile = validateProfile(req.body);
    await pool.execute(
      `INSERT INTO student_profiles
        (student_id, phone, location, headline, bio, cgpa, skills, projects)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        phone = VALUES(phone), location = VALUES(location), headline = VALUES(headline),
        bio = VALUES(bio), cgpa = VALUES(cgpa), skills = VALUES(skills), projects = VALUES(projects)`,
      [req.auth.sub, profile.phone, profile.location, profile.headline, profile.bio,
        profile.cgpa, profile.skills, profile.projects],
    );
    return res.json({ message: 'Profile saved.', profile });
  } catch (error) {
    if (error instanceof Error && (error.message.endsWith('is invalid.') || error.message.startsWith('cgpa') || error.message === 'Profile payload is invalid.')) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
});

router.put('/resume', requireAuth, requireRoles('student'), (req, res, next) => {
  upload.single('resume')(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Resume must be 5 MB or smaller.' });
      }
      return res.status(400).json({ message: 'Upload a single PDF, DOC, or DOCX resume.' });
    }
    if (!req.file || !resumeMatchesSignature(req.file)) {
      return res.status(400).json({ message: 'Upload a valid PDF, DOC, or DOCX resume.' });
    }
    try {
      const extension = path.extname(req.file.originalname).toLowerCase();
      await pool.execute(
        `INSERT INTO student_resumes
          (student_id, original_name, mime_type, file_size, file_data)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          original_name = VALUES(original_name), mime_type = VALUES(mime_type),
          file_size = VALUES(file_size), file_data = VALUES(file_data),
          uploaded_at = CURRENT_TIMESTAMP`,
        [req.auth.sub, req.file.originalname, allowedResumeTypes.get(extension),
          req.file.size, req.file.buffer],
      );
      return res.json({ message: 'Resume uploaded.', fileName: req.file.originalname, fileSize: req.file.size });
    } catch (error) {
      return next(error);
    }
  });
});

router.get('/resume', requireAuth, requireRoles('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT original_name, mime_type, file_size, file_data FROM student_resumes WHERE student_id = ? LIMIT 1',
      [req.auth.sub],
    );
    if (!rows[0]) return res.status(404).json({ message: 'No resume has been uploaded.' });
    res.type(rows[0].mime_type);
    res.set('Content-Disposition', `attachment; filename="${rows[0].original_name.replace(/["\\\r\n]/g, '_')}"`);
    res.set('Content-Length', String(rows[0].file_size));
    return res.send(rows[0].file_data);
  } catch (error) {
    return next(error);
  }
});


// Generate a downloadable PDF resume using the student's saved profile.
router.get('/resume/generated', requireAuth, requireRoles('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.full_name, s.institutional_email, s.student_id, s.course,
              p.phone, p.location, p.headline, p.bio, p.cgpa, p.skills, p.projects
       FROM students s
       LEFT JOIN student_profiles p ON p.student_id = s.id
       WHERE s.id = ? LIMIT 1`,
      [req.auth.sub],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const profile = rows[0];
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595.28, 841.89]);
    let y = 790;
    const margin = 50;
    const width = 495;

    const clean = (value) =>
      String(value ?? '')
        .normalize('NFKD')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();

    function addPageIfNeeded(requiredSpace = 30) {
      if (y < requiredSpace + 50) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
    }

    function drawSection(label, value) {
      const text = clean(value);
      if (!text) return;

      addPageIfNeeded(55);

      page.drawText(label.toUpperCase(), {
        x: margin,
        y,
        size: 11,
        font: boldFont,
        color: rgb(0.15, 0.25, 0.35),
      });

      y -= 20;

      const words = text.split(/\s+/);
      let line = '';

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;

        if (font.widthOfTextAtSize(testLine, 10) > width) {
          addPageIfNeeded(20);
          page.drawText(line, {
            x: margin,
            y,
            size: 10,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
          y -= 15;
          line = word;
        } else {
          line = testLine;
        }
      }

      if (line) {
        addPageIfNeeded(20);
        page.drawText(line, {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= 15;
      }

      y -= 15;
    }

    page.drawText(clean(profile.full_name) || 'Student Resume', {
      x: margin,
      y,
      size: 24,
      font: boldFont,
      color: rgb(0.12, 0.20, 0.32),
    });

    y -= 28;

    if (profile.headline) {
      page.drawText(clean(profile.headline).slice(0, 100), {
        x: margin,
        y,
        size: 12,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 25;
    }

    drawSection('Contact Information', [
      profile.institutional_email,
      profile.phone,
      profile.location,
    ].filter(Boolean).join(' | '));

    drawSection('Education', [
      profile.course,
      profile.student_id ? `Student ID: ${profile.student_id}` : '',
      profile.cgpa !== null && profile.cgpa !== undefined
        ? `CGPA: ${profile.cgpa}`
        : '',
    ].filter(Boolean).join('\n'));

    drawSection('About Me', profile.bio);
    drawSection('Skills', profile.skills);
    drawSection('Projects', profile.projects);

    const pdfBytes = await pdf.save();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="student-resume.pdf"',
      'Content-Length': String(pdfBytes.length),
    });

    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    return next(error);
  }
});


export default router;
