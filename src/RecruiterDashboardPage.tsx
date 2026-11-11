import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  RecruiterPortalError,
  closeRecruiterListing,
  createRecruiterListing,
  decideApplication,
  getListingApplicants,
  getRecruiterListings,
  publishRecruiterListing,
  type Applicant,
  type Decision,
  type ListingType,
  type NewListingInput,
  type RecruiterListing,
} from './services/recruiterPortalApi';
import './recruiter-portal.css';

const TOKEN_KEY = 'oipp_recruiter_token';
// Statuses a recruiter may change; Interview/Selected are managed elsewhere.
const CHANGEABLE = ['Applied', 'Shortlisted', 'Rejected'];

type FormErrors = Partial<Record<keyof NewListingInput, string>>;

const emptyForm: NewListingInput = {
  title: '',
  companyName: '',
  description: '',
  location: '',
  listingType: 'Internship',
  minCgpa: '',
  publish: false,
};

// Mirrors the server rules in server/recruiter-listings.js
function validate(form: NewListingInput): FormErrors {
  const errors: FormErrors = {};
  const title = form.title.trim();
  const company = form.companyName.trim();
  const location = form.location.trim();
  const description = form.description.trim();

  if (title.length < 2) errors.title = 'Enter a title (at least 2 characters).';
  else if (title.length > 180) errors.title = 'Title must be 180 characters or fewer.';
  if (company.length < 2) errors.companyName = 'Enter the company name (at least 2 characters).';
  else if (company.length > 150) errors.companyName = 'Company name must be 150 characters or fewer.';
  if (location.length < 1) errors.location = 'Enter a location.';
  else if (location.length > 120) errors.location = 'Location must be 120 characters or fewer.';
  if (description.length < 1) errors.description = 'Add a short description.';
  else if (description.length > 5000) errors.description = 'Description must be 5000 characters or fewer.';

  const cgpa = form.minCgpa.trim();
  if (cgpa !== '') {
    const value = Number(cgpa);
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      errors.minCgpa = 'Minimum CGPA must be a number from 0 to 10.';
    }
  }
  return errors;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatCgpa(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value);
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rec-badge rec-badge-${status.toLowerCase()}`}>{status}</span>;
}

export default function RecruiterDashboardPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [sessionMessage, setSessionMessage] = useState('');
  const [listings, setListings] = useState<RecruiterListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [form, setForm] = useState<NewListingInput>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<RecruiterListing | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicantsError, setApplicantsError] = useState('');

  const endSession = useCallback((message: string) => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setSessionMessage(message);
  }, []);

  // Returns true when the error ended the session.
  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof RecruiterPortalError && (error.status === 401 || error.status === 403)) {
      endSession(error.status === 401
        ? 'Your session has expired. Sign in again to continue.'
        : 'This account is not approved for recruiter access.');
      return true;
    }
    return false;
  }, [endSession]);

  const loadListings = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setLoadError('');
    try {
      setListings(await getRecruiterListings(token));
    } catch (error) {
      if (!handleAuthError(error)) {
        setLoadError(error instanceof Error ? error.message : 'Could not load your listings.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, handleAuthError]);

  useEffect(() => { void loadListings(); }, [loadListings]);

  function updateField<K extends keyof NewListingInput>(field: K, value: NewListingInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setActionError('');
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setActionError('');
    const errors = validate(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    try {
      const result = await createRecruiterListing(token, form);
      setNotice(result.status === 'OPEN'
        ? 'Listing published. Students can see it now.'
        : 'Listing saved as a draft. Publish it when you are ready.');
      setForm({ ...emptyForm, listingType: form.listingType });
      await loadListings();
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionError(error instanceof Error ? error.message : 'Could not create the listing.');
      }
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(listing: RecruiterListing, action: 'publish' | 'close') {
    if (busyKey) return;
    if (action === 'close' && !window.confirm(`Close "${listing.title}"? Students will no longer see it.`)) return;

    setBusyKey(`${action}-${listing.id}`);
    setNotice('');
    setActionError('');
    try {
      if (action === 'publish') await publishRecruiterListing(token, listing.id);
      else await closeRecruiterListing(token, listing.id);
      setNotice(action === 'publish' ? `"${listing.title}" is now published.` : `"${listing.title}" is now closed.`);
      await loadListings();
      if (selected?.id === listing.id) {
        setSelected({ ...listing, status: action === 'publish' ? 'OPEN' : 'CLOSED' });
      }
    } catch (error) {
      if (!handleAuthError(error)) {
        setActionError(error instanceof Error ? error.message : 'Could not update the listing.');
        await loadListings();
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function viewApplicants(listing: RecruiterListing) {
    setSelected(listing);
    setApplicants([]);
    setApplicantsError('');
    setApplicantsLoading(true);
    try {
      const result = await getListingApplicants(token, listing.id);
      setApplicants(result.applicants);
    } catch (error) {
      if (!handleAuthError(error)) {
        setApplicantsError(error instanceof Error ? error.message : 'Could not load applicants.');
      }
    } finally {
      setApplicantsLoading(false);
    }
  }

  async function decide(applicant: Applicant, status: Decision) {
    if (busyKey) return;
    const name = applicant.student.fullName || 'this applicant';
    if (status === 'Rejected' && !window.confirm(`Reject ${name}'s application?`)) return;

    setBusyKey(`app-${applicant.applicationId}`);
    setNotice('');
    setApplicantsError('');
    try {
      await decideApplication(token, applicant.applicationId, status);
      setApplicants((current) => current.map((item) => (
        item.applicationId === applicant.applicationId ? { ...item, status } : item
      )));
      setNotice(`${name} was marked ${status.toLowerCase()}.`);
    } catch (error) {
      if (!handleAuthError(error)) {
        setApplicantsError(error instanceof Error ? error.message : 'Could not update the application.');
        if (selected) await viewApplicants(selected);
      }
    } finally {
      setBusyKey(null);
    }
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.assign('/recruiter/login');
  }

  const openCount = listings.filter((listing) => listing.status === 'OPEN').length;
  const draftCount = listings.filter((listing) => listing.status === 'DRAFT').length;

  const header = (
    <header className="topbar">
      <a className="brand" href="/" aria-label="OIPP home">
        <span className="brand-mark" aria-hidden="true">O</span>
        <span>OIPP<span className="brand-period">.</span></span>
      </a>
      <div className="admin-header-actions">
        <span className="topbar-note"><span className="status-dot" /> Recruiter workspace</span>
        {token && <button className="admin-link-button" type="button" onClick={signOut}>Sign out</button>}
      </div>
    </header>
  );

  if (!token) {
    return (
      <main className="page-shell admin-page">
        {header}
        <section className="admin-dashboard" aria-labelledby="recruiter-signed-out">
          <div className="admin-state admin-state-error rec-signed-out" role="alert">
            <strong id="recruiter-signed-out">You are signed out</strong>
            <span>{sessionMessage || 'Sign in with an approved recruiter account to manage listings.'}</span>
            <a className="admin-retry-link" href="/recruiter/login">Go to recruiter sign-in</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell admin-page">
      {header}

      <section className="admin-dashboard" aria-labelledby="recruiter-dashboard-title">
        <div className="admin-dashboard-heading">
          <div>
            <p className="kicker">RECRUITER WORKSPACE</p>
            <h1 id="recruiter-dashboard-title">Your listings</h1>
            <p className="intro">Create internship and placement listings, then review and shortlist applicants.</p>
          </div>
          <button className="refresh-button" type="button" onClick={() => void loadListings()} disabled={loading}>
            <span aria-hidden="true">↻</span> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <section className="admin-summary" aria-label="Listing summary">
          <span className="summary-icon" aria-hidden="true">⌁</span>
          <div>
            <strong>{loading ? '—' : openCount}</strong>
            <span>Open {openCount === 1 ? 'listing' : 'listings'}</span>
          </div>
          <span className="summary-caption">{loading ? '' : `${draftCount} draft${draftCount === 1 ? '' : 's'}`}</span>
        </section>

        {notice && <p className="admin-feedback admin-feedback-success" role="status">{notice}</p>}
        {actionError && <p className="admin-feedback admin-feedback-error" role="alert">{actionError}</p>}

        <section className="admin-report-panel" aria-labelledby="create-listing-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="create-listing-title">Create a listing</h2>
              <p>Save it as a draft, or publish it straight away so students can see it.</p>
            </div>
          </div>
          <form className="rec-create-form" onSubmit={handleCreate} noValidate>
            <label className="field compact-field">
              <span>Title</span>
              <input value={form.title} maxLength={180} onChange={(e) => updateField('title', e.target.value)}
                aria-invalid={Boolean(formErrors.title)} />
              {formErrors.title && <small className="field-error" role="alert">{formErrors.title}</small>}
            </label>
            <label className="field compact-field">
              <span>Company</span>
              <input value={form.companyName} maxLength={150} onChange={(e) => updateField('companyName', e.target.value)}
                aria-invalid={Boolean(formErrors.companyName)} />
              {formErrors.companyName && <small className="field-error" role="alert">{formErrors.companyName}</small>}
            </label>
            <label className="field compact-field">
              <span>Location</span>
              <input value={form.location} maxLength={120} onChange={(e) => updateField('location', e.target.value)}
                aria-invalid={Boolean(formErrors.location)} />
              {formErrors.location && <small className="field-error" role="alert">{formErrors.location}</small>}
            </label>
            <label className="field compact-field">
              <span>Type</span>
              <select value={form.listingType} onChange={(e) => updateField('listingType', e.target.value as ListingType)}>
                <option value="Internship">Internship</option>
                <option value="Placement">Placement</option>
              </select>
            </label>
            <label className="field compact-field">
              <span>Minimum CGPA (optional)</span>
              <input type="number" min="0" max="10" step="0.1" inputMode="decimal" value={form.minCgpa}
                onChange={(e) => updateField('minCgpa', e.target.value)} aria-invalid={Boolean(formErrors.minCgpa)} />
              {formErrors.minCgpa && <small className="field-error" role="alert">{formErrors.minCgpa}</small>}
            </label>
            <label className="rec-check">
              <input type="checkbox" checked={form.publish} onChange={(e) => updateField('publish', e.target.checked)} />
              <span>Publish immediately</span>
            </label>
            <label className="field compact-field rec-wide">
              <span>Description</span>
              <textarea rows={4} value={form.description} maxLength={5000}
                onChange={(e) => updateField('description', e.target.value)} aria-invalid={Boolean(formErrors.description)} />
              {formErrors.description && <small className="field-error" role="alert">{formErrors.description}</small>}
            </label>
            <div className="rec-form-actions rec-wide">
              <button className="primary-button" type="submit" disabled={creating}>
                {creating ? 'Saving…' : form.publish ? 'Create and publish' : 'Save as draft'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-request-panel" aria-labelledby="my-listings-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="my-listings-title">My listings</h2>
              <p>Only listings created by your account appear here.</p>
            </div>
            <span className="pending-count">{listings.length} total</span>
          </div>

          {loading ? (
            <div className="admin-state" role="status"><span className="admin-spinner" aria-hidden="true" /> Loading listings…</div>
          ) : loadError ? (
            <div className="admin-state admin-state-error" role="alert">
              <strong>Couldn&apos;t load your listings</strong>
              <span>{loadError}</span>
              <button className="admin-retry-button" type="button" onClick={() => void loadListings()}>Try again</button>
            </div>
          ) : listings.length === 0 ? (
            <div className="admin-state">
              <strong>No listings yet</strong>
              <span>Create your first listing above.</span>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Listing</th><th>Type</th><th>Min CGPA</th><th>Status</th><th>Created</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
                    <tr key={listing.id} className={selected?.id === listing.id ? 'rec-row-selected' : undefined}>
                      <td data-label="Listing">
                        <strong className="request-name">{listing.title}</strong>
                        <span className="request-email">{listing.company_name}{listing.location ? ` · ${listing.location}` : ''}</span>
                      </td>
                      <td data-label="Type">{listing.listing_type}</td>
                      <td data-label="Min CGPA">{formatCgpa(listing.min_cgpa)}</td>
                      <td data-label="Status"><StatusBadge status={listing.status} /></td>
                      <td data-label="Created">{formatDate(listing.created_at)}</td>
                      <td data-label="Actions">
                        <div className="request-actions">
                          {listing.status === 'DRAFT' && (
                            <button className="decision-button decision-approve" type="button"
                              disabled={busyKey !== null} onClick={() => void changeStatus(listing, 'publish')}>
                              {busyKey === `publish-${listing.id}` ? 'Publishing…' : 'Publish'}
                            </button>
                          )}
                          {listing.status === 'OPEN' && (
                            <button className="decision-button decision-reject" type="button"
                              disabled={busyKey !== null} onClick={() => void changeStatus(listing, 'close')}>
                              {busyKey === `close-${listing.id}` ? 'Closing…' : 'Close'}
                            </button>
                          )}
                          <button className="decision-button rec-neutral" type="button"
                            onClick={() => void viewApplicants(listing)}>
                            Applicants
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <section className="admin-request-panel rec-applicants" aria-labelledby="applicants-title">
            <div className="admin-panel-heading">
              <div>
                <h2 id="applicants-title">Applicants for {selected.title}</h2>
                <p>Shortlist or reject candidates. Students see the update in their application tracker.</p>
              </div>
              <button className="admin-link-button" type="button" onClick={() => setSelected(null)}>Close panel</button>
            </div>

            {applicantsError && <p className="admin-feedback admin-feedback-error rec-inline-feedback" role="alert">{applicantsError}</p>}

            {applicantsLoading ? (
              <div className="admin-state" role="status"><span className="admin-spinner" aria-hidden="true" /> Loading applicants…</div>
            ) : applicants.length === 0 && !applicantsError ? (
              <div className="admin-state">
                <strong>No applicants yet</strong>
                <span>Applications will appear here once students apply.</span>
              </div>
            ) : (
              <ul className="rec-applicant-list">
                {applicants.map((applicant) => {
                  const student = applicant.student;
                  const locked = !CHANGEABLE.includes(applicant.status);
                  const busy = busyKey === `app-${applicant.applicationId}`;
                  return (
                    <li className="rec-applicant" key={applicant.applicationId}>
                      <div className="rec-applicant-main">
                        <div className="rec-applicant-head">
                          <strong>{student.fullName || 'Unnamed applicant'}</strong>
                          <StatusBadge status={applicant.status} />
                        </div>
                        <p className="rec-meta">
                          {student.email && <a href={`mailto:${student.email}`}>{student.email}</a>}
                          {student.studentId && <span>{student.studentId}</span>}
                          {student.course && <span>{student.course}</span>}
                          <span>CGPA {formatCgpa(student.cgpa)}</span>
                          {student.location && <span>{student.location}</span>}
                        </p>
                        {student.headline && <p className="rec-headline">{student.headline}</p>}
                        {student.skills && <p className="rec-detail"><b>Skills:</b> {student.skills}</p>}
                        {student.projects && <p className="rec-detail"><b>Projects:</b> {student.projects}</p>}
                        <p className="rec-detail rec-muted">
                          Applied {formatDate(applicant.appliedAt)}
                          {applicant.resumeName ? ` · Resume: ${applicant.resumeName}` : ''}
                        </p>
                      </div>
                      <div className="request-actions rec-applicant-actions">
                        {locked ? (
                          <span className="rec-muted">Managed elsewhere</span>
                        ) : (
                          <>
                            <button className="decision-button decision-approve" type="button"
                              disabled={busyKey !== null || applicant.status === 'Shortlisted'}
                              onClick={() => void decide(applicant, 'Shortlisted')}>
                              {busy ? 'Saving…' : applicant.status === 'Shortlisted' ? 'Shortlisted' : 'Shortlist'}
                            </button>
                            <button className="decision-button decision-reject" type="button"
                              disabled={busyKey !== null || applicant.status === 'Rejected'}
                              onClick={() => void decide(applicant, 'Rejected')}>
                              {applicant.status === 'Rejected' ? 'Rejected' : 'Reject'}
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
