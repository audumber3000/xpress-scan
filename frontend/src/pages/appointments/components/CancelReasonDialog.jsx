import React from "react";

/**
 * Cancelling asks why.
 *
 * A cancellation with no reason is a number; one with a reason is something a
 * clinic can act on. Replaces the native confirm() plus prompt() pair, which
 * could not be styled and could not be dismissed with the mouse.
 */
const CancelReasonDialog = ({ prompt, onChange, onConfirm, onClose, busy }) => {
  if (!prompt) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
        <h3 className="text-base font-bold text-gray-900">Cancel this appointment</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-3">A short reason helps you spot a pattern later.</p>
        <input
          autoFocus
          value={prompt.reason}
          onChange={(e) => onChange(c => ({ ...c, reason: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm(prompt.id, 'cancelled', prompt.reason)}
          placeholder="Patient rang to rearrange"
          className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2a276e] outline-none"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => onClose()}
                  className="px-4 h-9 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600">
            Keep it
          </button>
          <button
            onClick={() => onConfirm(prompt.id, 'cancelled', prompt.reason)}
            disabled={busy}
            className="px-4 h-9 rounded-lg bg-[#2a276e] text-white text-sm font-bold disabled:opacity-50"
          >
            Cancel appointment
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelReasonDialog;
