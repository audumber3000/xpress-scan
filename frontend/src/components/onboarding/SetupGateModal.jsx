import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Check, Loader2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../utils/api';

import ClinicDetailsStep from './steps/ClinicDetailsStep';
import SecurityStep from './steps/SecurityStep';
import TreatmentsStep from './steps/TreatmentsStep';

/**
 * The three things a clinic must set before the app is any use, asked once.
 *
 * Replaces WelcomeChecklistModal, which listed the same ideas but only linked
 * out to them: a brand-new owner had to leave the modal, find the screen, come
 * back, and remember what was next. This does the work in place.
 *
 * Order matters and is not alphabetical. Clinic details print on every invoice,
 * so they come first. The master password gates deletes, so it comes before
 * anybody has data worth deleting. Treatment prices are last because they are
 * the longest job and the easiest to postpone without breaking anything.
 *
 * Nothing here is compulsory. Every step can be skipped and the whole thing can
 * be dismissed, because a modal that will not let go on day one is how people
 * decide the software is going to be hard work. Whatever is skipped stays in
 * the Control Center progress ring, which is the permanent home for this list.
 */

const STEPS = [
  { id: 'clinic', title: 'Clinic details', keys: ['contact', 'hours'], Component: ClinicDetailsStep },
  { id: 'security', title: 'Security', keys: ['master_password'], Component: SecurityStep },
  { id: 'treatments', title: 'Treatments', keys: ['treatments'], Component: TreatmentsStep },
];

const STORAGE_KEY = 'mp_setup_gate_v1';

/** Kept from the welcome modal this replaced. Finishing setup deserves a moment. */
const celebrate = () => {
  confetti({
    particleCount: 110, spread: 80, startVelocity: 42, origin: { y: 0.4 },
    colors: ['#2a276e', '#9B8CFF', '#29828a', '#F59E0B', '#22c55e'],
    zIndex: 100000,
  });
};

const SetupGateModal = ({ open, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState([]);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api.get('/clinics/me/setup-status'));
    } catch {
      setStatus(null);   // the modal is a convenience; never block on it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) loadStatus(); }, [open, loadStatus]);

  const isDone = useCallback(
    (step) => {
      if (!status?.items) return false;
      return step.keys.every((k) => status.items.find((i) => i.key === k)?.done);
    },
    [status]
  );

  // Anything already configured is not worth asking about. Someone who filled
  // their clinic details during onboarding should land straight on step two.
  const remaining = useMemo(
    () => STEPS.filter((s) => !isDone(s) && !skipped.includes(s.id)),
    [isDone, skipped]
  );

  const dismiss = (permanent) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        [permanent ? 'completedAt' : 'dismissedAt']: Date.now(),
      }));
    } catch { /* private window */ }
    onClose?.();
  };

  useEffect(() => {
    // Everything done (or skipped) — nothing left to ask.
    if (!loading && open && remaining.length === 0) dismiss(true);
  }, [loading, open, remaining.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || loading || !status) return null;
  if (remaining.length === 0) return null;

  const step = remaining[Math.min(index, remaining.length - 1)];
  const StepBody = step.Component;
  const position = STEPS.findIndex((s) => s.id === step.id);

  const advance = async () => {
    // Was this the last thing left to do? Read it before reloading, because
    // `remaining` is about to shrink by one either way.
    const wasLast = remaining.length <= 1;
    await loadStatus();
    if (wasLast) {
      celebrate();
      dismiss(true);
    } else {
      setIndex(0);   // `remaining` recomputes; always take the first one left
    }
  };

  const skipStep = () => {
    setSkipped((s) => [...s, step.id]);
    setIndex(0);
  };

  return (
    <div
      className="fixed inset-0 z-[900] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Finish setting up your clinic"
    >
      {/* Full-height sheet on a phone, centred card from sm up. A centred card
          on a 360px screen puts the footer actions below the fold. */}
      <div className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:shadow-2xl">

        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Let us get your clinic ready</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Three quick things. You can skip any of them and come back later.
            </p>
          </div>
          <button
            onClick={() => dismiss(false)}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress. Shows all three always, so skipping one does not make the
            list shorter and hide what is left undone. */}
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-5 py-3">
          {STEPS.map((s, i) => {
            const done = isDone(s);
            const active = s.id === step.id;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? 'bg-emerald-100 text-emerald-600'
                        : active ? 'bg-[#2a276e] text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {done ? <Check size={11} /> : i + 1}
                  </span>
                  <span className={`hidden text-[11px] font-medium sm:inline ${active ? 'text-[#2a276e]' : 'text-gray-400'}`}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <StepBody
            key={step.id}
            onDone={advance}
            renderFooter={({ onSave, saving, disabled, saveLabel = 'Save and continue' }) => (
              <div className="mt-6 space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={skipStep}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 min-h-[2.75rem] text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Skip
                  </button>
                  <button
                    onClick={onSave}
                    disabled={saving || disabled}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2a276e] px-4 py-2.5 min-h-[2.75rem] text-sm font-semibold text-white transition-colors hover:bg-[#1a1548] disabled:opacity-50"
                  >
                    {saving
                      ? <><Loader2 size={14} className="animate-spin" /> Saving</>
                      : <>{saveLabel} <ArrowRight size={14} /></>}
                  </button>
                </div>
                <button
                  onClick={() => dismiss(false)}
                  className="w-full text-center text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
                >
                  I will do all of this later
                </button>
                <p className="text-center text-[11px] leading-relaxed text-gray-300">
                  Anything you skip stays in Control Center, under the setup ring.
                </p>
              </div>
            )}
          />
        </div>

        <p className="border-t border-gray-100 px-5 py-2.5 text-center text-[11px] text-gray-400 sm:hidden">
          Step {position + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
};

export default SetupGateModal;
