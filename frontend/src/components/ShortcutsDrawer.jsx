import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { canAccess } from "../utils/permissions";
import { SHORTCUT_GROUPS, keyLabel } from "../utils/shortcuts";

/** A single keycap chip, e.g. Alt or K. */
const Key = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600 shadow-sm">
    {children}
  </kbd>
);

/**
 * ShortcutsDrawer — right-hand panel listing every keyboard shortcut, grouped.
 *
 * Rows are filtered by the same RBAC gate as the sidebar, so a receptionist
 * without finance access never sees a Payments shortcut they can't use.
 */
const ShortcutsDrawer = ({ open, onClose }) => {
  const { user } = useAuth();

  // Esc closes — matches the "Close panels" row this drawer documents.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const groups = SHORTCUT_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccess(user, item)) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-white shadow-2xl z-[70] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-bold text-gray-900">Keyboard Shortcuts</h3>
            <p className="text-sm text-gray-500 mt-0.5">Press F9 anytime to open this</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            aria-label="Close shortcuts"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {groups.map((group) => (
            <div key={group.title} className="mb-6 last:mb-0">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
                {group.title}
              </h4>
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm text-gray-700">{item.label}</span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && <span className="text-xs text-gray-400">+</span>}
                          <Key>{keyLabel(k)}</Key>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Shortcuts pause while you're typing in a field
          </p>
        </div>
      </div>
    </>
  );
};

export default ShortcutsDrawer;
