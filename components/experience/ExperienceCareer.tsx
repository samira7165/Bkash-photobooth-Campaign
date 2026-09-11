'use client';

import { useState } from 'react';
import { createParticipant } from '@/services/api';
import { ExperienceInfoData } from './ExperienceInfo';
import CareerVisual from '@/components/CareerVisual';

const CAREERS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer',
];

interface Props {
  eventId: string;
  info: ExperienceInfoData;
  onComplete: (participantId: string, career: string) => void;
}

export default function ExperienceCareer({ eventId, info, onComplete }: Props) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const { participantId } = await createParticipant({
        name: info.name.trim(),
        phone: info.phone.trim(),
        email: info.email.trim() || undefined,
        gender: info.gender,
        career: selected,
        eventId,
      });
      onComplete(participantId, selected);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kiosk-card fade-in wide">
      <div className="step-indicator">
        <span className="step-dot done">✓</span>
        <span className="step-dot active" />
        <span className="step-dot" />
        <span className="step-dot" />
      </div>
      <p className="step-label">STEP 2 OF 4</p>

      <h2 className="kiosk-title">What&apos;s your dream career?</h2>
      <p className="kiosk-sub">Pick one to see yourself in the role</p>

      <div className="kiosk-job-grid">
        {CAREERS.map((career) => (
          <button
            key={career}
            className={`kiosk-job-tile ${selected === career ? 'selected' : ''}`}
            onClick={() => setSelected(career)}
          >
            <CareerVisual career={career} />
            <span className="job-tile-label">{career}</span>
            {selected === career && <span className="job-check">✓</span>}
          </button>
        ))}
      </div>

      {error && <p className="field-err" style={{ textAlign: 'center' }}>{error}</p>}

      <button className="kiosk-btn-primary" onClick={submit} disabled={!selected || loading}>
        <span>{loading ? 'Saving…' : 'Continue'}</span>
        <span className="btn-arrow">→</span>
      </button>
    </div>
  );
}
