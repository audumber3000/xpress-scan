import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, KeyRound, Loader2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * The master password prompt.
 *
 * Stands in front of the deletes nothing can undo: a patient and everything
 * attached to them, a paid bill, a payment already receipted. Six digits set by
 * the owner in Control Center, asked for every single time, never remembered.
 *
 * The code is exchanged here for a short-lived token, which the caller then
 * sends with the delete itself. That split is the reason this component exists:
 * a wrong code is answered before anything is destroyed, so "that password is
 * not right" and "the delete failed" can never be the same red toast.
 *
 * Props:
 *   open        — whether to render
 *   title       — what is about to happen, e.g. "Delete this patient?"
 *   message     — the consequence, in plain words; string or node
 *   confirmLabel— action button text (default "Confirm and delete")
 *   onCancel    — backdrop / Cancel / Escape
 *   onConfirm   — async (token) => {}. Thrown errors surface as the modal's own
 *                 error line, so the prompt stays open and the user can retry.
 */
const CODE_LENGTH = 6;

const MasterPasswordModal = ({
  open,
  title = 'Enter the master password',
  message,
  confirmLabel = 'Confirm and delete',
  onCancel,
  onConfirm,
}) => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const isOwner = user?.role === 'clinic_owner';

  // Fresh every time it opens. A code left in state from the last delete would
  // be a prompt that does not actually ask.
  useEffect(() => {
    if (!open) return;
    setCode('');
    setError('');
    setBusy(false);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const submit = async () => {
    if (code.length < CODE_LENGTH || busy) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await api.post('/security/master-password/verify', { password: code });
      await onConfirm?.(token);
    } catch (e) {
      // `detail` is a string for our own 4xx and an array for FastAPI's schema
      // errors; only the former is worth showing raw.
      const detail = typeof e?.detail === 'string' ? e.detail : null;
      setError(detail || e?.message || 'Could not confirm the master password');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => !busy && onCancel?.()}
    >
      {/* A modal keeps its lift: it sits over a dimmed page and has to read as
          detached. The border-only rule is about cards in the flow. */}
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <KeyRound size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 leading-tight">{title}</h3>
              {message && <div className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</div>}
            </div>
          </div>
          <button
            onClick={() => !busy && onCancel?.()}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
            Master password
          </label>
          <input
            ref={inputRef}
            type="password"
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="••••••"
            inputMode="numeric"
            autoComplete="off"
            className={`w-full text-center tracking-[0.5em] text-2xl font-bold px-3 py-2.5 bg-gray-50 border rounded-lg outline-none transition-colors ${
              error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#29828a]'
            }`}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {/* Owners get a way out of the dead end: forgetting the code is
              exactly when you need the page that changes it, and hunting for it
              through the menu with this dialog open is the wrong errand. Staff
              get no link, because that page is owner-only and sending them to a
              403 would be worse than telling them who to ask. */}
          {isOwner ? (
            <p className="text-xs text-gray-400">
              The six digits set in Control Center.{' '}
              <Link
                to="/admin/security/verification"
                onClick={() => onCancel?.()}
                className="inline-flex items-center gap-0.5 font-semibold text-[#29828a] hover:text-[#216b71] hover:underline"
              >
                Change it in Verification
                <ArrowUpRight size={12} />
              </Link>
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              If you do not know the master password, ask your clinic owner for it.
            </p>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={() => onCancel?.()}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || code.length < CODE_LENGTH}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterPasswordModal;
