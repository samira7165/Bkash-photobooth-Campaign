'use client';

import { useState } from 'react';
import TermsAndConditions from '@/components/TermsAndConditions';
import { isValidPhone, normalizePhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { createSession } from '@/services/api';

interface Props {
  onComplete: (sessionId: string, userInfo: { name: string; phone: string; email: string; college: string; gender: string }) => void;
}

export default function StepInfo({ onComplete }: Props) {
  const [info, setInfo] = useState({ name: '', phone: '', email: '', college: '', gender: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (phone: string) => {
    setInfo({ ...info, phone });

    // Too many digits is unambiguous the moment it happens — flag it
    // immediately instead of waiting for blur/submit. Too few is only
    // checked on blur (below), since the user is still mid-typing here.
    const digitCount = normalizePhone(phone).replace(/\D/g, '').length;
    setErrors((prev) => {
      if (digitCount > 11) return { ...prev, phone: PHONE_VALIDATION_MESSAGE };
      if (prev.phone === PHONE_VALIDATION_MESSAGE) {
        const { phone: _drop, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  };

  const handlePhoneBlur = () => {
    if (info.phone.trim() && !isValidPhone(info.phone)) {
      setErrors((prev) => ({ ...prev, phone: PHONE_VALIDATION_MESSAGE }));
    }
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!acceptedTerms) errs.terms = 'Please agree to the Terms and Conditions to continue';
    if (!info.name.trim()) errs.name = 'Name is required';
    if (!info.phone.trim()) errs.phone = 'Phone number is required';
    else if (!isValidPhone(info.phone)) errs.phone = PHONE_VALIDATION_MESSAGE;
    if (!info.gender) errs.gender = 'Please select your gender';
    if (info.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email))
      errs.email = 'Invalid email';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const session = await createSession({
        name: info.name.trim(),
        phone: info.phone.trim(),
        email: info.email.trim() || undefined,
        college: info.college.trim() || undefined,
        gender: info.gender,
      });
      setErrors({});
      onComplete(session.id, info);
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
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

      <h2 className="kiosk-title">
  Your <span className="title-accent">dream career</span> starts here
</h2>
      <p className="kiosk-sub">Tell us a bit about yourself</p>

      <div className="kiosk-field">
        <label>Name <span className="req">*</span></label>
        <input type="text" placeholder="Your full name" value={info.name}
          onChange={(e) => setInfo({ ...info, name: e.target.value })} />
        {errors.name && <span className="field-err">{errors.name}</span>}
      </div>

      <div className="kiosk-field">
        <label>Phone Number <span className="req">*</span></label>
        <input type="tel" placeholder="+880 1XX XXXX XXX" value={info.phone}
          onChange={(e) => handlePhoneChange(e.target.value)} onBlur={handlePhoneBlur} />
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

      {errors.submit && <p className="field-err" style={{ textAlign: 'center' }}>{errors.submit}</p>}

      <TermsAndConditions accepted={acceptedTerms} onChange={setAcceptedTerms} error={errors.terms} />

      <button className="kiosk-btn-primary" onClick={handleSubmit} disabled={loading}>
        <span>{loading ? 'Saving…' : 'Continue'}</span>
        <span className="btn-arrow">→</span>
      </button>

      <p className="trust-line">Your information is kept safe and secure</p>
    </div>
  );
}
