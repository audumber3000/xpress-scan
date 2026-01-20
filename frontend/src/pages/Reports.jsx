import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { FaFilePdf, FaEye, FaTrash, FaWhatsapp, FaSync, FaEdit } from 'react-icons/fa';
import { api } from "../utils/api";
import LoadingButton from "../components/LoadingButton";
import GearLoader from "../components/GearLoader";
import { useAuth } from "../contexts/AuthContext";

const REPORTS_PER_PAGE = 8;

const Reports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [deletingReports, setDeletingReports] = useState(new Set());
  const [sendingWhatsApp, setSendingWhatsApp] = useState(new Set());

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await api.get("/reports/");
      setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      final: { color: "bg-[#9B8CFF]/20 text-[#2a276e] border-[#9B8CFF]", dot: "bg-[#9B8CFF]/100" },
      draft: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
      pending: { color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" }
    };

    const config = statusConfig[status.toLowerCase()] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getWhatsAppStatus = (report) => {
    if (report.whatsapp_sent_count && report.whatsapp_sent_count > 0) {
      return (
        <div className="flex items-center gap-1 bg-[#9B8CFF]/20 text-[#2a276e] px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
          <FaWhatsapp className="w-3 h-3 flex-shrink-0" />
          <span>Sent ({report.whatsapp_sent_count})</span>
        </div>
      );
    }
    return null;
  };

  // Helper function to check if user has permission
  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;
    if (user.role === "clinic_owner") return true;
    
    const [section, action] = permission.split(":");
    
    if (user.permissions[section] && user.permissions[section][action]) {
      return user.permissions[section][action] === true;
    }
    
    return false;
  };

  // Filtered and paginated reports
  const filteredReports = reports.filter((report) => {
    const matchesSearch = 
      report.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.scan_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.referred_by.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || report.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredReports.length / REPORTS_PER_PAGE) || 1;
  const paginatedReports = filteredReports.slice(
    (page - 1) * REPORTS_PER_PAGE,
    page * REPORTS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus, reports]);

  const handleViewReport = (report) => {
    if (report.pdf_url) {
      window.open(report.pdf_url, "_blank");
    } else if (report.docx_url) {
      window.open(report.docx_url, "_blank");
    } else {
      toast.error("Report document not available yet.");
    }
  };

  const handleRegenerateReport = async (report) => {
    try {
      const data = await api.post("/reports/create-doc", {
        name: report.patient_name,
        age: report.patient_age,
        gender: report.patient_gender,
        scan_type: report.scan_type,
        referred_by: report.referred_by,
      });
      
      window.open(data.edit_url, "_blank");
      fetchReports();
    } catch (error) {
      console.error("Error regenerating report:", error);
      toast.error("Error regenerating report");
    }
  };

  const handleDeleteReport = async (report) => {
    if (!window.confirm(`Are you sure you want to delete the report for ${report.patient_name}?`)) return;
    try {
      setDeletingReports(prev => new Set(prev).add(report.id));
      await api.delete(`/reports/${report.id}`);
      toast.success("Report deleted successfully");
      fetchReports();
    } catch (error) {
      toast.error("Error deleting report");
    } finally {
      setDeletingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(report.id);
        return newSet;
      });
    }
  };

  const handleSendWhatsApp = async (report) => {
    try {
      setSendingWhatsApp(prev => new Set(prev).add(report.id));
      toast.info("Sending report to patient...");
      const response = await api.post(`/reports/send-whatsapp/${report.id}`);
      
      if (response.success) {
        toast.success("✅ Report sent to patient successfully!");
      } else {
        toast.error("Failed to send report to patient");
      }
    } catch (error) {
      console.error("Error sending report to patient:", error);
      toast.error("Error sending report to patient");
    } finally {
      setSendingWhatsApp(prev => {
        const newSet = new Set(prev);
        newSet.delete(report.id);
        return newSet;
      });
    }
  };

  const handleEditReport = (report) => {
    const reportData = {
      reportId: report.id,
      isEditing: true,
      patientId: report.patient_id
    };
    localStorage.setItem('editingDraftReport', JSON.stringify(reportData));
    window.location.href = '/voice-reporting';
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 pb-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <button
                onClick={fetchReports}
                disabled={loading}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh reports"
              >
                <FaSync className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-gray-600 mt-1">Manage and track all radiology reports</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
            />
          </div>
          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {loading ? (
            <div className="w-full flex items-center justify-center py-16">
              <div className="text-center">
                <GearLoader size="w-8 h-8" className="mx-auto" />
                <p className="mt-2 text-sm text-gray-600">Loading reports...</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Report #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scan Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div>
                        <p className="text-lg font-medium">No reports found</p>
                        <p className="text-sm mt-1">Reports will appear here once generated</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className="text-gray-900 font-medium text-sm">
                          #{report.id}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-red-600 text-xl">
                        <FaFilePdf />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-semibold text-gray-900">{report.patient_name}</div>
                          <div className="text-sm text-gray-500">{report.patient_age} years • {report.patient_gender}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{report.scan_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{report.referred_by}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(report.status)}
                          {getWhatsAppStatus(report)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900">{formatDate(report.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewReport(report)}
                            className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
                            title="View Report"
                          >
                            <FaEye className="w-4 h-4" />
                          </button>
                          {report.status === "draft" && hasPermission("reports:edit") && (
                            <button
                              onClick={() => handleEditReport(report)}
                              className="text-gray-400 hover:text-[#9B8CFF] transition-colors duration-150"
                              title="Edit Report"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                          )}
                          {report.status === "final" && hasPermission("reports:edit") && (
                            <button
                              onClick={() => handleSendWhatsApp(report)}
                              disabled={sendingWhatsApp.has(report.id)}
                              className="text-gray-400 hover:text-[#2a276e] transition-colors duration-150 disabled:opacity-50"
                              title="Send WhatsApp"
                            >
                              <FaWhatsapp className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission("reports:delete") && (
                            <button
                              onClick={() => handleDeleteReport(report)}
                              disabled={deletingReports.has(report.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors duration-150 disabled:opacity-50"
                              title="Delete Report"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
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
                Showing <span className="font-medium">{(page - 1) * REPORTS_PER_PAGE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * REPORTS_PER_PAGE, filteredReports.length)}</span> of{' '}
                <span className="font-medium">{filteredReports.length}</span> results
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
    </div>
  );
};

export default Reports; 