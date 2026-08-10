import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CalendarPlus, ReceiptText } from 'lucide-react';

/**
 * The three things people come to the dashboard to start.
 *
 * Each one lands on its section *with the panel already open* rather than
 * dropping you on the list to hunt for the button. `?new=1` is the convention
 * both target pages already use for this (Calendar.jsx and Payments.jsx each
 * strip the param once applied, so a refresh doesn't reopen the panel) — worth
 * reusing rather than adding a second router-state mechanism alongside it.
 *
 * Add patient goes to the intake screen, which is a full page rather than a
 * drawer, so it needs no param.
 */
const ACTIONS = [
  { label: 'Add patient', icon: UserPlus, to: '/patient-intake' },
  { label: 'New appointment', icon: CalendarPlus, to: '/calendar?new=1' },
  { label: 'Create invoice', icon: ReceiptText, to: '/payments?new=1' },
];

const QuickActions = () => {
  const navigate = useNavigate();
  return (
    <div className="flex gap-2 mb-4 md:mb-5 overflow-x-auto -mx-1 px-1 pb-1 [&::-webkit-scrollbar]:hidden">
      {ACTIONS.map(({ label, icon: Icon, to }) => (
        <button
          key={label}
          onClick={() => navigate(to)}
          className="flex items-center gap-2 px-3.5 py-2.5 min-h-[2.75rem] bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:border-[#2a276e]/40 hover:text-[#2a276e] transition-colors flex-shrink-0 whitespace-nowrap"
        >
          <Icon size={16} className="text-[#2a276e]" />
          {label}
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
