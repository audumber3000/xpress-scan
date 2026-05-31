import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CalendarPlus, ReceiptText } from 'lucide-react';

const ACTIONS = [
  { label: 'Add Patient', icon: UserPlus, to: '/patient-intake' },
  { label: 'New Appointment', icon: CalendarPlus, to: '/calendar' },
  { label: 'Create Invoice', icon: ReceiptText, to: '/payments' },
];

const QuickActions = () => {
  const navigate = useNavigate();
  return (
    <div className="flex gap-2 md:gap-3 mb-6 overflow-x-auto -mx-1 px-1 pb-1 [&::-webkit-scrollbar]:hidden">
      {ACTIONS.map(({ label, icon: Icon, to }) => (
        <button
          key={label}
          onClick={() => navigate(to)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:border-[#2a276e]/40 hover:text-[#2a276e] hover:shadow-md transition-all flex-shrink-0 whitespace-nowrap"
        >
          <Icon size={16} className="text-[#2a276e]" />
          {label}
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
