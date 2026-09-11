'use client';

import { useState } from 'react';
import DownloadPhoneEntry from '@/components/download/DownloadPhoneEntry';
import DownloadOtpEntry from '@/components/download/DownloadOtpEntry';
import DownloadGallery from '@/components/download/DownloadGallery';
import { MotionStep } from '@/components/MotionStep';

type Step = 'phone' | 'otp' | 'gallery';

export default function DownloadTokenPage({ params }: { params: { token: string } }) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');

  return (
    <div className="download-page">
      <MotionStep stepKey={step}>
      {step === 'phone' && (
        <DownloadPhoneEntry
          token={params.token}
          onComplete={(p) => { setPhone(p); setStep('otp'); }}
        />
      )}
      {step === 'otp' && (
        <DownloadOtpEntry
          token={params.token}
          phone={phone}
          onComplete={() => setStep('gallery')}
        />
      )}
      {step === 'gallery' && <DownloadGallery token={params.token} />}
      </MotionStep>
    </div>
  );
}
