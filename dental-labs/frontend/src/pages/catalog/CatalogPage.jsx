/**
 * CatalogPage — manage products/services. Inline price editing, a "needs pricing"
 * nudge, search, and per-row delete so a new lab can price its catalog in minutes.
 */
import { useState, useEffect, useMemo } from "react";
import { api } from "../../utils/api";
import { formatCurrency, getCurrencySymbol } from "../../utils/currency";
import { PRODUCT_CATEGORIES } from "../../utils/constants";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Plus, Package, Edit2, X, Trash2, Search, AlertTriangle, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", category: "crown", material: "", unit_price: 0, default_turnaround_days: 5 });

  // Inline price editing
  const [priceEditId, setPriceEditId] = useState(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [savingId, setSavingId] = useState(null);

  const loadProducts = async () => {
    try {
      const data = await api.get("/products");
      setProducts(data.products || []);
    } catch {
      toast.error("Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const openNew = () => {
    setForm({ name: "", category: "crown", material: "", unit_price: 0, default_turnaround_days: 5 });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setForm({ name: p.name, category: p.category, material: p.material || "", unit_price: p.unit_price, default_turnaround_days: p.default_turnaround_days });
    setEditingId(p.id);
    setShowModal(true);
  };

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, unit_price: Number(form.unit_price), default_turnaround_days: Number(form.default_turnaround_days) };
    try {
      if (editingId) {
        const { product } = await api.put(`/products/${editingId}`, payload);
        setProducts((ps) => ps.map((p) => (p.id === editingId ? product : p)));
        toast.success("Product updated");
      } else {
        const { product } = await api.post("/products", payload);
        setProducts((ps) => [...ps, product]);
        toast.success("Product added");
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const startPriceEdit = (p) => {
    setPriceEditId(p.id);
    setPriceDraft(p.unit_price ? String(p.unit_price) : "");
  };

  const savePrice = async (p) => {
    const value = Number(priceDraft);
    setPriceEditId(null);
    if (isNaN(value) || value === p.unit_price) return;
    setSavingId(p.id);
    try {
      const { product } = await api.put(`/products/${p.id}`, { unit_price: value });
      setProducts((ps) => ps.map((x) => (x.id === p.id ? product : x)));
    } catch (err) {
      toast.error(err.message || "Couldn't update price");
    } finally {
      setSavingId(null);
    }
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from your catalog?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      setProducts((ps) => ps.filter((x) => x.id !== p.id));
      toast.success("Product removed");
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  };

  const unpricedCount = useMemo(() => products.filter((p) => !p.unit_price).length, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyUnpriced && p.unit_price) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.material || "").toLowerCase().includes(q);
    });
  }, [products, search, onlyUnpriced]);

  const grouped = useMemo(() => visible.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {}), [visible]);

  const sym = getCurrencySymbol();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} products · click any price to edit it inline.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-[#2a276e] text-white text-sm font-semibold rounded-lg hover:bg-[#1a1548] transition-colors shadow-sm">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Needs-pricing nudge */}
      {!loading && unpricedCount > 0 && (
        <button
          onClick={() => setOnlyUnpriced((v) => !v)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
            onlyUnpriced ? "bg-amber-100 border-amber-300" : "bg-amber-50 border-amber-200 hover:bg-amber-100"
          }`}
        >
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800 flex-1">
            <strong>{unpricedCount}</strong> {unpricedCount === 1 ? "product needs" : "products need"} a price before you can bill them.
          </span>
          <span className="text-xs font-semibold text-amber-700">{onlyUnpriced ? "Show all" : "Show these"}</span>
        </button>
      )}

      {/* Search */}
      {!loading && products.length > 0 && (
        <div className="w-full md:max-w-sm relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search products or materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all"
          />
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
          <Package size={48} className="opacity-40 text-[#2a276e] mb-4" />
          <h3 className="text-base font-semibold text-gray-900">Catalog is empty</h3>
          <p className="text-sm mt-2">Add your first crown or bridge</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
          <Search size={40} className="opacity-40 text-[#2a276e] mb-4" />
          <h3 className="text-base font-semibold text-gray-900">No matches</h3>
          <p className="text-sm mt-2">Try a different search{onlyUnpriced ? " or show all products" : ""}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {PRODUCT_CATEGORIES.map((cat) => {
            const group = grouped[cat.value];
            if (!group || group.length === 0) return null;
            return (
              <div key={cat.value}>
                <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{cat.label}</h2>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turnaround</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Default Price</th>
                          <th className="px-6 py-3 w-[100px]"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {group.map((p) => (
                          <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors duration-150 group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.material || "-"}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.default_turnaround_days} days</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              {priceEditId === p.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-gray-400">{sym}</span>
                                  <input
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={priceDraft}
                                    onChange={(e) => setPriceDraft(e.target.value)}
                                    onBlur={() => savePrice(p)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") savePrice(p);
                                      if (e.key === "Escape") setPriceEditId(null);
                                    }}
                                    className="w-24 px-2 py-1 border border-[#2a276e] rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20"
                                  />
                                </div>
                              ) : savingId === p.id ? (
                                <span className="inline-flex items-center gap-1 text-gray-400"><Check size={13} /> saving…</span>
                              ) : p.unit_price ? (
                                <button onClick={() => startPriceEdit(p)} className="font-semibold text-gray-900 hover:text-[#2a276e] hover:underline decoration-dotted underline-offset-4">
                                  {formatCurrency(p.unit_price)}
                                </button>
                              ) : (
                                <button onClick={() => startPriceEdit(p)} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                                  Set price
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => openEdit(p)} title="Edit">
                                  <Edit2 size={15} />
                                </button>
                                <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => deleteProduct(p)} title="Remove">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowModal(false)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10" aria-label="Close">
              <X size={18} />
            </button>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? "Edit Product" : "New Product"}</h2>
            </div>
            <div className="px-6 py-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" value={form.name} onChange={update("name")} required placeholder="e.g. Zirconia Crown" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                    <select className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" value={form.category} onChange={update("category")}>
                      {PRODUCT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
                    <input className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" value={form.material} onChange={update("material")} placeholder="e.g. Zirconia" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Price</label>
                    <input className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" type="number" min="0" step="0.01" value={form.unit_price} onChange={update("unit_price")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Turnaround (Days)</label>
                    <input className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 focus:border-[#2a276e] transition-all" type="number" min="1" value={form.default_turnaround_days} onChange={update("default_turnaround_days")} />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" className="px-4 py-2.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2.5 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] transition-colors shadow-sm">Save Product</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
