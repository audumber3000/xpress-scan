import React, { useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import WorkingHoursTab from './WorkingHoursTab';

/**
 * Working hours in its own drawer.
 *
 * Deliberately not routed through UserDetailsPanel. That component is called
 * with `user` / `activeTab` while its own signature reads `selectedUser` /
 * `userPanelTab`, so `if (!selectedUser) return null` fires every time and it
 * has never actually rendered: the Edit pencil opens nothing either. Fixing it
 * properly means reconciling roughly twenty-five props it also expects and
 * never receives, which is a job of its own. Hours does not need any of that,
 * so it gets a small correct drawer instead of waiting on a broken one.
 */
const WorkingHoursDrawer = ({ open, staff, onClose }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !staff) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      {/* Bottom sheet on a phone, side drawer from sm up, matching every other
          drawer in the app. */}
      <div className="absolute inset-x-0 bottom-0 top-14 rounded-t-2xl sm:rounded-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 w-full sm:max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[#29828a]/10 text-[#29828a] grid place-items-center flex-shrink-0">
              <Clock size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-tight truncate">
                {staff.name || staff.email}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Working hours and time off</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <WorkingHoursTab doctorId={staff.id} doctorName={staff.name} />
        </div>
      </div>
    </div>
  );
};

export default WorkingHoursDrawer;
