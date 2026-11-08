import { Router } from 'express';
import { requireAuth, requireRoles } from './security.js';

const DURATION_SECONDS = 15 * 60;
const QUESTIONS_PER_TEST = 10;

// The correct answers are stored only on the server.
const QUESTION_BANK = [
  // DATA STRUCTURES AND ALGORITHMS
  {
    id: 'dsa1',
    question: 'Which data structure follows FIFO?',
    options: [
      { id: 'a', text: 'Stack' },
      { id: 'b', text: 'Queue' },
      { id: 'c', text: 'Tree' },
      { id: 'd', text: 'Graph' },
    ],
    answer: 'b',
  },
  {
    id: 'dsa2',
    question: 'What is the time complexity of binary search?',
    options: [
      { id: 'a', text: 'O(n)' },
      { id: 'b', text: 'O(log n)' },
      { id: 'c', text: 'O(n²)' },
      { id: 'd', text: 'O(1)' },
    ],
    answer: 'b',
  },
  {
    id: 'dsa3',
    question: 'Which data structure uses LIFO?',
    options: [
      { id: 'a', text: 'Queue' },
      { id: 'b', text: 'Stack' },
      { id: 'c', text: 'Array' },
      { id: 'd', text: 'Graph' },
    ],
    answer: 'b',
  },
  {
    id: 'dsa4',
    question: 'Which traversal visits the root before its children?',
    options: [
      { id: 'a', text: 'Inorder' },
      { id: 'b', text: 'Postorder' },
      { id: 'c', text: 'Preorder' },
      { id: 'd', text: 'Level order' },
    ],
    answer: 'c',
  },
  {
    id: 'dsa5',
    question: 'Which sorting algorithm repeatedly selects the smallest element?',
    options: [
      { id: 'a', text: 'Merge sort' },
      { id: 'b', text: 'Selection sort' },
      { id: 'c', text: 'Quick sort' },
      { id: 'd', text: 'Heap sort' },
    ],
    answer: 'b',
  },
  {
    id: 'dsa6',
    question: 'What is the average search complexity of a hash table?',
    options: [
      { id: 'a', text: 'O(1)' },
      { id: 'b', text: 'O(n)' },
      { id: 'c', text: 'O(log n)' },
      { id: 'd', text: 'O(n²)' },
    ],
    answer: 'a',
  },
  {
    id: 'dsa7',
    question: 'Which data structure is commonly used in BFS?',
    options: [
      { id: 'a', text: 'Stack' },
      { id: 'b', text: 'Queue' },
      { id: 'c', text: 'Heap' },
      { id: 'd', text: 'Hash table' },
    ],
    answer: 'b',
  },
  {
    id: 'dsa8',
    question: 'What is the worst-case complexity of linear search?',
    options: [
      { id: 'a', text: 'O(1)' },
      { id: 'b', text: 'O(log n)' },
      { id: 'c', text: 'O(n)' },
      { id: 'd', text: 'O(n log n)' },
    ],
    answer: 'c',
  },

  // DATABASE MANAGEMENT SYSTEMS
  {
    id: 'db1',
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
    id: 'db2',
    question: 'Which key uniquely identifies each row?',
    options: [
      { id: 'a', text: 'Foreign key' },
      { id: 'b', text: 'Primary key' },
      { id: 'c', text: 'View' },
      { id: 'd', text: 'Index only' },
    ],
    answer: 'b',
  },
  {
    id: 'db3',
    question: 'Which normal form eliminates partial dependency?',
    options: [
      { id: 'a', text: '1NF' },
      { id: 'b', text: '2NF' },
      { id: 'c', text: '3NF' },
      { id: 'd', text: 'BCNF' },
    ],
    answer: 'b',
  },
  {
    id: 'db4',
    question: 'Which SQL clause filters grouped records?',
    options: [
      { id: 'a', text: 'WHERE' },
      { id: 'b', text: 'ORDER BY' },
      { id: 'c', text: 'HAVING' },
      { id: 'd', text: 'DISTINCT' },
    ],
    answer: 'c',
  },
  {
    id: 'db5',
    question: 'Which command removes all rows but keeps the table structure?',
    options: [
      { id: 'a', text: 'DROP' },
      { id: 'b', text: 'ALTER' },
      { id: 'c', text: 'TRUNCATE' },
      { id: 'd', text: 'CREATE' },
    ],
    answer: 'c',
  },
  {
    id: 'db6',
    question: 'What does ACID stand for?',
    options: [
      { id: 'a', text: 'Atomicity, Consistency, Isolation, Durability' },
      { id: 'b', text: 'Access, Control, Integrity, Data' },
      { id: 'c', text: 'Accuracy, Consistency, Indexing, Data' },
      { id: 'd', text: 'Atomicity, Clarity, Isolation, Dependency' },
    ],
    answer: 'a',
  },
  {
    id: 'db7',
    question: 'Which SQL function counts rows?',
    options: [
      { id: 'a', text: 'SUM()' },
      { id: 'b', text: 'COUNT()' },
      { id: 'c', text: 'TOTAL()' },
      { id: 'd', text: 'NUMBER()' },
    ],
    answer: 'b',
  },
  {
    id: 'db8',
    question: 'What is the purpose of a foreign key?',
    options: [
      { id: 'a', text: 'Sorting records' },
      { id: 'b', text: 'Referencing another table' },
      { id: 'c', text: 'Encrypting data' },
      { id: 'd', text: 'Deleting duplicates' },
    ],
    answer: 'b',
  },

  // OBJECT-ORIENTED PROGRAMMING
  {
    id: 'oop1',
    question: 'Which OOP concept bundles data and methods together?',
    options: [
      { id: 'a', text: 'Inheritance' },
      { id: 'b', text: 'Encapsulation' },
      { id: 'c', text: 'Polymorphism' },
      { id: 'd', text: 'Compilation' },
    ],
    answer: 'b',
  },
  {
    id: 'oop2',
    question: 'What is inheritance?',
    options: [
      { id: 'a', text: 'Hiding implementation details' },
      { id: 'b', text: 'Creating objects without classes' },
      { id: 'c', text: 'A class acquiring properties of another class' },
      { id: 'd', text: 'Converting code into machine language' },
    ],
    answer: 'c',
  },
  {
    id: 'oop3',
    question: 'Which concept allows one interface to have multiple implementations?',
    options: [
      { id: 'a', text: 'Abstraction' },
      { id: 'b', text: 'Polymorphism' },
      { id: 'c', text: 'Encapsulation' },
      { id: 'd', text: 'Inheritance' },
    ],
    answer: 'b',
  },
  {
    id: 'oop4',
    question: 'What is a constructor?',
    options: [
      { id: 'a', text: 'A method used to initialize objects' },
      { id: 'b', text: 'A method used to delete classes' },
      { id: 'c', text: 'A database query' },
      { id: 'd', text: 'A loop structure' },
    ],
    answer: 'a',
  },
  {
    id: 'oop5',
    question: 'Which OOP concept hides implementation details?',
    options: [
      { id: 'a', text: 'Inheritance' },
      { id: 'b', text: 'Abstraction' },
      { id: 'c', text: 'Overloading' },
      { id: 'd', text: 'Instantiation' },
    ],
    answer: 'b',
  },

  // OPERATING SYSTEMS
  {
    id: 'os1',
    question: 'Which component manages processes and memory?',
    options: [
      { id: 'a', text: 'Compiler' },
      { id: 'b', text: 'Operating system' },
      { id: 'c', text: 'Browser' },
      { id: 'd', text: 'Database' },
    ],
    answer: 'b',
  },
  {
    id: 'os2',
    question: 'What is a thread?',
    options: [
      { id: 'a', text: 'A lightweight unit of execution' },
      { id: 'b', text: 'A storage device' },
      { id: 'c', text: 'A network protocol' },
      { id: 'd', text: 'A database table' },
    ],
    answer: 'a',
  },
  {
    id: 'os3',
    question: 'Which scheduling algorithm uses time slices?',
    options: [
      { id: 'a', text: 'FCFS' },
      { id: 'b', text: 'Round Robin' },
      { id: 'c', text: 'Shortest Job First' },
      { id: 'd', text: 'Priority only' },
    ],
    answer: 'b',
  },
  {
    id: 'os4',
    question: 'What is deadlock?',
    options: [
      { id: 'a', text: 'A process finishing execution' },
      { id: 'b', text: 'Processes waiting indefinitely for resources' },
      { id: 'c', text: 'A memory allocation technique' },
      { id: 'd', text: 'A file permission' },
    ],
    answer: 'b',
  },
  {
    id: 'os5',
    question: 'Which memory is volatile?',
    options: [
      { id: 'a', text: 'ROM' },
      { id: 'b', text: 'SSD' },
      { id: 'c', text: 'RAM' },
      { id: 'd', text: 'Hard disk' },
    ],
    answer: 'c',
  },

  // COMPUTER NETWORKS
  {
    id: 'net1',
    question: 'Which protocol is used to securely browse websites?',
    options: [
      { id: 'a', text: 'FTP' },
      { id: 'b', text: 'HTTP' },
      { id: 'c', text: 'HTTPS' },
      { id: 'd', text: 'SMTP' },
    ],
    answer: 'c',
  },
  {
    id: 'net2',
    question: 'Which transport protocol provides reliable delivery?',
    options: [
      { id: 'a', text: 'UDP' },
      { id: 'b', text: 'TCP' },
      { id: 'c', text: 'IP' },
      { id: 'd', text: 'ARP' },
    ],
    answer: 'b',
  },
  {
    id: 'net3',
    question: 'Which device forwards packets between networks?',
    options: [
      { id: 'a', text: 'Hub' },
      { id: 'b', text: 'Switch' },
      { id: 'c', text: 'Router' },
      { id: 'd', text: 'Repeater' },
    ],
    answer: 'c',
  },
  {
    id: 'net4',
    question: 'What does DNS do?',
    options: [
      { id: 'a', text: 'Encrypts files' },
      { id: 'b', text: 'Maps domain names to IP addresses' },
      { id: 'c', text: 'Transfers emails' },
      { id: 'd', text: 'Assigns MAC addresses' },
    ],
    answer: 'b',
  },
  {
    id: 'net5',
    question: 'Which protocol is connectionless?',
    options: [
      { id: 'a', text: 'TCP' },
      { id: 'b', text: 'UDP' },
      { id: 'c', text: 'HTTPS' },
      { id: 'd', text: 'SSH' },
    ],
    answer: 'b',
  },

  // WEB DEVELOPMENT
  {
    id: 'web1',
    question: 'Which of these is a JavaScript UI library?',
    options: [
      { id: 'a', text: 'React' },
      { id: 'b', text: 'MySQL' },
      { id: 'c', text: 'Nginx' },
      { id: 'd', text: 'Linux' },
    ],
    answer: 'a',
  },
  {
    id: 'web2',
    question: 'Which HTML element creates a hyperlink?',
    options: [
      { id: 'a', text: '<div>' },
      { id: 'b', text: '<a>' },
      { id: 'c', text: '<p>' },
      { id: 'd', text: '<span>' },
    ],
    answer: 'b',
  },
  {
    id: 'web3',
    question: 'Which HTTP status code indicates success?',
    options: [
      { id: 'a', text: '404' },
      { id: 'b', text: '500' },
      { id: 'c', text: '200' },
      { id: 'd', text: '301' },
    ],
    answer: 'c',
  },
  {
    id: 'web4',
    question: 'Which JavaScript keyword declares a reassignable block-scoped variable?',
    options: [
      { id: 'a', text: 'var' },
      { id: 'b', text: 'let' },
      { id: 'c', text: 'const' },
      { id: 'd', text: 'static' },
    ],
    answer: 'b',
  },
  {
    id: 'web5',
    question: 'What is the purpose of CSS?',
    options: [
      { id: 'a', text: 'Manage database records' },
      { id: 'b', text: 'Style web pages' },
      { id: 'c', text: 'Run server processes' },
      { id: 'd', text: 'Compile JavaScript' },
    ],
    answer: 'b',
  },
  {
    id: 'web6',
    question: 'Which method converts a JSON string into a JavaScript object?',
    options: [
      { id: 'a', text: 'JSON.stringify()' },
      { id: 'b', text: 'JSON.parse()' },
      { id: 'c', text: 'JSON.convert()' },
      { id: 'd', text: 'JSON.object()' },
    ],
    answer: 'b',
  },
  {
    id: 'web7',
    question: 'What does an API allow?',
    options: [
      { id: 'a', text: 'Communication between software systems' },
      { id: 'b', text: 'Only image editing' },
      { id: 'c', text: 'Only database deletion' },
      { id: 'd', text: 'Hardware cooling' },
    ],
    answer: 'a',
  },

  // PROGRAMMING LANGUAGES
  {
    id: 'prog1',
    question: 'Which language is commonly associated with the JVM?',
    options: [
      { id: 'a', text: 'Java' },
      { id: 'b', text: 'C' },
      { id: 'c', text: 'HTML' },
      { id: 'd', text: 'SQL' },
    ],
    answer: 'a',
  },
  {
    id: 'prog2',
    question: 'Which symbol starts a single-line comment in Python?',
    options: [
      { id: 'a', text: '//' },
      { id: 'b', text: '#' },
      { id: 'c', text: '/*' },
      { id: 'd', text: '<!--' },
    ],
    answer: 'b',
  },
  {
    id: 'prog3',
    question: 'Which C function prints formatted output?',
    options: [
      { id: 'a', text: 'scanf()' },
      { id: 'b', text: 'printf()' },
      { id: 'c', text: 'input()' },
      { id: 'd', text: 'display()' },
    ],
    answer: 'b',
  },
  {
    id: 'prog4',
    question: 'What does a compiler do?',
    options: [
      { id: 'a', text: 'Translates source code into another form' },
      { id: 'b', text: 'Stores database records' },
      { id: 'c', text: 'Connects computers to Wi-Fi' },
      { id: 'd', text: 'Designs web pages' },
    ],
    answer: 'a',
  },
  {
    id: 'prog5',
    question: 'Which JavaScript value represents an unassigned variable?',
    options: [
      { id: 'a', text: 'undefined' },
      { id: 'b', text: 'true' },
      { id: 'c', text: 'Infinity' },
      { id: 'd', text: 'false' },
    ],
    answer: 'a',
  },

  // GIT AND SOFTWARE ENGINEERING
  {
    id: 'se1',
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
    id: 'se2',
    question: 'Which Git command downloads remote changes without merging?',
    options: [
      { id: 'a', text: 'git commit' },
      { id: 'b', text: 'git fetch' },
      { id: 'c', text: 'git init' },
      { id: 'd', text: 'git status' },
    ],
    answer: 'b',
  },
  {
    id: 'se3',
    question: 'What is the purpose of unit testing?',
    options: [
      { id: 'a', text: 'Test individual components' },
      { id: 'b', text: 'Deploy the application' },
      { id: 'c', text: 'Design the user interface' },
      { id: 'd', text: 'Manage user accounts' },
    ],
    answer: 'a',
  },
  {
    id: 'se4',
    question: 'What does CI stand for?',
    options: [
      { id: 'a', text: 'Code Inspection' },
      { id: 'b', text: 'Continuous Integration' },
      { id: 'c', text: 'Computer Interface' },
      { id: 'd', text: 'Central Installation' },
    ],
    answer: 'b',
  },
  {
    id: 'se5',
    question: 'What is the purpose of code refactoring?',
    options: [
      { id: 'a', text: 'Improve code structure without changing behavior' },
      { id: 'b', text: 'Delete all tests' },
      { id: 'c', text: 'Change the programming language' },
      { id: 'd', text: 'Remove version control' },
    ],
    answer: 'a',
  },
];

function getAttemptQuestions(attemptId) {
  // A deterministic shuffle ensures the same attempt gets
  // the same questions after a page refresh or server restart.
  let seed = Number(attemptId) || 1;

  function random() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const shuffled = [...QUESTION_BANK];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, QUESTIONS_PER_TEST);
}

function publicQuestions(attemptQuestions) {
  return attemptQuestions.map(({ id, question, options }) => ({
    id,
    question,
    options,
  }));
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function calculateScore(answers, attemptQuestions) {
  return attemptQuestions.reduce(
    (score, question) =>
      score + (answers[question.id] === question.answer ? 1 : 0),
    0,
  );
}

export function createMockTestRouter(dbPool) {
  const router = Router();

  // START A NEW MOCK TEST
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
          [req.auth.sub, QUESTIONS_PER_TEST],
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

        const attempt = rows[0];
        const attemptQuestions = getAttemptQuestions(attempt.id);

        const remainingSeconds = Math.max(
          0,
          DURATION_SECONDS - Number(attempt.elapsed_seconds),
        );

        return res.status(201).json({
          attemptId: attempt.id,
          startedAt: attempt.started_at,
          durationSeconds: DURATION_SECONDS,
          remainingSeconds,
          questions: publicQuestions(attemptQuestions),
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  // RESUME AN EXISTING ATTEMPT
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
        const attemptQuestions = getAttemptQuestions(attempt.id);

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
          questions: attempt.submitted_at
            ? []
            : publicQuestions(attemptQuestions),
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  // SUBMIT AND AUTOMATICALLY SCORE THE TEST
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

      try {
        const [rows] = await dbPool.execute(
          `SELECT
             id,
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

        if (attempt.submitted_at) {
          return res.status(409).json({
            message: 'This mock test has already been submitted.',
            score: attempt.score,
          });
        }

        const attemptQuestions = getAttemptQuestions(attempt.id);

        // Validate answers against the exact questions
        // assigned to this attempt.
        const validQuestionIds = new Set(
          attemptQuestions.map((question) => question.id),
        );

        const validOptionIds = new Map(
          attemptQuestions.map((question) => [
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

        // Server-side timer enforcement.
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
            totalQuestions: QUESTIONS_PER_TEST,
            expired: true,
          });
        }

        const score = calculateScore(answers, attemptQuestions);

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
          totalQuestions: QUESTIONS_PER_TEST,
          percentage: Math.round(
            (score / QUESTIONS_PER_TEST) * 100,
          ),
          message: 'Mock test submitted successfully.',
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  // GET THE LOGGED-IN STUDENT'S TEST HISTORY
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