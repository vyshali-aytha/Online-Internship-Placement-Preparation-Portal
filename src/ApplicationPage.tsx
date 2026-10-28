import { useEffect, useState } from 'react';

type Listing = {
  id: number;
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  listing_type: string;
};


export default function ApplicationPage({ token }: { token: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const listingResponse = await fetch('/api/student/listings', { headers });
      const listingData = await listingResponse.json();
      if (!listingResponse.ok) throw new Error(listingData.message || 'Could not load listings.');
      setListings(listingData.listings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load application data.');
    }
  }

  useEffect(() => { void load(); }, [token]);

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

  return (
    <section className="applications-page" aria-labelledby="applications-heading">
      <p className="kicker">OPPORTUNITIES</p>
      <h2 id="applications-heading">Internships & placements</h2>
      <p className="intro">Apply using your saved student profile and resume, then follow each application here.</p>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {notice && <p className="feedback success" role="status">{notice}</p>}

      <h3>Open listings</h3>
      {listings.length === 0 && <p className="intro">No open listings are available yet.</p>}
      <div className="application-list">
        {listings.map((listing) => (
          <article className="application-card" key={listing.id}>
            <div>
              <h4>{listing.title}</h4>
              <p>{listing.company_name}{listing.location ? ` · ${listing.location}` : ''}</p>
              {listing.description && <p>{listing.description}</p>}
              <small>{listing.listing_type}</small>
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
