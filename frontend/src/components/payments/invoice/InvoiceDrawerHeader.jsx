import React from 'react';
import { Printer, Download, X } from 'lucide-react';
import Spinner from '../../common/Spinner';

/**
 * The drawer's top row: tabs on the left, the two things you do with a finished
 * bill on the right, then close.
 *
 * Print and Download sit up here rather than only in the footer because they act
 * on the invoice as a document, not on its state — you reach for them while
 * reading, not after deciding something.
 */
const InvoiceDrawerHeader = ({
  tabs = [],
  activeTab,
  onTabChange,
  title,
  showDocActions,
  onPrint,
  printing,
  onDownload,
  downloading,
  onClose,
}) => (
  <div className="px-4 sm:px-5 border-b border-gray-200 shrink-0 flex items-center justify-between gap-2 sm:gap-4">
    {tabs.length ? (
      <nav className="-mb-px flex space-x-5 sm:space-x-6 overflow-x-auto min-w-0 flex-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`${
              activeTab === t.id
                ? 'border-[#2a276e] text-[#2a276e]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap shrink-0 py-3.5 px-1 border-b-2 font-medium text-[13px] transition-colors`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    ) : (
      <h2 className="py-3.5 text-[13px] font-semibold text-gray-900">{title}</h2>
    )}

    <div className="flex items-center gap-2 shrink-0">
      {showDocActions && (
        <>
          <button
            type="button"
            onClick={onPrint}
            disabled={printing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors text-[12px] font-semibold disabled:opacity-50"
          >
            <Printer size={14} /> <span className="hidden sm:inline">Print</span>
            {printing && <Spinner className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors text-[12px] font-semibold disabled:opacity-50"
          >
            <Download size={14} /> <span className="hidden sm:inline">Download</span>
            {downloading && <Spinner className="w-3 h-3" />}
          </button>
        </>
      )}
      <button
        onClick={onClose}
        aria-label="Close"
        className="p-1.5 hover:bg-gray-100 rounded-full transition"
      >
        <X size={18} className="text-gray-500" />
      </button>
    </div>
  </div>
);

export default InvoiceDrawerHeader;
