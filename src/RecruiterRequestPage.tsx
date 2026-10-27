import { useState, type FormEvent, type ReactNode } from 'react';
import {
  RecruiterRequestError,
  submitRecruiterRequest,
  type RecruiterRequestInput,
} from './services/recruiterApi';

type FormState = RecruiterRequestInput & { confirmPassword: string };
type FieldErrors = Partial<Record<keyof FormState, string>>;
type Submitted = { email: string; fullName: string; companyName: string };

const initialForm: FormState = {
  fullName: '',
  email: '',
  companyName: '',
  password: '',
  confirmPassword: '',
};

// Mirrors the server rules in server/recruiter-requests.js
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.fullName.trim();
  const company = form.companyName.trim();
  const email = form.email.trim();

  if (name.length < 2) errors.fullName = 'Enter your full name (at least 2 characters).';
  else if (name.length > 100) errors.fullName = 'Name must be 100 characters or fewer.';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid work email address.';
  else if (email.length > 255) errors.email = 'Email must be 255 characters or fewer.';

  if (company.length < 2) errors.companyName = 'Enter your company name (at least 2 characters).';
  else if (company.length > 150) errors.companyName = 'Company name must be 150 characters or fewer.';

  if (form.password.length < 12) errors.password = 'Use at least 12 characters.';
  else if (new TextEncoder().encode(form.password).length > 72) {
    errors.password = 'Password is too long (72 bytes maximum).';
  }

  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Those passwords do not match.';

  return errors;
}

// Purely visual guidance; the real rule is the 12-character minimum.
function passwordStrength(password: string) {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length < 12) score = Math.min(score, 1);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: password.length < 12 ? 'Too short' : labels[score] };
}

const icons = {
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 10h5a1 1 0 0 1 1 1v10M2 21h20" /><path d="M8 8h2M8 12h2M8 16h2" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  shield: <path d="M12 3 4 6v6c0 4.4 3.1 8 8 9 4.9-1 8-4.6 8-9V6l-8-3Zm-3 9 2.2 2.2L15.5 10" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></>,
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function Field(props: { label: string; icon: keyof typeof icons; error?: string; hint?: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <label className={`field has-icon${props.error ? ' has-error' : ''}`}>
      <span>{props.label}</span>
      <div className="input-wrap">
        <Icon name={props.icon} />
        {props.children}
        {props.trailing}
      </div>
      {props.error
        ? <small className="field-error" role="alert">{props.error}</small>
        : props.hint && <small>{props.hint}</small>}
    </label>
  );
}

export default function RecruiterRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);

  const strength = passwordStrength(form.password);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const fullName = form.fullName.trim();
      const companyName = form.companyName.trim();
      const result = await submitRecruiterRequest({
        fullName,
        email: form.email.trim(),
        companyName,
        password: form.password,
      });
      setSubmitted({ email: result.email, fullName, companyName });
      setForm(initialForm); // never keep the password in state after submit
      setShowPassword(false);
    } catch (submitError) {
      if (submitError instanceof RecruiterRequestError && submitError.status === 409) {
        setFieldErrors({ email: submitError.message });
      } else {
        setError(
          submitError instanceof Error ? submitError.message : 'Could not submit your request.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const stage = submitted ? 2 : 1;

  return (
    <main className="page-shell recruiter-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OIPP home">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span>OIPP<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-note"><span className="status-dot" /> Recruiter portal</div>
      </header>

      <section className="registration-layout" aria-label="Recruiter account request">
        <aside className="visual-panel recruiter-visual">
          <img
            className="campus-image"
            src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=85"
            alt="A team collaborating in a meeting"
          />
          <div className="image-wash" />
          <div className="visual-copy">
            <span className="eyebrow">HIRE WITH US</span>
            <h1>Meet the talent<br />you&apos;re looking for.</h1>
            <p>Request a recruiter account to post internships and connect with students ready to start.</p>
            <ul className="perk-list">
              <li><Icon name="briefcase" /> Post internships &amp; placement drives</li>
              <li><Icon name="shield" /> Every account verified by the placement cell</li>
              <li><Icon name="clock" /> Reviewed by an admin before access is granted</li>
            </ul>
            <div className="visual-bottom">
              <span>Internships · Placements · Hiring</span>
              <span className="visual-index">02 / 03</span>
            </div>
          </div>
        </aside>

        <section className="form-panel">
          <div className="form-content">
            <ol className="stage-tracker" aria-label="Request progress">
              {['Request', 'Admin review', 'Access'].map((label, index) => {
                const n = index + 1;
                const state = n < stage ? 'done' : n === stage ? 'active' : '';
                return (
                  <li key={label} className={state}>
                    <span className="stage-dot">{state === 'done' ? <Icon name="check" /> : n}</span>
                    <span className="stage-label">{label}</span>
                  </li>
                );
              })}
            </ol>

            {submitted ? (
              <div className="complete-state recruiter-done" role="status">
                <div className="success-ring" aria-hidden="true"><Icon name="check" /></div>
                <p className="kicker">REQUEST SUBMITTED</p>
                <h2>You&apos;re in the queue.</h2>
                <p className="intro">
                  Your recruiter account request has been submitted and is <strong>pending admin approval</strong>.
                  You won&apos;t be able to sign in as a recruiter until the placement cell reviews it.
                </p>

                <div className="request-card">
                  <div className="request-card-head">
                    <span>YOUR REQUEST</span>
                    <span className="badge-pending"><i /> PENDING</span>
                  </div>
                  <dl>
                    <div><dt>Name</dt><dd>{submitted.fullName}</dd></div>
                    <div><dt>Company</dt><dd>{submitted.companyName}</dd></div>
                    <div><dt>Work email</dt><dd>{submitted.email}</dd></div>
                  </dl>
                </div>

                <ol className="next-steps">
                  <li className="done"><b>Request received</b><span>Your details are saved securely.</span></li>
                  <li><b>Admin review</b><span>The placement cell checks your company details.</span></li>
                  <li><b>Account activated</b><span>Once approved, sign in with your work email.</span></li>
                </ol>

                <a className="back-button" href="/">← Back to home</a>
              </div>
            ) : (
              <>
                <p className="kicker">RECRUITER ACCOUNT</p>
                <h2>Request recruiter access.</h2>
                <p className="intro">
                  Tell us who you are. The placement cell reviews every request before an account is activated.
                </p>
                <form onSubmit={handleSubmit} className="registration-form" noValidate>
                  <Field label="Full name" icon="user" error={fieldErrors.fullName}>
                    <input autoComplete="name" name="fullName" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="e.g. Ravi Menon" maxLength={100} aria-invalid={!!fieldErrors.fullName} />
                  </Field>
                  <Field label="Work email" icon="mail" error={fieldErrors.email} hint="Use your company email address.">
                    <input autoComplete="email" type="email" name="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="you@company.com" maxLength={255} aria-invalid={!!fieldErrors.email} />
                  </Field>
                  <Field label="Company name" icon="building" error={fieldErrors.companyName}>
                    <input autoComplete="organization" name="companyName" value={form.companyName} onChange={(e) => updateField('companyName', e.target.value)} placeholder="e.g. Acme Technologies" maxLength={150} aria-invalid={!!fieldErrors.companyName} />
                  </Field>
                  <div className="field-row">
                    <Field
                      label="Password"
                      icon="lock"
                      error={fieldErrors.password}
                      trailing={
                        <button type="button" className="eye-button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                        </button>
                      }
                    >
                      <input autoComplete="new-password" type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="At least 12 characters" maxLength={72} aria-invalid={!!fieldErrors.password} />
                    </Field>
                    <Field label="Confirm password" icon="lock" error={fieldErrors.confirmPassword}>
                      <input autoComplete="new-password" type={showPassword ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} placeholder="Enter it again" maxLength={72} aria-invalid={!!fieldErrors.confirmPassword} />
                    </Field>
                  </div>

                  {form.password && (
                    <div className="strength" data-score={strength.score} aria-live="polite">
                      <div className="strength-bars"><i /><i /><i /><i /></div>
                      <span>{strength.label}</span>
                    </div>
                  )}

                  {error && <p className="feedback error banner-error" role="alert">{error}</p>}
                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? 'Submitting…' : 'Submit request'}
                    <span aria-hidden="true">↗</span>
                  </button>
                  <p className="secure-note"><Icon name="lock" /> Your password is encrypted. No access is granted until an admin approves you.</p>
                </form>
                <p className="form-footnote">Are you a student? <a href="/">Go to student sign-up</a></p>
              </>
            )}
          </div>
          <footer className="form-footer"><span>© 2026 OIPP</span><span>Built for your next step.</span></footer>
        </section>
      </section>
    </main>
  );
}
