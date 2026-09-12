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
      <main className="download-layout">
        <header className="download-hero">
          <img src="/logos/bkash.svg" alt="bKash" className="download-brand" />
          <p className="download-eyebrow">Your dream. Your story.</p>
          <h1>Find Your Dream Career Photo</h1>
          <p>Enter the phone number you used at the photobooth to retrieve your files.</p>
        </header>
      {step === 'phone' && (
        <DownloadPhoneEntry
          initialPhone={phone}
          onComplete={(p, verified) => { setPhone(p); setStep(verified ? 'gallery' : 'otp'); }}
        />
      )}
      {step === 'otp' && (
        <DownloadOtpEntry
          phone={phone}
          onComplete={() => setStep('gallery')}
        />
      )}
      {step === 'gallery' && <DownloadGallery />}
      </main>
    </div>
  );
}
