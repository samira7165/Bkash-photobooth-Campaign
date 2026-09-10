'use client';

interface Props {
  jobLabel: string;
  phone: string;
  campaignName: string;
  onRestart: () => void;
}

export default function StepDone({ jobLabel, phone, campaignName, onRestart }: Props) {
  return (
    <div className="kiosk-card fade-in kiosk-done">
      <div className="step-indicator">
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
      </div>

      <div className="done-party">🎉</div>
      <h2 className="kiosk-title">You&apos;re all set!</h2>
      <p className="kiosk-sub">
        Your AI-generated <strong>{jobLabel}</strong> photo is being created right now.
      </p>

      <div className="sms-box">
        <span className="sms-box-icon">📱</span>
        <p>You&apos;ll receive an SMS at <strong>{phone}</strong> with a link to view and download your image.</p>
      </div>

      <button className="kiosk-btn-secondary" onClick={onRestart}>Start New Session</button>
    </div>
  );
}
