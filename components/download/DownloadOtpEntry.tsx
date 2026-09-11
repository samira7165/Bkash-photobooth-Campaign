'use client';

import { useState } from 'react';
import { requestDownloadOtp, verifyDownloadOtp } from '@/services/api';

interface Props {
  phone: string;
  onComplete: () => void;
}

export default function DownloadOtpEntry({ phone, onComplete }: Props) {
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
      await verifyDownloadOtp(phone, otp.trim());
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
      await requestDownloadOtp(phone);
      setResent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="download-card">
      <h2 className="download-title">Enter verification code</h2>
      <p className="download-sub">We sent a 6-digit code to {phone}. It expires in a few minutes.</p>

      <div className="download-field">
        <label>Verification Code</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
        {error && <span className="download-err">{error}</span>}
      </div>

      <button className="download-btn-primary" onClick={submit} disabled={loading}>
        {loading ? 'Verifying…' : 'Verify'}
      </button>

      <button className="download-btn-link" onClick={resend} disabled={resending}>
        {resent ? 'Code resent' : resending ? 'Resending…' : 'Resend code'}
      </button>
    </div>
  );
}
