import React from 'react';

const WIDGETS = [
  { key: 'patientStats', icon: 'fi fi-sr-chart-histogram', color: 'text-[#9B8CFF]', title: 'New vs Returning', desc: 'Patient growth & retention' },
  { key: 'demographics', icon: 'fi fi-sr-chart-pie', color: 'text-purple-600', title: 'Patients by Age', desc: 'Age-band distribution' },
  { key: 'revenue', icon: 'fi fi-sr-chart-line-up', color: 'text-[#2a276e]', title: 'Billed vs Collected', desc: 'Revenue & collection gap' },
  { key: 'appointments', icon: 'fi fi-sr-calendar-check', color: 'text-orange-600', title: 'Appointment Outcomes', desc: 'Completed vs missed' },
];

const Toggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#9B8CFF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a276e]"></div>
  </label>
);

const CustomizeDrawer = ({ open, widgets, onToggle, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose}></div>
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Customize Dashboard</h3>
            <p className="text-sm text-gray-600 mt-1">Choose which widgets to display</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {WIDGETS.map((w) => (
            <div key={w.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <div className="flex items-center gap-3">
                <i className={`${w.icon} text-xl ${w.color}`}></i>
                <div>
                  <div className="font-semibold text-gray-900">{w.title}</div>
                  <div className="text-xs text-gray-600">{w.desc}</div>
                </div>
              </div>
              <Toggle checked={!!widgets[w.key]} onChange={() => onToggle(w.key)} />
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-gray-200">
          <button onClick={onClose} className="w-full px-6 py-3 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizeDrawer;
