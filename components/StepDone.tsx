'use client';

interface Props {
  jobLabel: string;
  phone: string;
  onRestart: () => void;
}

export default function StepDone({ jobLabel, phone, onRestart }: Props) {
  return (
    <div className="kiosk-card fade-in kiosk-done">
      <div className="step-indicator">
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
      </div>

      <h2 className="kiosk-title">You&apos;re all set!</h2>
      <p className="kiosk-sub">
        Your AI-generated <strong>{jobLabel}</strong> photo is being created right now.
      </p>

      <div className="sms-box">
        <p>You&apos;ll receive an SMS at <strong>{phone}</strong> with a link to view and download your image.</p>
      </div>

      <button className="kiosk-btn-secondary" onClick={onRestart}>Start New Session</button>
    </div>
  );
}
