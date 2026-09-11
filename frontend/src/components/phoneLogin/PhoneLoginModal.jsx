import React from 'react';
import { X } from 'lucide-react';
import PhoneLoginQR from './PhoneLoginQR';

/** "Log in to mobile app" from the header menu: your own QR, in a modal. */
const PhoneLoginModal = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-login-title"
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div>
            <h2 id="phone-login-title" className="text-base font-bold text-gray-900 leading-tight">Log in to the mobile app</h2>
            <p className="text-xs text-gray-500 mt-0.5">Scan this with the MolarPlus app to sign in on your phone</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          {/* Mounted only while open, so the code and its polling stop the
              moment the modal closes. */}
          <PhoneLoginQR />
        </div>
      </div>
    </div>
  );
};

export default PhoneLoginModal;
