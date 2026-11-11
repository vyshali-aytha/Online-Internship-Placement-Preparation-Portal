import { useEffect, useState, type FormEvent } from 'react';
import './listing-filters.css';

type Listing = {
  id: number;
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  listing_type: string;
  min_cgpa?: string | number | null;
};

type Filters = { role: string; location: string; minCgpa: string };

const noFilters: Filters = { role: '', location: '', minCgpa: '' };

function filtersAreActive(filters: Filters) {
  return filters.role.trim() !== '' || filters.location.trim() !== '' || filters.minCgpa.trim() !== '';
}

export default function ApplicationPage({ token }: { token: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Filters>(noFilters);
  const [applied, setApplied] = useState<Filters>(noFilters);
  const [filterError, setFilterError] = useState('');

  async function load(filters: Filters = applied) {
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams();
      if (filters.role.trim()) params.set('role', filters.role.trim());
      if (filters.location.trim()) params.set('location', filters.location.trim());
      if (filters.minCgpa.trim()) params.set('minCgpa', filters.minCgpa.trim());
      const query = params.toString();
      const listingResponse = await fetch(`/api/student/listings${query ? `?${query}` : ''}`, { headers });
      const listingData = await listingResponse.json();
      if (!listingResponse.ok) throw new Error(listingData.message || 'Could not load listings.');
      setListings(listingData.listings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load application data.');
    }
  }

  useEffect(() => { void load(); }, [token]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cgpa = draft.minCgpa.trim();
    if (cgpa !== '') {
      const value = Number(cgpa);
      if (!Number.isFinite(value) || value < 0 || value > 10) {
        setFilterError('Minimum CGPA must be a number from 0 to 10.');
        return;
      }
    }
    setFilterError('');
    setApplied(draft);
    void load(draft);
  }

  function resetFilters() {
    setFilterError('');
    setDraft(noFilters);
    setApplied(noFilters);
    void load(noFilters);
  }

  async function apply(listingId: number) {
    setBusyId(listingId);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/student/listings/${listingId}/applications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Application failed.');
      setNotice('Application submitted successfully.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Application failed.');
    } finally {
      setBusyId(null);
    }
  }

  const filtering = filtersAreActive(applied);

  return (
    <section className="applications-page" aria-labelledby="applications-heading">
      <p className="kicker">OPPORTUNITIES</p>
      <h2 id="applications-heading">Internships & placements</h2>
      <p className="intro">Apply using your saved student profile and resume, then follow each application here.</p>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}

      <form className="listing-filters" onSubmit={applyFilters} aria-label="Filter listings" noValidate>
        <label className="field compact-field">
          <span>Role</span>
          <input value={draft.role} maxLength={100} placeholder="e.g. Backend"
            onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
        </label>
        <label className="field compact-field">
          <span>Location</span>
          <input value={draft.location} maxLength={100} placeholder="e.g. Bengaluru"
            onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
        </label>
        <label className="field compact-field">
          <span>Minimum CGPA</span>
          <input type="number" min="0" max="10" step="0.1" inputMode="decimal" placeholder="Your CGPA"
            value={draft.minCgpa} aria-invalid={Boolean(filterError)}
            onChange={(e) => setDraft({ ...draft, minCgpa: e.target.value })} />
        </label>
        <div className="report-filter-actions">
          <button className="primary-button" type="submit">Apply filters</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>Reset</button>
        </div>
      </form>
      {filterError && <p className="feedback error" role="alert">{filterError}</p>}
      <p className="listing-filter-note">
        CGPA filter shows listings whose required CGPA is at most the value you enter, plus listings with no requirement.
      </p>

      <h3>Open listings</h3>
      {listings.length === 0 && (
        <p className="intro">
          {filtering ? 'No listings match your filters. Try changing or resetting them.' : 'No open listings are available yet.'}
        </p>
      )}
      <div className="application-list">
        {listings.map((listing) => (
          <article className="application-card" key={listing.id}>
            <div>
              <h4>{listing.title}</h4>
              <p>{listing.company_name}{listing.location ? ` · ${listing.location}` : ''}</p>
              {listing.description && <p>{listing.description}</p>}
              <small>
                {listing.listing_type}
                {listing.min_cgpa !== null && listing.min_cgpa !== undefined && listing.min_cgpa !== ''
                  ? ` · Min CGPA ${Number(listing.min_cgpa)}`
                  : ''}
              </small>
            </div>
            <button className="primary-button" type="button"
              disabled={busyId !== null}
              onClick={() => void apply(listing.id)}>
              {busyId === listing.id ? 'Applying…' : 'Apply now'}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
        ))}
      </div>

    </section>
  );
}
