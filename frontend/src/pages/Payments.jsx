import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import GearLoader from "../components/GearLoader";
import { api } from "../utils/api";
import InvoiceEditor from "../components/payments/InvoiceEditor";
import InvoiceItem from "../components/payments/InvoiceItem";

const INVOICES_PER_PAGE = 10;

const Payments = () => {
  const { user } = useAuth();
  const { setTitle, setRefreshFunction } = useHeader();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch invoices from API with pagination and search
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");
      
      const skip = (page - 1) * INVOICES_PER_PAGE;
      
      // Build query params
      const params = {
        skip: skip,
        limit: INVOICES_PER_PAGE
      };
      
      // Add search filter if exists (search by patient name)
      if (debouncedSearch.trim()) {
        // Note: Backend invoice search by patient_name would need to be implemented
        // For now, we'll fetch all and filter client-side or implement backend search
      }
      
      const invoicesData = await api.get('/invoices', { params });
      setInvoices(invoicesData || []);
      
      // For total count, we'll use a rough estimate based on the number of results
      if (invoicesData && invoicesData.length === INVOICES_PER_PAGE) {
        setTotalCount((page) * INVOICES_PER_PAGE + 1);
      } else {
        setTotalCount((page - 1) * INVOICES_PER_PAGE + (invoicesData?.length || 0));
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to fetch invoices');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitle('Invoices');
    setRefreshFunction(() => fetchInvoices);
  }, [setTitle, setRefreshFunction]);

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
  };

  const handleInvoiceClose = () => {
    setSelectedInvoiceId(null);
    fetchInvoices(); // Refresh list after closing
  };

  // Filter invoices client-side for search (until backend search is implemented)
  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.patient_name?.toLowerCase().includes(searchLower) ||
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.patient_phone?.toLowerCase().includes(searchLower)
    );
  });

  // Since we're using backend pagination, we use the current invoices directly
  const totalPages = Math.ceil(totalCount / INVOICES_PER_PAGE) || 1;
  const currentInvoices = filteredInvoices;

  return (
    <div className="flex flex-col h-screen">
      {/* Header - Removed, now in global Header */}

      {/* Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {loading && invoices.length === 0 ? (
            <div className="w-full flex items-center justify-center py-16">
              <div className="text-center">
                <GearLoader size="w-8 h-8" className="mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading invoices...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading invoices</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <button 
                      onClick={fetchInvoices}
                      className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Mode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div>
                        <p className="text-lg font-medium">No invoices found</p>
                        <p className="text-sm mt-1">Invoices will appear here once patients are registered</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentInvoices.map((invoice) => (
                    <InvoiceItem
                      key={invoice.id}
                      invoice={invoice}
                      onSelect={handleInvoiceSelect}
                    />
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sticky Pagination at Bottom */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 flex-shrink-0 sticky bottom-0 z-20 shadow-lg">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * INVOICES_PER_PAGE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * INVOICES_PER_PAGE, totalCount)}</span> of{' '}
                <span className="font-medium">{totalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === pageNum
                        ? 'z-10 bg-[#9B8CFF]/10 border-[#2a276e] text-[#2a276e]'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Editor Panel */}
      {selectedInvoiceId && (
        <InvoiceEditor
          invoiceId={selectedInvoiceId}
          onClose={handleInvoiceClose}
          onSave={handleInvoiceClose}
        />
      )}
    </div>
  );
};

export default Payments;
