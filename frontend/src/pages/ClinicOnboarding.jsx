import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { notify } from '../utils/notify';
import { api } from '../utils/api';
import { detectCountry, detectCountryAsync } from '../utils/detectCountry';
import { track, EVENTS } from '../analytics/track';
import { phoneHint } from '../utils/phoneHints';
import OnboardingRail from './onboarding/OnboardingRail';
import ClinicStep from './onboarding/ClinicStep';
import PracticeStep from './onboarding/PracticeStep';
import VerifyContactStep from './onboarding/VerifyContactStep';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

/**
 * Signup, in three screens.
 *
 * It was four. The first asked for a full name we already had from signup and
 * a "specialty / degree" that the onboarding endpoint reads nowhere and no
 * column exists for — a mandatory screen that stored nothing, shown to people
 * with nothing yet invested. Over 90 days, 247 owners created an account and
 * only 149 finished the wizard; the ones who arrived by Google, who had spent
 * a single click to get there, finished at 53% against 79% for those who had
 * typed out an email and a password. Deleting a screen that collects nothing
 * is the cheapest thing that could possibly help.
 *
 * The page is composition and nothing else. Each screen owns its own fields,
 * because the version of this file that held all of them inline was 562 lines
 * and every new question made it worse.
 *
 * Step 3 is verification, and it genuinely blocks: the clinic exists by then
 * (step 2 creates it, and the OTP endpoints are clinic-scoped), so there is no
 * way to hoist it earlier without a second, clinic-less OTP path. Reloading is
 * not a way past it — App.jsx sends an unverified owner straight back here.
 */

const STEPS = [
  { id: 1, title: 'Clinic' },
  { id: 2, title: 'Practice' },
  { id: 3, title: 'Verify' },
];

const LAST_FORM_STEP = 2;
const VERIFY_STEP = 3;

const STEP_NAMES = { 1: 'clinic', 2: 'practice', 3: 'verify' };

/** Only ever sent when the map filled them in. All are existing columns. */
const PLACE_FIELDS = ['city', 'state', 'postal_code', 'latitude', 'longitude', 'google_place_id'];

const ClinicOnboarding = () => {
  const navigate = useNavigate();
  const { setUser: setAuthUser, signOut } = useAuth();
  const [user, setUser] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [dir, setDir] = useState('fwd');
  const [countries, setCountries] = useState([]);
  const [formData, setFormData] = useState({
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    clinic_email: "",
    country: detectCountry(),
    number_of_chairs: 1,
    category: "General Dentistry",
    // Sent for completeness only. The server ignores it and provisions the plan
    // itself in user_service.complete_onboarding, so a client can never choose
    // its own plan by editing this payload.
    subscription_plan: "plus",
    billing_cycle: "monthly",
  });
  // Filled by the map, submitted only if present. Held apart from formData so
  // a hand-typed address never carries a stale pin from an earlier search.
  const [place, setPlace] = useState({});

  // Guards the one-time funnel events against React's double-invoked effects.
  const started = useRef(false);
  const finished = useRef(false);

  const setField = useCallback((name, value, meta) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Rewriting the address by hand invalidates whatever the map last
    // resolved — the pin, the city and the postcode all described the old
    // text. Only a genuine keystroke counts: choosing a Places result also
    // sets this field, and that must keep its pin.
    if (name === 'clinic_address' && meta?.typed) setPlace({});
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const u = JSON.parse(userData);
      setUser(u);
      setFormData((prev) => ({
        ...prev,
        clinic_email: u.clinic?.email || u.email || "",
        clinic_phone: u.clinic?.phone || prev.clinic_phone,
      }));
      // Already has a clinic, so the form half is done and they are here
      // because verification is still outstanding.
      if (u.clinic_id) setCurrentStep(VERIFY_STEP);

      if (!started.current) {
        started.current = true;
        track(EVENTS.ONBOARDING_STARTED, {
          resumed: !!u.clinic_id,
          // The 26-point completion gap between these two is the single
          // biggest thing in the funnel, so every event carries it.
          signup_method: u.supabase_user_id ? 'google' : 'email',
        });
      }
    }

    api.get('/clinics/countries').then(async (list) => {
      setCountries(list);
      const detected = await detectCountryAsync();
      setFormData((prev) =>
        list.some((c) => c.code === detected)
          ? { ...prev, country: detected }
          : list.some((c) => c.code === prev.country)
          ? prev
          : { ...prev, country: 'IN' }
      );
    }).catch(() => {});
  }, []);

  // Every screen entry, so the drop-off finally has a shape.
  useEffect(() => {
    if (!user) return;
    track(EVENTS.ONBOARDING_STEP_VIEWED, {
      step: currentStep,
      step_name: STEP_NAMES[currentStep],
    });
  }, [currentStep, user]);

  // Don't let people wander off mid-setup. Warn on tab close/refresh, and
  // intercept the browser Back button with a friendly "finish your clinic" nudge.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!finished.current) {
        track(EVENTS.ONBOARDING_ABANDONED, {
          step: currentStep,
          step_name: STEP_NAMES[currentStep],
        });
      }
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      track(EVENTS.ONBOARDING_EXIT_INTENT, {
        step: currentStep,
        step_name: STEP_NAMES[currentStep],
      });
      setShowExitModal(true);
      // Re-trap so a second Back press still shows the nudge instead of leaving.
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [currentStep]);

  const handleLeaveAnyway = async () => {
    setShowExitModal(false);
    finished.current = true;   // a deliberate exit is not an abandon
    track(EVENTS.ONBOARDING_ABANDONED, {
      step: currentStep,
      step_name: STEP_NAMES[currentStep],
      deliberate: true,
    });
    try { await signOut?.(); } catch { /* ignore */ }
    navigate('/login', { replace: true });
  };

  const isValidStep = () => {
    if (currentStep === 1) {
      const digits = formData.clinic_phone.replace(/\D/g, '');
      const dial = countries.find((c) => c.code === formData.country)?.phone_code || '';
      const hint = phoneHint(formData.clinic_phone, formData.country, dial);
      return (
        !!formData.clinic_name.trim() &&
        !!formData.clinic_address.trim() &&
        digits.length >= 4 &&
        hint?.level !== 'blocked'
      );
    }
    if (currentStep === 2) return formData.number_of_chairs >= 1 && !!formData.category;
    return true;
  };

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      const cleanPhone = formData.clinic_phone.replace(/\D/g, '');
      if (cleanPhone.length < 4) throw new Error("Enter a valid phone number.");

      const referralCode = sessionStorage.getItem('referred_by_code');
      const payload = {
        ...formData,
        number_of_chairs: parseInt(formData.number_of_chairs, 10) || 1,
        specialization: formData.category,
        referred_by_code: referralCode,
      };
      // Additive: an older backend simply ignores keys it does not read, so
      // the frontend can ship before the server does.
      for (const k of PLACE_FIELDS) {
        if (place[k] !== undefined && place[k] !== null && place[k] !== '') payload[k] = place[k];
      }

      const result = await api.post('/auth/onboarding', payload);
      if (referralCode) sessionStorage.removeItem('referred_by_code');

      localStorage.setItem('user', JSON.stringify(result.user));
      setAuthUser(result.user);

      track(EVENTS.ONBOARDING_STEP_COMPLETED, {
        step: 2,
        step_name: 'practice',
        clinic_id: result.user?.clinic_id,
        address_from_map: !!place.google_place_id,
      });

      // The clinic now exists, so verification can happen.
      setDir('fwd');
      setCurrentStep(VERIFY_STEP);
    } catch (error) {
      track(EVENTS.ONBOARDING_SUBMIT_FAILED, {
        // The message matters: a duplicate clinic name is a hard failure at
        // the very last press, and it is invisible without this.
        reason: String(error?.message || error).slice(0, 120),
      });
      notify.problem(error, "Onboarding failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = (e) => {
    e?.preventDefault();
    if (!isValidStep() || loading) return;
    if (currentStep < LAST_FORM_STEP) {
      track(EVENTS.ONBOARDING_STEP_COMPLETED, {
        step: currentStep,
        step_name: STEP_NAMES[currentStep],
        address_from_map: !!place.google_place_id,
      });
      setDir('fwd');
      setCurrentStep(currentStep + 1);
    } else {
      submitOnboarding();
    }
  };

  const handleBack = () => {
    track(EVENTS.ONBOARDING_STEP_BACK, {
      step: currentStep,
      step_name: STEP_NAMES[currentStep],
    });
    setDir('back');
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  /** Verification passed. Only now is onboarding actually over. */
  const finishOnboarding = () => {
    finished.current = true;
    // Show the one-time welcome on the dashboard, and keep the recurring
    // device-app upsell quiet for this first session so they don't stack.
    localStorage.setItem('mp_welcome_pending', '1');
    try {
      localStorage.setItem('mp_device_upsell_v1', JSON.stringify({ dismissedAt: Date.now() }));
    } catch { /* private window, not worth failing signup over */ }
    let clinicId = user?.clinic_id;
    try {
      clinicId = JSON.parse(localStorage.getItem('user') || '{}').clinic_id ?? clinicId;
    } catch { /* fall back to the stale copy */ }
    track(EVENTS.ONBOARDING_COMPLETED, { clinic_id: clinicId });
    navigate('/dashboard');
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  const stepAnim = dir === 'back' ? 'animate-ob-step-back' : 'animate-ob-step';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a276e]/5 to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <img src="/molarplus-logo.svg" alt="MolarPlus" className="h-10" />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-md md:p-8">
          <OnboardingRail steps={STEPS} current={currentStep} />

          {/* Keyed on the step so each screen genuinely remounts, which is what
              replays the entrance and resets the staggered fields. */}
          <div key={currentStep} className={stepAnim}>
            {currentStep === 1 && (
              <ClinicStep
                data={formData}
                onChange={setField}
                countries={countries}
                onAddressPlace={(details) => {
                  // A chosen result replaces the lot; dragging the pin only
                  // moves the coordinates and leaves the city and postcode
                  // that came with it alone.
                  setPlace((prev) =>
                    details.google_place_id ? details : { ...prev, ...details },
                  );
                  if (details.google_place_id) {
                    track(EVENTS.ONBOARDING_ADDRESS_PICKED, { country: formData.country });
                  }
                }}
                onAddressManual={() => track(EVENTS.ONBOARDING_ADDRESS_MANUAL)}
              />
            )}

            {currentStep === 2 && <PracticeStep data={formData} onChange={setField} />}

            {currentStep === VERIFY_STEP && (
              <VerifyContactStep
                phone={formData.clinic_phone}
                email={formData.clinic_email}
                onVerified={finishOnboarding}
              />
            )}
          </div>

          {/* Absent on the verify step: it owns its own actions, and there is
              deliberately no way past it. Back is gone there too, because the
              clinic already exists and stepping back into the form would offer
              to create it a second time. */}
          {currentStep < VERIFY_STEP && (
            <div className="mt-8 flex gap-3 border-t border-gray-100 pt-6">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={!isValidStep() || loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2a276e] py-3 font-semibold text-white transition-colors hover:bg-[#1a1548] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating your clinic…
                  </>
                ) : (
                  <>
                    {currentStep === LAST_FORM_STEP ? 'Create my clinic' : 'Continue'}
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          A product by Clino Health · Upclick Labs (OPC)
        </div>
      </div>

      {/* Exit-intent nudge */}
      {showExitModal && (
        <div className="animate-celebrate-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-celebrate-pop w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-[#2a276e] to-[#403bb1] px-8 pb-10 pt-8 text-center text-white">
              <div className="mb-3 text-5xl">🦷✨</div>
              <h2 className="text-2xl font-bold tracking-tight">Your clinic is almost ready</h2>
              <p className="mt-2 text-sm text-white/80">
                {currentStep === VERIFY_STEP
                  ? 'Just the code left. Everything you have set up is saved.'
                  : 'One more screen and you are in. Nothing is saved until you finish.'}
              </p>
            </div>
            <div className="-mt-6 flex flex-col gap-2.5 rounded-t-3xl bg-white px-6 pb-7 pt-6">
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full rounded-xl bg-[#2a276e] py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#1a1548]"
              >
                Finish setting up my clinic →
              </button>
              <button
                onClick={handleLeaveAnyway}
                className="w-full py-2.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-600"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicOnboarding;
