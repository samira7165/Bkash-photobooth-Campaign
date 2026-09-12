'use client';

import { useEffect, useState } from 'react';
import TermsAndConditions from '@/components/TermsAndConditions';
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { requestDownloadOtp, resumeDownloadSession } from '@/services/api';
import { getRememberedPhone, rememberPhone } from '@/lib/remembered-phone';

interface Props {
  initialPhone?: string;
  /** `verified` is true when this browser was already trusted and no OTP was sent. */
  onComplete: (phone: string, verified: boolean) => void;
}

export default function DownloadPhoneEntry({ onComplete, initialPhone = '' }: Props) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Prefill the number last verified in this browser. Done in an effect rather
  // than useState's initialiser because localStorage doesn't exist during SSR,
  // and reading it inline would desync the server and client render.
  useEffect(() => {
    if (initialPhone) return;
    const remembered = getRememberedPhone();
    if (remembered) setPhone(remembered);
  }, [initialPhone]);

  const submit = async () => {
    if (!phone.trim()) {
      setError('Please enter your mobile number');
      return;
    }
    if (!isValidPhone(phone)) {
      setError(PHONE_VALIDATION_MESSAGE);
      return;
    }
    if (!acceptedTerms) {
      setTermsError('Please agree to the Disclaimer to continue');
      return;
    }
    setTermsError('');
    setLoading(true);
    setError('');
    try {
      const trimmed = phone.trim();
      // If this browser already proved it owns this exact number — by
      // registering on the index page, or verifying here before — the server
      // hands back a session and nobody has to wait for another SMS.
      if (await resumeDownloadSession(trimmed)) {
        rememberPhone(trimmed);
        onComplete(trimmed, true);
        return;
      }
      await requestDownloadOtp(trimmed);
      onComplete(trimmed, false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="download-card download-search" onSubmit={(event) => { event.preventDefault(); submit(); }}>

      <div className="download-field">
        <label htmlFor="download-phone">Phone Number</label>
        <input
          id="download-phone"
          autoComplete="tel"
          type="tel"
          placeholder="+880 1XX XXXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {error && <span className="download-err">{error}</span>}
      </div>

      <TermsAndConditions accepted={acceptedTerms} onChange={(accepted) => { setAcceptedTerms(accepted); setTermsError(''); }} error={termsError} />

      <button className="download-btn-primary" type="submit" disabled={loading}>
        {loading ? 'Sending code…' : 'Search'}
      </button>
    </form>
  );
}
