import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(currentDirectory, '../.env'),
});

const { default: authRouter } = await import('./auth.js');
const { pool } = await import('./db.js');
const { createRbacRouter } = await import('./rbac-routes.js');
const { enforceHttps } = await import('./enforceHttps.js');
const { loadTlsOptions, createHttpRedirectHandler } = await import('./tls.js');
const { createRecruiterRequestRouter } =
  await import('./recruiter-requests.js');
const { createRecruiterApprovalStatusResolver } =
  await import('./recruiterApproval.js');
const { default: studentRouter } = await import('./student.js');

const app = express();
const port = Number(process.env.PORT || 4000);
const httpsPort = Number(process.env.HTTPS_PORT || 4443);

// Trust the hosting proxy only when HTTPS enforcement is enabled.
if (process.env.ENFORCE_HTTPS === 'true') {
  app.set('trust proxy', 1);
}

app.use(enforceHttps);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      },
    },
  })
);

app.use(express.json({ limit: '10kb' }));

app.locals.getRecruiterApprovalStatus =
  createRecruiterApprovalStatusResolver(pool);

// Authentication, role-based routes, recruiter requests, and student features.
app.use('/api/auth', authRouter);
app.use('/api', createRbacRouter(pool));
app.use('/api', createRecruiterRequestRouter(pool));
app.use('/api/student', studentRouter);

app.get('/api/health', (_req, res) => {
  return res.json({ status: 'ok' });
});

app.use(express.static(path.resolve(currentDirectory, '../dist')));

app.use((error, _req, res, _next) => {
  if (error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({
      message: 'Required database migration has not been applied.',
    });
  }

  console.error(error);

  return res.status(500).json({
    message: 'Something went wrong. Please try again.',
  });
});

const tlsOptions = loadTlsOptions();

async function checkDatabase(url) {
  try {
    await pool.query('SELECT 1');
    console.log(`OIPP API listening on ${url}`);
  } catch (error) {
    console.error('Could not connect to MySQL:', error.message);
  }
}

if (tlsOptions) {
  https.createServer(tlsOptions, app).listen(httpsPort, () => {
    checkDatabase(`https://localhost:${httpsPort}`);
  });

  http
    .createServer(createHttpRedirectHandler(httpsPort))
    .listen(port, () => {
      console.log(`HTTP on :${port} only redirects to HTTPS`);
    });
} else {
  app.listen(port, () => {
    checkDatabase(`http://localhost:${port}`);
  });
}
