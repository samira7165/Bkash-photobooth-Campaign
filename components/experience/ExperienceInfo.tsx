'use client';

import { useEffect, useRef, useState } from 'react';
import TermsAndConditions from '@/components/TermsAndConditions';
import { isValidPhone, normalizePhone, PHONE_VALIDATION_MESSAGE } from '@/lib/utils';
import { checkAlreadyParticipated, requestParticipantOtp } from '@/services/api';

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

const PHONE_CHECK_DEBOUNCE_MS = 500;

export default function ExperienceInfo({ onComplete }: Props) {
  const [info, setInfo] = useState<ExperienceInfoData>({ name: '', phone: '', email: '', college: '', gender: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alreadyParticipated, setAlreadyParticipated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const checkTimer = useRef<ReturnType<typeof setTimeout>>();

  const handlePhoneChange = (phone: string) => {
    setInfo((prev) => ({ ...prev, phone }));
    setAlreadyParticipated(false);

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

    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!isValidPhone(phone)) return;
    checkTimer.current = setTimeout(async () => {
      const participated = await checkAlreadyParticipated(phone).catch(() => false);
      setAlreadyParticipated(participated);
    }, PHONE_CHECK_DEBOUNCE_MS);
  };

  const handlePhoneBlur = () => {
    if (info.phone.trim() && !isValidPhone(info.phone)) {
      setErrors((prev) => ({ ...prev, phone: PHONE_VALIDATION_MESSAGE }));
    }
  };

  useEffect(() => () => { if (checkTimer.current) clearTimeout(checkTimer.current); }, []);

  const handleSubmit = async () => {
    if (alreadyParticipated || submitting) return;

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
    setSubmitError('');
    setSubmitting(true);
    try {
      // Sends an OTP so the next step can prove this is really their number
      // before we create a Participant tied to it.
      await requestParticipantOtp(info.phone.trim());
      onComplete(info);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
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
          onChange={(e) => handlePhoneChange(e.target.value)} onBlur={handlePhoneBlur} />
        {errors.phone && <span className="field-err">{errors.phone}</span>}
        {alreadyParticipated && (
          <span className="field-err">This number has already been used to submit a picture. Check your SMS for the link to get your Future Career image.</span>
        )}
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

      {submitError && <p className="field-err" style={{ textAlign: 'center' }}>{submitError}</p>}

      <button className="kiosk-btn-primary" onClick={handleSubmit} disabled={alreadyParticipated || submitting}>
        <span>{submitting ? 'Sending code…' : 'Continue'}</span>
        <span className="btn-arrow">→</span>
      </button>

      <p className="trust-line">Your information is kept safe and secure</p>
    </div>
  );
}
