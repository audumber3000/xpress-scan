import React from 'react';
import { Beaker, ClipboardList, ExternalLink } from 'lucide-react';

const DiagnosticsGrid = ({
  labOrders,
  visitPrescriptions,
  selectedCasePaper,
  isNewCasePaper,
  onNewLabOrder,
  onEditLabOrder,
  onNewPrescription
}) => {
  const filteredPrescriptions = isNewCasePaper
    ? visitPrescriptions.filter(rx => !rx.appointment_id)
    : visitPrescriptions.filter(rx =>
        rx.appointment_id === selectedCasePaper?.id ||
        rx.appointment_id?.toString() === selectedCasePaper?.id?.toString()
      );
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8 border-t border-gray-100">
      {/* Lab Orders Column */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Beaker size={20} className="text-[#2a276e]" />
            Laboratory Orders
          </h3>
          <button 
            onClick={onNewLabOrder}
            className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
          >
            + New Order
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {labOrders.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lab</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {labOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.work_type} {order.tooth_number ? `(#${order.tooth_number})` : ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.vendor_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button 
                        onClick={() => onEditLabOrder(order)}
                        className="p-1.5 text-gray-400 hover:text-[#2a276e] hover:bg-white rounded-lg transition-all"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-gray-50">
              <p className="text-sm text-gray-500">No lab work recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* Visit Prescriptions Column */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={20} className="text-[#2a276e]" />
            Visit Prescriptions
          </h3>
          <button 
            onClick={onNewPrescription}
            className="bg-[#2a276e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm"
          >
            + New Prescription
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {filteredPrescriptions.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPrescriptions.map(rx => (
                  <React.Fragment key={rx.id}>
                    {rx.items?.map((item, idx) => (
                      <tr key={`${rx.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.medicine_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.dosage}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.duration}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-gray-50">
              <p className="text-sm text-gray-500">No prescriptions this visit</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DiagnosticsGrid;
