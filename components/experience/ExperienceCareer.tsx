'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createParticipant } from '@/services/api';
import { ExperienceInfoData } from './ExperienceInfo';

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

  const pick = (career: string) => {
    setSelected(career);
    setError('');
  };

  const submit = async () => {
    if (!selected) return;

    setLoading(true);
    setError('');
    try {
      const { participantId } = await createParticipant({
        name: info.name.trim(),
        phone: info.phone.trim(),
        email: info.email.trim() || undefined,
        college: info.college.trim() || undefined,
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

      <h2 className="kiosk-title">What do you want to be when you grow up?</h2>
      <p className="kiosk-sub">Pick your dream job</p>

      <div className="kiosk-job-grid">
        {CAREERS.map((career) => (
          <button
            key={career}
            className={`kiosk-job-tile kiosk-job-tile-visual ${selected === career ? 'selected' : ''}`}
            aria-pressed={selected === career}
            onClick={() => pick(career)}
          >
            <Image
              className="job-tile-image"
              src={`/careers/${career.toLowerCase().replace(/ /g, '-')}.png`}
              alt=""
              width={240}
              height={240}
              sizes="(max-width: 768px) 30vw, 150px"
            />
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
