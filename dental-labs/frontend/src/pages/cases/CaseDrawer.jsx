import { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { formatCurrency } from "../../utils/currency";
import { X, Save, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function CaseDrawer({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [catalog, setCatalog] = useState([]);
  
  const [form, setForm] = useState({
    client_id: "",
    doctor_name: "",
    patient_name: "",
    patient_age: "",
    patient_sex: "",
    received_date: new Date().toISOString().split("T")[0],
    due_date: "",
    priority: "normal",
    notes: "",
    items: [],
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form on open
      setForm({
        client_id: "",
        doctor_name: "",
        patient_name: "",
        patient_age: "",
        patient_sex: "",
        received_date: new Date().toISOString().split("T")[0],
        due_date: "",
        priority: "normal",
        notes: "",
        items: [],
      });
      
      Promise.all([
        api.get("/clients"),
        api.get("/products"),
      ]).then(([clientData, catalogData]) => {
        setClients(clientData.clients || []);
        setCatalog(catalogData.products || []);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { product_id: "", product_name: "", tooth_numbers: "", shade: "", material: "", qty: 1, unit_price: 0 }]
    });
  };

  const updateItem = (index, key, val) => {
    const newItems = [...form.items];
    newItems[index][key] = val;
    
    // Auto-fill product details if product_id changes
    if (key === "product_id") {
      const product = catalog.find(p => p.id.toString() === val);
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].material = product.material || "";
        newItems[index].unit_price = product.unit_price;
      }
    }
    
    setForm({ ...form, items: newItems });
  };

  const removeItem = (index) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  };

  // Tooth numbers are entered free-text ("11, 12" / "11 12"); the API wants a
  // list of ints (or null). Parse defensively so an empty box → null, not "".
  const parseTeeth = (val) => {
    if (Array.isArray(val)) return val.length ? val : null;
    if (val == null || !String(val).trim()) return null;
    const nums = String(val)
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n));
    return nums.length ? nums : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_id) { toast.error("Please select a client"); return; }
    if (form.items.length === 0) { toast.error("Please add at least one line item"); return; }
    if (form.items.some((it) => !it.product_name?.trim())) {
      toast.error("Each line item needs a product");
      return;
    }

    // Coerce every field to the type the API expects (inputs hand back strings).
    const items = form.items.map((it) => ({
      product_id: it.product_id ? Number(it.product_id) : null,
      product_name: it.product_name,
      tooth_numbers: parseTeeth(it.tooth_numbers),
      shade: it.shade || null,
      material: it.material || null,
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price) || 0,
    }));

    setLoading(true);
    try {
      const { case: newCase } = await api.post("/cases", {
        ...form,
        client_id: Number(form.client_id),
        items,
      });
      toast.success(`Case ${newCase.case_number} created`);
      onSuccess?.(newCase.id);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to create case");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = form.items.reduce((acc, item) => acc + (item.qty * item.unit_price), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-4xl w-full bg-white shadow-xl flex flex-col animate-slide-in-right">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 bg-white border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">New Case</h2>
            <p className="text-sm text-gray-500 mt-1">Register a new case to start production</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
          <form id="case-form" onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto">
            
            {/* General Info Section */}
            <div>
              <h3 className="text-base font-semibold text-[#2a276e] mb-4 border-b border-gray-100 pb-2">1. Client & Patient Info</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Client / Clinic <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    value={form.client_id} 
                    onChange={update("client_id")} 
                    required
                  >
                    <option value="">Select a clinic...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.clinic_name ? `(${c.clinic_name})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor Name</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    value={form.doctor_name} 
                    onChange={update("doctor_name")} 
                    placeholder="e.g. Dr. Smith" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Patient Name</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    value={form.patient_name} 
                    onChange={update("patient_name")} 
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    value={form.patient_age} 
                    onChange={update("patient_age")} 
                    placeholder="e.g. 45"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sex</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    value={form.patient_sex} 
                    onChange={update("patient_sex")}
                  >
                    <option value="">-</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="O">O</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div>
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                <h3 className="text-base font-semibold text-[#2a276e]">2. Products & Pricing</h3>
                <button 
                  type="button" 
                  className="flex items-center gap-1 text-sm font-semibold text-[#2a276e] hover:text-[#1a1548]" 
                  onClick={addItem}
                >
                  <Plus size={16} /> Add Product
                </button>
              </div>
              
              {form.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm font-medium">No products added</p>
                  <p className="text-xs mt-1">Click 'Add Product' to add crowns, bridges, etc.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                        <div className="col-span-2 md:col-span-4">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Product</label>
                          <select 
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                            value={item.product_id} 
                            onChange={e => updateItem(idx, "product_id", e.target.value)} 
                            required
                          >
                            <option value="">Select product...</option>
                            {catalog.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Tooth #</label>
                          <input 
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                            value={item.tooth_numbers} 
                            onChange={e => updateItem(idx, "tooth_numbers", e.target.value)} 
                            placeholder="e.g. 11, 12" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Shade / Mat</label>
                          <input 
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                            value={item.shade} 
                            onChange={e => updateItem(idx, "shade", e.target.value)} 
                            placeholder="e.g. A2" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Qty</label>
                          <input 
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                            type="number" 
                            min="1" 
                            value={item.qty} 
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Unit Price</label>
                          <input 
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                            type="number" 
                            min="0" 
                            value={item.unit_price} 
                            onChange={e => updateItem(idx, "unit_price", Number(e.target.value))} 
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="w-full md:w-10 h-[38px] flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0" 
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-4">
                    <p className="text-sm font-semibold text-gray-600 mr-4">Total Amount:</p>
                    <p className="text-xl font-bold text-[#2a276e]">{formatCurrency(totalAmount)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Section */}
            <div>
              <h3 className="text-base font-semibold text-[#2a276e] mb-4 border-b border-gray-100 pb-2">3. Timeline & Notes</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Received Date <span className="text-red-500">*</span></label>
                  <input 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    type="date" 
                    value={form.received_date} 
                    onChange={update("received_date")} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date <span className="text-red-500">*</span></label>
                  <input 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    type="date" 
                    value={form.due_date} 
                    onChange={update("due_date")} 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" 
                    value={form.priority} 
                    onChange={update("priority")}
                  >
                    <option value="normal">Normal</option>
                    <option value="rush">Rush</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Instructions</label>
                <textarea 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all resize-y" 
                  value={form.notes} 
                  onChange={update("notes")} 
                  rows={3} 
                  placeholder="Any special instructions from the prescription..." 
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-white flex justify-end gap-3 mt-auto">
          <button 
            type="button" 
            className="px-6 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="case-form"
            className="flex items-center justify-center gap-2 px-8 py-2.5 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm disabled:opacity-50" 
            disabled={loading}
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={16} />}
            {loading ? "Creating..." : "Create Case"}
          </button>
        </div>
      </div>
    </div>
  );
}
