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
};

export type EditableProfile = Pick<StudentProfile, 'phone' | 'location' | 'headline' | 'bio' | 'cgpa' | 'skills' | 'projects'>;

async function readResponse(response: Response) {
  const result = await response.json() as { message?: string };
  if (!response.ok) throw new Error(result.message || 'Request failed.');
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
  return readResponse(response);
}

export async function downloadStudentResume(token: string) {
  const response = await fetch('/api/student/resume', { headers: authHeaders(token) });
  if (!response.ok) {
    const result = await response.json() as { message?: string };
    throw new Error(result.message || 'Could not download resume.');
  }
  return response.blob();
}
