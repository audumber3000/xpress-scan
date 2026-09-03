import React from 'react';
import { Check } from 'lucide-react';

/**
 * Where you are in signup, and how much is left.
 *
 * Three dots, not a percentage. The honest thing a new owner wants to know is
 * "how many more of these", and a number answers it in one glance where a bar
 * only implies it.
 *
 * The connecting line animates as each step is banked. That is the whole
 * reward loop of a wizard: the line filling is the only moment the screen says
 * "that is done, it is behind you now".
 *
 * Props:
 *   steps    [{ id, title }]
 *   current  id of the active step
 */
const OnboardingRail = ({ steps, current }) => (
  <nav aria-label="Progress" className="mb-7">
    <ol className="flex items-center">
      {steps.map((step, idx) => {
        const isActive = current === step.id;
        const isDone = current > step.id;
        const lineFilled = current > step.id;

        return (
          <React.Fragment key={step.id}>
            <li className="flex shrink-0 flex-col items-center">
              <div
                aria-current={isActive ? 'step' : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-[#2a276e] text-white ring-4 ring-[#2a276e]/12'
                    : isDone
                    ? 'bg-[#2a276e] text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? (
                  <Check key="done" className="h-4 w-4 animate-ob-done" strokeWidth={3} />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium transition-colors duration-300 ${
                  isActive ? 'text-[#2a276e]' : isDone ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {step.title}
              </span>
            </li>

            {idx < steps.length - 1 && (
              <li aria-hidden="true" className="-mt-5 mx-2 h-0.5 flex-1 overflow-hidden bg-gray-200">
                {/* Keyed on its own filled state so React remounts it, which is
                    what replays the fill rather than snapping straight to full. */}
                <div
                  key={lineFilled ? 'on' : 'off'}
                  className={`h-full bg-[#2a276e] ${lineFilled ? 'animate-ob-rail' : ''}`}
                  style={{ transform: lineFilled ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </li>
            )}
          </React.Fragment>
        );
      })}
    </ol>
  </nav>
);

export default OnboardingRail;
