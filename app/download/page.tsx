'use client';

import { FormEvent, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface SearchResult {
  name: string;
  career: string;
  createdAt: string;
  status: string;
  generatedUrl: string | null;
  originalUrl: string | null;
  pdfUrl: string | null;
}

const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));

export default function DownloadPortalPage() {
  const reduceMotion = useReducedMotion();
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/download/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Search failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reveal = reduceMotion ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="portal-page">
      <div className="portal-orb portal-orb-one" />
      <div className="portal-orb portal-orb-two" />
      <section className="portal-shell">
        <motion.div {...reveal} transition={{ duration: 0.45 }} className="portal-heading">
          <img src="/logos/bkash.svg" alt="bKash" className="portal-logo" />
          <span className="portal-eyebrow">YOUR DREAM. YOUR STORY.</span>
          <h1>Find Your Dream Career Photo</h1>
          <p>Enter the phone number you used at the photobooth to retrieve your files.</p>
        </motion.div>

        <motion.form {...reveal} transition={{ duration: 0.45, delay: 0.08 }} className="portal-search" onSubmit={search}>
          <label htmlFor="portal-phone">Phone Number</label>
          <div className="portal-search-row">
            <input id="portal-phone" type="tel" inputMode="tel" autoComplete="tel"
              placeholder="+880 1XX XXXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
          </div>
          {error && <p className="portal-error" role="alert">{error}</p>}
        </motion.form>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div key={result.createdAt} className="portal-results"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <div className="portal-user-card">
                <div className="portal-avatar">{result.name.charAt(0).toUpperCase()}</div>
                <dl>
                  <div><dt>Name</dt><dd>{result.name}</dd></div>
                  <div><dt>Selected career</dt><dd>{result.career}</dd></div>
                  <div><dt>Generation date</dt><dd>{formatDate(result.createdAt)}</dd></div>
                </dl>
              </div>

              <div className="portal-file-grid">
                <FileCard title="AI Generated Image" url={result.generatedUrl} imageUrl={result.generatedUrl} button="Download" index={0} />
                <FileCard title="Original Photo" url={result.originalUrl} imageUrl={result.originalUrl} button="Download" index={1} />
                <FileCard title="Career PDF" url={result.pdfUrl} button="Download PDF" pdf index={2} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function FileCard({ title, url, imageUrl, button, pdf, index }: {
  title: string; url: string | null; imageUrl?: string | null; button: string; pdf?: boolean; index: number;
}) {
  return (
    <motion.article className="portal-file-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 + index * 0.08 }}>
      <div className="portal-preview">
        {imageUrl ? <img src={imageUrl} alt={`${title} preview`} /> : pdf && url ? (
          <div className="portal-pdf-preview"><span>CAREER</span><strong>DREAM<br />EDITION</strong><small>YOUR FUTURE STARTS HERE</small></div>
        ) : <div className="portal-unavailable">Not available yet</div>}
      </div>
      <h2>{title}</h2>
      {url ? <a href={`${url}?download=1`} download>{button}<span>↓</span></a> : <button disabled>{button}</button>}
    </motion.article>
  );
}
