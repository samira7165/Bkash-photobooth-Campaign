'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { uploadParticipantImage } from '@/services/api';

interface Props {
  participantId: string;
  careerLabel: string;
  onComplete: () => void;
}

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 1800;
const TARGET_RATIO = OUTPUT_WIDTH / OUTPUT_HEIGHT;

// Center-crop any image/video source to the 1200x1800 target aspect ratio
// (cameras and uploaded photos rarely come in native portrait, so we crop
// rather than stretch) and encode it as a JPEG blob.
function cropToOutput(source: CanvasImageSource, srcWidth: number, srcHeight: number): Promise<Blob | null> {
  const srcRatio = srcWidth / srcHeight;
  let sx = 0, sy = 0, sw = srcWidth, sh = srcHeight;
  if (srcRatio > TARGET_RATIO) {
    sw = srcHeight * TARGET_RATIO;
    sx = (srcWidth - sw) / 2;
  } else {
    sh = srcWidth / TARGET_RATIO;
    sy = (srcHeight - sh) / 2;
  }

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

export default function ExperienceCamera({ participantId, careerLabel, onComplete }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Only phones/tablets with more than one camera can actually switch —
  // most booth kiosk webcams have just one, so the button stays hidden there.
  const checkCameraCount = useCallback(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCanSwitchCamera(videoInputs.length > 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { checkCameraCount(); }, [checkCameraCount]);

  const switchCamera = useCallback(() => {
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
  }, []);

  const setPreview = useCallback((blob: Blob) => {
    setPreviewBlob(blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }, []);

  const capture = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setBusy(true);
    setError('');
    try {
      const blob = await cropToOutput(video, video.videoWidth, video.videoHeight);
      if (!blob) return;
      setPreview(blob);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [setPreview]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const blob = await cropToOutput(img, img.naturalWidth, img.naturalHeight);
        if (blob) setPreview(blob);
      } catch (err: any) {
        setError(err.message || 'Failed to process the selected image');
      } finally {
        URL.revokeObjectURL(objectUrl);
        setBusy(false);
      }
    };
    img.onerror = () => {
      setError('Could not load the selected image');
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    };
    img.src = objectUrl;
  }, [setPreview]);

  const retake = useCallback(() => {
    setError('');
    setPreviewBlob(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const submit = useCallback(async () => {
    if (!previewBlob) return;
    setBusy(true);
    setUploading(true);
    setError('');
    // Warn on tab close / refresh while the photo is still in flight — the
    // upload retries transient network drops itself, but there's no
    // recovering from the tab closing mid-request.
    const warnOnClose = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warnOnClose);
    try {
      await uploadParticipantImage(participantId, previewBlob);
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      window.removeEventListener('beforeunload', warnOnClose);
      setUploading(false);
      setBusy(false);
    }
  }, [previewBlob, participantId, onComplete]);

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
      <p className="kiosk-sub">Show us your best {careerLabel} look</p>

      <div className="cam-box">
        {previewUrl ? (
          <img src={previewUrl} alt="Captured preview" className="cam-feed" />
        ) : (
          <Webcam ref={webcamRef} audio={false} mirrored={facingMode === 'user'}
            videoConstraints={{ facingMode, width: 1200, height: 1800 }}
            onUserMedia={checkCameraCount}
            className="cam-feed" />
        )}
        {!previewUrl && canSwitchCamera && (
          <button type="button" className="cam-switch-btn" onClick={switchCamera} disabled={busy} aria-label="Switch camera">
            ⟳
          </button>
        )}
        <div className="cam-corner tl" />
        <div className="cam-corner tr" />
        <div className="cam-corner bl" />
        <div className="cam-corner br" />
      </div>

      {error && <p className="field-err" style={{ textAlign: 'center' }}>{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {!previewUrl ? (
        <>
          <button className="shutter-btn" onClick={capture} disabled={busy}>
            {busy ? <span className="shutter-spin" /> : <span className="shutter-circle" />}
          </button>
          <p className="cam-hint">Position yourself inside the frame and tap to capture.</p>
          <button className="kiosk-btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            Upload Photo Instead
          </button>
        </>
      ) : (
        <>
          <button className="kiosk-btn-secondary" onClick={retake} disabled={busy}>
            Retake
          </button>
          <button className="kiosk-btn-primary" onClick={submit} disabled={busy}>
            <span>{uploading ? 'Uploading…' : 'Continue'}</span>
            <span className="btn-arrow">→</span>
          </button>
          {uploading && (
            <p className="cam-hint" role="alert">Please don&apos;t close this page or turn off your phone while your photo uploads.</p>
          )}
        </>
      )}
    </div>
  );
}
