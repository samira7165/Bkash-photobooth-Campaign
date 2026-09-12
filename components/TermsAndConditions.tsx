'use client';

import { useId, useRef } from 'react';
import termsContent from './terms-content.json';

interface Props {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  error?: string;
}

export default function TermsAndConditions({ accepted, onChange, error }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="terms-and-conditions">
      <button
        type="button"
        className="terms-trigger"
        onClick={() => dialogRef.current?.showModal()}
      >
        <svg className="terms-trigger-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 3.5h7l4.5 4.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 3.5V8h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8.5 12.5h7M8.5 15.5h7M8.5 18h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span>Terms and Conditions</span>
        <svg className="terms-trigger-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <label className="terms-agreement" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={!!error && !accepted}
          aria-describedby={error && !accepted ? `${id}-error` : undefined}
        />
        <span>I have read and agree to the Terms and Conditions</span>
      </label>
      {error && !accepted && <p id={`${id}-error`} className="terms-error" role="alert">{error}</p>}

      <dialog
        ref={dialogRef}
        className="terms-modal"
        aria-label="AI Photobooth Experience: Terms of Use"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="terms-modal-header">
          <h3>Terms and Conditions</h3>
          <button
            type="button"
            className="terms-modal-close"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            &times;
          </button>
        </div>
        <div className="terms-modal-body" tabIndex={0}>
          {termsContent}
        </div>
        <div className="terms-modal-actions">
          <button type="button" className="terms-modal-btn-secondary" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
          <button
            type="button"
            className="terms-modal-btn-primary"
            onClick={() => {
              onChange(true);
              dialogRef.current?.close();
            }}
          >
            Agree
          </button>
        </div>
      </dialog>
    </div>
  );
}
