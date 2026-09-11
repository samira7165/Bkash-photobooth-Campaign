'use client';

import { useEffect, useState } from 'react';
import { resolveDownloadToken, requestDownloadOtp } from '@/services/api';

interface Props {
  token: string;
  onComplete: (phone: string) => void;
}

export default function DownloadPhoneEntry({ token, onComplete }: Props) {
  const [checking, setChecking] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resolveDownloadToken(token)
      .then((res) => setLinkValid(res.valid))
      .catch(() => setLinkValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const submit = async () => {
    if (!phone.trim()) {
      setError('Please enter your mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestDownloadOtp(token, phone.trim());
      onComplete(phone.trim());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="download-card">
        <div className="download-spinner" />
      </div>
    );
  }

  if (!linkValid) {
    return (
      <div className="download-card">
        <h2 className="download-title">Link expired</h2>
        <p className="download-sub">
          This download link is no longer valid. Please contact the event organizer for help.
        </p>
      </div>
    );
  }

  return (
    <div className="download-card">
      <h2 className="download-title">Access your images</h2>
      <p className="download-sub">Enter your mobile number to access your images</p>

      <div className="download-field">
        <label>Mobile Number</label>
        <input
          type="tel"
          placeholder="+880 1XX XXXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {error && <span className="download-err">{error}</span>}
      </div>

      <button className="download-btn-primary" onClick={submit} disabled={loading}>
        {loading ? 'Sending code…' : 'Continue'}
      </button>
    </div>
  );
}
