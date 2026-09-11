'use client';

import { useState } from 'react';
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { requestDownloadOtp } from '@/services/api';

interface Props {
  initialPhone?: string;
  onComplete: (phone: string) => void;
}

export default function DownloadPhoneEntry({ onComplete, initialPhone = '' }: Props) {
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!phone.trim()) {
      setError('Please enter your mobile number');
      return;
    }
    if (!isValidPhone(phone)) {
      setError(PHONE_VALIDATION_MESSAGE);
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

      <button className="download-btn-primary" type="submit" disabled={loading}>
        {loading ? 'Sending code…' : 'Search'}
      </button>
    </form>
  );
}
