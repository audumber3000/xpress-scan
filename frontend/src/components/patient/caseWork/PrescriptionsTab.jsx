import React from 'react';
import EmptyState from '../../common/EmptyState';
import { noData } from '../../../assets/illustrations';

/** Every medicine written this visit, flattened out of its prescription. */
const PrescriptionsTab = ({ prescriptions = [] }) => {
  const rows = prescriptions.flatMap((rx) =>
    (rx.items || [])
      .filter((i) => (i?.medicine_name || '').trim())
      .map((item, idx) => ({ ...item, key: `${rx.id}-${idx}` }))
  );

  if (!rows.length) {
    return (
      <EmptyState
        image={noData}
        size="sm"
        title="Nothing prescribed this visit"
        subtitle="Medicines written on this case paper appear here."
      />
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-[#f8fafc] border-b border-gray-200">
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Medicine</th>
            <th className="px-4 py-3">Dosage</th>
            <th className="px-4 py-3">Frequency</th>
            <th className="px-4 py-3">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((item) => (
            <tr key={item.key} className="transition-colors duration-150 hover:bg-gray-50/70">
              <td className="px-4 py-3 font-semibold text-gray-900">{item.medicine_name}</td>
              <td className="px-4 py-3 text-gray-500">{item.dosage || <span className="text-gray-300">—</span>}</td>
              <td className="px-4 py-3 text-gray-500">{item.frequency || <span className="text-gray-300">—</span>}</td>
              <td className="px-4 py-3 text-gray-500">{item.duration || <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PrescriptionsTab;
