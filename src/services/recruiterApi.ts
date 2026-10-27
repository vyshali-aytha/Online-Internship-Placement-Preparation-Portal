export type RecruiterRequestInput = {
  fullName: string;
  email: string;
  companyName: string;
  password: string;
};

export type RecruiterRequestResult = {
  id: number;
  email: string;
  status: 'PENDING';
};

export class RecruiterRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// POST /api/recruiter-requests (F-020 backend). Always creates a PENDING request.
export async function submitRecruiterRequest(
  input: RecruiterRequestInput,
): Promise<RecruiterRequestResult> {
  let response: Response;
  try {
    response = await fetch('/api/recruiter-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new RecruiterRequestError(
      'Could not reach the server. Check your connection and try again.',
      0,
    );
  }

  // Error bodies are not guaranteed to be JSON (e.g. rate limiter, proxy errors).
  let body: { message?: string } & Partial<RecruiterRequestResult> = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const fallback =
      response.status === 409 ? 'A request with this email already exists.'
      : response.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.'
      : response.status === 400 ? 'Please check the submitted fields.'
      : 'Something went wrong on our side. Please try again later.';
    throw new RecruiterRequestError(body.message || fallback, response.status);
  }

  return body as RecruiterRequestResult;
}
