import React from 'react';
import { Check, FileText, Pencil, Plus, Minus, Ticket, Undo2 } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatTime } from '../../../utils/datetime';
import { SLATE, INDIGO, OCHRE, GREEN, RUST, tint } from '../../common/timelineTones';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One thing that happened to the bill.
 *
 * Drawn as the same element as the patient file's activity feed: a solid dot in
 * the category's tone, the time as the heading, and the event named in a tinted
 * badge opposite it. The two feeds answer the same question and used to look
 * like they came from different products — this one had outlined rings in
 * Tailwind's -50/-600 pairs, which read as alerts next to the muted dots on the
 * patient card.
 *
 * The heading is the time, not the label, and that is what makes the badge
 * work here. An earlier pass removed a badge from this row because it repeated
 * the heading word for word — "Payment received" above "Payment received". With
 * the day already named by the section header above and the time as the
 * heading, the badge is the only thing saying what kind of event it is, so it
 * earns its place instead of echoing.
 *
 * Everything else stays one dotted line: method, reference, who. Stacked as
 * labelled rows it turned a six-event history into a screenful.
 */
const KINDS = {
  payment:           { Icon: Check,    tone: GREEN },
  created:           { Icon: FileText, tone: INDIGO },
  finalized:         { Icon: FileText, tone: INDIGO },
  // The bookkeeping edits. Grey because nobody reads them unless they are
  // hunting for something, and colouring them competes with the money.
  updated:           { Icon: Pencil,   tone: SLATE },
  line_item_added:   { Icon: Plus,     tone: SLATE },
  line_item_updated: { Icon: Pencil,   tone: SLATE },
  // Taken back, which is the distinction worth a colour of its own: a reversed
  // payment and a recorded one must never be mistaken for each other.
  line_item_deleted: { Icon: Minus,    tone: RUST },
  payment_deleted:   { Icon: Undo2,    tone: RUST },
  discount_removed:  { Icon: Ticket,   tone: OCHRE },
};
const FALLBACK = { Icon: Pencil, tone: SLATE };

const TimelineEvent = ({ event, last }) => {
  const { Icon, tone } = KINDS[event.kind] || FALLBACK;
  const isPayment = event.kind === 'payment';
  const when = event.at || event.on;

  // One dotted line, as on the patient card. The note is part of it rather
  // than a row of its own: a payment note is usually four words, and giving it
  // its own line made a six-event history a screenful.
  const detail = [
    event.method,
    event.reference ? `Ref ${event.reference}` : null,
    event.note,
  ].filter(Boolean).join(' · ');

  return (
    <li className="relative pl-8 pb-4 last:pb-0">
      {!last && <span className="absolute left-[11px] top-7 bottom-0 w-px bg-gray-200" aria-hidden="true" />}
      <span
        className="absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: tone }}
        aria-hidden="true"
      >
        <Icon size={12} strokeWidth={2.5} />
      </span>

      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate">
          {/* The day is already the section heading above, so this is the time
              alone. An entry with no time recorded says so rather than
              inventing midnight. */}
          {when ? formatTime(when) : <span className="font-medium text-gray-500">Time not recorded</span>}
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: tint(tone), color: tone }}
          title={event.label}
        >
          {event.label}
        </span>
      </div>

      {event.amount != null && (
        <p
          className="text-xs font-bold tabular-nums mt-0.5"
          style={{ color: isPayment ? GREEN : '#374151' }}
        >
          {isPayment ? '+' : ''}{money(event.amount)}
        </p>
      )}

      {detail && (
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={detail}>{detail}</p>
      )}

      {/* Kept on its own line, as on the patient card: who did it is the thing
          somebody is looking for when they open a bill's history at all. */}
      {event.by && (
        <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={`${event.by_verb || 'By'} ${event.by}`}>
          {event.by_verb || 'By'} {event.by}
        </p>
      )}
    </li>
  );
};

export default TimelineEvent;
