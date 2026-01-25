import React from 'react';

/**
 * PatientBilling - Renders simple billing summary and payment history in a table format
 * @param {array} payments - List of payment transactions
 */
const PatientBilling = ({ payments = [] }) => {
    const successfulPayments = payments.filter(p => p.status === 'success');

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Billing History</h3>
                        <p className="text-sm text-gray-500 mt-1">Full record of patient transactions and settlements</p>
                    </div>
                    <button className="text-sm font-bold text-[#2a276e] bg-gray-50 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
                        Export PDF
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Procedure / Service</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Payment Method</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {successfulPayments.length > 0 ? (
                                successfulPayments.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-gray-800">{payment.procedure}</div>
                                            {payment.notes && <div className="text-xs text-gray-500 mt-1 italic">{payment.notes}</div>}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-gray-600">
                                            {new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs font-semibold text-gray-600 px-2 py-1 bg-gray-100 rounded">
                                                {payment.payment_method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right font-bold text-gray-900">
                                            ₹{payment.amount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                    Paid
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-gray-400 italic">
                                        No billing records found for this patient.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {successfulPayments.length > 0 && (
                            <tfoot className="bg-gray-50/30 font-bold">
                                <tr>
                                    <td colSpan="3" className="px-6 py-4 text-sm text-gray-600 text-right">Total Settled Amount:</td>
                                    <td className="px-6 py-4 text-right text-lg text-[#2a276e]">
                                        ₹{successfulPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PatientBilling;
