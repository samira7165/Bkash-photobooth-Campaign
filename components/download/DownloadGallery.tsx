'use client';

import { useEffect, useState } from 'react';
import { getDownloadGallery, DownloadSubmission } from '@/services/api';

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function SubmissionCard({ submission }: { submission: DownloadSubmission }) {
  const [downloadingAll, setDownloadingAll] = useState(false);

  const downloadAll = async () => {
    const urls = [submission.originalUrl, submission.aiUrl, submission.comicBookUrl].filter(Boolean) as string[];
    setDownloadingAll(true);
    for (const url of urls) {
      triggerDownload(`${url}?download=1`);
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
  };

  if (submission.processingStatus === 'queued' || submission.processingStatus === 'processing') {
    return (
      <div className="download-item-group">
        <h3 className="download-title">Still preparing your image</h3>
        <p className="download-sub">Your {submission.label} image isn&apos;t quite ready yet. Please check back in a minute.</p>
        <div className="download-spinner" />
      </div>
    );
  }

  if (submission.processingStatus === 'failed') {
    return (
      <div className="download-item-group">
        <h3 className="download-title">We couldn&apos;t create your image</h3>
        <p className="download-sub">Something went wrong while generating your {submission.label} photo. Please contact the event organizer.</p>
      </div>
    );
  }

  const items = [
    { key: 'original', label: 'Original Photo', url: submission.originalUrl },
    { key: 'ai', label: 'Dream Career Image', url: submission.aiUrl },
    { key: 'comic-book', label: 'Comic Book', url: submission.comicBookUrl },
  ].filter((item) => item.url);

  return (
    <div className="download-item-group">
      <div className="download-gallery-grid">
        {items.map((item) => (
          <div className="download-item" key={item.key}>
            {item.key === 'comic-book' ? (
              <div className="download-item-pdf-icon">PDF</div>
            ) : (
              <img className="download-item-preview" src={item.url!} alt={item.label} />
            )}
            <span className="download-item-label">{item.label}</span>
            <a className="download-item-btn" href={`${item.url}?download=1`} download>
              Download
            </a>
          </div>
        ))}
      </div>

      <button className="download-btn-primary" onClick={downloadAll} disabled={downloadingAll}>
        {downloadingAll ? 'Downloading…' : 'Download All'}
      </button>
    </div>
  );
}

export default function DownloadGallery() {
  const [submissions, setSubmissions] = useState<DownloadSubmission[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDownloadGallery()
      .then((res) => setSubmissions(res.submissions))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="download-card">
        <h2 className="download-title">Something went wrong</h2>
        <p className="download-sub">{error}</p>
      </div>
    );
  }

  if (!submissions) {
    return (
      <div className="download-card">
        <div className="download-spinner" />
      </div>
    );
  }

  return (
    <div className="download-card wide">
      <h2 className="download-title">Your images are ready</h2>
      <p className="download-sub">Preview and download each item below, or download everything at once.</p>

      {submissions.map((submission) => (
        <div key={submission.id} className="download-submission">
          {submissions.length > 1 && (
            <p className="download-submission-heading">{submission.label}</p>
          )}
          <SubmissionCard submission={submission} />
        </div>
      ))}
    </div>
  );
}
