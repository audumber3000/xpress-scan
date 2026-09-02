import React from 'react';
import { Check, FileText, Pencil, Plus, Minus, Ticket, Undo2 } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatTime } from '../../../utils/datetime';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One thing that happened to the bill.
 *
 * The kind drives an icon, not a badge. This row used to carry a pill beside the
 * timestamp that repeated the heading word for word — "Payment received" above
 * "Payment received" — which is noise dressed as information. The icon already
 * says what kind of event it is and the heading already names it.
 *
 * Everything else about the event is one dotted line: time, method, reference,
 * who. Stacked as four labelled rows it turned a six-event history into a
 * screenful.
 */
const ICONS = {
  payment:           { Icon: Check,    ring: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  created:           { Icon: FileText, ring: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  finalized:         { Icon: FileText, ring: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  updated:           { Icon: Pencil,   ring: 'bg-gray-50 text-gray-400 border-gray-200' },
  line_item_added:   { Icon: Plus,     ring: 'bg-gray-50 text-gray-400 border-gray-200' },
  line_item_updated: { Icon: Pencil,   ring: 'bg-gray-50 text-gray-400 border-gray-200' },
  line_item_deleted: { Icon: Minus,    ring: 'bg-red-50 text-red-500 border-red-200' },
  discount_removed:  { Icon: Ticket,   ring: 'bg-amber-50 text-amber-600 border-amber-200' },
  payment_deleted:   { Icon: Undo2,    ring: 'bg-red-50 text-red-500 border-red-200' },
};
const FALLBACK = { Icon: Pencil, ring: 'bg-gray-50 text-gray-400 border-gray-200' };

const TimelineEvent = ({ event, last }) => {
  const { Icon, ring } = ICONS[event.kind] || FALLBACK;
  const isPayment = event.kind === 'payment';

  const when = event.at || event.on;
  const detail = [
    when ? formatTime(when) : null,
    event.method,
    event.reference ? `Ref ${event.reference}` : null,
    event.by,
  ].filter(Boolean).join(' · ');

  return (
    <li className="relative pl-7 pb-3 last:pb-0">
      {!last && <span className="absolute left-[10px] top-6 bottom-0 w-px bg-gray-200" aria-hidden="true" />}
      <span className={`absolute left-0 top-0 w-5 h-5 rounded-full border flex items-center justify-center ${ring}`} aria-hidden="true">
        <Icon size={11} strokeWidth={2.5} />
      </span>

      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900 truncate" title={event.label}>{event.label}</p>
        {event.amount != null && (
          <span className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${isPayment ? 'text-emerald-600' : 'text-gray-500'}`}>
            {isPayment ? '+' : ''}{money(event.amount)}
          </span>
        )}
      </div>

      {detail && <p className="text-[11px] text-gray-500 mt-0.5 truncate" title={detail}>{detail}</p>}
      {event.note && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={event.note}>{event.note}</p>}
    </li>
  );
};

export default TimelineEvent;
