
import { Router } from 'express';
import { requireAuth, requireRoles } from './security.js';

const DURATION_SECONDS = 15 * 60;

const QUESTIONS = [
  {
    id: 'q1',
    question: 'Which data structure follows the FIFO principle?',
    options: [
      { id: 'a', text: 'Stack' },
      { id: 'b', text: 'Queue' },
      { id: 'c', text: 'Tree' },
      { id: 'd', text: 'Graph' },
    ],
    answer: 'b',
  },
  {
    id: 'q2',
    question: 'Which SQL command retrieves data from a table?',
    options: [
      { id: 'a', text: 'INSERT' },
      { id: 'b', text: 'UPDATE' },
      { id: 'c', text: 'SELECT' },
      { id: 'd', text: 'DELETE' },
    ],
    answer: 'c',
  },
  {
    id: 'q3',
    question: 'Which protocol is commonly used to securely browse websites?',
    options: [
      { id: 'a', text: 'FTP' },
      { id: 'b', text: 'HTTP' },
      { id: 'c', text: 'HTTPS' },
      { id: 'd', text: 'SMTP' },
    ],
    answer: 'c',
  },
  {
    id: 'q4',
    question: 'What is the time complexity of binary search on a sorted array?',
    options: [
      { id: 'a', text: 'O(n)' },
      { id: 'b', text: 'O(log n)' },
      { id: 'c', text: 'O(n²)' },
      { id: 'd', text: 'O(1)' },
    ],
    answer: 'b',
  },
  {
    id: 'q5',
    question: 'Which of the following is a JavaScript framework/library?',
    options: [
      { id: 'a', text: 'React' },
      { id: 'b', text: 'MySQL' },
      { id: 'c', text: 'Nginx' },
      { id: 'd', text: 'Linux' },
    ],
    answer: 'a',
  },
  {
    id: 'q6',
    question: 'Which key uniquely identifies each row in a relational database table?',
    options: [
      { id: 'a', text: 'Foreign key' },
      { id: 'b', text: 'Primary key' },
      { id: 'c', text: 'Composite attribute' },
      { id: 'd', text: 'View' },
    ],
    answer: 'b',
  },
  {
    id: 'q7',
    question: 'Which HTTP status code indicates a successful request?',
    options: [
      { id: 'a', text: '404' },
      { id: 'b', text: '500' },
      { id: 'c', text: '200' },
      { id: 'd', text: '301' },
    ],
    answer: 'c',
  },
  {
    id: 'q8',
    question: 'Which Git command creates a new branch?',
    options: [
      { id: 'a', text: 'git push' },
      { id: 'b', text: 'git branch' },
      { id: 'c', text: 'git merge' },
      { id: 'd', text: 'git clone' },
    ],
    answer: 'b',
  },
  {
    id: 'q9',
    question: 'Which normal form eliminates partial dependency?',
    options: [
      { id: 'a', text: 'First Normal Form' },
      { id: 'b', text: 'Second Normal Form' },
      { id: 'c', text: 'Third Normal Form' },
      { id: 'd', text: 'Boyce-Codd Normal Form' },
    ],
    answer: 'b',
  },
  {
    id: 'q10',
    question: 'In object-oriented programming, what is inheritance?',
    options: [
      { id: 'a', text: 'Hiding implementation details' },
      { id: 'b', text: 'Creating objects without classes' },
      { id: 'c', text: 'A class acquiring properties of another class' },
      { id: 'd', text: 'Converting code into machine language' },
    ],
    answer: 'c',
  },
];

function publicQuestions() {
  return QUESTIONS.map(({ id, question, options }) => ({
    id,
    question,
    options,
  }));
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function calculateScore(answers) {
  let score = 0;

  for (const question of QUESTIONS) {
    if (answers[question.id] === question.answer) {
      score += 1;
    }
  }

  return score;
}

export function createMockTestRouter(dbPool) {
  const router = Router();

  // Start a new timed mock test.
  router.post(
    '/mock-tests/attempts',
    requireAuth,
    requireRoles('STUDENT'),
    async (req, res, next) => {
      try {
        const [result] = await dbPool.execute(
          `INSERT INTO mock_test_attempts
            (student_id, total_questions)
           VALUES (?, ?)`,
          [req.auth.sub, QUESTIONS.length],
        );

        const [rows] = await dbPool.execute(
          `SELECT
             id,
             started_at,
             TIMESTAMPDIFF(
               SECOND,
               started_at,
               CURRENT_TIMESTAMP()
             ) AS elapsed_seconds
           FROM mock_test_attempts
           WHERE id = ? AND student_id = ?
           LIMIT 1`,
          [result.insertId, req.auth.sub],
        );

        if (!rows[0]) {
          return res.status(500).json({
            message: 'Could not start the mock test.',
          });
        }

        const remainingSeconds = Math.max(
          0,
          DURATION_SECONDS - Number(rows[0].elapsed_seconds),
        );

        return res.status(201).json({
          attemptId: rows[0].id,
          startedAt: rows[0].started_at,
          durationSeconds: DURATION_SECONDS,
          remainingSeconds,
          questions: publicQuestions(),
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  // Resume an existing attempt without resetting its timer.
  router.get(
    '/mock-tests/attempts/:attemptId',
    requireAuth,
    requireRoles('STUDENT'),
    async (req, res, next) => {
      const attemptId = positiveId(req.params.attemptId);

      if (!attemptId) {
        return res.status(400).json({
          message: 'Invalid attempt ID.',
        });
      }

      try {
        const [rows] = await dbPool.execute(
          `SELECT
             id,
             started_at,
             submitted_at,
             score,
             total_questions,
             TIMESTAMPDIFF(
               SECOND,
               started_at,
               CURRENT_TIMESTAMP()
             ) AS elapsed_seconds
           FROM mock_test_attempts
           WHERE id = ? AND student_id = ?
           LIMIT 1`,
          [attemptId, req.auth.sub],
        );

        if (!rows[0]) {
          return res.status(404).json({
            message: 'Mock test attempt not found.',
          });
        }

        const attempt = rows[0];

        return res.json({
          attemptId: attempt.id,
          startedAt: attempt.started_at,
          durationSeconds: DURATION_SECONDS,
          remainingSeconds: Math.max(
            0,
            DURATION_SECONDS - Number(attempt.elapsed_seconds),
          ),
          submitted: Boolean(attempt.submitted_at),
          score: attempt.score,
          totalQuestions: attempt.total_questions,
          questions: attempt.submitted_at ? [] : publicQuestions(),
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  // Validate, score and save submitted answers.
  router.post(
    '/mock-tests/attempts/:attemptId/submit',
    requireAuth,
    requireRoles('STUDENT'),
    async (req, res, next) => {
      const attemptId = positiveId(req.params.attemptId);
      const answers = req.body?.answers;

      if (!attemptId) {
        return res.status(400).json({
          message: 'Invalid attempt ID.',
        });
      }

      if (
        !answers ||
        typeof answers !== 'object' ||
        Array.isArray(answers)
      ) {
        return res.status(400).json({
          message: 'Submit your answers to continue.',
        });
      }

      const validQuestionIds = new Set(
        QUESTIONS.map((question) => question.id),
      );

      const validOptionIds = new Map(
        QUESTIONS.map((question) => [
          question.id,
          new Set(question.options.map((option) => option.id)),
        ]),
      );

      for (const [questionId, optionId] of Object.entries(answers)) {
        if (
          !validQuestionIds.has(questionId) ||
          typeof optionId !== 'string' ||
          !validOptionIds.get(questionId).has(optionId)
        ) {
          return res.status(400).json({
            message: 'One or more answers are invalid.',
          });
        }
      }

      try {
        const [rows] = await dbPool.execute(
          `SELECT
             id,
             submitted_at,
             score,
             TIMESTAMPDIFF(
               SECOND,
               started_at,
               CURRENT_TIMESTAMP()
             ) AS elapsed_seconds
           FROM mock_test_attempts
           WHERE id = ? AND student_id = ?
           LIMIT 1`,
          [attemptId, req.auth.sub],
        );

        if (!rows[0]) {
          return res.status(404).json({
            message: 'Mock test attempt not found.',
          });
        }

        const attempt = rows[0];

        if (attempt.submitted_at) {
          return res.status(409).json({
            message: 'This mock test has already been submitted.',
            score: attempt.score,
          });
        }

        // The server enforces the deadline independently
        // of the browser countdown.
        if (Number(attempt.elapsed_seconds) >= DURATION_SECONDS) {
          const [expiredUpdate] = await dbPool.execute(
            `UPDATE mock_test_attempts
             SET answers = ?, score = 0,
                 submitted_at = CURRENT_TIMESTAMP()
             WHERE id = ?
               AND student_id = ?
               AND submitted_at IS NULL`,
            [
              JSON.stringify({}),
              attemptId,
              req.auth.sub,
            ],
          );

          if (expiredUpdate.affectedRows !== 1) {
            return res.status(409).json({
              message: 'This mock test has already been submitted.',
            });
          }

          return res.status(410).json({
            message: 'Time is up. Your mock test has expired.',
            score: 0,
            totalQuestions: QUESTIONS.length,
            expired: true,
          });
        }

        const score = calculateScore(answers);

        const [update] = await dbPool.execute(
          `UPDATE mock_test_attempts
           SET answers = ?,
               score = ?,
               submitted_at = CURRENT_TIMESTAMP()
           WHERE id = ?
             AND student_id = ?
             AND submitted_at IS NULL`,
          [
            JSON.stringify(answers),
            score,
            attemptId,
            req.auth.sub,
          ],
        );

        if (update.affectedRows !== 1) {
          return res.status(409).json({
            message: 'This mock test has already been submitted.',
          });
        }

        return res.json({
          attemptId,
          score,
          totalQuestions: QUESTIONS.length,
          percentage: Math.round(
            (score / QUESTIONS.length) * 100,
          ),
          message: 'Mock test submitted successfully.',
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  // Get the logged-in student's mock test history.
  router.get(
    '/mock-tests/history',
    requireAuth,
    requireRoles('STUDENT'),
    async (req, res, next) => {
      try {
        const [rows] = await dbPool.execute(
          `SELECT
             id AS attemptId,
             started_at AS startedAt,
             submitted_at AS submittedAt,
             score,
             total_questions AS totalQuestions,
             ROUND(
               (score / total_questions) * 100
             ) AS percentage
           FROM mock_test_attempts
           WHERE student_id = ?
             AND submitted_at IS NOT NULL
           ORDER BY submitted_at DESC
           LIMIT 50`,
          [req.auth.sub],
        );

        return res.json({ history: rows });
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
