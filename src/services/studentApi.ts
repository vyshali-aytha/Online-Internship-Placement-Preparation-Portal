export type StudentProfile = {
  full_name: string;
  institutional_email: string;
  student_id: string;
  course: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  bio: string | null;
  cgpa: number | null;
  skills: string | null;
  projects: string | null;
  resume_file_name?: string | null;
};

export type EditableProfile = Pick<StudentProfile, 'phone' | 'location' | 'headline' | 'bio' | 'cgpa' | 'skills' | 'projects'>;

async function readResponse(response: Response) {
  const text = await response.text();

  let result: { message?: string } = {};

  if (text) {
    try {
      result = JSON.parse(text) as { message?: string };
    } catch {
      throw new Error(
        `Server returned an invalid response (HTTP ${response.status}).`
      );
    }
  }

  if (!response.ok) {
    throw new Error(result.message || `Request failed (HTTP ${response.status}).`);
  }

  return result;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getStudentProfile(token: string) {
  const response = await fetch('/api/student/profile', { headers: authHeaders(token) });
  const result = await readResponse(response) as { profile: StudentProfile };
  return result.profile;
}

export async function saveStudentProfile(token: string, profile: EditableProfile) {
  const response = await fetch('/api/student/profile', {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return readResponse(response);
}

export async function uploadStudentResume(token: string, file: File) {
  const formData = new FormData();
  formData.append('resume', file);
  const response = await fetch('/api/student/resume', {
    method: 'PUT',
    headers: authHeaders(token),
    body: formData,
  });
  return readResponse(response) as Promise<{ message?: string; fileName?: string; fileSize?: number }>;
}

export async function downloadStudentResume(token: string) {
  const response = await fetch('/api/student/resume', { headers: authHeaders(token) });
  if (!response.ok) {
    const result = await response.json() as { message?: string };
    throw new Error(result.message || 'Could not download resume.');
  }
  return response.blob();
}

export async function generateStudentResumePdf(token: string) {
  const response = await fetch('/api/student/resume/generated', {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    const result = await response.json() as { message?: string };
    throw new Error(result.message || 'Could not generate PDF resume.');
  }

  return response.blob();
}
