
import { useEffect, useState, type FormEvent } from 'react';
import ProfilePage from './ProfilePage';
import ApplicationPage from './ApplicationPage';
import ApplicationTrackingPage from './ApplicationTrackingPage';
import MockTestPage from './MockTestPage';
import MockTestHistoryPage from './MockTestHistoryPage';
import InterviewQuestionBank from './InterviewQuestionBank';

type RegistrationForm = {
  fullName: string;
  studentId: string;
  course: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type ApiResponse = {
  message?: string;
};

const initialForm: RegistrationForm = {
  fullName: '',
  studentId: '',
  course: '',
  email: '',
  password: '',
  confirmPassword: '',
};

async function requestOtp(form: RegistrationForm) {
  const response = await fetch('/api/auth/register/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: form.fullName,
      studentId: form.studentId,
      course: form.course,
      email: form.email,
      password: form.password,
    }),
  });

  const result = await response.json() as ApiResponse;

  if (!response.ok) {
    throw new Error(
      result.message || 'Could not send your code. Please try again.',
    );
  }

  return result.message || 'Verification code sent.';
}

function App() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<
    'details' | 'verify' | 'complete' | 'login'
  >('details');

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [studentToken, setStudentToken] = useState(
    () => sessionStorage.getItem('oipp_student_token') || '',
  );
  const isUnauthenticatedEntry = step === 'login' || step === 'details';

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setTimeout(
      () => setResendSeconds((seconds) => seconds - 1),
      1000,
    );

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function updateField(
    field: keyof RegistrationForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError('');
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const result = await response.json() as ApiResponse & {
        token?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || 'Login failed.');
      }

      if (!result.token) {
        throw new Error('Login failed.');
      }

      sessionStorage.setItem('oipp_student_token', result.token);
      setStudentToken(result.token);
      setNotice('Signed in successfully.');
      setStep('complete');
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Login failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestCode(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      setNotice(await requestOtp(form));
      setStep('verify');
      setResendSeconds(60);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not send your code.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const response = await fetch(
        '/api/auth/register/verify-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            otp,
          }),
        },
      );

      const result = await response.json() as ApiResponse;

      if (!response.ok) {
        throw new Error(
          result.message || 'That code could not be verified.',
        );
      }

      setNotice(
        result.message ||
          'Your account is ready. Sign in to manage your profile.',
      );

      setStep('complete');
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'That code could not be verified.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError('');
    setBusy(true);

    try {
      setNotice(await requestOtp(form));
      setOtp('');
      setResendSeconds(60);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not resend your code.',
      );
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem('oipp_student_token');

    setStudentToken('');
    setForm(initialForm);
    setError('');
    setNotice('');
    setStep('login');
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OIPP home">
          <span className="brand-mark" aria-hidden="true">
            O
          </span>

          <span>
            OIPP<span className="brand-period">.</span>
          </span>
        </a>

        <div className="topbar-note">
          <span className="status-dot" />
          Student portal
        </div>
      </header>

      <section
        className="registration-layout"
        aria-label="Student registration"
      >
        <aside className={`visual-panel${studentToken && !isUnauthenticatedEntry ? ' visual-panel-authenticated' : ''}`}>
          {studentToken && !isUnauthenticatedEntry ? (
            <svg className="career-art" viewBox="0 0 900 1200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="career-field" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#173b33" />
                  <stop offset="0.52" stopColor="#102923" />
                  <stop offset="1" stopColor="#202a28" />
                </linearGradient>
                <linearGradient id="career-light" x1="0" y1="0" x2="0.9" y2="1">
                  <stop offset="0" stopColor="#c2d785" stopOpacity=".2" />
                  <stop offset="1" stopColor="#c2d785" stopOpacity="0" />
                </linearGradient>
                <pattern id="career-grid" width="56" height="56" patternUnits="userSpaceOnUse">
                  <path d="M56 0H0V56" fill="none" stroke="#dbe7c2" strokeOpacity=".09" strokeWidth="1" />
                </pattern>
              </defs>
              <path fill="url(#career-field)" d="M0 0h900v1200H0z" />
              <path fill="url(#career-grid)" d="M0 0h900v1200H0z" />
              <path fill="url(#career-light)" d="M0 0h900v700L410 1200H0z" />
              <path d="M-120 820 470 230l470 470-590 590z" fill="#173b33" fillOpacity=".72" />
              <path d="m-80 910 560-560 330 330-560 560z" fill="#29443a" fillOpacity=".48" stroke="#d7e4b5" strokeOpacity=".22" />
              <path d="M90 1200 650 640M170 1200 730 640M250 1200 810 640M330 1200 890 640" stroke="#d7e4b5" strokeOpacity=".15" />
              <path d="M62 520h300v-82h210v-82h210v-82h180" fill="none" stroke="#d4e391" strokeOpacity=".62" strokeWidth="2" />
              <path d="M90 580h250v-70h200v-70h200v-70h190" fill="none" stroke="#d4e391" strokeOpacity=".28" />
              <circle cx="690" cy="240" r="116" fill="none" stroke="#d4e391" strokeOpacity=".19" />
              <circle cx="690" cy="240" r="82" fill="none" stroke="#d4e391" strokeOpacity=".12" />
              <path d="M620 240h140M690 170v140" stroke="#d4e391" strokeOpacity=".19" />
              <path d="m110 790 77-77 77 77-77 77z" fill="#c5d987" fillOpacity=".1" stroke="#d4e391" strokeOpacity=".45" />
              <path d="M146 790h82M187 749v82" stroke="#d4e391" strokeOpacity=".65" />
              <path d="M600 750c75-48 165-48 240 0v150c-75-48-165-48-240 0z" fill="#d4e391" fillOpacity=".1" stroke="#d4e391" strokeOpacity=".4" />
              <path d="M720 750v150" stroke="#d4e391" strokeOpacity=".4" />
            </svg>
          ) : (
            <img
              className="campus-image"
              src={step === 'login' || step === 'details' ? 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85' : '/campus-architecture.png'}
              alt={step === 'login' || step === 'details' ? 'Students collaborating around a table on campus' : 'Modern glass university architecture and a sunlit campus corridor'}
            />
          )}

          <div className="image-wash" />

          <div className="visual-copy">
            <span className="eyebrow">YOUR NEXT CHAPTER</span>

            <h1>
              Make room
              <br />
              for what&apos;s next.
            </h1>

            <p>
              One place to prepare, connect, and move toward work
              that matters.
            </p>

            <div className="visual-bottom">
              <span>
                Internships · Placements · Preparation
              </span>

              <span className="visual-index">01 / 03</span>
            </div>
          </div>

          <span className="photo-credit">
            A student community in motion
          </span>
        </aside>

        <section className="form-panel">
          <div className="form-content">
            {step === 'login' && (
              <>
                <div className="step-line">
                  <span className="step-active" />
                  <span />
                  <span />
                </div>

                <p className="kicker">STUDENT SIGN-IN</p>
                <h2>Welcome back.</h2>

                <p className="intro">
                  Use the registered institutional email for your
                  student account.
                </p>

                <form
                  onSubmit={handleLogin}
                  className="registration-form"
                >
                  <label className="field">
                    <span>Institutional email</span>

                    <input
                      autoComplete="email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField('email', event.target.value)
                      }
                      required
                      maxLength={254}
                    />
                  </label>

                  <label className="field">
                    <span>Password</span>

                    <input
                      autoComplete="current-password"
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        updateField('password', event.target.value)
                      }
                      required
                      minLength={12}
                      maxLength={72}
                    />
                  </label>

                  {error && (
                    <p className="feedback error" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? 'Signing in…' : 'Sign in'}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>

                <button
                  type="button"
                  className="back-button"
                  onClick={() => {
                    setError('');
                    setStep('details');
                  }}
                >
                  ← Create student account
                </button>
              </>
            )}

            {step === 'details' && (
              <>
                <div className="step-line">
                  <span className="step-active" />
                  <span />
                  <span />
                </div>

                <p className="kicker">STUDENT ACCOUNT</p>
                <h2>Start with your details.</h2>

                <p className="intro">
                  Create your portal account with your institutional email.
                </p>

                <form
                  onSubmit={handleRequestCode}
                  className="registration-form"
                >
                  <div className="field-row">
                    <label className="field">
                      <span>Full name</span>

                      <input
                        autoComplete="name"
                        name="fullName"
                        value={form.fullName}
                        onChange={(event) =>
                          updateField('fullName', event.target.value)
                        }
                        placeholder="e.g. Asha Kumar"
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </label>

                    <label className="field">
                      <span>Student ID</span>

                      <input
                        autoComplete="off"
                        name="studentId"
                        value={form.studentId}
                        onChange={(event) =>
                          updateField('studentId', event.target.value)
                        }
                        placeholder="Your campus ID"
                        required
                        maxLength={64}
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Course or programme</span>

                    <input
                      autoComplete="organization-title"
                      name="course"
                      value={form.course}
                      onChange={(event) =>
                        updateField('course', event.target.value)
                      }
                      placeholder="e.g. BSc Computer Science"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>

                  <label className="field">
                    <span>Institutional email</span>

                    <input
                      autoComplete="email"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField('email', event.target.value)
                      }
                      placeholder="you@college.edu"
                      required
                      maxLength={254}
                    />

                    <small>
                      Use the email address issued by your institution.
                    </small>
                  </label>

                  <div className="field-row">
                    <label className="field">
                      <span>Password</span>

                      <input
                        autoComplete="new-password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={(event) =>
                          updateField('password', event.target.value)
                        }
                        placeholder="At least 12 characters"
                        required
                        minLength={12}
                        maxLength={72}
                      />
                    </label>

                    <label className="field">
                      <span>Confirm password</span>

                      <input
                        autoComplete="new-password"
                        type="password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={(event) =>
                          updateField('confirmPassword', event.target.value)
                        }
                        placeholder="Enter it again"
                        required
                        minLength={12}
                        maxLength={72}
                      />
                    </label>
                  </div>

                  {error && (
                    <p className="feedback error" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    className="text-button form-sign-in"
                    onClick={() => {
                      setError('');
                      setStep('login');
                    }}
                  >
                    Already registered? Sign in
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? 'Sending code…' : 'Create account'}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>

                <p className="form-footnote">
                  Hiring for your company?{' '}
                  <a href="/recruiter-request">
                    Request a recruiter account
                  </a>
                </p>
              </>
            )}

            {step === 'verify' && (
              <>
                <div className="step-line">
                  <span className="step-done" />
                  <span className="step-active" />
                  <span />
                </div>

                <p className="kicker">EMAIL VERIFICATION</p>
                <h2>Check your inbox.</h2>

                <p className="intro">
                  We sent a six-digit code to <strong>{form.email}</strong>.
                  Enter it below to finish creating your account.
                </p>

                {notice && (
                  <p className="feedback success" role="status">
                    {notice}
                  </p>
                )}

                <form
                  onSubmit={handleVerify}
                  className="registration-form verify-form"
                >
                  <label className="field">
                    <span>Verification code</span>

                    <input
                      className="otp-input"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      name="otp"
                      value={otp}
                      onChange={(event) => {
                        setOtp(
                          event.target.value.replace(/\D/g, '').slice(0, 6),
                        );
                        setError('');
                      }}
                      placeholder="000000"
                      required
                      pattern="[0-9]{6}"
                      maxLength={6}
                      aria-label="Six-digit email verification code"
                    />

                    <small>
                      Code expires 10 minutes after it was sent.
                    </small>
                  </label>

                  {error && (
                    <p className="feedback error" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={busy || otp.length !== 6}
                  >
                    {busy ? 'Verifying…' : 'Verify and create account'}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>

                <div className="resend-row">
                  <span>Didn&apos;t receive it?</span>

                  <button
                    type="button"
                    className="text-button"
                    onClick={handleResend}
                    disabled={busy || resendSeconds > 0}
                  >
                    {resendSeconds > 0
                      ? `Resend in ${resendSeconds}s`
                      : 'Send a new code'}
                  </button>
                </div>

                <button
                  type="button"
                  className="back-button"
                  onClick={() => {
                    setError('');
                    setStep('details');
                  }}
                >
                  ← Edit registration details
                </button>
              </>
            )}

            {step === 'complete' && (
              <div className="complete-state">
                <div className="complete-icon" aria-hidden="true">
                  ✓
                </div>

                <p className="kicker">
                  {studentToken ? 'STUDENT PROFILE' : 'EMAIL VERIFIED'}
                </p>

                <h2>
                  {studentToken
                    ? 'Manage your profile.'
                    : 'You’re on your way.'}
                </h2>

                <p className="intro">{notice}</p>

                {studentToken ? (
                  <>
                    <ProfilePage token={studentToken} />

                    <ApplicationPage token={studentToken} />

                    <ApplicationTrackingPage token={studentToken} />

                    <MockTestPage token={studentToken} />

                    <InterviewQuestionBank />

                    <MockTestHistoryPage token={studentToken} />

                    <button
                      className="back-button"
                      type="button"
                      onClick={signOut}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="account-summary">
                      <span>STUDENT ACCOUNT</span>
                      <strong>{form.fullName}</strong>
                      <small>{form.email}</small>
                    </div>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setError('');
                        setStep('login');
                      }}
                    >
                      Sign in to manage your profile
                      <span aria-hidden="true">↗</span>
                    </button>

                    <button
                      className="back-button"
                      type="button"
                      onClick={() => {
                        setForm(initialForm);
                        setOtp('');
                        setNotice('');
                        setStep('details');
                      }}
                    >
                      Register another student
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <footer className="form-footer">
            <div className="form-footer-row">
              <span>© 2026 OIPP</span>
              <span>Built for your next step.</span>
            </div>

            <a href="/admin/login">Admin Login</a>
            <a href="/recruiter/login">Recruiter Login</a>
            <a href="/mock-interviews">Mock Interviews</a>
          </footer>
        </section>
      </section>
    </main>
  );
}

export default App;
