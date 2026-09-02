import React from 'react';
import { ChevronRight } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import Spinner from '../../common/Spinner';

/**
 * Nudge the patient about what is still owed.
 *
 * A card rather than a button because it carries a second line saying what
 * pressing it does — this opens WhatsApp with the invoice attached, which is
 * not obvious from the words "send reminder" alone.
 */
const SendReminderCard = ({ onSend, sending, disabled }) => (
  <button
    type="button"
    onClick={onSend}
    disabled={sending || disabled}
    className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-left hover:border-[#2a276e]/40 hover:bg-indigo-50/30 transition-colors disabled:opacity-50"
  >
    <span className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
      <WhatsAppIcon size={16} brand />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-semibold text-gray-900">Send payment reminder</span>
      <span className="block text-[11px] text-gray-500 mt-0.5">Share the bill and balance on WhatsApp</span>
    </span>
    {sending ? <Spinner className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
  </button>
);

export default SendReminderCard;
