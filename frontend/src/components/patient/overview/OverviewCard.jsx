import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * The shell every Overview card sits in.
 *
 * Border only, never a shadow — that is the house rule for cards, and it is
 * what keeps eight of these on one screen from looking like a pile of paper.
 *
 * `onOpen` renders the one link out. Every card here is a summary of a tab, and
 * none of them owns editing: the moment a card starts saving things it becomes
 * a second implementation of the tab it summarises, and the two drift.
 */
const OverviewCard = ({ title, action, onOpen, headerExtra, children, className = '' }) => (
  <section className={`bg-white border border-gray-200 rounded-xl ${className}`}>
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
      <h3 className="text-sm font-bold text-gray-800 tracking-tight truncate">{title}</h3>
      {/* A control that belongs to the card rather than to the link out, like
          the chart's Adult/Child switch. */}
      {headerExtra}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2a276e] hover:underline cursor-pointer flex-shrink-0"
        >
          {action || 'View all'}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
    {children}
  </section>
);

/**
 * What a card shows when there is nothing to show.
 *
 * Spelled out rather than left blank: an empty card and a card that failed to
 * load look identical, and on a clinical screen the reader has to be able to
 * tell "nothing recorded" from "something went wrong".
 */
export const OverviewEmpty = ({ children, action, onAction }) => (
  <div className="px-4 py-8 text-center">
    <p className="text-xs text-gray-500">{children}</p>
    {action && (
      <button
        type="button"
        onClick={onAction}
        className="mt-2 text-[11px] font-semibold text-[#2a276e] hover:underline cursor-pointer"
      >
        {action}
      </button>
    )}
  </div>
);

export default OverviewCard;
