'use client';

import { useState } from 'react';
import Image from 'next/image';
import { selectJob } from '@/services/api';

const JOBS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer',
];

interface Props {
  sessionId: string;
  onComplete: (job: string, custom: string) => void;
}

export default function StepDreamJob({ sessionId, onComplete }: Props) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pick = (job: string) => {
    setSelected(job);
    setError('');
  };

  const submit = async () => {
    if (!selected) return;

    setLoading(true);

    try {
      await selectJob(sessionId, { job: selected });

      onComplete(selected, '');

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

      <h2 className="kiosk-title">
        What do you want to be when you grow up?
      </h2>

      <p className="kiosk-sub">
        Pick your dream job
      </p>


      <div className="kiosk-job-grid">

        {JOBS.map((job) => (
          <button
            key={job}
            className={`kiosk-job-tile kiosk-job-tile-visual ${selected === job ? 'selected' : ''}`}
            aria-pressed={selected === job}
            onClick={() => pick(job)}
          >
            <Image
              className="job-tile-image"
              src={`/careers/${job.toLowerCase().replace(/ /g, '-')}.png`}
              alt=""
              width={240}
              height={240}
              sizes="(max-width: 768px) 30vw, 150px"
            />
            <span className="job-tile-label">
              {job}
            </span>

            {selected === job && (
              <span className="job-check">
                ✓
              </span>
            )}
          </button>
        ))}

      </div>


      {error && (
        <p
          className="field-err"
          style={{ textAlign: 'center' }}
        >
          {error}
        </p>
      )}


      <button
        className="kiosk-btn-primary"
        onClick={submit}
        disabled={!selected || loading}
      >

        <span>
          {loading ? 'Saving…' : 'Continue to Camera'}
        </span>

        <span className="btn-arrow">
          →
        </span>

      </button>

    </div>
  );
}
