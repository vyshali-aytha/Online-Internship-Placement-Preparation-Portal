import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

import { signJwt } from '../server/security.js';
import { createMockInterviewRouter } from '../server/mock-interviews.js';

function futureSqlDate(offsetMinutes = 60) {
  return new Date(Date.now() + offsetMinutes * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function sqlNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

const slots = new Map();
const bookings = new Map();

let nextSlotId = 1;
let nextBookingId = 1;

const firstSlot = {
  id: nextSlotId++,
  starts_at: futureSqlDate(60),
  ends_at: futureSqlDate(90),
  created_by: 'admin:test@example.edu',
};

slots.set(firstSlot.id, firstSlot);

const students = new Map([
  ['1', {
    id: 1,
    full_name: 'Student One',
    institutional_email: 'student1@example.edu',
  }],
  ['2', {
    id: 2,
    full_name: 'Student Two',
    institutional_email: 'student2@example.edu',
  }],
]);

const fakeConnection = {
  async beginTransaction() {},
  async commit() {},
  async rollback() {},
  release() {},

  async execute(sql, values = []) {
    const query = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (query.startsWith('SELECT ID, STARTS_AT FROM MOCK_INTERVIEW_SLOTS')) {
      const slot = slots.get(Number(values[0]));

      if (
        slot &&
        new Date(`${slot.starts_at.replace(' ', 'T')}Z`).getTime() > Date.now()
      ) {
        return [[{ id: slot.id, starts_at: slot.starts_at }], []];
      }

      return [[], []];
    }

    if (query.startsWith('INSERT INTO MOCK_INTERVIEW_BOOKINGS')) {
      const [slotId, studentId] = values;

      if ([...bookings.values()].some((booking) => booking.slot_id === Number(slotId))) {
        const error = new Error('Duplicate booking');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }

      const booking = {
        id: nextBookingId++,
        slot_id: Number(slotId),
        student_id: String(studentId),
        feedback: null,
        feedback_by: null,
        feedback_at: null,
        created_at: sqlNow(),
      };

      bookings.set(booking.id, booking);

      return [{ insertId: booking.id }, []];
    }

    throw new Error(`Unexpected transaction SQL: ${sql}`);
  },
};

const fakePool = {
  async getConnection() {
    return fakeConnection;
  },

  async execute(sql, values = []) {
    const query = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (query.includes('FROM MOCK_INTERVIEW_SLOTS S LEFT JOIN MOCK_INTERVIEW_BOOKINGS B')) {
      const available = [...slots.values()]
        .filter((slot) => {
          const isFuture =
            new Date(`${slot.starts_at.replace(' ', 'T')}Z`).getTime() > Date.now();
          const isBooked = [...bookings.values()]
            .some((booking) => booking.slot_id === slot.id);

          return isFuture && !isBooked;
        })
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map(({ id, starts_at, ends_at }) => ({ id, starts_at, ends_at }));

      return [available, []];
    }

    if (
      query.includes('FROM MOCK_INTERVIEW_BOOKINGS B') &&
      query.includes('WHERE B.STUDENT_ID = ?')
    ) {
      const studentId = String(values[0]);

      const rows = [...bookings.values()]
        .filter((booking) => booking.student_id === studentId)
        .map((booking) => {
          const slot = slots.get(booking.slot_id);

          return {
            booking_id: booking.id,
            student_id: booking.student_id,
            feedback: booking.feedback,
            feedback_at: booking.feedback_at,
            created_at: booking.created_at,
            slot_id: slot.id,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
          };
        });

      return [rows, []];
    }

    if (
      query.includes('FROM MOCK_INTERVIEW_BOOKINGS B') &&
      query.includes('INNER JOIN STUDENTS ST ON ST.ID = B.STUDENT_ID')
    ) {
      const rows = [...bookings.values()].map((booking) => {
        const slot = slots.get(booking.slot_id);
        const student = students.get(booking.student_id);

        return {
          booking_id: booking.id,
          student_id: booking.student_id,
          full_name: student?.full_name || 'Unknown student',
          institutional_email: student?.institutional_email || '',
          feedback: booking.feedback,
          feedback_at: booking.feedback_at,
          created_at: booking.created_at,
          slot_id: slot.id,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
        };
      });

      return [rows, []];
    }

    if (query.startsWith('INSERT INTO MOCK_INTERVIEW_SLOTS')) {
      const [startsAt, endsAt, createdBy] = values;

      const exists = [...slots.values()].some(
        (slot) => slot.starts_at === startsAt && slot.ends_at === endsAt
      );

      if (exists) {
        const error = new Error('Duplicate slot');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }

      const slot = {
        id: nextSlotId++,
        starts_at: startsAt,
        ends_at: endsAt,
        created_by: createdBy,
      };

      slots.set(slot.id, slot);

      return [{ insertId: slot.id, affectedRows: 1 }, []];
    }

    if (query.startsWith('SELECT ID FROM MOCK_INTERVIEW_BOOKINGS WHERE ID = ? LIMIT 1')) {
      const booking = bookings.get(Number(values[0]));
      return [booking ? [{ id: booking.id }] : [], []];
    }

    if (query.startsWith('UPDATE MOCK_INTERVIEW_BOOKINGS SET FEEDBACK = ?')) {
      const [feedback, reviewer, bookingId] = values;
      const booking = bookings.get(Number(bookingId));

      if (!booking) return [{ affectedRows: 0 }, []];

      booking.feedback = feedback;
      booking.feedback_by = reviewer;
      booking.feedback_at = sqlNow();

      return [{ affectedRows: 1 }, []];
    }

    throw new Error(`Unexpected pool SQL: ${query}`);
  },
};

const app = express();
app.use(express.json());
app.use('/api', createMockInterviewRouter(fakePool));

app.use((error, _req, res, _next) => {
  return res.status(500).json({ message: 'Unexpected test server error.' });
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

  if (authToken) headers.authorization = `Bearer ${authToken}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

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

test('mock interview routes reject unauthenticated and wrong-role users', async () => {
  const unauthenticated = await api('/api/mock-interviews/slots');
  assert.equal(unauthenticated.status, 401);

  const recruiter = await api('/api/mock-interviews/slots', {
    authToken: token('17', 'RECRUITER'),
  });

  assert.equal(recruiter.status, 403);
});

test('students can view available slots and duplicate slot bookings are prevented', async () => {
  const studentOne = token('1', 'STUDENT');
  const studentTwo = token('2', 'STUDENT');

  const available = await api('/api/mock-interviews/slots', {
    authToken: studentOne,
  });

  assert.equal(available.status, 200);
  assert.ok(available.body.some((slot) => slot.id === firstSlot.id));

  const booked = await api('/api/mock-interviews/bookings', {
    authToken: studentOne,
    method: 'POST',
    body: { slotId: firstSlot.id },
  });

  assert.equal(booked.status, 201);

  const duplicate = await api('/api/mock-interviews/bookings', {
    authToken: studentTwo,
    method: 'POST',
    body: { slotId: firstSlot.id },
  });

  assert.equal(duplicate.status, 409);

  const remaining = await api('/api/mock-interviews/slots', {
    authToken: studentTwo,
  });

  assert.equal(remaining.status, 200);
  assert.equal(remaining.body.some((slot) => slot.id === firstSlot.id), false);
});

test('only an administrator can create slots and submit feedback', async () => {
  const studentToken = token('1', 'STUDENT');
  const adminToken = token('admin:test@example.edu', 'ADMIN');

  const forbidden = await api('/api/mock-interviews/admin/slots', {
    authToken: studentToken,
    method: 'POST',
    body: {
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      endsAt: new Date(Date.now() + 5_400_000).toISOString(),
    },
  });

  assert.equal(forbidden.status, 403);

  const startsAt = new Date(Date.now() + 4 * 3_600_000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

  const created = await api('/api/mock-interviews/admin/slots', {
    authToken: adminToken,
    method: 'POST',
    body: {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    },
  });

  assert.equal(created.status, 201);

  const booking = await api('/api/mock-interviews/bookings', {
    authToken: studentToken,
    method: 'POST',
    body: { slotId: created.body.id },
  });

  assert.equal(booking.status, 201);

  const feedback = await api(
    `/api/mock-interviews/admin/bookings/${booking.body.bookingId}/feedback`,
    {
      authToken: adminToken,
      method: 'PATCH',
      body: { feedback: 'Good communication and clear explanations.' },
    }
  );

  assert.equal(feedback.status, 200);

  const repeatFeedback = await api(
    `/api/mock-interviews/admin/bookings/${booking.body.bookingId}/feedback`,
    {
      authToken: adminToken,
      method: 'PATCH',
      body: { feedback: 'Good communication and clear explanations.' },
    }
  );

  assert.equal(repeatFeedback.status, 200);

  const missingBooking = await api(
    '/api/mock-interviews/admin/bookings/99999/feedback',
    {
      authToken: adminToken,
      method: 'PATCH',
      body: { feedback: 'Feedback for a missing booking.' },
    }
  );

  assert.equal(missingBooking.status, 404);

  const ownBookings = await api('/api/mock-interviews/my-bookings', {
    authToken: studentToken,
  });

  const savedBooking = ownBookings.body.find(
    (item) => item.booking_id === booking.body.bookingId
  );

  assert.equal(
    savedBooking.feedback,
    'Good communication and clear explanations.'
  );

  const otherStudent = await api('/api/mock-interviews/my-bookings', {
    authToken: token('2', 'STUDENT'),
  });

  assert.equal(
    otherStudent.body.some(
      (item) => item.booking_id === booking.body.bookingId
    ),
    false
  );
});

test('invalid booking IDs and feedback are rejected', async () => {
  const adminToken = token('admin:test@example.edu', 'ADMIN');

  const invalidFeedback = await api(
    '/api/mock-interviews/admin/bookings/1/feedback',
    {
      authToken: adminToken,
      method: 'PATCH',
      body: { feedback: '   ' },
    }
  );

  assert.equal(invalidFeedback.status, 400);

  const invalidBooking = await api('/api/mock-interviews/bookings', {
    authToken: token('1', 'STUDENT'),
    method: 'POST',
    body: { slotId: 'invalid' },
  });

  assert.equal(invalidBooking.status, 400);
});