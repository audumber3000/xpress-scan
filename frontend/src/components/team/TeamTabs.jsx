import React from 'react';
import { Users, CalendarCheck, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * The shared header for the team screens — Staff, Attendance and Location.
 *
 * Permissions used to be a fourth tab. It is now edited on the staff member
 * themselves (Staff → open somebody → Permissions), which is where the question
 * is actually asked, so a whole screen for it was a second answer to the same
 * thing. Its route stays live for existing links. They are one section viewed several ways, so the title, the tab bar
 * and the page chrome belong in one place rather than being re-typed (and
 * quietly drifting apart) in each file.
 *
 * Laid out like the Notifications section: a plain title and one-line
 * description, a tab strip underneath, and the content sitting directly on the
 * page background. No wrapper card — the table is the content, and boxing it
 * inside a second card just adds a frame around a frame.
 *
 * Props:
 *   active    'staff' | 'attendance' | 'location'
 *   action    optional node rendered at the top right (e.g. a Refresh button)
 *   children  the page body
 */

const TABS = [
  { id: 'staff',       label: 'Staff',       icon: Users,         path: '/admin/staff' },
  { id: 'attendance',  label: 'Attendance',  icon: CalendarCheck, path: '/admin/attendance' },
  { id: 'location',    label: 'Location',    icon: MapPin,        path: '/admin/clinic-location' },
];

const SUBTITLE = {
  staff:       'Everyone who can sign in to this clinic, and what they can reach.',
  attendance:  'Who was in, and when, across the week.',
  location:    'Where the clinic is, and how close staff must be to clock in.',
};

const TeamTabs = ({ active, action, children }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team</h2>
            <p className="text-sm text-gray-500 mt-0.5">{SUBTITLE[active]}</p>
          </div>
          {action}
        </div>

        <div className="border-b border-gray-200">
          <div className="flex gap-1 -mb-px">
            {TABS.map(({ id, label, icon: Icon, path }) => (
              <button
                key={id}
                onClick={() => active !== id && navigate(path)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
                  active === id
                    ? 'border-[#29828a] text-[#29828a] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
};

export default TeamTabs;
