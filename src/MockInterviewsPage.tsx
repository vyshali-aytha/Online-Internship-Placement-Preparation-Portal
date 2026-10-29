import { useEffect, useState } from 'react';

type Slot = {
  id: number;
  starts_at: string;
  ends_at: string;
};

type StudentBooking = {
  booking_id: number;
  slot_id: number;
  starts_at: string;
  ends_at: string;
  feedback: string | null;
  feedback_at: string | null;
};

type AdminBooking = StudentBooking & {
  student_id: number | string;
  full_name: string;
  institutional_email: string;
};

async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new Error('Could not connect to the server. Check your connection.');
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'The request could not be completed.';

    throw new Error(message);
  }

  return body as T;
}

function displayDate(value: string) {
  const normalized = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function MockInterviewsPage() {
  const [mode] = useState<'admin' | 'student' | 'guest'>(() => {
    if (sessionStorage.getItem('oipp_admin_token')) return 'admin';
    if (sessionStorage.getItem('oipp_student_token')) return 'student';
    return 'guest';
  });

  const token = mode === 'admin'
    ? sessionStorage.getItem('oipp_admin_token') || ''
    : sessionStorage.getItem('oipp_student_token') || '';

  const [slots, setSlots] = useState<Slot[]>([]);
  const [studentBookings, setStudentBookings] = useState<StudentBooking[]>([]);
  const [adminBookings, setAdminBookings] = useState<AdminBooking[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        if (mode === 'student') {
          const [available, mine] = await Promise.all([
            apiRequest<Slot[]>('/api/mock-interviews/slots', token),
            apiRequest<StudentBooking[]>('/api/mock-interviews/my-bookings', token),
          ]);

          if (!cancelled) {
            setSlots(available);
            setStudentBookings(mine);
          }
        } else if (mode === 'admin') {
          const bookings = await apiRequest<AdminBooking[]>(
            '/api/mock-interviews/admin/bookings',
            token,
          );

          if (!cancelled) {
            setAdminBookings(bookings);
            setFeedbackDrafts((current) => {
              const updated = { ...current };

              for (const booking of bookings) {
                if (!(booking.booking_id in updated)) {
                  updated[booking.booking_id] = booking.feedback || '';
                }
              }

              return updated;
            });
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load mock interviews.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, token, reload]);

  async function bookSlot(slotId: number) {
    setBusyId(slotId);
    setError('');
    setNotice('');

    try {
      const result = await apiRequest<{ message: string }>(
        '/api/mock-interviews/bookings',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ slotId }),
        },
      );

      setNotice(result.message);
      setReload((value) => value + 1);
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'Could not book this slot.');
    } finally {
      setBusyId(null);
    }
  }

  async function createSlot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!startsAt || !endsAt) {
      setError('Choose both a start and end time.');
      return;
    }

    setBusyId(-1);

    try {
      await apiRequest<Slot>(
        '/api/mock-interviews/admin/slots',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
          }),
        },
      );

      setStartsAt('');
      setEndsAt('');
      setNotice('Interview slot created.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the slot.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveFeedback(bookingId: number) {
    setBusyId(bookingId);
    setError('');
    setNotice('');

    try {
      const result = await apiRequest<{ message: string }>(
        `/api/mock-interviews/admin/bookings/${bookingId}/feedback`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ feedback: feedbackDrafts[bookingId] || '' }),
        },
      );

      setNotice(result.message);
      setReload((value) => value + 1);
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : 'Could not save feedback.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page-shell mock-interview-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OIPP home">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span>OIPP<span className="brand-period">.</span></span>
        </a>
        <nav className="mock-nav">
          <a href="/">Student portal</a>
          {mode === 'admin' && <a href="/admin">Admin dashboard</a>}
          {mode === 'guest' && <a href="/admin/login">Admin sign-in</a>}
        </nav>
      </header>

      <section className="mock-interview-content">
        <p className="kicker">INTERVIEW PREPARATION</p>
        <h1>Mock interviews</h1>

        {mode === 'guest' && (
          <section className="mock-card">
            <h2>Sign in to continue</h2>
            <p className="intro">
              Students must sign in to book a mock interview. Administrators can
              sign in to create slots and provide feedback.
            </p>
            <a className="mock-button" href="/">Student sign-in</a>
            <a className="mock-button mock-button-secondary" href="/admin/login">Administrator sign-in</a>
          </section>
        )}

        {error && <p className="mock-message mock-error" role="alert">{error}</p>}
        {notice && <p className="mock-message mock-success" role="status">{notice}</p>}

        {mode === 'student' && (
          <>
            <section className="mock-card">
              <div className="mock-section-heading">
                <div>
                  <h2>Available slots</h2>
                  <p>Choose a future slot. Each slot can be booked once.</p>
                </div>
                <button
                  type="button"
                  className="mock-button mock-button-secondary"
                  onClick={() => setReload((value) => value + 1)}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="mock-muted">Loading available slots…</p>
              ) : slots.length === 0 ? (
                <p className="mock-muted">No available slots right now. Check again later.</p>
              ) : (
                <div className="mock-list">
                  {slots.map((slot) => (
                    <article className="mock-row" key={slot.id}>
                      <div>
                        <strong>{displayDate(slot.starts_at)}</strong>
                        <p>Ends {displayDate(slot.ends_at)}</p>
                      </div>
                      <button
                        type="button"
                        className="mock-button"
                        disabled={busyId !== null}
                        onClick={() => void bookSlot(slot.id)}
                      >
                        {busyId === slot.id ? 'Booking…' : 'Book slot'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mock-card">
              <h2>My interviews</h2>
              {loading ? (
                <p className="mock-muted">Loading your bookings…</p>
              ) : studentBookings.length === 0 ? (
                <p className="mock-muted">You haven't booked an interview yet.</p>
              ) : (
                <div className="mock-list">
                  {studentBookings.map((booking) => (
                    <article className="mock-row mock-row-stacked" key={booking.booking_id}>
                      <div>
                        <strong>{displayDate(booking.starts_at)}</strong>
                        <p>Ends {displayDate(booking.ends_at)}</p>
                        <span className="mock-label">Booking #{booking.booking_id}</span>
                      </div>
                      <div className="mock-feedback">
                        <strong>Administrator feedback</strong>
                        <p>{booking.feedback || 'Feedback has not been added yet.'}</p>
                        {booking.feedback_at && (
                          <small>Updated {displayDate(booking.feedback_at)}</small>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {mode === 'admin' && (
          <>
            <section className="mock-card">
              <h2>Create an interview slot</h2>
              <p className="intro">Students will be able to book the slot after it is created.</p>

              <form className="mock-form" onSubmit={(event) => void createSlot(event)}>
                <label className="field">
                  <span>Start time</span>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  <span>End time</span>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    required
                  />
                </label>

                <button className="mock-button" type="submit" disabled={busyId !== null}>
                  {busyId === -1 ? 'Creating…' : 'Create slot'}
                </button>
              </form>
            </section>

            <section className="mock-card">
              <div className="mock-section-heading">
                <h2>Bookings and feedback</h2>
                <button
                  type="button"
                  className="mock-button mock-button-secondary"
                  onClick={() => setReload((value) => value + 1)}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="mock-muted">Loading bookings…</p>
              ) : adminBookings.length === 0 ? (
                <p className="mock-muted">No students have booked an interview yet.</p>
              ) : (
                <div className="mock-list">
                  {adminBookings.map((booking) => (
                    <article className="mock-admin-booking" key={booking.booking_id}>
                      <div>
                        <strong>{booking.full_name}</strong>
                        <p>{booking.institutional_email}</p>
                        <p>{displayDate(booking.starts_at)} – {displayDate(booking.ends_at)}</p>
                        <span className="mock-label">Booking #{booking.booking_id}</span>
                      </div>

                      <label className="field">
                        <span>Interview feedback</span>
                        <textarea
                          rows={4}
                          maxLength={5000}
                          value={feedbackDrafts[booking.booking_id] ?? ''}
                          onChange={(event) => setFeedbackDrafts((current) => ({
                            ...current,
                            [booking.booking_id]: event.target.value,
                          }))}
                          placeholder="Record constructive feedback for the student."
                        />
                      </label>

                      <button
                        className="mock-button"
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void saveFeedback(booking.booking_id)}
                      >
                        {busyId === booking.booking_id ? 'Saving…' : 'Save feedback'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}