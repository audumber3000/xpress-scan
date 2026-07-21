import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmDialog — a small, designed confirmation popup matching the case-paper
 * style (dimmed backdrop, white rounded card, #2a276e accent). Supports one or
 * more stacked action buttons so a single prompt can offer several choices
 * (e.g. "Add to bill" / "Just record" / "Cancel").
 *
 * Props:
 *   open      — whether to render
 *   onClose   — called on backdrop click / Cancel
 *   title     — bold heading
 *   message   — supporting line(s); string or node
 *   tone      — 'default' | 'danger' (icon + accent)
 *   actions   — [{ label, onClick, variant, disabled }]
 *               variant: 'primary' (filled) | 'danger' (filled red) | 'secondary' (outline)
 *   cancelLabel — text for the trailing cancel button (default "Cancel"); pass null to hide
 */
const VARIANTS = {
  primary: 'bg-[#2a276e] text-white hover:bg-[#1a1548] border border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
};

const ConfirmDialog = ({
  open,
  onClose,
  title,
  message,
  tone = 'default',
  actions = [],
  cancelLabel = 'Cancel',
}) => {
  if (!open) return null;

  const iconWrap = tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-[#2a276e]/10 text-[#2a276e]';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconWrap}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              {message && <div className="mt-1 text-sm text-gray-500 leading-relaxed">{message}</div>}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                disabled={a.disabled}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${VARIANTS[a.variant] || VARIANTS.primary}`}
              >
                {a.label}
              </button>
            ))}
            {cancelLabel && (
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
