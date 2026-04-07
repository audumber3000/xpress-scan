import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { useHeader } from "../contexts/HeaderContext";
import { 
  Save, 
  Image as ImageIcon, 
  FileText, 
  Check, 
  Palette, 
  Files, 
  Layout,
  Stethoscope,
  ClipboardCheck
} from "lucide-react";
import FeatureLock from "../components/FeatureLock";

const TemplatesManager = () => {
  const { user } = useAuth();
  const { setTitle } = useHeader();
  
  const [activeTab, setActiveTab] = useState("invoice");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State for all template categories
  const [configs, setConfigs] = useState({
    invoice: {
      template_id: "modern_orange",
      logo_url: "",
      primary_color: "#FF9800",
      footer_text: "",
      gst_number: "" // Special field for invoices (stored on clinic)
    },
    prescription: {
      template_id: "default",
      logo_url: "",
      primary_color: "#2a276e",
      footer_text: ""
    },
    consent: {
      template_id: "default",
      logo_url: "",
      primary_color: "#10B981",
      footer_text: ""
    }
  });

  const templateLists = {
    invoice: [
      { id: "modern_orange", name: "Modern Orange", color: "#FF9800" },
      { id: "classic_blue", name: "Classic Navy", color: "#1e3a8a" },
      { id: "minimalist_mono", name: "Minimalist Mono", color: "#000000" },
      { id: "elegant_green", name: "Elegant Green", color: "#10b981" }
    ],
    prescription: [
      { id: "standard", name: "Standard Rx", color: "#2a276e" },
      { id: "modern", name: "Modern Clinical", color: "#4f46e5" }
    ],
    consent: [
      { id: "standard", name: "Standard Legal", color: "#10b981" },
      { id: "detailed", name: "Detailed Consent", color: "#059669" }
    ]
  };

  useEffect(() => {
    setTitle("Template Management");
    fetchConfigs();
  }, [setTitle]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      if (!user?.clinic_id) return;
      
      // 1. Fetch Clinic data for GST and existing fields
      const meData = await api.get("/auth/me");
      const clinic = meData.clinic;
      
      // 2. Fetch all template configurations
      const configData = await api.get("/template-configs");
      
      const newConfigs = { ...configs };
      
      // Map existing clinic fields to invoice config
      if (clinic) {
        newConfigs.invoice.gst_number = clinic.gst_number || "";
        newConfigs.invoice.template_id = clinic.invoice_template || "modern_orange";
        newConfigs.invoice.logo_url = clinic.logo_url || "";
      }
      
      // Overlay with data from new table if exists
      configData.forEach(cfg => {
        if (newConfigs[cfg.category]) {
          newConfigs[cfg.category] = {
            ...newConfigs[cfg.category],
            template_id: cfg.template_id,
            logo_url: cfg.logo_url || "",
            primary_color: cfg.primary_color || newConfigs[cfg.category].primary_color,
            footer_text: cfg.footer_text || ""
          };
        }
      });
      
      setConfigs(newConfigs);
    } catch (error) {
      console.error("Error fetching configs:", error);
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to load template settings.",
        "You don't have permission to view template settings."
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentConfig = configs[activeTab];
      
      // 1. Save to TemplateConfiguration table
      await api.post("/template-configs", {
        category: activeTab,
        template_id: currentConfig.template_id,
        logo_url: currentConfig.logo_url,
        primary_color: currentConfig.primary_color,
        footer_text: currentConfig.footer_text
      });
      
      // 2. Specialized handling for Invoice (sync back to Clinic table for legacy support)
      if (activeTab === "invoices") {
        await api.put(`/clinics/${user.clinic_id}`, {
          gst_number: configs.invoice.gst_number,
          logo_url: configs.invoice.logo_url,
          invoice_template: configs.invoice.template_id
        });
      }
      
      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} template saved!`);
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to save settings.",
        "You don't have permission to update template settings."
      ));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (category, field, value) => {
    setConfigs(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "invoice", label: "Invoices", icon: FileText },
    { id: "prescription", label: "Prescriptions", icon: Stethoscope },
    { id: "consent", label: "Consent Forms", icon: ClipboardCheck }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      <FeatureLock featureName="PDF & Invoice Templates">
      
      {/* Header Panel */}
      <div className="mb-6 flex justify-between items-end">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <span>Admin</span>
          <span>/</span>
          <span className="text-gray-900">Templates</span>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#29828a] hover:bg-[#216b71] text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Save size={18} /> Save Changes</>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-6 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.id 
                  ? "border-[#29828a] text-[#29828a]" 
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Branding Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-4">
              <Palette className="text-indigo-500" size={20} />
              Branding & Info
            </h2>
            
            <div className="space-y-4">
              {/* Common Fields */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={configs[activeTab].primary_color}
                    onChange={(e) => updateField(activeTab, "primary_color", e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-none"
                  />
                  <input
                    type="text"
                    value={configs[activeTab].primary_color}
                    onChange={(e) => updateField(activeTab, "primary_color", e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category Logo URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon className="text-gray-400" size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png"
                    value={configs[activeTab].logo_url}
                    onChange={(e) => updateField(activeTab, "logo_url", e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 italic">Leave blank to use global clinic logo.</p>
              </div>

              {/* Specialized Field for Invoice */}
              {activeTab === "invoice" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Clinic GST Number</label>
                  <input
                    type="text"
                    placeholder="29GGGGG1314R9Z6"
                    value={configs.invoice.gst_number}
                    onChange={(e) => updateField("invoice", "gst_number", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Footer Text / Disclaimer</label>
                <textarea
                  rows={4}
                  placeholder="e.g. This is a computer generated document. No signature required."
                  value={configs[activeTab].footer_text}
                  onChange={(e) => updateField(activeTab, "footer_text", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Template Selection / Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-4 mb-6">
              <Files className="text-pink-500" size={20} />
              Live Preview
            </h2>
            
            <div className="flex flex-col items-center">
              {/* Dynamic Preview for selected layout (Visual representation) */}
              <div className="w-full p-6 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Visual Context</p>
                 <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="h-1.5 w-full" style={{ backgroundColor: configs[activeTab].primary_color }}></div>
                    <div className="p-6 space-y-6">
                       <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                             {configs[activeTab].logo_url ? (
                                <img src={configs[activeTab].logo_url} alt="Preview Logo" className="w-10 h-10 object-contain" />
                             ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">
                                   <ImageIcon size={20} />
                                </div>
                             )}
                             <div className="space-y-1">
                                <div className="w-24 h-3 rounded bg-gray-100"></div>
                                <div className="w-32 h-2 rounded bg-gray-50"></div>
                             </div>
                          </div>
                          <div className="text-right space-y-1">
                             <div className="w-16 h-4 ml-auto rounded" style={{ backgroundColor: `${configs[activeTab].primary_color}20` }}></div>
                             <div className="w-20 h-2 ml-auto rounded bg-gray-50"></div>
                          </div>
                       </div>
                       
                       <div className="space-y-3">
                          <div className="w-full h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center px-3">
                             <div className="w-1/2 h-2 rounded bg-gray-200"></div>
                          </div>
                          <div className="h-32 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                                {activeTab} Content Area
                             </span>
                          </div>
                       </div>

                       <div className="pt-6 border-t border-gray-50 flex justify-between items-end">
                          <div className="w-48 text-[10px] text-gray-400 font-medium leading-relaxed italic line-clamp-2">
                             {configs[activeTab].footer_text || "Footer/Disclaimer text will appear at the bottom of the document."}
                          </div>
                          <div className="w-24 h-8 rounded-lg" style={{ backgroundColor: `${configs[activeTab].primary_color}10`, border: `1px dashed ${configs[activeTab].primary_color}` }}></div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </FeatureLock>
    </div>
  );
};

export default TemplatesManager;
