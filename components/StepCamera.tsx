'use client';

import { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { uploadImage } from '@/services/api';

interface Props {
  sessionId: string;
  jobLabel: string;
  onComplete: () => void;
}

export default function StepCamera({ sessionId, jobLabel, onComplete }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const capture = useCallback(async () => {
    if (!webcamRef.current) return;
    const src = webcamRef.current.getScreenshot();
    if (!src) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await uploadImage(sessionId, blob);
      onComplete();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [sessionId, onComplete]);

  return (
    <div className="kiosk-card fade-in wide">
      <div className="step-indicator">
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot active" />
        <span className="step-dot" />
      </div>
      <p className="step-label">STEP 3 OF 4</p>

      <h2 className="kiosk-title">Strike a pose!</h2>
      <p className="kiosk-sub">Show us your best {jobLabel} look</p>

      <div className="cam-box">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          videoConstraints={{ facingMode: 'user', width: 720, height: 720 }}
          className="cam-feed" />
        <div className="cam-corner tl" />
        <div className="cam-corner tr" />
        <div className="cam-corner bl" />
        <div className="cam-corner br" />
      </div>

      {error && <p className="field-err" style={{ textAlign: 'center' }}>{error}</p>}

      <button className="shutter-btn" onClick={capture} disabled={loading}>
        {loading ? <span className="shutter-spin" /> : <span className="shutter-circle" />}
      </button>
      <p className="cam-hint">Position yourself inside the frame and tap to capture.</p>
    </div>
  );
}
