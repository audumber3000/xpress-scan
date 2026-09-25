import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import EmptyState from '../../common/EmptyState';
import { noData } from '../../../assets/illustrations';
import { formatDate } from '../../../utils/datetime';

/**
 * This visit's prescriptions, each with its medicines under it.
 *
 * Grouped rather than flattened so a prescription can be edited or deleted as
 * a whole, and a single medicine removed from its own prescription. Deleting
 * the last medicine is left to the parent, which asks whether to delete the
 * whole prescription instead of leaving an empty one behind.
 */
const hasName = (i) => (i?.medicine_name || '').trim();

const IconButton = ({ label, onClick, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`p-1.5 rounded-lg transition-colors ${
      danger
        ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
        : 'text-gray-400 hover:text-[#2a276e] hover:bg-[#2a276e]/5'
    }`}
  >
    {children}
  </button>
);

const PrescriptionsTab = ({ prescriptions = [], onEdit, onDelete, onDeleteMedicine }) => {
  const groups = prescriptions
    .map((rx) => ({ rx, items: (rx.items || []).map((item, index) => ({ item, index })).filter(({ item }) => hasName(item)) }))
    .filter((g) => g.items.length);

  if (!groups.length) {
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
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-[#f8fafc] border-b border-gray-200">
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Medicine</th>
            <th className="px-4 py-3">Dosage</th>
            <th className="px-4 py-3">Frequency</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3 w-12"><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        {groups.map(({ rx, items }, g) => (
          <tbody key={rx.id ?? g} className="divide-y divide-gray-100 border-b border-gray-200 last:border-b-0">
            <tr className="bg-gray-50/60">
              <td colSpan={4} className="px-4 py-2">
                <span className="text-xs font-semibold text-gray-700">
                  {groups.length > 1 ? `Prescription ${g + 1}` : 'Prescription'}
                </span>
                <span className="text-xs text-gray-400">
                  {' · '}{formatDate(rx.issued_on || rx.created_at || rx.date)}
                  {' · '}{items.length} {items.length === 1 ? 'medicine' : 'medicines'}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center justify-end gap-0.5">
                  {onEdit && (
                    <IconButton label="Edit prescription" onClick={() => onEdit(rx)}>
                      <Pencil size={14} />
                    </IconButton>
                  )}
                  {onDelete && (
                    <IconButton label="Delete prescription" danger onClick={() => onDelete(rx)}>
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </div>
              </td>
            </tr>
            {items.map(({ item, index }) => (
              <tr key={`${rx.id}-${index}`} className="transition-colors duration-150 hover:bg-gray-50/70">
                <td className="px-4 py-3 font-semibold text-gray-900">{item.medicine_name}</td>
                <td className="px-4 py-3 text-gray-500">{item.dosage || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-500">{item.frequency || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-500">{item.duration || <span className="text-gray-300">—</span>}</td>
                <td className="px-2 py-2 text-right">
                  {onDeleteMedicine && (
                    <IconButton
                      label={`Remove ${item.medicine_name}`}
                      danger
                      onClick={() => onDeleteMedicine(rx, index)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
};

export default PrescriptionsTab;
