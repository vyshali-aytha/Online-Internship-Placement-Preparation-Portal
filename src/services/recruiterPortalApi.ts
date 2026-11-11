// Client for the recruiter-facing API (F-016 listings, F-017 applicants).

export type ListingStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type ListingType = 'Internship' | 'Placement';

export type RecruiterListing = {
  id: number;
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  listing_type: string;
  min_cgpa: string | number | null;
  status: ListingStatus;
  created_at: string;
};

export type NewListingInput = {
  title: string;
  companyName: string;
  description: string;
  location: string;
  listingType: ListingType;
  minCgpa: string;
  publish: boolean;
};

export type Applicant = {
  applicationId: number;
  status: string;
  appliedAt: string;
  updatedAt: string;
  resumeName: string | null;
  student: {
    fullName: string | null;
    email: string | null;
    studentId: string | null;
    course: string | null;
    cgpa: string | number | null;
    location: string | null;
    headline: string | null;
    skills: string | null;
    projects: string | null;
  };
};

export type ApplicantsResult = {
  listing: { id: number; title: string };
  applicants: Applicant[];
};

export type Decision = 'Shortlisted' | 'Selected' | 'Rejected';

export class RecruiterPortalError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RecruiterPortalError';
    this.status = status;
  }
}

function fallbackMessage(status: number) {
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'This account is not approved for recruiter access.';
  if (status === 404) return 'That item could not be found. Refresh and try again.';
  if (status === 409) return 'That action is no longer possible. Refresh and try again.';
  if (status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  return status >= 500
    ? 'The server could not complete the request. Please try again.'
    : 'The request could not be completed. Please try again.';
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init?.body) headers.set('Content-Type', 'application/json');
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new RecruiterPortalError('Could not reach the server. Check your connection and try again.', 0);
  }

  // Error bodies are not guaranteed to be JSON (rate limiter, proxy errors).
  let body: { message?: string } & Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new RecruiterPortalError(
      typeof body.message === 'string' && body.message ? body.message : fallbackMessage(response.status),
      response.status,
    );
  }
  return body as T;
}

export function loginRecruiter(email: string, password: string) {
  return request<{ token: string }>('/api/auth/recruiter/login', '', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getRecruiterListings(token: string) {
  const result = await request<{ listings: RecruiterListing[] }>('/api/recruiter/listings', token);
  return result.listings;
}

export function createRecruiterListing(token: string, input: NewListingInput) {
  const minCgpa = input.minCgpa.trim();
  return request<{ id: number; status: ListingStatus }>('/api/recruiter/listings', token, {
    method: 'POST',
    body: JSON.stringify({
      title: input.title.trim(),
      companyName: input.companyName.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      listingType: input.listingType,
      minCgpa: minCgpa === '' ? null : Number(minCgpa),
      publish: input.publish,
    }),
  });
}

export function publishRecruiterListing(token: string, id: number) {
  return request<{ id: number; status: ListingStatus }>(`/api/recruiter/listings/${id}/publish`, token, { method: 'POST' });
}

export function closeRecruiterListing(token: string, id: number) {
  return request<{ id: number; status: ListingStatus }>(`/api/recruiter/listings/${id}/close`, token, { method: 'POST' });
}

export function getListingApplicants(token: string, listingId: number) {
  return request<ApplicantsResult>(`/api/recruiter/listings/${listingId}/applicants`, token);
}

export function decideApplication(token: string, applicationId: number, status: Decision) {
  return request<{ id: number; status: Decision }>(`/api/recruiter/applications/${applicationId}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
