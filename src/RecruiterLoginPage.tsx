import { useState, type FormEvent } from 'react';
import { RecruiterPortalError, loginRecruiter } from './services/recruiterPortalApi';
import './recruiter-portal.css';

function loginErrorMessage(error: unknown) {
  if (!(error instanceof RecruiterPortalError)) {
    return error instanceof Error ? error.message : 'Could not sign in.';
  }
  if (error.status === 401) return 'The email or password is incorrect.';
  if (error.status === 403) return 'Your recruiter account has not been approved yet. The placement cell will review your request.';
  if (error.status === 429) return 'Too many sign-in attempts. Please wait and try again.';
  return error.message;
}

export default function RecruiterLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await loginRecruiter(email.trim(), password);
      if (!result.token) throw new RecruiterPortalError('The server did not return a session.', 0);
      sessionStorage.setItem('oipp_recruiter_token', result.token);
      window.location.assign('/recruiter');
    } catch (loginError) {
      setError(loginErrorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell admin-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OIPP home">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span>OIPP<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-note"><span className="status-dot" /> Recruiter access</div>
      </header>

      <section className="admin-login-card" aria-labelledby="recruiter-login-title">
        <p className="kicker">RECRUITER SIGN-IN</p>
        <h1 id="recruiter-login-title">Welcome back.</h1>
        <p className="intro">Sign in to post opportunities and review applicants.</p>
        <form className="registration-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Work email</span>
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(''); }}
              maxLength={255}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(''); }}
              required
            />
          </label>
          {error && <p className="feedback error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="form-footnote">
          No account yet? <a href="/recruiter-request">Request a recruiter account</a>
        </p>
      </section>
    </main>
  );
}
