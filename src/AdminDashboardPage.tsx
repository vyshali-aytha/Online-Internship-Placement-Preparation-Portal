import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  decideRecruiterRequest,
  getPendingRecruiterRequests,
  type RecruiterDecision,
  type RecruiterRequest,
} from './services/adminApi';

function formatSubmissionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function statusMessage(error: unknown) {
  if (!(error instanceof AdminApiError)) {
    return error instanceof Error ? error.message : 'Could not load recruiter requests.';
  }
  if (error.status === 401) return 'Your admin session has expired. Sign in again to continue.';
  if (error.status === 403) return 'Access denied. This session does not have administrator access.';
  if (error.status >= 500) return error.message || 'The server could not complete the request.';
  return error.message;
}

export default function AdminDashboardPage() {
  const [token] = useState(() => sessionStorage.getItem('oipp_admin_token') || '');
  const [requests, setRequests] = useState<RecruiterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [processingAction, setProcessingAction] = useState<{
    id: number;
    decision: RecruiterDecision;
  } | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setLoadError('Sign in with an administrator account to view recruiter requests.');
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      setRequests(await getPendingRecruiterRequests(token));
    } catch (error) {
      setLoadError(statusMessage(error));
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        sessionStorage.removeItem('oipp_admin_token');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function handleDecision(request: RecruiterRequest, decision: RecruiterDecision) {
    if (request.status !== 'PENDING' || processingAction !== null) return;
    const verb = decision === 'APPROVED' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${verb} ${request.full_name}'s recruiter request?`)) {
      return;
    }

    setProcessingAction({ id: request.id, decision });
    setFeedback('');
    setActionError('');
    try {
      const result = await decideRecruiterRequest(token, request.id, decision);
      setRequests((current) => current.filter((item) => item.id !== result.id));
      setFeedback(`${request.full_name}'s request was ${result.status.toLowerCase()}.`);
      await loadRequests();
    } catch (error) {
      setActionError(statusMessage(error));
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        sessionStorage.removeItem('oipp_admin_token');
        setLoadError(statusMessage(error));
      }
      if (error instanceof AdminApiError && (error.status === 404 || error.status === 409)) {
        await loadRequests();
      }
    } finally {
      setProcessingAction(null);
    }
  }

  function signOut() {
    sessionStorage.removeItem('oipp_admin_token');
    window.location.assign('/admin/login');
  }

  return (
    <main className="page-shell admin-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="OIPP home">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span>OIPP<span className="brand-period">.</span></span>
        </a>
        <div className="admin-header-actions">
          <span className="topbar-note"><span className="status-dot" /> Admin workspace</span>
          <button className="admin-link-button" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
        <div className="admin-dashboard-heading">
          <div>
            <p className="kicker">RECRUITER ACCESS</p>
            <h1 id="admin-dashboard-title">Recruiter requests</h1>
            <p className="intro">Review and decide which companies can access the recruiter portal.</p>
          </div>
          <button className="refresh-button" type="button" onClick={() => void loadRequests()} disabled={loading}>
            <span aria-hidden="true">↻</span> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <section className="admin-summary" aria-label="Pending request summary">
          <span className="summary-icon" aria-hidden="true">⌁</span>
          <div>
            <strong>{loading ? '—' : requests.length}</strong>
            <span>Pending {requests.length === 1 ? 'request' : 'requests'}</span>
          </div>
          <span className="summary-caption">Awaiting review</span>
        </section>

        {feedback && <p className="admin-feedback admin-feedback-success" role="status">{feedback}</p>}
        {actionError && <p className="admin-feedback admin-feedback-error" role="alert">{actionError}</p>}

        <section className="admin-request-panel" aria-label="Pending recruiter requests">
          <div className="admin-panel-heading">
            <div>
              <h2>Requests to review</h2>
              <p>Requests appear here until they are approved or rejected.</p>
            </div>
            {!loading && <span className="pending-count">{requests.length} PENDING</span>}
          </div>

          {loading ? (
            <div className="admin-state" role="status"><span className="admin-spinner" /> Loading recruiter requests…</div>
          ) : loadError ? (
            <div className="admin-state admin-state-error" role="alert">
              <strong>Couldn&apos;t load requests</strong>
              <span>{loadError}</span>
              {!token || loadError.includes('expired') || loadError.includes('Access denied') ? (
                <a className="admin-retry-link" href="/admin/login">Return to admin sign-in</a>
              ) : (
                <button className="admin-retry-button" type="button" onClick={() => void loadRequests()}>Try again</button>
              )}
            </div>
          ) : requests.length === 0 ? (
            <div className="admin-state admin-state-empty">
              <span className="empty-check" aria-hidden="true">✓</span>
              <strong>You&apos;re all caught up.</strong>
              <span>There are no pending recruiter requests right now.</span>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Recruiter</th>
                    <th scope="col">Company</th>
                    <th scope="col">Status</th>
                    <th scope="col">Submitted</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td data-label="Recruiter">
                        <strong className="request-name">{request.full_name}</strong>
                        <a className="request-email" href={`mailto:${request.email}`}>{request.email}</a>
                      </td>
                      <td data-label="Company">{request.company_name}</td>
                      <td data-label="Status"><span className="admin-status">{request.status}</span></td>
                      <td data-label="Submitted">{formatSubmissionDate(request.created_at)}</td>
                      <td data-label="Actions">
                        <div className="request-actions">
                          <button
                            className="decision-button decision-approve"
                            type="button"
                            disabled={processingAction !== null || request.status !== 'PENDING'}
                            onClick={() => void handleDecision(request, 'APPROVED')}
                          >
                            {processingAction?.id === request.id && processingAction.decision === 'APPROVED' ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            className="decision-button decision-reject"
                            type="button"
                            disabled={processingAction !== null || request.status !== 'PENDING'}
                            onClick={() => void handleDecision(request, 'REJECTED')}
                          >
                            {processingAction?.id === request.id && processingAction.decision === 'REJECTED' ? 'Rejecting…' : 'Reject'}
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
      </section>
    </main>
  );
}
