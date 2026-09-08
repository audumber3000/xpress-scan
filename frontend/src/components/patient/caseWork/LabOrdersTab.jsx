import React from 'react';
import { ExternalLink } from 'lucide-react';
import EmptyState from '../../common/EmptyState';
import { noData } from '../../../assets/illustrations';

// Invoice status chip shown when a lab order is on a bill.
const INV_STATUS = {
  draft: ['Draft', 'bg-gray-100 text-gray-600 border-gray-200'],
  finalized: ['Generated', 'bg-blue-50 text-blue-700 border-blue-200'],
  partially_paid: ['Partial', 'bg-amber-50 text-amber-700 border-amber-200'],
  paid_verified: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  paid_unverified: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-600 border-red-200'],
};

const LabOrdersTab = ({ labOrders = [], onEditLabOrder }) => {
  if (!labOrders.length) {
    return (
      <EmptyState
        image={noData}
        size="sm"
        title="No lab work recorded"
        subtitle="Crowns, dentures and other lab orders for this visit appear here."
      />
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-[#f8fafc] border-b border-gray-200">
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Work type</th>
            <th className="px-4 py-3">Lab</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 w-[52px]"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {labOrders.map((order) => {
            const [lbl, cls] = INV_STATUS[order.invoice_status] || INV_STATUS.draft;
            return (
              <tr key={order.id} className="transition-colors duration-150 hover:bg-gray-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">
                    {order.work_type}
                    {order.tooth_number ? <span className="text-gray-400 font-medium"> · #{order.tooth_number}</span> : null}
                  </p>
                  {order.invoice_number ? (
                    <p className="mt-0.5 flex items-center gap-1 flex-wrap text-[11px]">
                      <span className="text-gray-400">On bill</span>
                      <span className="font-semibold text-[#2a276e]">{order.invoice_number}</span>
                      <span className={`px-1.5 py-0.5 rounded border ${cls}`}>{lbl}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-gray-400">Not billed</p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{order.vendor_name}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEditLabOrder(order)}
                    title="Open this lab order"
                    aria-label="Open this lab order"
                    className="p-1.5 rounded-lg text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:text-[#2a276e] hover:bg-gray-100 active:scale-[0.97]"
                  >
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LabOrdersTab;
