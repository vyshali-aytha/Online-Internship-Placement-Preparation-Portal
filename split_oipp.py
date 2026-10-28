from pathlib import Path
import re
import sys

mode = sys.argv[1]
app_path = Path("src/App.tsx")
page_path = Path("src/ApplicationPage.tsx")
api_path = Path("server/applications.js")

if mode == "clean10":
    app = app_path.read_text(encoding="utf-8-sig")
    app = app.replace("import ApplicationPage from './ApplicationPage';\n", "")
    app = app.replace("          <ApplicationPage token={studentToken} />\n", "")
    app_path.write_text(app, encoding="utf-8")

    page = page_path.read_text(encoding="utf-8-sig")
    page, n = re.subn(r"\ntype Application = \{.*?\n\};\n", "\n", page, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Could not isolate the application-tracking type; no commit made.")

    page = page.replace("  const [applications, setApplications] = useState<Application[]>([]);\n", "")
    page, n = re.subn(
        r"      const \[listingResponse, applicationResponse\] = await Promise\.all\(\[[\s\S]*?setApplications\(applicationData\.applications \|\| \[\]\);",
        """      const listingResponse = await fetch('/api/student/listings', { headers });
      const listingData = await listingResponse.json();
      if (!listingResponse.ok) throw new Error(listingData.message || 'Could not load listings.');
      setListings(listingData.listings || []);""",
        page, count=1,
    )
    if n != 1:
        raise SystemExit("Could not isolate the listings loader; no commit made.")

    page = page.replace(
        "  const appliedIds = new Set(applications.map((application) => application.listing_id));\n\n", ""
    )
    page = page.replace(
        "disabled={busyId !== null || appliedIds.has(listing.id)}",
        "disabled={busyId !== null}",
    )
    page = page.replace(
        "{busyId === listing.id ? 'Applying…' : appliedIds.has(listing.id) ? 'Already applied' : 'Apply now'}",
        "{busyId === listing.id ? 'Applying…' : 'Apply now'}",
    )
    page, n = re.subn(
        r"\n      <h3>My applications</h3>[\s\S]*?\n    </section>",
        "\n    </section>",
        page, count=1,
    )
    if n != 1:
        raise SystemExit("Could not remove the tracking panel; no commit made.")
    page_path.write_text(page, encoding="utf-8")

    api = api_path.read_text(encoding="utf-8-sig")
    api, n = re.subn(
        r"\nrouter\.get\('/applications',[\s\S]*?\n\}\);\n\nexport default router;",
        "\nexport default router;",
        api, count=1,
    )
    if n != 1:
        raise SystemExit("Could not isolate the tracking API; no commit made.")
    api_path.write_text(api, encoding="utf-8")

elif mode == "add11":
    app = app_path.read_text(encoding="utf-8-sig")
    if "ApplicationTrackingPage" not in app:
        app = app.replace(
            "import ProfilePage from './ProfilePage';",
            "import ProfilePage from './ProfilePage';\nimport ApplicationTrackingPage from './ApplicationTrackingPage';",
            1,
        )
        app = app.replace(
            "<ProfilePage token={studentToken} />",
            "<ProfilePage token={studentToken} />\n                    <ApplicationTrackingPage token={studentToken} />",
            1,
        )
        app_path.write_text(app, encoding="utf-8")

    Path("src/ApplicationTrackingPage.tsx").write_text("""import { useEffect, useState } from 'react';

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
""", encoding="utf-8")

    api = api_path.read_text(encoding="utf-8-sig")
    if "router.get('/applications'" not in api:
        route = r"""
router.get('/applications', requireAuth, requireRoles('STUDENT'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.listing_id, l.title, l.company_name, l.location,
              a.status, a.applied_at, a.updated_at
       FROM applications a
       JOIN internship_listings l ON l.id = a.listing_id
       WHERE a.student_id = ?
       ORDER BY a.applied_at DESC`,
      [req.auth.sub]
    );
    return res.json({ applications: rows });
  } catch (error) {
    return next(error);
  }
});
"""
        api = api.replace("export default router;", route + "\nexport default router;")
        api_path.write_text(api, encoding="utf-8")
else:
    raise SystemExit("Unknown mode. Use clean10 or add11.")

print(f"PASS: {mode}")
