'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CouponSubmissionData,
  getCouponSubmission,
  submitCouponClaim,
} from '@/services/api';
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';

interface Props {
  source: 'booth' | 'mobile';
  sourceId: string;
  defaultName: string;
  onClose: () => void;
}

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Phase = 'checking' | 'form' | 'submitting' | 'pending' | 'approved' | 'rejected';

function StepIndicator({ phase }: { phase: Phase }) {
  const submitDone = phase === 'pending' || phase === 'approved' || phase === 'rejected';
  const couponDone = phase === 'approved';
  return (
    <div className="coupon-steps" aria-hidden="true">
      <span className="coupon-step done">
        <span className="coupon-step-num">✓</span> Share
      </span>
      <span className={`coupon-step-sep ${submitDone ? 'done' : ''}`} />
      <span className={`coupon-step ${submitDone ? 'done' : 'active'}`}>
        <span className="coupon-step-num">{submitDone ? '✓' : '2'}</span> Submit Proof
      </span>
      <span className={`coupon-step-sep ${couponDone ? 'done' : ''}`} />
      <span className={`coupon-step ${couponDone ? 'active' : ''}`}>
        <span className="coupon-step-num">3</span> Get Coupon
      </span>
    </div>
  );
}

export default function CouponClaimModal({ source, sourceId, defaultName, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('checking');
  const [submission, setSubmission] = useState<CouponSubmissionData | null>(null);
  const [loadError, setLoadError] = useState('');

  const [bkashNumber, setBkashNumber] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [name, setName] = useState(defaultName);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCouponSubmission(source, sourceId)
      .then((res) => {
        if (cancelled) return;
        if (res.submission) {
          setSubmission(res.submission);
          setPhase(res.submission.status === 'pending' ? 'pending' : res.submission.status === 'approved' ? 'approved' : 'rejected');
        } else {
          setPhase('form');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || 'Failed to check coupon status');
        setPhase('form');
      });
    return () => { cancelled = true; };
  }, [source, sourceId]);

  useEffect(() => {
    return () => {
      if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    };
  }, [screenshotPreview]);

  function close() {
    dialogRef.current?.close();
  }

  function pickScreenshot(file: File | undefined) {
    if (!file) return;
    setFieldError('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFieldError('Screenshot must be a JPG, PNG, or WEBP image');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setFieldError('Screenshot must be smaller than 8MB');
      return;
    }
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setScreenshotFile(file);
  }

  function removeScreenshot() {
    setScreenshotFile(null);
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  const canSubmit =
    !!screenshotFile && name.trim().length > 0 && isValidPhone(bkashNumber) && phase !== 'submitting';

  async function submit() {
    setSubmitError('');
    if (!name.trim()) { setFieldError('Please enter your name'); return; }
    if (!isValidPhone(bkashNumber)) { setFieldError(PHONE_VALIDATION_MESSAGE); return; }
    if (!screenshotFile) { setFieldError('Please upload a screenshot of your post'); return; }
    if (postUrl.trim()) {
      try {
        new URL(postUrl.trim());
      } catch {
        setFieldError('Post link must be a valid URL');
        return;
      }
    }
    setFieldError('');
    setPhase('submitting');
    try {
      const res = await submitCouponClaim({
        source,
        sourceId,
        name: name.trim(),
        phone: bkashNumber,
        postUrl: postUrl.trim() || undefined,
        screenshot: screenshotFile,
      });
      setSubmission(res.submission);
      setPhase('pending');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setPhase('form');
    }
  }

  function retrySubmission() {
    setSubmitError('');
    setFieldError('');
    setScreenshotFile(null);
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhase('form');
  }

  async function copyCode() {
    if (!submission?.couponCode) return;
    try {
      await navigator.clipboard.writeText(submission.couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browsers, non-secure
      // context) — the code is still visible on the card either way.
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="coupon-modal"
      aria-label="Claim your coupon"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="coupon-modal-header">
        <button type="button" className="coupon-modal-close" aria-label="Close" onClick={close}>
          &times;
        </button>
        <p className="coupon-modal-title">🎁 CLAIM YOUR COUPON</p>
        <p className="coupon-modal-sub">
          Share your photo on social media and submit your proof to claim your exclusive bKash coupon.
        </p>
      </div>

      <StepIndicator phase={phase} />

      <div className="coupon-modal-body">
        {phase === 'checking' && (
          <div className="download-spinner" role="status" aria-label="Loading" />
        )}

        {(phase === 'form' || phase === 'submitting') && (
          <>
            {loadError && <p className="download-err">{loadError}</p>}

            <div className="coupon-field">
              <label htmlFor="coupon-post-url">Post Link</label>
              <input
                id="coupon-post-url"
                type="url"
                placeholder="Paste your social media post link"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                disabled={phase === 'submitting'}
              />
              <span className="coupon-field-helper">Paste the link to the post where you shared your photo.</span>
            </div>

            <div className="coupon-field">
              <label>Upload Screenshot</label>
              {screenshotFile && screenshotPreview ? (
                <div className="coupon-upload-preview">
                  <button
                    type="button"
                    className="coupon-upload-remove"
                    aria-label="Remove screenshot"
                    onClick={removeScreenshot}
                    disabled={phase === 'submitting'}
                  >
                    &times;
                  </button>
                  <img src={screenshotPreview} alt="Screenshot preview" />
                  <div className="coupon-upload-filename">{screenshotFile.name}</div>
                </div>
              ) : (
                <button
                  type="button"
                  className="coupon-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={phase === 'submitting'}
                >
                  <span className="coupon-upload-icon" aria-hidden="true">📷</span>
                  <span className="coupon-upload-title">Upload Screenshot</span>
                  <span className="coupon-upload-helper">
                    Make sure your profile name and shared post are visible.
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => pickScreenshot(e.target.files?.[0])}
              />
            </div>

            <div className="coupon-field">
              <label htmlFor="coupon-name">Name</label>
              <input
                id="coupon-name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={phase === 'submitting'}
              />
            </div>

            <div className="coupon-field">
              <label htmlFor="coupon-phone">bKash Account Number</label>
              <input
                id="coupon-phone"
                type="tel"
                placeholder="01XXXXXXXXX"
                value={bkashNumber}
                onChange={(e) => setBkashNumber(e.target.value)}
                disabled={phase === 'submitting'}
              />
              <span className="coupon-field-helper">The coupon will be issued to this bKash account.</span>
            </div>

            {(fieldError || submitError) && <p className="download-err">{fieldError || submitError}</p>}

            <button
              type="button"
              className="coupon-submit-btn"
              onClick={submit}
              disabled={!canSubmit}
            >
              {phase === 'submitting' ? 'Submitting…' : 'SUBMIT & GET COUPON'}
            </button>
          </>
        )}

        {phase === 'pending' && submission && (
          <>
            <div className="coupon-status-icon" aria-hidden="true">✓</div>
            <h3 className="coupon-status-title">Submission Received</h3>
            <p className="coupon-status-text">Thanks for sharing your bKash photo!</p>
            <p className="coupon-status-text">Your submission has been received and is being verified.</p>
            <span className="coupon-status-id">Submission ID: #{submission.id.slice(0, 8).toUpperCase()}</span>
            <button type="button" className="coupon-secondary-btn" onClick={close}>
              View My Photo
            </button>
          </>
        )}

        {phase === 'approved' && submission && (
          <>
            <div className="coupon-status-icon" aria-hidden="true">🎉</div>
            <h3 className="coupon-status-title">CONGRATULATIONS!</h3>
            <p className="coupon-status-text">Your coupon is ready</p>
            <div className="coupon-card">
              <div className="coupon-card-value">{submission.couponValue}</div>
              <div className="coupon-card-code-label">Coupon Code</div>
              <div className="coupon-card-code">{submission.couponCode}</div>
              {submission.couponExpiry && (
                <div className="coupon-card-expiry">
                  Valid until: {new Date(submission.couponExpiry).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka',
                  })}
                </div>
              )}
            </div>
            <button type="button" className={`coupon-copy-btn ${copied ? 'copied' : ''}`} onClick={copyCode}>
              {copied ? '✓ Copied!' : 'COPY CODE'}
            </button>
            <button type="button" className="coupon-secondary-btn" onClick={close}>
              View My Photo
            </button>
          </>
        )}

        {phase === 'rejected' && submission && (
          <>
            <div className="coupon-status-icon" aria-hidden="true">✕</div>
            <h3 className="coupon-status-title">Submission Not Approved</h3>
            <p className="coupon-status-text">Your submission could not be verified.</p>
            {submission.rejectionReason && (
              <p className="coupon-status-text"><strong>Reason:</strong> {submission.rejectionReason}</p>
            )}
            <button type="button" className="coupon-retry-btn" onClick={retrySubmission}>
              Submit Again
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
