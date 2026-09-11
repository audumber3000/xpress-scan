import { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { X, Save } from "lucide-react";
import toast from "react-hot-toast";

export default function ClientDrawer({ isOpen, onClose, client, onSuccess }) {
  const isEdit = Boolean(client?.id);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    clinic_name: "",
    phone: "",
    email: "",
    address: "",
    tax_id: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (isEdit && client) {
        setForm({
          name: client.name || "",
          clinic_name: client.clinic_name || "",
          phone: client.phone || "",
          email: client.email || "",
          address: client.address || "",
          tax_id: client.tax_id || "",
        });
      } else {
        setForm({ name: "", clinic_name: "", phone: "", email: "", address: "", tax_id: "" });
      }
    }
  }, [isOpen, client, isEdit]);

  if (!isOpen) return null;

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Dentist name is required");
      return;
    }
    
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/clients/${client.id}`, form);
        toast.success("Client updated successfully");
      } else {
        await api.post("/clients", form);
        toast.success("Client added successfully");
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to save client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-xl flex flex-col animate-slide-in-right">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Client' : 'Add New Client'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isEdit ? 'Update clinic details' : 'Enter clinic information'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="client-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Dentist Name <span className="text-red-500">*</span></label>
              <input 
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                value={form.name} 
                onChange={update("name")} 
                placeholder="Dr. Jane Doe" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic Name</label>
              <input 
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                value={form.clinic_name} 
                onChange={update("clinic_name")} 
                placeholder="Smile Care Dental" 
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                  value={form.phone} 
                  onChange={update("phone")} 
                  placeholder="+91 ..." 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                  type="email" 
                  value={form.email} 
                  onChange={update("email")} 
                  placeholder="clinic@email.com" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <textarea 
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all resize-none" 
                value={form.address} 
                onChange={update("address")} 
                placeholder="Full clinic address" 
                rows={3} 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax ID / GST Number</label>
              <input 
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                value={form.tax_id} 
                onChange={update("tax_id")} 
                placeholder="Optional" 
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-200 mt-auto bg-white">
          <div className="flex gap-3">
            <button 
              type="button" 
              className="flex-1 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="client-form"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm disabled:opacity-50" 
              disabled={loading}
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={16} />}
              {isEdit ? "Update Client" : "Save Client"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
