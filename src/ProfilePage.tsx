import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  downloadStudentResume,
  getStudentProfile,
  saveStudentProfile,
  uploadStudentResume,
  type EditableProfile,
  type StudentProfile,
} from './services/studentApi';

const emptyProfile: EditableProfile = {
  phone: '',
  location: '',
  headline: '',
  bio: '',
  cgpa: null,
  skills: '',
  projects: '',
};

function editableFields(profile: StudentProfile): EditableProfile {
  return {
    phone: profile.phone || '',
    location: profile.location || '',
    headline: profile.headline || '',
    bio: profile.bio || '',
    cgpa: profile.cgpa,
    skills: profile.skills || '',
    projects: profile.projects || '',
  };
}

export default function ProfilePage({ token }: { token: string }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [form, setForm] = useState<EditableProfile>(emptyProfile);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStudentProfile(token)
      .then((result) => {
        setProfile(result);
        setForm(editableFields(result));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load profile.'));
  }, [token]);

  function updateField(field: keyof EditableProfile, value: string) {
    setForm((current) => ({ ...current, [field]: field === 'cgpa' ? (value === '' ? null : Number(value)) : value }));
    setNotice('');
    setError('');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await saveStudentProfile(token, form);
      setNotice('Profile saved.');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await uploadStudentResume(token, file);
      setNotice('Resume uploaded and ready to download.');
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload resume.');
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    setError('');
    try {
      const blob = await downloadStudentResume(token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'resume';
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError: unknown) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download resume.');
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return <p className="intro">{error || 'Loading your profile…'}</p>;

  return (
    <div className="profile-page">
      <p className="kicker">STUDENT PROFILE</p>
      <h2>Build your next step.</h2>
      <p className="intro">{profile.full_name} · {profile.course}</p>
      <form className="registration-form" onSubmit={handleSave}>
        <label className="field"><span>Headline</span><input maxLength={160} value={form.headline || ''} onChange={(event) => updateField('headline', event.target.value)} /></label>
        <div className="field-row">
          <label className="field"><span>Phone</span><input maxLength={30} value={form.phone || ''} onChange={(event) => updateField('phone', event.target.value)} /></label>
          <label className="field"><span>Location</span><input maxLength={120} value={form.location || ''} onChange={(event) => updateField('location', event.target.value)} /></label>
        </div>
        <div className="field-row">
          <label className="field"><span>CGPA</span><input type="number" min="0" max="10" step="0.01" value={form.cgpa ?? ''} onChange={(event) => updateField('cgpa', event.target.value)} /></label>
          <label className="field"><span>Institutional email</span><input value={profile.institutional_email} readOnly /></label>
        </div>
        <label className="field"><span>About you</span><textarea maxLength={5000} value={form.bio || ''} onChange={(event) => updateField('bio', event.target.value)} /></label>
        <label className="field"><span>Skills</span><textarea maxLength={5000} value={form.skills || ''} onChange={(event) => updateField('skills', event.target.value)} placeholder="JavaScript, SQL, communication..." /></label>
        <label className="field"><span>Projects</span><textarea maxLength={10000} value={form.projects || ''} onChange={(event) => updateField('projects', event.target.value)} /></label>
        {error && <p className="feedback error" role="alert">{error}</p>}
        {notice && <p className="feedback">{notice}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'} <span aria-hidden="true">↗</span></button>
      </form>
      <section className="resume-panel" aria-labelledby="resume-heading">
        <p className="kicker" id="resume-heading">RESUME</p>
        <p className="intro">Upload a PDF, DOC, or DOCX file up to 5 MB. A new upload replaces the current resume.</p>
        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResume} disabled={busy} />
        <button className="back-button" type="button" onClick={handleDownload} disabled={busy}>Download current resume</button>
      </section>
    </div>
  );
}
