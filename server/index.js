import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../.env') });

const { default: authRouter } = await import('./auth.js');
const { default: studentRouter } = await import('./student.js');
const { pool } = await import('./db.js');

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    },
  },
}));
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', authRouter);
app.use('/api/student', studentRouter);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static(path.resolve(currentDirectory, '../dist')));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

app.listen(port, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`OIPP API listening on http://localhost:${port}`);
  } catch (error) {
    console.error('Could not connect to MySQL:', error.message);
  }
});