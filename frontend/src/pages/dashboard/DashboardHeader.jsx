import React, { useState } from 'react';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const today = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
];

const periodLabel = (value) => PERIODS.find((p) => p.value === value)?.label || 'All time';

const DashboardHeader = ({ ownerName, period, onPeriodChange }) => {
  const [exporting, setExporting] = useState(false);

  /**
   * Pull the CSV as a blob rather than pointing the browser at the URL.
   * The export endpoint needs the Authorization header, which a plain
   * window.open or <a download> can't send — that would just bounce to a 401.
   * Same shape as components/payments/ExportModal.jsx.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${baseURL}/api/v1/dashboard/export?period=${period}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `dashboard-${period}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      toast.error(e?.message || 'Could not export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mb-4 md:mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-bold text-[#2a276e] tracking-tight truncate">
            {greeting()}{ownerName ? `, ${ownerName}` : ''} 👋
          </h1>
          <p className="text-xs md:text-sm text-gray-500 font-medium mt-0.5 truncate">
            {today()} · here's how your clinic is doing
          </p>
        </div>

        {/* Full-width and thumb-reachable on a phone, inline on wider screens. */}
        <div className="flex items-stretch gap-2 flex-shrink-0">
          <div className="relative flex-1 md:flex-none">
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              aria-label="Time period"
              className="w-full md:w-auto appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-9 py-2.5 min-h-[2.75rem] text-sm font-semibold text-gray-700 cursor-pointer hover:border-[#2a276e]/40 focus:outline-none focus:ring-2 focus:ring-[#2a276e]/20 transition-colors"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-3.5 md:px-4 py-2.5 min-h-[2.75rem] rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#231f5e] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title={`Export ${periodLabel(period).toLowerCase()} as CSV`}
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">{exporting ? 'Exporting' : 'Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
