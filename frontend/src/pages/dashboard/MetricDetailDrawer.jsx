import React from 'react';
import GearLoader from '../../components/GearLoader';
import { CalendarCheckIcon } from './icons';

const PatientRow = ({ item }) => (
  <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
    <h4 className="font-semibold text-gray-900">{item.name || `Patient #${item.id}`}</h4>
    <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
      {item.age && <div><span className="font-medium">Age:</span> {item.age}</div>}
      {item.gender && <div><span className="font-medium">Gender:</span> {item.gender}</div>}
      {item.phone && <div><span className="font-medium">Phone:</span> {item.phone}</div>}
      {item.village && <div><span className="font-medium">Location:</span> {item.village}</div>}
      {item.treatment_type && <div className="col-span-2"><span className="font-medium">Treatment:</span> {item.treatment_type}</div>}
    </div>
    {item.created_at && (
      <div className="text-xs text-gray-500 mt-2">
        Added: {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>
    )}
  </div>
);

const AppointmentRow = ({ item }) => (
  <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
    <div className="flex items-center gap-2">
      <div className="p-2 bg-[#9B8CFF]/10 rounded-lg text-[#2a276e]"><CalendarCheckIcon /></div>
      <div>
        <h4 className="font-semibold text-gray-900">{item.name}</h4>
        {item.time && <p className="text-xs text-gray-500">{item.time}</p>}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-gray-600">
      {item.age && <div><span className="font-medium">Age:</span> {item.age}</div>}
      {item.gender && <div><span className="font-medium">Gender:</span> {item.gender}</div>}
      {item.phone && <div><span className="font-medium">Phone:</span> {item.phone}</div>}
      {item.treatment_type && <div><span className="font-medium">Treatment:</span> {item.treatment_type}</div>}
    </div>
  </div>
);

const MetricDetailDrawer = ({ metric, data, loading, onClose }) => {
  if (!metric) return null;
  const isPatients = metric.title === 'Total Patients';
  const isAppointments = metric.title === 'Appointments' || metric.title === 'Checking';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose}></div>
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">{metric.title} Details</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64"><GearLoader size="w-12 h-12" /></div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <p className="text-lg font-medium">No data available</p>
              <p className="text-sm mt-1">Start adding {metric.title.toLowerCase()} to see them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((item, idx) =>
                isPatients ? <PatientRow key={item.id || idx} item={item} />
                : isAppointments ? <AppointmentRow key={item.id || idx} item={item} />
                : null
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between items-center">
          <span className="text-sm text-gray-600">{data.length} {data.length === 1 ? 'item' : 'items'}</span>
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};

export default MetricDetailDrawer;
