'use client';

interface Props {
  eventName: string;
  onStart: () => void;
}

export default function ExperienceLanding({ eventName, onStart }: Props) {
  return (
    <div className="kiosk-card fade-in" style={{ textAlign: 'center' }}>
      <h2 className="kiosk-title">
        Your <span className="title-accent">dream career</span> starts here
      </h2>
      <p className="kiosk-sub">{eventName}</p>
      <p className="kiosk-sub" style={{ marginTop: '-0.5rem' }}>
        Take a photo, pick a career, and see your AI-generated dream career portrait —
        delivered straight to your phone.
      </p>

      <button className="kiosk-btn-primary" onClick={onStart}>
        <span>Create Your Dream Career Experience</span>
        <span className="btn-arrow">→</span>
      </button>
    </div>
  );
}
