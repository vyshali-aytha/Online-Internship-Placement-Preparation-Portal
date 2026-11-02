
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

import { signJwt } from '../server/security.js';
import { createMockTestRouter } from '../server/mock-tests.js';

const attempts = new Map();
let nextAttemptId = 1;

const fakePool = {
  async execute(sql, values = []) {
    const query = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (query.startsWith('INSERT INTO MOCK_TEST_ATTEMPTS')) {
      const [studentId, totalQuestions] = values;
      const id = nextAttemptId++;

      attempts.set(id, {
        id,
        student_id: String(studentId),
        started_at: new Date(),
        submitted_at: null,
        score: null,
        total_questions: totalQuestions,
        answers: null,
      });

      return [{ insertId: id }, []];
    }

    if (query.includes('FROM MOCK_TEST_ATTEMPTS')) {
      const [attemptId, studentId] = values;
      const attempt = attempts.get(Number(attemptId));

      if (!attempt || attempt.student_id !== String(studentId)) {
        return [[], []];
      }

      const elapsedSeconds = Math.floor(
        (Date.now() - attempt.started_at.getTime()) / 1000,
      );

      return [[{
        id: attempt.id,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        score: attempt.score,
        total_questions: attempt.total_questions,
        elapsed_seconds: elapsedSeconds,
      }], []];
    }

    if (query.startsWith('UPDATE MOCK_TEST_ATTEMPTS')) {
      let answers;
      let score;
      let attemptId;
      let studentId;

      if (query.includes('SCORE = 0')) {
        [answers, attemptId, studentId] = values;
        score = 0;
      } else {
        [answers, score, attemptId, studentId] = values;
      }

      const attempt = attempts.get(Number(attemptId));

      if (
        !attempt ||
        attempt.student_id !== String(studentId) ||
        attempt.submitted_at
      ) {
        return [{ affectedRows: 0 }, []];
      }

      attempt.answers = answers;
      attempt.score = score;
      attempt.submitted_at = new Date();

      return [{ affectedRows: 1 }, []];
    }

    throw new Error(`Unexpected SQL: ${query}`);
  },
};

const app = express();
app.use(express.json());
app.use('/api', createMockTestRouter(fakePool));

app.use((error, _req, res, _next) => {
  return res.status(500).json({
    message: 'Unexpected test server error.',
  });
});

let server;
let baseUrl;

before(async () => {
  server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

function token(subject, role) {
  return signJwt(String(subject), role);
}

async function api(path, { authToken, method = 'GET', body } = {}) {
  const headers = {};

  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test('mock tests reject unauthenticated and wrong-role users', async () => {
  const unauthenticated = await api('/api/mock-tests/attempts', {
    method: 'POST',
  });

  assert.equal(unauthenticated.status, 401);

  const recruiter = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: token('20', 'RECRUITER'),
  });

  assert.equal(recruiter.status, 403);
});

test('students can start a test and receive questions without answers', async () => {
  const response = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: token('1', 'STUDENT'),
  });

  assert.equal(response.status, 201);
  assert.ok(response.body.attemptId);
  assert.equal(response.body.durationSeconds, 900);
  assert.equal(response.body.questions.length, 10);

  for (const question of response.body.questions) {
    assert.ok(question.id);
    assert.ok(question.question);
    assert.equal(question.options.length, 4);
    assert.equal('answer' in question, false);
  }
});

test('students can retrieve their own attempt and its remaining time', async () => {
  const started = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: token('2', 'STUDENT'),
  });

  const response = await api(
    `/api/mock-tests/attempts/${started.body.attemptId}`,
    {
      authToken: token('2', 'STUDENT'),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.attemptId, started.body.attemptId);
  assert.equal(response.body.submitted, false);
  assert.equal(response.body.questions.length, 10);
  assert.ok(response.body.remainingSeconds <= 900);
});

test('students cannot access another student attempt', async () => {
  const started = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: token('3', 'STUDENT'),
  });

  const response = await api(
    `/api/mock-tests/attempts/${started.body.attemptId}`,
    {
      authToken: token('4', 'STUDENT'),
    },
  );

  assert.equal(response.status, 404);
});

test('invalid attempt IDs and invalid answers are rejected', async () => {
  const studentToken = token('5', 'STUDENT');

  const invalidId = await api('/api/mock-tests/attempts/abc', {
    authToken: studentToken,
  });

  assert.equal(invalidId.status, 400);

  const started = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: studentToken,
  });

  const invalidAnswer = await api(
    `/api/mock-tests/attempts/${started.body.attemptId}/submit`,
    {
      method: 'POST',
      authToken: studentToken,
      body: {
        answers: {
          q1: 'invalid-option',
        },
      },
    },
  );

  assert.equal(invalidAnswer.status, 400);
});

test('server automatically scores submitted answers', async () => {
  const studentToken = token('6', 'STUDENT');

  const started = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: studentToken,
  });

  const answers = {
    q1: 'b',
    q2: 'c',
    q3: 'c',
    q4: 'b',
    q5: 'a',
    q6: 'b',
    q7: 'c',
    q8: 'b',
    q9: 'b',
    q10: 'a',
  };

  const response = await api(
    `/api/mock-tests/attempts/${started.body.attemptId}/submit`,
    {
      method: 'POST',
      authToken: studentToken,
      body: { answers },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.score, 9);
  assert.equal(response.body.totalQuestions, 10);
  assert.equal(response.body.percentage, 90);
});

test('a submitted attempt cannot be submitted again', async () => {
  const studentToken = token('7', 'STUDENT');

  const started = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: studentToken,
  });

  const path =
    `/api/mock-tests/attempts/${started.body.attemptId}/submit`;

  const first = await api(path, {
    method: 'POST',
    authToken: studentToken,
    body: { answers: { q1: 'b' } },
  });

  assert.equal(first.status, 200);

  const second = await api(path, {
    method: 'POST',
    authToken: studentToken,
    body: { answers: { q1: 'b' } },
  });

  assert.equal(second.status, 409);
});

test('expired attempts are rejected and recorded with zero score', async () => {
  const studentToken = token('8', 'STUDENT');

  const started = await api('/api/mock-tests/attempts', {
    method: 'POST',
    authToken: studentToken,
  });

  const attempt = attempts.get(Number(started.body.attemptId));

  // Simulate a test that started more than 15 minutes ago.
  attempt.started_at = new Date(Date.now() - 901_000);

  const response = await api(
    `/api/mock-tests/attempts/${started.body.attemptId}/submit`,
    {
      method: 'POST',
      authToken: studentToken,
      body: { answers: { q1: 'b' } },
    },
  );

  assert.equal(response.status, 410);
  assert.equal(response.body.expired, true);
  assert.equal(response.body.score, 0);
  assert.equal(attempt.score, 0);
  assert.ok(attempt.submitted_at);
});
