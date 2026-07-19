import React from "react";
import { X } from "lucide-react";

/*
 * FormDrawer — the shared right-side panel used for every create/edit in the
 * inventory & vendors section (general stock, medications, vendors), so the UX
 * matches the rest of the app's drawers (e.g. the invoice editor).
 */
const FormDrawer = ({ open, onClose, title, subtitle, onSubmit, submitting, submitLabel = "Save", children, accentClass = "bg-[#2a276e] hover:bg-[#1a1548]" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={submitting ? undefined : onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} disabled={submitting} className="p-2 hover:bg-gray-100 rounded-full transition disabled:opacity-40">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">{children}</div>
          <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={`px-6 py-2 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${accentClass}`}>
              {submitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const inputCls = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2a276e] focus:bg-white focus:ring-2 focus:ring-[#2a276e]/20 transition-colors";

// Labelled field wrapper for consistent spacing/typography across drawers.
export const Field = ({ label, children, hint, className = "" }) => (
  <div className={className}>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

export const TextInput = (props) => <input {...props} className={inputCls} />;
export const SelectInput = ({ children, ...props }) => <select {...props} className={inputCls}>{children}</select>;

export default FormDrawer;
