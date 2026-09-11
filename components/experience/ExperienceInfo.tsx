'use client';

import { useState } from 'react';
import TermsAndConditions from '@/components/TermsAndConditions';
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';

export interface ExperienceInfoData {
  name: string;
  phone: string;
  email: string;
  college: string;
  gender: string;
}

interface Props {
  onComplete: (info: ExperienceInfoData) => void;
}

export default function ExperienceInfo({ onComplete }: Props) {
  const [info, setInfo] = useState<ExperienceInfoData>({ name: '', phone: '', email: '', college: '', gender: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!acceptedTerms) errs.terms = 'Please agree to the Terms and Conditions to continue';
    if (!info.name.trim()) errs.name = 'Name is required';
    if (!info.phone.trim()) errs.phone = 'Phone number is required';
    else if (!isValidPhone(info.phone)) errs.phone = PHONE_VALIDATION_MESSAGE;
    if (!info.gender) errs.gender = 'Please select your gender';
    if (info.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email))
      errs.email = 'Invalid email';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    onComplete(info);
  };

  return (
    <div className="kiosk-card fade-in">
      <div className="step-indicator">
        <span className="step-dot active" />
        <span className="step-dot" />
        <span className="step-dot" />
        <span className="step-dot" />
      </div>
      <p className="step-label">STEP 1 OF 4</p>

      <h2 className="kiosk-title">Tell us about yourself</h2>
      <p className="kiosk-sub">A few details before you get started</p>

      <div className="kiosk-field">
        <label>Full Name <span className="req">*</span></label>
        <input type="text" placeholder="Your full name" value={info.name}
          onChange={(e) => setInfo({ ...info, name: e.target.value })} />
        {errors.name && <span className="field-err">{errors.name}</span>}
      </div>

      <div className="kiosk-field">
        <label>Mobile Number <span className="req">*</span></label>
        <input type="tel" placeholder="+880 1XX XXXX XXX" value={info.phone}
          onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
        {errors.phone && <span className="field-err">{errors.phone}</span>}
      </div>

      <div className="kiosk-field">
        <label>Email <span className="opt">(optional)</span></label>
        <input type="email" placeholder="you@example.com" value={info.email}
          onChange={(e) => setInfo({ ...info, email: e.target.value })} />
        {errors.email && <span className="field-err">{errors.email}</span>}
      </div>

      <div className="kiosk-field">
        <label>Which college do you want to get admitted to? <span className="opt">(optional)</span></label>
        <input type="text" placeholder="Your dream college" value={info.college}
          onChange={(e) => setInfo({ ...info, college: e.target.value })} />
      </div>

      <div className="kiosk-field">
        <label>Gender <span className="req">*</span></label>
        <div className="gender-row">
          {(['male', 'female'] as const).map((g) => (
            <button key={g} className={`gender-btn ${info.gender === g ? 'active' : ''}`}
              onClick={() => setInfo({ ...info, gender: g })}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {errors.gender && <span className="field-err">{errors.gender}</span>}
      </div>

      <TermsAndConditions accepted={acceptedTerms} onChange={setAcceptedTerms} error={errors.terms} />

      <button className="kiosk-btn-primary" onClick={handleSubmit}>
        <span>Continue</span>
        <span className="btn-arrow">→</span>
      </button>

      <p className="trust-line">Your information is kept safe and secure</p>
    </div>
  );
}
