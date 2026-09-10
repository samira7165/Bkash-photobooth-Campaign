'use client';

import { useState, useEffect } from 'react';
import StepInfo from '@/components/StepInfo';
import StepDreamJob from '@/components/StepDreamJob';
import StepCamera from '@/components/StepCamera';
import StepDone from '@/components/StepDone';
import BoothDecorations from '@/components/BoothDecorations';
import { getCampaigns, Campaign } from '@/services/api';

type Step = 'loading' | 'info' | 'dreamJob' | 'camera' | 'done';

// Confirmed via `ls public/characters/` — the plain pink cityscape gradient
// (no characters baked in) lives at public/characters/background.png.
const BG_IMAGE = '/characters/background.png';

export default function Home() {
  const [step, setStep] = useState<Step>('loading');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [phone, setPhone] = useState('');
  const [jobLabel, setJobLabel] = useState('');

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    getCampaigns()
      .then((list) => {
        const active = list.filter((c) => c.isActive);
        setCampaigns(active);
        if (active.length === 1) {
          setActiveCampaign(active[0]);
          setStep('info');
        } else if (active.length > 1) {
          setStep('loading');
        } else {
          setStep('loading');
        }
      })
      .catch(() => setStep('loading'));
  }, []);

  const handleRestart = () => {
    setStep('info');
    setSessionId('');
    setPhone('');
    setJobLabel('');
  };

  // No campaigns
  if (step === 'loading' && !activeCampaign && campaigns.length === 0) {
    return (
      <div className="kiosk" style={{ backgroundImage: `url(${BG_IMAGE})` }}>
        <div className="kiosk-content">
          <div className="kiosk-card fade-in" style={{ textAlign: 'center' }}>
            <h2 className="kiosk-title">No active campaign</h2>
            <p className="kiosk-sub">
              Create a campaign in the <a href="/admin" style={{ color: '#ffc3d7' }}>admin dashboard</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Campaign picker if multiple
  if (!activeCampaign && campaigns.length > 1) {
    return (
      <div className="kiosk" style={{ backgroundImage: `url(${BG_IMAGE})` }}>
        <BoothDecorations step="info" />
        <div className="kiosk-content">
          <div className="kiosk-card fade-in wide">
            <h2 className="kiosk-title">Select Campaign</h2>
            <p className="kiosk-sub">Which campaign is running?</p>
            <div className="kiosk-job-grid">
              {campaigns.map((c) => (
                <button key={c.id} className="kiosk-job-tile"
                  onClick={() => { setActiveCampaign(c); setStep('info'); }}>
                  {c.logoUrl
                    ? <img src={c.logoUrl} alt={c.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    : <span className="job-tile-icon">{c.name.charAt(0)}</span>}
                  <span className="job-tile-label">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = step === 'loading' ? 'info' : step;

  return (
    <div className="kiosk" style={{ backgroundImage: `url(${BG_IMAGE})` }}>
      {/* Layer 2: Character decorations */}
      <BoothDecorations step={currentStep as any} />

      {/* Logo */}
      <div className="kiosk-logo">
        {activeCampaign?.logoUrl ? (
          <img src={activeCampaign.logoUrl} alt={activeCampaign.name} />
        ) : (
          <span className="kiosk-logo-text">{activeCampaign?.name || 'Dream Job Photobooth'}</span>
        )}
      </div>

      {/* Layer 3: Card content */}
      <div className="kiosk-content">
        {step === 'info' && activeCampaign && (
          <StepInfo
            campaignId={activeCampaign.id}
            campaignName={activeCampaign.name}
            onComplete={(id, ui) => { setSessionId(id); setPhone(ui.phone); setStep('dreamJob'); }}
          />
        )}
        {step === 'dreamJob' && (
          <StepDreamJob
            sessionId={sessionId}
            onComplete={(j, c) => { setJobLabel(j === 'Other' ? c : j); setStep('camera'); }}
          />
        )}
        {step === 'camera' && (
          <StepCamera
            sessionId={sessionId}
            jobLabel={jobLabel}
            onComplete={() => setStep('done')}
          />
        )}
        {step === 'done' && (
          <StepDone
            jobLabel={jobLabel}
            phone={phone}
            campaignName={activeCampaign?.name || ''}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
