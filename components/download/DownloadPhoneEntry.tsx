'use client';

import { useState } from 'react';
import { requestDownloadOtp } from '@/services/api';

interface Props {
  onComplete: (phone: string) => void;
}

export default function DownloadPhoneEntry({ onComplete }: Props) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!phone.trim()) {
      setError('Please enter your mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestDownloadOtp(phone.trim());
      onComplete(phone.trim());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="download-card">
      <h2 className="download-title">Find your images</h2>
      <p className="download-sub">Enter the mobile number you used when you took your picture</p>

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
