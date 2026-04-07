import React, { useState } from 'react';

const VendorTable = ({ vendors, onEditVendor }) => {
  const [activeTab, setActiveTab] = useState('All Categories');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Filter vendors based on active tab
  const filteredVendors = vendors.filter(vendor => {
    if (activeTab === 'All Categories') return true;
    return vendor.category === activeTab;
  });

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const paginatedVendors = filteredVendors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getInitials = (name) => {
    if (!name) return "V";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No orders";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Table Filters/Tabs */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-6 overflow-x-auto">
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#2a276e] hover:bg-gray-100 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          All Categories
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-6 text-sm font-bold text-gray-500">
          {['Equipment', 'Consumables', 'Lab Services'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
              className={`pb-1 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab 
                  ? 'border-[#2a276e] text-[#2a276e]' 
                  : 'border-transparent hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Vendor Name</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Category</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Primary Contact</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Status</th>
              <th className="py-4 px-6 text-[10px] font-black tracking-widest text-gray-400 uppercase">Last Order</th>
              <th className="py-4 px-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginatedVendors.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 text-[#2a276e] flex items-center justify-center font-black text-sm">
                      {getInitials(vendor.name)}
                    </div>
                    <span className="font-bold text-[#2a276e]">{vendor.name}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                    {vendor.category || 'General'}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-gray-700 font-medium">
                  {vendor.contact_name || 'Unassigned'}
                </td>
                <td className="py-4 px-6">
                  {vendor.is_active ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 text-green-700 text-[10px] font-black tracking-wider uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-200 text-gray-600 text-[10px] font-black tracking-wider uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                      Inactive
                    </span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm text-gray-600 font-medium">
                  {formatDate(vendor.last_order_date)}
                </td>
                <td className="py-4 px-6 text-right">
                  <button 
                    onClick={() => onEditVendor(vendor)}
                    className="p-2 text-gray-400 hover:text-[#2a276e] hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {paginatedVendors.length === 0 && (
              <tr>
                <td colSpan="6" className="py-12 text-center text-gray-500 text-sm">
                  No vendors found in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm">
        <div className="text-gray-500 font-medium">
          Showing <span className="text-gray-900 font-bold">{filteredVendors.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredVendors.length)}</span> of <span className="text-gray-900 font-bold">{filteredVendors.length}</span> vendors
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold transition-colors ${
                  currentPage === idx + 1 
                    ? 'bg-[#0d0a2d] text-white' 
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {idx + 1}
              </button>
            ))}

            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorTable;
