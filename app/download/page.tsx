'use client';

import { useState } from 'react';
import DownloadPhoneEntry from '@/components/download/DownloadPhoneEntry';
import DownloadOtpEntry from '@/components/download/DownloadOtpEntry';
import DownloadGallery from '@/components/download/DownloadGallery';

type Step = 'phone' | 'otp' | 'gallery';

export default function DownloadPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');

  return (
    <div className="download-page">
      {step === 'phone' && (
        <DownloadPhoneEntry
          onComplete={(p) => { setPhone(p); setStep('otp'); }}
        />
      )}
      {step === 'otp' && (
        <DownloadOtpEntry
          phone={phone}
          onComplete={() => setStep('gallery')}
        />
      )}
      {step === 'gallery' && <DownloadGallery />}
    </div>
  );
}
