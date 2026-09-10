'use client';

import { useState } from 'react';
import { selectJob } from '@/services/api';

const JOBS = [
  'Military', 'Painter', 'Scientist', 'Professional Gamer',
  'Doctor', 'Engineer', 'Pilot', 'Journalist',
  'Photographer', 'Lawyer', 'Singer', 'Footballer',
];
const ICONS: Record<string, string> = {
  Military: '🎖️', Painter: '🎨', Scientist: '🔬', 'Professional Gamer': '🎮',
  Doctor: '🩺', Engineer: '⚙️', Pilot: '✈️', Journalist: '📰',
  Photographer: '📸', Lawyer: '⚖️', Singer: '🎤', Footballer: '⚽',
};

interface Props {
  sessionId: string;
  onComplete: (job: string, custom: string) => void;
}

export default function StepDreamJob({ sessionId, onComplete }: Props) {
  const [selected, setSelected] = useState('');
  const [customJob, setCustomJob] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pick = (job: string) => {
    setSelected(job);
    setShowOther(job === 'Other');
    if (job !== 'Other') setCustomJob('');
    setError('');
  };

  const submit = async () => {
    if (!selected) return;
    if (selected === 'Other' && !customJob.trim()) { setError('Please type your dream job'); return; }
    setLoading(true);
    try {
      await selectJob(sessionId, { job: selected, customJob: selected === 'Other' ? customJob.trim() : undefined });
      onComplete(selected, customJob.trim());
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
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
        {JOBS.map((job) => (
          <button key={job} className={`kiosk-job-tile ${selected === job ? 'selected' : ''}`}
            onClick={() => pick(job)}>
            <span className="job-tile-icon">{ICONS[job]}</span>
            <span className="job-tile-label">{job}</span>
            {selected === job && <span className="job-check">✓</span>}
          </button>
        ))}
        <button className={`kiosk-job-tile ${selected === 'Other' ? 'selected' : ''}`}
          onClick={() => pick('Other')}>
          <span className="job-tile-icon">✨</span>
          <span className="job-tile-label">Other</span>
          {selected === 'Other' && <span className="job-check">✓</span>}
        </button>
      </div>

      {showOther && (
        <div className="kiosk-field" style={{ marginTop: '0.75rem' }}>
          <div className="input-wrap">
            <span className="input-icon">💭</span>
            <input type="text" placeholder="Type your dream job…" value={customJob}
              onChange={(e) => setCustomJob(e.target.value)} autoFocus />
          </div>
        </div>
      )}

      {error && <p className="field-err" style={{ textAlign: 'center' }}>{error}</p>}

      <button className="kiosk-btn-primary" onClick={submit} disabled={!selected || loading}>
        <span>{loading ? 'Saving…' : 'Continue to Camera'}</span>
        <span className="btn-arrow">→</span>
      </button>
    </div>
  );
}
