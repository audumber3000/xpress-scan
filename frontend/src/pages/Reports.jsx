import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast } from 'react-toastify';
import { FaFilePdf, FaEye, FaTrash, FaWhatsapp, FaSync } from 'react-icons/fa';
import { MoreVertical } from 'lucide-react';
import { api } from "../utils/api";
import LoadingButton from "../components/LoadingButton";
import { useAuth } from "../contexts/AuthContext";

const REPORTS_PER_PAGE = 7;

const Reports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [deletingReports, setDeletingReports] = useState(new Set());
  const [sendingWhatsApp, setSendingWhatsApp] = useState(new Set());
  // Dropdown close on outside click
  React.useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('.dropdown-menu') && !e.target.closest('.dropdown-trigger')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const toggleDropdown = id => setOpenDropdown(openDropdown === id ? null : id);

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

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "final":
        return "bg-blue-100 text-blue-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getWhatsAppStatus = (report) => {
    console.log("Report WhatsApp count:", report.whatsapp_sent_count, typeof report.whatsapp_sent_count);
    if (report.whatsapp_sent_count && report.whatsapp_sent_count > 0) {
      return (
        <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
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
    
    // Parse permission string (e.g., "reports:delete" -> ["reports", "delete"])
    const [section, action] = permission.split(":");
    
    // Check nested permission structure
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
      // Refresh the reports list
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
    // Navigate to Voice Reporting page with the report data
    // Store the report data in localStorage for the VoiceReporting page to access
    const reportData = {
      reportId: report.id,
      isEditing: true,
      patientId: report.patient_id
    };
    localStorage.setItem('editingDraftReport', JSON.stringify(reportData));
    
    // Navigate to voice reporting page
    window.location.href = '/voice-reporting';
  };

  return (
    <div className="w-full h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
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
            <p className="text-gray-600 mt-1">
              Manage and view all patient reports
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {loading ? "Loading..." : `${filteredReports.length} of ${reports.length} reports`}
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by patient name, scan type, or doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scan Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referred By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading reports...</p>
                  </div>
                </td>
              </tr>
            ) : paginatedReports.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  {reports.length === 0 ? (
                    <div>
                      <p className="text-lg font-medium">No reports found</p>
                      <p className="text-sm mt-1">Reports will appear here once generated</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium">No reports match your search</p>
                      <p className="text-sm mt-1">Try adjusting your search or filters</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  {/* PDF Icon */}
                  <td className="px-4 py-4 whitespace-nowrap text-red-600 text-xl">
                    <FaFilePdf />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {report.patient_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {report.patient_age} years • {report.patient_gender}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {report.scan_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {report.referred_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                      {getWhatsAppStatus(report)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(report.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium relative">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => toggleDropdown(report.id)}
                        className="p-1 rounded hover:bg-gray-100 dropdown-trigger"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="18" r="1" /></svg>
                      </button>
                      {openDropdown === report.id && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200 dropdown-menu">
                          <div className="py-1">
                            {report.status === "final" ? (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); handleViewReport(report); setOpenDropdown(null); }}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <FaEye className="w-4 h-4 mr-2 text-blue-500" /> View
                                </button>
                                {hasPermission("reports:edit") && (
                                  <LoadingButton
                                    onClick={e => { e.stopPropagation(); handleSendWhatsApp(report); setOpenDropdown(null); }}
                                    loading={sendingWhatsApp.has(report.id)}
                                    className="w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                                  >
                                    <FaWhatsapp className="w-4 h-4 mr-2 text-green-500" /> Send WhatsApp
                                  </LoadingButton>
                                )}
                                {hasPermission("reports:delete") && (
                                  <LoadingButton
                                    onClick={e => { e.stopPropagation(); handleDeleteReport(report); setOpenDropdown(null); }}
                                    loading={deletingReports.has(report.id)}
                                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <FaTrash className="w-4 h-4 mr-2 text-red-500" /> Delete
                                  </LoadingButton>
                                )}
                              </>
                            ) : report.status === "draft" ? (
                              <>
                                {hasPermission("reports:edit") && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleEditReport(report); setOpenDropdown(null); }}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21v-6.586a2 2 0 01.586-1.414l9-9a2 2 0 012.828 0l3.172 3.172a2 2 0 010 2.828l-9 9A2 2 0 019.586 21H3z" /></svg>
                                    Edit
                                  </button>
                                )}
                                {hasPermission("reports:delete") && (
                                  <LoadingButton
                                    onClick={e => { e.stopPropagation(); handleDeleteReport(report); setOpenDropdown(null); }}
                                    loading={deletingReports.has(report.id)}
                                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <FaTrash className="w-4 h-4 mr-2 text-red-500" /> Delete
                                  </LoadingButton>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); handleViewReport(report); setOpenDropdown(null); }}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <FaEye className="w-4 h-4 mr-2 text-blue-500" /> View
                                </button>
                                {hasPermission("reports:delete") && (
                                  <LoadingButton
                                    onClick={e => { e.stopPropagation(); handleDeleteReport(report); setOpenDropdown(null); }}
                                    loading={deletingReports.has(report.id)}
                                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <FaTrash className="w-4 h-4 mr-2 text-red-500" /> Delete
                                  </LoadingButton>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500 px-6 pb-6">
          <div>
            Showing {filteredReports.length === 0 ? 0 : (page - 1) * REPORTS_PER_PAGE + 1}
            -{Math.min(page * REPORTS_PER_PAGE, filteredReports.length)} of {filteredReports.length} entries
          </div>
          <div className="flex gap-1">
            <LoadingButton
              className="w-8 h-8 rounded border border-gray-200 bg-white hover:bg-green-50"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              &lt;
            </LoadingButton>
            {Array.from({ length: totalPages }, (_, i) => (
              <LoadingButton
                key={i + 1}
                className={`w-8 h-8 rounded border border-gray-200 bg-white hover:bg-green-50 ${page === i + 1 ? 'bg-green-100 border-green-600 font-bold' : ''}`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </LoadingButton>
            ))}
            <LoadingButton
              className="w-8 h-8 rounded border border-gray-200 bg-white hover:bg-green-50"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              &gt;
            </LoadingButton>
          </div>
        </div>
      </div>
      {/* Add a button to trigger a notification for demo */}
      <button
        onClick={() => toast.success('This is a test notification!')}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        Show Notification
      </button>
    </div>
  );
};

export default Reports; 