'use client';

import { useRef } from 'react';

const RULES = [
  'Download your photo from the photobooth.',
  'Share the photo on your social media account.',
  'Your post must be public so it can be verified.',
  'Upload a clear screenshot of your shared post.',
  'Your screenshot must show your profile/account name and the shared photo.',
  'Submit the required information correctly.',
  'Each participant is eligible for one coupon only.',
  'Coupon issuance is subject to successful verification of your post.',
  'The coupon is valid only within the specified campaign period and terms.',
];

export default function CouponRules() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="terms-and-conditions">
      <button
        type="button"
        className="terms-trigger terms-trigger-solid"
        onClick={() => dialogRef.current?.showModal()}
      >
        <span aria-hidden="true">🎟️</span>
        <span>Rules to Get Your Coupon</span>
        <svg className="terms-trigger-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        className="terms-modal"
        aria-label="Rules to Get Your Coupon"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="terms-modal-header">
          <h3>🎟️ Rules to Get Your Coupon</h3>
          <button
            type="button"
            className="terms-modal-close"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            &times;
          </button>
        </div>
        <div className="terms-modal-body coupon-rules-body" tabIndex={0}>
          <ul>
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div className="terms-modal-actions">
          <button type="button" className="terms-modal-btn-primary" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}
