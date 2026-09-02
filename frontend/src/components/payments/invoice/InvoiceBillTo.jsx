import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { generatePatientPersona, generateInitialsAvatar } from '../../../utils/avatar';

/**
 * Who the bill is for. One cell of the summary strip, so it brings no card of
 * its own — the strip owns the border and the dividers.
 */
const InvoiceBillTo = ({ invoice }) => {
  const name = invoice?.patient_name || 'Unknown patient';

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Bill to</p>
      <div className="flex items-start gap-2.5 min-w-0">
        <img
          src={generatePatientPersona({ name }, 80)}
          onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(name); }}
          alt=""
          className="w-8 h-8 rounded-full flex-shrink-0 object-cover border border-gray-200"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900 truncate" title={name}>{name}</p>
          {invoice?.patient_phone ? (
            <a href={`tel:${invoice.patient_phone}`} className="block text-[12px] text-gray-600 hover:text-[#2a276e] truncate">
              {invoice.patient_phone}
            </a>
          ) : (
            <p className="text-[12px] text-gray-400">No phone on file</p>
          )}
          {invoice?.patient_address && (
            <p className="text-[11px] text-gray-500 truncate" title={invoice.patient_address}>
              {invoice.patient_address}
            </p>
          )}
          {invoice?.patient_id && (
            <Link
              to={`/patient-profile/${invoice.patient_id}`}
              className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-[#2a276e] hover:underline"
            >
              View profile <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceBillTo;
