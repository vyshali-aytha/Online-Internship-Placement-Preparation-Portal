const profileTextLimits = {
  phone: 30,
  location: 120,
  headline: 160,
  bio: 5000,
  skills: 5000,
  projects: 10000,
};

export const allowedResumeTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]);

function optionalText(body, field) {
  if (body[field] === undefined || body[field] === null || body[field] === '') return null;
  if (typeof body[field] !== 'string' || body[field].trim().length > profileTextLimits[field]) {
    throw new Error(`${field} is invalid.`);
  }
  return body[field].trim();
}

export function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Profile payload is invalid.');
  }
  const profile = {};
  for (const field of Object.keys(profileTextLimits)) {
    profile[field] = optionalText(body, field);
  }

  if (body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== '') {
    const cgpa = Number(body.cgpa);
    if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) throw new Error('cgpa must be between 0 and 10.');
    profile.cgpa = cgpa;
  } else {
    profile.cgpa = null;
  }
  return profile;
}

export function resumeMatchesSignature(file) {
  if (!file?.buffer || !file.mimetype) return false;
  if (file.mimetype === 'application/pdf') return file.buffer.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'application/msword') return file.buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return file.buffer.subarray(0, 2).toString() === 'PK';
  }
  return false;
}
