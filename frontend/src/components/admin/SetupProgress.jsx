import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ChevronRight } from 'lucide-react';

/**
 * How far through setting up the clinic is, as a ring in the Control Center
 * header. Clicking it opens the checklist behind the number.
 *
 * The ring alone would only be a scold — it tells you something is missing
 * without saying what or where. Every unfinished row is a link to the screen
 * that finishes it, and finished rows stay visible so the number is auditable
 * rather than something you have to take on faith.
 *
 * Hidden entirely at 100%: a permanent green tick is furniture, and this sits
 * in a header that every Control Center page renders.
 */

const SIZE = 40;
const STROKE = 3.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ringColor = (percent) => {
  if (percent >= 100) return '#15803D';
  if (percent >= 60) return '#29828a';
  return '#B45309';
};

const SetupProgress = ({ status, onRefresh }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!status || !status.total) return null;

  const { completed, total, percent, items = [] } = status;
  if (percent >= 100) return null;

  const colour = ringColor(percent);
  const remaining = items.filter((i) => !i.done);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Clinic setup ${percent}% complete — ${total - completed} left`}
        aria-label={`Clinic setup ${percent} percent complete. Open checklist.`}
        className="relative shrink-0 rounded-full hover:bg-gray-50 transition-colors"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="#E5E7EB" strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke={colour} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            style={{ transition: 'stroke-dashoffset 500ms ease' }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ color: colour }}
        >
          {percent}%
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md max-h-full flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Clinic setup</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {completed} of {total} done
                  {remaining.length > 0 && ` · ${remaining.length} left`}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percent}%`, background: colour, transition: 'width 500ms ease' }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* Unfinished first — that's what the modal was opened to find. */}
              {[...items].sort((a, b) => Number(a.done) - Number(b.done)).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.path)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    item.done ? 'hover:bg-gray-50' : 'hover:bg-indigo-50/40'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      item.done
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'border-2 border-dashed border-amber-300'
                    }`}
                  >
                    {item.done && <Check size={12} strokeWidth={3} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${item.done ? 'text-gray-400 line-through' : 'font-semibold text-gray-900'}`}>
                      {item.label}
                    </span>
                    {!item.done && (
                      <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{item.hint}</span>
                    )}
                  </span>

                  {!item.done && <ChevronRight size={16} className="text-gray-300 mt-0.5 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={onRefresh}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Re-check
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#29828a] hover:bg-[#216b71] rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SetupProgress;
