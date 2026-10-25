import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeMatchesSignature, validateProfile } from '../server/student-validation.js';

test('profile validation trims optional values and accepts a valid CGPA', () => {
  const profile = validateProfile({
    headline: '  Full-stack developer ',
    skills: 'JavaScript, SQL',
    cgpa: '8.75',
  });
  assert.equal(profile.headline, 'Full-stack developer');
  assert.equal(profile.skills, 'JavaScript, SQL');
  assert.equal(profile.cgpa, 8.75);
  assert.equal(profile.phone, null);
});

test('profile validation rejects oversized fields and invalid CGPA', () => {
  assert.throws(() => validateProfile({ bio: 'x'.repeat(5001) }), /bio is invalid/);
  assert.throws(() => validateProfile({ cgpa: 10.1 }), /cgpa must be between/);
});

test('resume validation checks file signatures', () => {
  assert.equal(resumeMatchesSignature({
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  }), true);
  assert.equal(resumeMatchesSignature({
    mimetype: 'application/pdf',
    buffer: Buffer.from('not a pdf'),
  }), false);
  assert.equal(resumeMatchesSignature({
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('PK\x03\x04document'),
  }), true);
});
