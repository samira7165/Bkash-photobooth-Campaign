'use client';

import { useEffect, useRef, useState } from 'react';
import { getDownloadGallery, DownloadSubmission } from '@/services/api';
import CouponClaimModal from './CouponClaimModal';

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function SubmissionCard({
  submission,
  onComicDownload,
}: {
  submission: DownloadSubmission;
  onComicDownload: () => void;
}) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);

  useEffect(() => {
    const dialog = previewRef.current;
    if (!dialog) return;
    const handleClose = () => setPreviewOpen(false);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

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
    { key: 'ai', label: 'AI Generated Image (Themed)', url: submission.aiUrl },
    { key: 'original', label: 'bKash Branded Photo', url: submission.originalUrl },
    { key: 'comic-book', label: 'Comic Book', url: submission.comicBookUrl },
  ].filter((item) => item.url);

  return (
    <div className="download-item-group">
      <div className="coupon-cta">
        <p className="coupon-cta-title">🎁 Get Your Coupon</p>
        <p className="coupon-cta-sub">
          Share your photo on social media and submit your post proof to claim your exclusive coupon.
        </p>
        <button type="button" className="coupon-cta-btn" onClick={() => setShowCoupon(true)}>
          Get My Coupon
        </button>
      </div>

      <div className="download-gallery-grid">
        {items.map((item) => (
          <div className="download-item" key={item.key}>
            {item.key === 'comic-book' ? (
              <a
                className="download-comic-cta-card"
                href={`${item.url}?download=1`}
                download
                onClick={(event) => {
                  event.preventDefault();
                  triggerDownload(`${item.url}?download=1`);
                  onComicDownload();
                }}
              >
                <span className="download-comic-burst" aria-hidden="true" />
                <span className="download-comic-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 3.5h7l4.5 4.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M14 3.5V8h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M12 11.5v5m0 0-2-2m2 2 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="download-comic-cta-text">Click Here To<br />Download Comic Book</span>
                <span className="download-comic-cta-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v13m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </a>
            ) : (
              <img className="download-item-preview" src={item.url!} alt={item.label} />
            )}
            {item.key !== 'comic-book' && <span className="download-item-label">{item.label}</span>}
            {item.key === 'comic-book' && (
              <button
                type="button"
                className="download-item-btn download-preview-btn"
                aria-label="Preview comic book"
                onClick={() => {
                  setPreviewOpen(true);
                  previewRef.current?.showModal();
                }}
              >
                Preview PDF
              </button>
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

      {showCoupon && (
        <CouponClaimModal
          source={submission.source}
          sourceId={submission.id}
          defaultName={submission.name}
          onClose={() => setShowCoupon(false)}
        />
      )}

      {submission.comicBookUrl && (
        <dialog
          ref={previewRef}
          className="pdf-preview-modal"
          aria-label="Comic book preview"
          onClick={(event) => {
            if (event.target === event.currentTarget) previewRef.current?.close();
          }}
        >
          <div className="pdf-preview-modal-header">
            <h3>Comic Book Preview</h3>
            <button
              type="button"
              className="pdf-preview-modal-close"
              aria-label="Close preview"
              onClick={() => previewRef.current?.close()}
            >
              &times;
            </button>
          </div>
          {previewOpen && (
            <iframe
              className="pdf-preview-modal-frame"
              src={submission.comicBookUrl}
              title="Comic book PDF preview"
            />
          )}
          <div className="pdf-preview-modal-actions">
            <a
              className="download-item-btn"
              href={`${submission.comicBookUrl}?download=1`}
              download
              onClick={(event) => {
                event.preventDefault();
                triggerDownload(`${submission.comicBookUrl}?download=1`);
                onComicDownload();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 4v11m0 0-4-4m4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Download</span>
            </a>
          </div>
        </dialog>
      )}
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
          <SubmissionCard
            submission={submission}
            onComicDownload={() => popupRef.current?.showModal()}
          />
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
