'use client';

interface Props {
  onRestart: () => void;
}

export default function ExperienceSuccess({ onRestart }: Props) {
  return (
    <div className="kiosk-card fade-in kiosk-done">
      <div className="step-indicator">
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
        <span className="step-dot done">✓</span>
      </div>

      <h2 className="kiosk-title">Your dream career image is ready!</h2>

      <div className="sms-box">
        <p>Check your SMS for your download link.</p>
      </div>

      <button className="kiosk-btn-secondary" onClick={onRestart}>Start Over</button>
    </div>
  );
}
