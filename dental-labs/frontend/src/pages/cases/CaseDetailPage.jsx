/**
 * CaseDetailPage — view case summary, items, and transition status, MolarPlus style.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { api } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import { STATUS_CONFIG, STATUS_OPTIONS } from "../../utils/constants";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import { ArrowLeft, History, Paperclip, Upload, Trash2, FileText, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadCase();
  }, [id]);

  const loadCase = async () => {
    try {
      const data = await api.get(`/cases/${id}`);
      setCaseData(data.case);
      setNewStatus(data.case.status);
    } catch (err) {
      toast.error("Case not found");
      navigate("/cases");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (newStatus === caseData.status) return;
    
    try {
      const data = await api.patch(`/cases/${id}/status`, { status: newStatus, note: statusNote });
      setCaseData(data.case);
      setStatusNote("");
      toast.success("Status updated");
    } catch (err) {
      toast.error(err.message || "Failed to update status");
      setNewStatus(caseData.status);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const data = await api.post(`/cases/${id}/attachments`, formData);
      setCaseData({
        ...caseData,
        attachments: [...caseData.attachments, data.attachment]
      });
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = null; // Reset input
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;

    try {
      await api.delete(`/cases/${id}/attachments/${attachmentId}`);
      setCaseData({
        ...caseData,
        attachments: caseData.attachments.filter(a => a.id !== attachmentId)
      });
      toast.success("File deleted");
    } catch (err) {
      toast.error("Failed to delete file");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!caseData) return null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Back button */}
      <Link to="/cases" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2">
        <ArrowLeft size={16} /> Back to cases
      </Link>

      {/* Case Hero Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Case {caseData.case_number || id}</h1>
          <p className="text-sm text-gray-500 mt-1">Created on {format(new Date(caseData.created_at || caseData.received_date), "dd MMM yyyy")}</p>
        </div>
        <StatusBadge status={caseData.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        
        <div className="flex flex-col gap-6">
          {/* Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Clinic</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{caseData.client_name}</div>
              <div className="text-xs text-gray-500">{caseData.doctor_name || "No doctor info"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{caseData.patient_name || "N/A"}</div>
              <div className="text-xs text-gray-500">{[caseData.patient_age, caseData.patient_sex].filter(Boolean).join(" / ")}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</div>
              <div className="text-sm text-gray-700 mt-1">Recv: {format(new Date(caseData.received_date), "dd MMM yyyy")}</div>
              <div className="text-sm font-semibold text-red-600">Due: {caseData.due_date ? format(new Date(caseData.due_date), "dd MMM yyyy") : "-"}</div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Products ({caseData.items.length})</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tooth #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shade / Mat.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {caseData.items.map(item => (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{item.product_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.tooth_numbers || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{[item.shade, item.material].filter(Boolean).join(" / ") || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="text-gray-500 mb-0.5">{item.qty} × {formatCurrency(item.unit_price)}</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(item.line_total)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Case Total</span>
              <span className="text-xl font-bold text-[#2a276e]">{formatCurrency(caseData.total_amount)}</span>
            </div>
          </div>

          {/* Notes */}
          {caseData.notes && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-bold text-gray-900 mb-3">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{caseData.notes}</p>
            </div>
          )}

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc]">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Paperclip size={18} /> Attachments
              </h3>
              <div className="relative">
                <input 
                  type="file" 
                  id="file-upload" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition-colors pointer-events-none">
                  {uploading ? <LoadingSpinner size={14} /> : <Upload size={14} />} 
                  {uploading ? "Uploading..." : "Upload File"}
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {caseData.attachments?.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No files attached yet</p>
                  <p className="text-xs mt-1">Upload STL scans, impression photos, or prescriptions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {caseData.attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors group">
                      <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate" title={att.file_name}>{att.file_name}</div>
                        <div className="text-xs text-gray-500">{(att.file_size / 1024).toFixed(1)} KB</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a 
                          href={att.file_url || "#"}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 rounded hover:bg-white transition-colors"
                          title="Download"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={16} />
                        </a>
                        <button 
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded hover:bg-white transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="flex flex-col gap-6">
          {/* Status Updater */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Update Status</h3>
            <form onSubmit={handleStatusUpdate}>
              <div className="mb-3">
                <select 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                  value={newStatus} 
                  onChange={e => setNewStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <textarea 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all resize-y" 
                  value={statusNote} 
                  onChange={e => setStatusNote(e.target.value)} 
                  placeholder="Add an optional note..." 
                  rows={2} 
                />
              </div>
              <button 
                type="submit" 
                className="w-full flex items-center justify-center px-4 py-2.5 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm disabled:opacity-50" 
                disabled={newStatus === caseData.status}
              >
                Update Case
              </button>
            </form>
          </div>

          {/* History Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History size={18} /> Timeline
            </h3>
            <div className="flex flex-col gap-4">
              {caseData.status_history.map((h, i) => (
                <div key={h.id} className="relative pl-5">
                  <div 
                    className="absolute left-0 top-1 w-2 h-2 rounded-full" 
                    style={{ background: STATUS_CONFIG[h.to_status]?.color || "#9CA3AF" }} 
                  />
                  {i !== caseData.status_history.length - 1 && (
                    <div className="absolute left-[3px] top-4 bottom-[-16px] w-0.5 bg-gray-100" />
                  )}
                  <div className="text-sm font-semibold text-gray-900 capitalize">{h.to_status.replace("_", " ")}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {format(new Date(h.changed_at), "dd MMM h:mm a")} • by {h.changed_by_name || "System"}
                  </div>
                  {h.note && (
                    <div className="text-xs text-gray-600 mt-1.5 bg-gray-50 px-2 py-1 rounded">
                      {h.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
