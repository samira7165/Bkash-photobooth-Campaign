'use client';

import { useId } from 'react';
import termsContent from './terms-content.json';

interface Props {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  error?: string;
}

export default function TermsAndConditions({ accepted, onChange, error }: Props) {
  const id = useId();

  return (
    <div className="terms-and-conditions">
      <details className="terms-details">
        <summary>Terms and Conditions</summary>
        <div className="terms-content" tabIndex={0} role="region" aria-label="AI Photobooth Experience: Terms of Use">
          {termsContent}
        </div>
      </details>
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
    </div>
  );
}
