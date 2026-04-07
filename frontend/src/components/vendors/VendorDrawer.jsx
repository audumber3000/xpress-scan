import React from 'react';
import VendorTable from './VendorTable';

const VendorDrawer = ({ isOpen, onClose, vendors, onEditVendor, onOpenAddVendor }) => {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-4xl bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">All Vendors</h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Manage your dental supply partners and contacts.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onOpenAddVendor}
              className="flex items-center gap-2 bg-[#2a276e] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#1a1548] transition-colors shadow-sm text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add New Vendor
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
          <div className="h-full flex flex-col">
            <VendorTable 
                vendors={vendors} 
                onEditVendor={onEditVendor} 
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default VendorDrawer;
