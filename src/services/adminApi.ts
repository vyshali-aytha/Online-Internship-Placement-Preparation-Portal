export type RecruiterRequest = {
  id: number;
  full_name: string;
  email: string;
  company_name: string;
  status: 'PENDING';
  created_at: string;
};

export type RecruiterDecision = 'APPROVED' | 'REJECTED';

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

function messageForStatus(status: number) {
  switch (status) {
    case 401:
      return 'Your admin session has expired. Sign in again to continue.';
    case 403:
      return 'This account is not authorized to access admin requests.';
    case 404:
      return 'This recruiter request could not be found. Refresh the list and try again.';
    case 409:
      return 'This recruiter request has already been decided. The list has been refreshed.';
    default:
      return status >= 500
        ? 'The server could not complete the request. Please try again.'
        : 'The request could not be completed. Please try again.';
  }
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    response = await fetch(path, {
      ...init,
      headers,
    });
  } catch {
    throw new AdminApiError(
      'Could not reach the server. Check your connection and try again.',
      0,
    );
  }

  let body: { message?: string } & Record<string, unknown> = {};
  try {
    body = await response.json() as typeof body;
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new AdminApiError(
      typeof body.message === 'string' ? body.message : messageForStatus(response.status),
      response.status,
    );
  }

  return body as T;
}

export async function loginAdmin(email: string, password: string) {
  return request<{ token: string; expiresIn: string }>('/api/auth/admin/login', '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function getPendingRecruiterRequests(token: string) {
  const result = await request<RecruiterRequest[]>('/api/admin/recruiter-requests', token);
  if (!Array.isArray(result)) {
    throw new AdminApiError('The server returned an invalid recruiter request list.', 0);
  }
  return result;
}

export async function decideRecruiterRequest(
  token: string,
  id: number,
  status: RecruiterDecision,
) {
  const result = await request<{ id: number; status: RecruiterDecision; reviewedAt: string }>(
    `/api/admin/recruiter-requests/${encodeURIComponent(String(id))}/status`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  if (result.id !== id || result.status !== status) {
    throw new AdminApiError('The server did not confirm the requested decision.', 0);
  }
  return result;
}
