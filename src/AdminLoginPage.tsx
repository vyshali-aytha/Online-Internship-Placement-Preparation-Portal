import { useState, type FormEvent } from 'react';
import { AdminApiError, loginAdmin } from './services/adminApi';

function loginErrorMessage(error: unknown) {
  if (!(error instanceof AdminApiError)) {
    return error instanceof Error ? error.message : 'Could not sign in.';
  }
  if (error.status === 401) return 'The email or password is incorrect.';
  if (error.status === 429) return 'Too many sign-in attempts. Please wait and try again.';
  if (error.status === 503) return 'Admin sign-in is not configured on the server.';
  return error.message;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await loginAdmin(email.trim(), password);
      if (!result.token) {
        throw new AdminApiError('The server did not return an admin session.', 0);
      }
      sessionStorage.setItem('oipp_admin_token', result.token);
      window.location.assign('/admin');
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
        <div className="topbar-note"><span className="status-dot" /> Administrator access</div>
      </header>

      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <p className="kicker">ADMINISTRATOR SIGN-IN</p>
        <h1 id="admin-login-title">Welcome back.</h1>
        <p className="intro">Sign in with your pre-configured administrator account to review recruiter requests.</p>
        <form className="registration-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Admin email</span>
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(''); }}
              maxLength={254}
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
        <p className="form-footnote">Administrator accounts are provisioned by the system owner.</p>
      </section>
    </main>
  );
}
