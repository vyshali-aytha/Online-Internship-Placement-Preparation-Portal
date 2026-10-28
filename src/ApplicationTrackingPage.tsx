import { useEffect, useState } from 'react';

type Application = {
  id: number;
  listing_id: number;
  title: string;
  company_name: string;
  location: string | null;
  status: 'Applied' | 'Shortlisted' | 'Interview' | 'Selected' | 'Rejected';
  applied_at: string;
  updated_at: string;
};

export default function ApplicationTrackingPage({ token }: { token: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/student/applications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not load applications.');
        if (active) setApplications(data.applications || []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load applications.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  return (
    <section className="applications-page" aria-labelledby="tracking-heading">
      <h3 id="tracking-heading">My applications</h3>
      {loading && <p className="intro">Loading applications…</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      {!loading && !error && applications.length === 0 &&
        <p className="intro">Your submitted applications will appear here.</p>}
      <div className="application-list">
        {applications.map((application) => (
          <article className="application-card" key={application.id}>
            <div>
              <h4>{application.title}</h4>
              <p>{application.company_name}{application.location ? ` · ${application.location}` : ''}</p>
              <small>Applied {new Date(application.applied_at).toLocaleDateString()}</small>
            </div>
            <span className={`application-status status-${application.status.toLowerCase()}`}>
              {application.status}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
