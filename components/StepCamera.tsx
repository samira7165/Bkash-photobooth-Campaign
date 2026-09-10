'use client';

import { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { uploadImage } from '@/services/api';

interface Props {
  sessionId: string;
  jobLabel: string;
  onComplete: () => void;
}

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 1800;

export default function StepCamera({ sessionId, jobLabel, onComplete }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const capture = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setLoading(true);
    setError('');
    try {
      // Center-crop the raw video frame to the 1200x1800 target aspect ratio
      // (cameras rarely stream native portrait, so we crop rather than stretch).
      const targetRatio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
      const srcRatio = video.videoWidth / video.videoHeight;
      let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
      if (srcRatio > targetRatio) {
        sw = video.videoHeight * targetRatio;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = video.videoWidth / targetRatio;
        sy = (video.videoHeight - sh) / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) return;
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
        <Webcam ref={webcamRef} audio={false}
          videoConstraints={{ facingMode: 'user', width: 1200, height: 1800 }}
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
