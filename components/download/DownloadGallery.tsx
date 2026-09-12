'use client';

import { useEffect, useRef, useState } from 'react';
import { getDownloadGallery, DownloadSubmission } from '@/services/api';

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function SubmissionCard({ submission, onComicDownload }: { submission: DownloadSubmission; onComicDownload: () => void }) {
  const [downloadingAll, setDownloadingAll] = useState(false);

  const downloadAll = async () => {
    const urls = [submission.originalUrl, submission.aiUrl, submission.comicBookUrl].filter(Boolean) as string[];
    setDownloadingAll(true);
    for (const url of urls) {
      triggerDownload(`${url}?download=1`);
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
    if (submission.comicBookUrl) onComicDownload();
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
    { key: 'ai', label: 'AI Generated Image', url: submission.aiUrl },
    { key: 'original', label: 'Original Photo', url: submission.originalUrl },
    { key: 'comic-book', label: 'Career PDF', url: submission.comicBookUrl },
  ].filter((item) => item.url);

  return (
    <div className="download-item-group">
      <div className="download-gallery-grid">
        {items.map((item) => (
          <div className="download-item" key={item.key}>
            <img
              className="download-item-preview"
              src={item.key === 'comic-book' ? '/documents/Comic-preview.jpg' : item.url!}
              alt={item.key === 'comic-book' ? 'Career PDF preview' : item.label}
            />
            <span className="download-item-label">{item.label}</span>
            {item.key === 'comic-book' && (
              <a
                className="download-item-btn download-preview-btn"
                href={item.url!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Preview comic (opens in a new tab)"
                onClick={onComicDownload}
              >
                Preview PDF
              </a>
            )}
            <a
              className="download-item-btn"
              href={`${item.url}?download=1`}
              download
              onClick={item.key === 'comic-book' ? (event) => {
                event.preventDefault();
                triggerDownload(`${item.url}?download=1`);
                onComicDownload();
              } : undefined}
            >
              <span>{item.key === 'comic-book' ? 'Download PDF' : 'Download'}</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        ))}
      </div>

      <button className="download-btn-primary download-all-btn" onClick={downloadAll} disabled={downloadingAll}>
        {downloadingAll ? 'Downloading…' : 'Download All'}
      </button>
    </div>
  );
}

export default function DownloadGallery() {
  const popupRef = useRef<HTMLDialogElement>(null);
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
    <section className="download-results" aria-label="Your photos and comic">

      {submissions.map((submission) => (
        <div key={submission.id} className="download-submission">
          <div className="download-person">
            <span className="download-avatar" aria-hidden="true">{submission.name?.charAt(0).toUpperCase() || 'Y'}</span>
            <dl>
              <div><dt>Name</dt><dd>{submission.name}</dd></div>
              <div><dt>Selected career</dt><dd>{submission.career}</dd></div>
              <div><dt>Generation date</dt><dd>{new Date(submission.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' })}</dd></div>
            </dl>
          </div>
          {submissions.length > 1 && (
            <p className="download-submission-heading">{submission.label}</p>
          )}
          <SubmissionCard submission={submission} onComicDownload={() => popupRef.current?.showModal()} />
        </div>
      ))}
      <dialog
        ref={popupRef}
        className="comic-download-popup"
        aria-label="UIU campaign information"
        onClick={(event) => {
          if (event.target === event.currentTarget) popupRef.current?.close();
        }}
      >
        <div className="comic-download-popup-content">
          <form method="dialog">
            <button className="comic-download-popup-close" aria-label="Close popup" autoFocus>&times;</button>
          </form>
          <img src="/documents/UIU_PVC-Output.jpg" alt="UIU campaign information" />
        </div>
      </dialog>
    </section>
  );
}
