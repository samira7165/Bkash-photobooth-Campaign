'use client';

import { useState, useEffect } from 'react';
import StepInfo from '@/components/StepInfo';
import StepDreamJob from '@/components/StepDreamJob';
import StepCamera from '@/components/StepCamera';
import StepDone from '@/components/StepDone';
import { MotionLogo, MotionStep } from '@/components/MotionStep';

type Step = 'info' | 'dreamJob' | 'camera' | 'done';

export default function Home() {
  const [step, setStep] = useState<Step>('info');
  const [sessionId, setSessionId] = useState('');
  const [phone, setPhone] = useState('');
  const [jobLabel, setJobLabel] = useState('');

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
  }, []);

  const handleRestart = () => {
    setStep('info');
    setSessionId('');
    setPhone('');
    setJobLabel('');
  };

  return (
    <div className="kiosk">
      <div className="kiosk-inner">
        <MotionLogo>
          <img src="/logos/bkash.svg" alt="bKash" />
        </MotionLogo>
        <div className="kiosk-content">
          <MotionStep stepKey={step}>
          {step === 'info' && (
            <StepInfo
              onComplete={(id, ui) => { setSessionId(id); setPhone(ui.phone); setStep('dreamJob'); }}
            />
          )}
          {step === 'dreamJob' && (
            <StepDreamJob
              sessionId={sessionId}
              onComplete={(j, c) => { setJobLabel(j === 'Other' ? c : j); setStep('camera'); }}
            />
          )}
          {step === 'camera' && (
            <StepCamera
              sessionId={sessionId}
              jobLabel={jobLabel}
              onComplete={() => setStep('done')}
            />
          )}
          {step === 'done' && (
            <StepDone
              jobLabel={jobLabel}
              phone={phone}
              onRestart={handleRestart}
            />
          )}
          </MotionStep>
        </div>
      </div>
    </div>
  );
}
