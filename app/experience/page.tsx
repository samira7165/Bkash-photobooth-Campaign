'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getActiveEvent } from '@/services/api';
import ExperienceLanding from '@/components/experience/ExperienceLanding';
import ExperienceInfo, { ExperienceInfoData } from '@/components/experience/ExperienceInfo';
import ExperienceCareer from '@/components/experience/ExperienceCareer';
import ExperienceCamera from '@/components/experience/ExperienceCamera';
import ExperienceProcessing from '@/components/experience/ExperienceProcessing';
import ExperienceSuccess from '@/components/experience/ExperienceSuccess';
import { MotionLogo, MotionStep } from '@/components/MotionStep';

type Step = 'loading' | 'noEvent' | 'landing' | 'info' | 'career' | 'camera' | 'processing' | 'success' | 'error';

function ExperienceFlow() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('loading');
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null);
  const [info, setInfo] = useState<ExperienceInfoData | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [careerLabel, setCareerLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    const eventId = searchParams.get('event');
    (async () => {
      try {
        if (eventId) {
          setEvent({ id: eventId, name: 'Dream Career Experience' });
        } else {
          const active = await getActiveEvent();
          if (!active) {
            setStep('noEvent');
            return;
          }
          setEvent(active);
        }
        setStep('landing');
      } catch {
        setStep('noEvent');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = () => {
    setStep('landing');
    setInfo(null);
    setParticipantId('');
    setCareerLabel('');
    setErrorMessage('');
  };

  return (
    <div className="kiosk">
      <div className="kiosk-inner">
        <MotionLogo>
          <img src="/logos/bkash.svg" alt="bKash" />
        </MotionLogo>
        <div className="kiosk-content">
          <MotionStep stepKey={step}>
          {step === 'loading' && (
            <div className="kiosk-card fade-in" style={{ textAlign: 'center' }}>
              <div className="kiosk-spinner-lg" />
            </div>
          )}

          {step === 'noEvent' && (
            <div className="kiosk-card fade-in" style={{ textAlign: 'center' }}>
              <h2 className="kiosk-title">No active event</h2>
              <p className="kiosk-sub">This experience isn&apos;t available right now. Please check back later.</p>
            </div>
          )}

          {step === 'landing' && event && (
            <ExperienceLanding eventName={event.name} onStart={() => setStep('info')} />
          )}

          {step === 'info' && (
            <ExperienceInfo
              onComplete={(data) => { setInfo(data); setStep('career'); }}
            />
          )}

          {step === 'career' && info && event && (
            <ExperienceCareer
              eventId={event.id}
              info={info}
              onComplete={(id, career) => { setParticipantId(id); setCareerLabel(career); setStep('camera'); }}
            />
          )}

          {step === 'camera' && (
            <ExperienceCamera
              participantId={participantId}
              careerLabel={careerLabel}
              onComplete={() => setStep('processing')}
            />
          )}

          {step === 'processing' && (
            <ExperienceProcessing
              participantId={participantId}
              onComplete={() => setStep('success')}
              onError={(message) => { setErrorMessage(message); setStep('error'); }}
            />
          )}

          {step === 'success' && <ExperienceSuccess onRestart={handleRestart} />}

          {step === 'error' && (
            <div className="kiosk-card fade-in" style={{ textAlign: 'center' }}>
              <h2 className="kiosk-title">Something went wrong</h2>
              <p className="kiosk-sub">{errorMessage}</p>
              <button className="kiosk-btn-secondary" onClick={handleRestart}>Start Over</button>
            </div>
          )}
          </MotionStep>
        </div>
      </div>
    </div>
  );
}

export default function ExperiencePage() {
  return (
    <Suspense fallback={null}>
      <ExperienceFlow />
    </Suspense>
  );
}
