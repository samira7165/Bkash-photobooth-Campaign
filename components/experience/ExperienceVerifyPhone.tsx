'use client';

import { useState } from 'react';
import { requestParticipantOtp, verifyDownloadOtp } from '@/services/api';
import { rememberPhone } from '@/lib/remembered-phone';

interface Props {
  phone: string;
  onComplete: () => void;
}

// Proves the person filling out step 1 actually controls the phone number
// they typed in, before we create a Participant tied to it — otherwise
// anyone could enter a stranger's number, and since phone is now globally
// unique (one picture ever per number), that would permanently lock the
// real owner out of ever participating.
export default function ExperienceVerifyPhone({ phone, onComplete }: Props) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const submit = async () => {
    if (!otp.trim()) {
      setError('Please enter the code we sent you');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Reuses the download portal's verify endpoint — it's generic
      // (verify code, issue a phone-ownership cookie), not download-specific.
      await verifyDownloadOtp(phone, otp.trim());
      // Ownership is now proved for this browser; remember the number so the
      // download portal can prefill it and skip straight past the OTP.
      rememberPhone(phone);
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    try {
      await requestParticipantOtp(phone);
      setResent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="kiosk-card fade-in">
      <div className="step-indicator">
        <span className="step-dot active" />
        <span className="step-dot" />
        <span className="step-dot" />
        <span className="step-dot" />
      </div>
      <p className="step-label">STEP 1 OF 4</p>

      <h2 className="kiosk-title">Verify your number</h2>
      <p className="kiosk-sub">We sent a 6-digit code to {phone}. It expires in a few minutes.</p>

      <div className="kiosk-field">
        <label>Verification Code <span className="req">*</span></label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError(''); }}
        />
        {error && <span className="field-err">{error}</span>}
      </div>

      <button className="kiosk-btn-primary" onClick={submit} disabled={loading}>
        <span>{loading ? 'Verifying…' : 'Verify'}</span>
        <span className="btn-arrow">→</span>
      </button>

      <button className="kiosk-btn-secondary" onClick={resend} disabled={resending} style={{ marginTop: '0.75rem' }}>
        {resent ? 'Code resent' : resending ? 'Resending…' : 'Resend code'}
      </button>
    </div>
  );
}
