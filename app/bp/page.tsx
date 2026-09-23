'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminLogin, adminLogout, DownloadSubmission } from '@/services/api';
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';

export default function BpPortal() {
  const [staff, setStaff] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [searchedPhone, setSearchedPhone] = useState('');
  const [results, setResults] = useState<DownloadSubmission[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) setStaff((await response.json()).displayName);
      })
      .catch(() => setError('Unable to check your session. Please sign in.'))
      .finally(() => setChecking(false));
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await adminLogin(username.trim(), password);
      setStaff(result.displayName);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResults(null);
    if (!isValidPhone(phone)) { setError(PHONE_VALIDATION_MESSAGE); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/bp/gallery?phone=${encodeURIComponent(phone)}`, { cache: 'no-store' });
      if (response.status === 401) {
        setStaff(null);
        throw new Error('Your session expired. Please sign in again.');
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to find photos.');
      setSearchedPhone(phone);
      setResults(data.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to find photos.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await adminLogout();
      setStaff(null);
      setResults(null);
      setPhone('');
      setSearchedPhone('');
    } catch { setError('Unable to sign out. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="download-page">
      <main className="download-layout">
        <header className="download-hero">
          <img src="/logos/bkash.svg" alt="bKash" className="download-brand" />
          <p className="download-eyebrow">Campaign staff</p>
          <h1>BP Photo Portal</h1>
          <p>{staff ? 'Search by customer phone number to preview and download their photos. No customer OTP is needed.' : 'Sign in with your staff account to find customer photos.'}</p>
        </header>
        {error && <p className="download-card download-err" role="alert">{error}</p>}
        {checking ? <p className="download-card" role="status">Checking your session…</p> : !staff ? (
          <form className="download-card" onSubmit={signIn}>
            <div className="download-field">
              <label htmlFor="bp-username">Username</label>
              <input id="bp-username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="download-field">
              <label htmlFor="bp-password">Password</label>
              <input id="bp-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <button className="download-btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
          </form>
        ) : (
          <>
            <div className="download-card bp-toolbar">
              <span>Signed in as <strong>{staff}</strong></span>
              <button className="download-item-btn" onClick={signOut} disabled={busy}>Sign Out</button>
            </div>
            <form className="download-card download-search" onSubmit={search}>
              <div className="download-field">
                <label htmlFor="bp-phone">Customer phone number</label>
                <input id="bp-phone" type="tel" autoComplete="off" placeholder="01XXXXXXXXX" required value={phone} onChange={(event) => { setPhone(event.target.value); setResults(null); }} disabled={busy} />
              </div>
              <button className="download-btn-primary" disabled={busy}>{busy ? 'Please wait…' : 'Find Photos'}</button>
            </form>
            {results && <section className="download-results" aria-label="Customer photos" aria-live="polite">
              <p className="download-card">{results.length ? `${results.length} submission${results.length === 1 ? '' : 's'} for ${searchedPhone}` : `No photos found for ${searchedPhone}. Check the number and try again.`}</p>
              {results.map((submission) => <article className="download-submission" key={submission.originalUrl || submission.aiUrl || submission.comicBookUrl}>
                <div className="download-person">
                  <dl>
                    <div><dt>Name</dt><dd>{submission.name}</dd></div>
                    <div><dt>Career</dt><dd>{submission.career}</dd></div>
                    <div><dt>Source</dt><dd>{submission.label}</dd></div>
                    <div><dt>Date</dt><dd>{new Date(submission.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</dd></div>
                  </dl>
                </div>
                {!submission.aiUrl && <p className="download-card">{submission.processingStatus === 'failed' ? 'AI generation failed. Available files can still be downloaded.' : 'The generated image is not ready yet. Search again to refresh.'}</p>}
                <div className="download-item-group"><div className="download-gallery-grid">
                  {[
                    { key: 'original', label: 'Original Photo', url: submission.originalUrl },
                    { key: 'ai', label: 'AI Generated Image', url: submission.aiUrl },
                    { key: 'comic-book', label: 'Comic Book', url: submission.comicBookUrl },
                  ].filter((item) => item.url).map((item) => <div className="download-item" key={item.key}>
                    {item.key !== 'comic-book' && <a href={item.url!} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${item.label}`}><img className="download-item-preview" src={item.url!} alt={item.label} loading="lazy" /></a>}
                    {item.key !== 'comic-book' && <span className="download-item-label">{item.label}</span>}
                    <a className="download-item-btn" href={`${item.url}?download=1`} download>{item.key === 'comic-book' ? 'Click Here To Download Comic Book' : 'Download'} <span aria-hidden="true">↓</span></a>
                  </div>)}
                </div></div>
              </article>)}
            </section>}
          </>
        )}
      </main>
    </div>
  );
}
