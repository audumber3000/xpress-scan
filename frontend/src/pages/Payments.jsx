import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { FaSync } from "react-icons/fa";

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data - in real app, this would come from your API
  const mockPayments = [
    {
      id: "852120",
      user: {
        name: "Jerome Bell",
        avatar: "https://randomuser.me/api/portraits/men/32.jpg",
        email: "jeromebell12@gmail.com",
        phone: "(307) 555-0133"
      },
      amount: 2522.00,
      status: "success",
      paymentMethod: "Card",
      date: "30/06/2025"
    },
    {
      id: "825525",
      user: {
        name: "Bessie Cooper",
        avatar: "https://randomuser.me/api/portraits/women/33.jpg",
        email: "bessie33@gmail.com",
        phone: "(219) 555-0114"
      },
      amount: 3205.00,
      status: "pending",
      paymentMethod: "PayPal",
      date: "30/06/2025"
    },
    {
      id: "805252",
      user: {
        name: "Dianne Russell",
        avatar: "https://randomuser.me/api/portraits/women/34.jpg",
        email: "russelld00@gmail.com",
        phone: "(629) 555-0129"
      },
      amount: 5102.00,
      status: "failed",
      paymentMethod: "PayPal",
      date: "29/06/2025"
    },
    {
      id: "852323",
      user: {
        name: "Esther Howard",
        avatar: "https://randomuser.me/api/portraits/women/35.jpg",
        email: "estherhawk@gmail.com",
        phone: "(808) 555-0111"
      },
      amount: 8235.00,
      status: "refunded",
      paymentMethod: "Net Banking",
      date: "29/06/2025"
    },
    {
      id: "821085",
      user: {
        name: "Annette Black",
        avatar: "https://randomuser.me/api/portraits/women/36.jpg",
        email: "annetteblack@gmail.com",
        phone: "(316) 555-0116"
      },
      amount: 6150.00,
      status: "refunded",
      paymentMethod: "Card",
      date: "29/06/2025"
    },
    {
      id: "832136",
      user: {
        name: "Robert Fox",
        avatar: "https://randomuser.me/api/portraits/men/37.jpg",
        email: "robertfox22@gmail.com",
        phone: "(207) 555-0119"
      },
      amount: 5890.00,
      status: "pending",
      paymentMethod: "Net Banking",
      date: "28/06/2025"
    },
    {
      id: "845678",
      user: {
        name: "Sarah Johnson",
        avatar: "https://randomuser.me/api/portraits/women/38.jpg",
        email: "sarah.johnson@gmail.com",
        phone: "(555) 123-4567"
      },
      amount: 4200.00,
      status: "success",
      paymentMethod: "Card",
      date: "28/06/2025"
    },
    {
      id: "856789",
      user: {
        name: "Michael Brown",
        avatar: "https://randomuser.me/api/portraits/men/39.jpg",
        email: "michael.brown@gmail.com",
        phone: "(555) 234-5678"
      },
      amount: 7800.00,
      status: "success",
      paymentMethod: "PayPal",
      date: "27/06/2025"
    },
    {
      id: "867890",
      user: {
        name: "Emily Davis",
        avatar: "https://randomuser.me/api/portraits/women/40.jpg",
        email: "emily.davis@gmail.com",
        phone: "(555) 345-6789"
      },
      amount: 3200.00,
      status: "pending",
      paymentMethod: "Net Banking",
      date: "27/06/2025"
    },
    {
      id: "878901",
      user: {
        name: "David Wilson",
        avatar: "https://randomuser.me/api/portraits/men/41.jpg",
        email: "david.wilson@gmail.com",
        phone: "(555) 456-7890"
      },
      amount: 9500.00,
      status: "success",
      paymentMethod: "Card",
      date: "26/06/2025"
    },
    {
      id: "889012",
      user: {
        name: "Lisa Anderson",
        avatar: "https://randomuser.me/api/portraits/women/42.jpg",
        email: "lisa.anderson@gmail.com",
        phone: "(555) 567-8901"
      },
      amount: 5400.00,
      status: "failed",
      paymentMethod: "PayPal",
      date: "26/06/2025"
    },
    {
      id: "890123",
      user: {
        name: "James Taylor",
        avatar: "https://randomuser.me/api/portraits/men/43.jpg",
        email: "james.taylor@gmail.com",
        phone: "(555) 678-9012"
      },
      amount: 6800.00,
      status: "success",
      paymentMethod: "Net Banking",
      date: "25/06/2025"
    }
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setPayments(mockPayments);
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      success: { color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
      pending: { color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
      failed: { color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
      refunded: { color: "bg-gray-100 text-gray-800 border-gray-200", dot: "bg-gray-500" }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Filter payments based on search term
  const filteredPayments = payments.filter(payment =>
    payment.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
              <button
                onClick={() => {
                  // Mock refresh for payments
                  setLoading(true);
                  setTimeout(() => setLoading(false), 1000);
                }}
                disabled={loading}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh payments"
              >
                <FaSync className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-gray-600 mt-1">Manage and track all payment transactions</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Table Container with Scrollbars */}
      <div className="overflow-x-auto">
        <table className="w-full">
                      <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
          <tbody className="bg-white divide-y divide-gray-200">
                          {currentPayments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div>
                      <p className="text-lg font-medium">No payments found</p>
                      <p className="text-sm mt-1">Payments will appear here once transactions are made</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className="text-gray-900 font-medium text-sm">
                        #{payment.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-8 w-8 rounded-full" src={payment.user.avatar} alt={payment.user.name} />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{payment.user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.user.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-gray-600 transition-colors duration-150" title="View Details">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button className="text-gray-400 hover:text-red-600 transition-colors duration-150" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0016.138 5H7.862a2 2 0 00-1.995 1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-medium">{Math.min(indexOfLastItem, filteredPayments.length)}</span> of{' '}
                <span className="font-medium">{filteredPayments.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      currentPage === page
                        ? 'z-10 bg-green-50 border-green-500 text-green-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
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
    </div>
  );
};

export default Payments;
