'use client';

import { useEffect, useRef } from 'react';
import { getParticipantStatus } from '@/services/api';

interface Props {
  participantId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

const TERMINAL_SUCCESS = ['generated', 'sms_sent'];

export default function ExperienceProcessing({ participantId, onComplete, onError }: Props) {
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const status = await getParticipantStatus(participantId);
        if (TERMINAL_SUCCESS.includes(status.processingStatus)) {
          stoppedRef.current = true;
          onComplete();
        } else if (status.processingStatus === 'failed') {
          stoppedRef.current = true;
          onError(status.errorMessage || 'Something went wrong while creating your image.');
        }
      } catch {
        // transient network hiccup — keep polling
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      stoppedRef.current = true;
      clearInterval(interval);
    };
  }, [participantId, onComplete, onError]);

  return (
    <div className="kiosk-card fade-in" style={{ textAlign: 'center' }}>
      <div className="step-indicator">
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot active" />
      </div>
      <p className="step-label">STEP 4 OF 4</p>

      <h2 className="kiosk-title">Creating your dream career image…</h2>
      <p className="kiosk-sub">This usually takes under a minute. Please don&apos;t close this page.</p>

      <div className="kiosk-spinner-lg" />
    </div>
  );
}
