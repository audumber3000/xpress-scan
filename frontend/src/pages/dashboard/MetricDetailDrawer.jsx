import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Phone, MapPin, Stethoscope, Clock, CalendarDays, IndianRupee, Armchair, ArrowRight } from 'lucide-react';
import GearLoader from '../../components/GearLoader';
import { getCurrencySymbol } from '../../utils/currency';
import { formatToK } from './format';

const PERIOD_LABEL = { today: 'Today', yesterday: 'Yesterday', '7days': 'Last 7 days', month: 'This month', all: 'All time' };

// "View all" target per metric → opens the matching full section.
const VIEW_ALL = {
  'Total Patients': { to: '/patients', label: 'View all patients' },
  Appointments:     { to: '/calendar', label: 'View all appointments' },
  Revenue:          { to: '/payments', label: 'View all payments' },
};

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const fmtDate = (iso, withTime = false) => {
  if (!iso) return '';
  const opts = { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) };
  return new Date(iso).toLocaleDateString('en-US', opts);
};

const Badge = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-50 text-green-700 border border-green-100',
    amber: 'bg-amber-50 text-amber-700 border border-amber-100',
    red: 'bg-red-50 text-red-600 border border-red-100',
    violet: 'bg-[#9B8CFF]/15 text-[#2a276e] border border-[#9B8CFF]/30',
    blue: 'bg-blue-50 text-blue-700 border border-blue-100',
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tones[tone] || tones.gray}`}>{children}</span>;
};

const Chip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
    <Icon size={13} className="text-gray-400" /> {children}
  </span>
);

const Avatar = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-[#f0f0fd] text-[#2a276e] font-bold text-sm flex items-center justify-center flex-shrink-0">
    {initials(name)}
  </div>
);

const PAYMENT_TONE = { success: 'green', paid: 'green', pending: 'amber', failed: 'red', refunded: 'gray' };
const APPT_TONE = { completed: 'green', confirmed: 'blue', scheduled: 'violet', cancelled: 'red', 'no-show': 'red', no_show: 'red', missed: 'red' };

const PatientRow = ({ item }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-[#9B8CFF]/40 hover:shadow-sm transition-all">
    <div className="flex items-center gap-3">
      <Avatar name={item.name} />
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-gray-900 truncate">{item.name || `Patient #${item.id}`}</h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {(item.age || item.gender) && <Chip icon={User}>{[item.age && `${item.age}y`, item.gender].filter(Boolean).join(' · ')}</Chip>}
          {item.phone && <Chip icon={Phone}>{item.phone}</Chip>}
          {item.village && <Chip icon={MapPin}>{item.village}</Chip>}
        </div>
      </div>
      {item.created_at && <span className="text-[11px] text-gray-400 flex-shrink-0">{fmtDate(item.created_at)}</span>}
    </div>
    {item.treatment_type && (
      <div className="mt-2.5"><Badge tone="violet">{item.treatment_type}</Badge></div>
    )}
  </div>
);

const AppointmentRow = ({ item }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-[#9B8CFF]/40 hover:shadow-sm transition-all">
    <div className="flex items-center gap-3">
      <Avatar name={item.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900 truncate">{item.name || 'Patient'}</h4>
          {item.status && <Badge tone={APPT_TONE[String(item.status).toLowerCase()] || 'gray'}>{item.status}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {item.time && <Chip icon={Clock}>{item.time}</Chip>}
          {item.doctor_name && <Chip icon={Stethoscope}>{item.doctor_name}</Chip>}
          {item.phone && <Chip icon={Phone}>{item.phone}</Chip>}
        </div>
      </div>
    </div>
    {item.treatment_type && (
      <div className="mt-2.5"><Badge tone="violet">{item.treatment_type}</Badge></div>
    )}
  </div>
);

const RevenueRow = ({ item, cur }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-[#9B8CFF]/40 hover:shadow-sm transition-all flex items-center gap-3">
    <Avatar name={item.patient_name} />
    <div className="min-w-0 flex-1">
      <h4 className="font-semibold text-gray-900 truncate">{item.patient_name}</h4>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
        {item.payment_method && <Chip icon={IndianRupee}>{item.payment_method}</Chip>}
        {item.created_at && <Chip icon={CalendarDays}>{fmtDate(item.created_at)}</Chip>}
      </div>
    </div>
    <div className="text-right flex-shrink-0">
      <div className="font-bold text-gray-900">{cur}{Number(item.amount).toLocaleString('en-IN')}</div>
      {item.status && <div className="mt-1"><Badge tone={PAYMENT_TONE[String(item.status).toLowerCase()] || 'gray'}>{item.status}</Badge></div>}
    </div>
  </div>
);

const ChairsView = ({ data }) => {
  const chairs = data?.chairs || [];
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-[#2a276e]">{data.utilization_percent ?? 0}%</div>
          <div className="text-xs text-gray-500 mt-0.5">Utilization</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{data.chairs_occupied ?? 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">In use</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-400">{data.chairs_idle ?? 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">Idle</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {chairs.map((c) => {
          const occupied = c.status === 'occupied';
          return (
            <div key={c.chair_number} className="bg-white border border-gray-100 rounded-xl p-3.5 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${occupied ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                <Armchair size={18} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Chair {c.chair_number}</h4>
                {occupied && c.patient_name && <p className="text-xs text-gray-500">{c.patient_name}</p>}
              </div>
              <div className="text-right">
                <Badge tone={occupied ? 'green' : 'gray'}>{occupied ? 'Occupied' : 'Idle'}</Badge>
                {occupied && c.active_time && <div className="text-[11px] text-gray-400 mt-1">{c.active_time}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MetricDetailDrawer = ({ metric, data, loading, period, onClose }) => {
  const navigate = useNavigate();
  if (!metric) return null;
  const cur = getCurrencySymbol();
  const title = metric.title;
  const viewAll = VIEW_ALL[title];

  const goViewAll = () => {
    onClose();
    navigate(viewAll.to);
  };
  const isPatients = title === 'Total Patients';
  const isAppointments = title === 'Appointments';
  const isRevenue = title === 'Revenue';
  const isChairs = title === 'Checking';

  const items = Array.isArray(data) ? data : [];
  const isEmpty = isChairs ? !(data && data.total_chairs) : items.length === 0;

  // Header summary stat + footer count, per metric.
  let summary = '';
  let footer = '';
  if (isRevenue) {
    const total = items.reduce((s, p) => s + Number(p.amount || 0), 0);
    summary = `${cur}${formatToK(total)} collected`;
    footer = `${items.length} ${items.length === 1 ? 'payment' : 'payments'}`;
  } else if (isChairs) {
    summary = data?.total_chairs ? `${data.chairs_occupied}/${data.total_chairs} chairs in use` : '';
    footer = data?.total_chairs ? `${data.total_chairs} chairs` : '';
  } else {
    summary = `${items.length} ${items.length === 1 ? 'record' : 'records'}`;
    footer = summary;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-gray-50 shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-[#2a276e] to-[#403bb1] text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-sm text-white/70 mt-0.5">{PERIOD_LABEL[period] || 'Details'}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-full transition">
              <X size={22} />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            {!loading && !isEmpty && summary ? (
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/15 text-sm font-semibold">
                {summary}
              </div>
            ) : <span />}
            {viewAll && (
              <button
                onClick={goViewAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-[#2a276e] text-sm font-semibold hover:bg-white/90 transition shadow-sm"
              >
                {viewAll.label} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-64"><GearLoader size="w-12 h-12" /></div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <p className="text-lg font-medium">No data available</p>
              <p className="text-sm mt-1">Nothing to show for {(PERIOD_LABEL[period] || 'this period').toLowerCase()}.</p>
            </div>
          ) : isChairs ? (
            <ChairsView data={data} />
          ) : (
            <div className="space-y-2.5">
              {items.map((item, idx) =>
                isPatients ? <PatientRow key={item.id || idx} item={item} />
                : isAppointments ? <AppointmentRow key={item.id || idx} item={item} />
                : isRevenue ? <RevenueRow key={item.id || idx} item={item} cur={cur} />
                : null
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center">
          <span className="text-sm text-gray-500">{!loading && !isEmpty ? footer : ''}</span>
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm">Close</button>
        </div>
      </div>
    </div>
  );
};

export default MetricDetailDrawer;
