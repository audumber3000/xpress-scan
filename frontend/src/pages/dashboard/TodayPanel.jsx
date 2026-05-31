import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, FlaskConical, UserX, CalendarClock, ChevronRight, CheckCircle2 } from 'lucide-react';
import GearLoader from '../../components/GearLoader';
import { getCurrencySymbol } from '../../utils/currency';

const STATUS_STYLES = {
  completed: 'bg-green-100 text-green-700',
  confirmed: 'bg-blue-100 text-blue-700',
  checking: 'bg-[#9B8CFF]/20 text-[#2a276e]',
  accepted: 'bg-[#9B8CFF]/20 text-[#2a276e]',
  'no-show': 'bg-red-100 text-red-700',
  'no_show': 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const StatusBadge = ({ status }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
    {String(status).replace('_', '-')}
  </span>
);

const Schedule = ({ summary, appointments }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-[#f0f0fd] rounded-lg text-[#2a276e]"><CalendarClock size={18} /></div>
        <h3 className="font-bold text-gray-900 text-lg">Today's Schedule</h3>
      </div>
      {summary && (
        <span className="text-xs font-semibold text-gray-500">
          {summary.total} total · {summary.completed} done · {summary.remaining} left
        </span>
      )}
    </div>

    {appointments.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <CalendarClock size={28} className="text-gray-200 mb-2" />
        <p className="text-sm font-medium text-gray-400">No appointments today</p>
      </div>
    ) : (
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {appointments.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50/60">
            <div className="w-14 text-xs font-bold text-[#2a276e] tabular-nums">{a.time || '—'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
              {a.treatment && <p className="text-xs text-gray-500 truncate">{a.treatment}</p>}
            </div>
            <StatusBadge status={a.status} />
          </div>
        ))}
      </div>
    )}
  </div>
);

const AttentionTile = ({ icon: Icon, label, value, sub, tone, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:shadow-sm ${tone}`}
  >
    <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0">
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold leading-tight">{value}</p>
      <p className="text-xs opacity-80 truncate">{label}{sub ? ` · ${sub}` : ''}</p>
    </div>
    <ChevronRight size={16} className="opacity-50 flex-shrink-0" />
  </button>
);

const NeedsAttention = ({ attention }) => {
  const navigate = useNavigate();
  const cur = getCurrencySymbol();
  const dues = attention?.outstanding_dues || { count: 0, amount: 0 };
  const labs = attention?.overdue_labs || 0;
  const noShows = attention?.no_shows_today || 0;
  const allClear = dues.count === 0 && labs === 0 && noShows === 0;

  return (
    <div className="md:w-72 flex-shrink-0 border-t border-gray-100 pt-5 md:border-t-0 md:pt-0 md:border-l md:pl-6">
      <h3 className="font-bold text-gray-900 text-lg mb-4">Needs attention</h3>
      {allClear ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 size={28} className="text-green-400 mb-2" />
          <p className="text-sm font-medium text-gray-500">All clear — nothing pending 🎉</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dues.count > 0 && (
            <AttentionTile
              icon={Wallet}
              tone="bg-amber-50 border-amber-200 text-amber-800"
              value={`${cur}${Number(dues.amount).toLocaleString('en-US')} outstanding`}
              label={`${dues.count} unpaid ${dues.count === 1 ? 'invoice' : 'invoices'}`}
              onClick={() => navigate('/payments')}
            />
          )}
          {labs > 0 && (
            <AttentionTile
              icon={FlaskConical}
              tone="bg-red-50 border-red-200 text-red-700"
              value={`${labs} overdue lab ${labs === 1 ? 'case' : 'cases'}`}
              label="Past due date"
              onClick={() => navigate('/lab')}
            />
          )}
          {noShows > 0 && (
            <AttentionTile
              icon={UserX}
              tone="bg-rose-50 border-rose-200 text-rose-700"
              value={`${noShows} no-${noShows === 1 ? 'show' : 'shows'} today`}
              label="Follow up to rebook"
              onClick={() => navigate('/calendar')}
            />
          )}
        </div>
      )}
    </div>
  );
};

const TodayPanel = ({ data, loading }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm mb-6">
    {loading ? (
      <div className="flex items-center justify-center min-h-[160px]"><GearLoader size="w-10 h-10" /></div>
    ) : (
      <div className="flex flex-col md:flex-row gap-6">
        <Schedule summary={data?.summary} appointments={data?.appointments || []} />
        <NeedsAttention attention={data?.attention} />
      </div>
    )}
  </div>
);

export default TodayPanel;
