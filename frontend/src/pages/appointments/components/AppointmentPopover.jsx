import React, { useEffect, useRef } from "react";
import AppointmentDetailContent from "./AppointmentDetailContent";
import useAnchoredPosition from "../hooks/useAnchoredPosition";

/**
 * The appointment, in a card beside the one you clicked.
 *
 * The drawer this replaces held the right information in the wrong shape: the
 * eye had to travel from the card it clicked, across the grid, to a panel
 * covering a quarter of the schedule. The answer belongs where the question was
 * asked.
 *
 * Rendered inline as a sibling in Calendar.jsx rather than through a portal.
 * Nothing in this app portals, and `position: fixed` escapes all three of the
 * calendar's scroll containers on its own. It must not be rendered as a child
 * of the card, though: AppointmentCard carries `hover:brightness-95`, and a
 * filter creates a containing block for fixed descendants while hovered, which
 * would pin the panel to the card instead of the viewport.
 *
 * z-[90] sits above every grid internal (cards 10/25, sticky header 20,
 * now-line 30, drag ghost 40) but below BookingModal (100) and the cancel
 * dialog (110), which this panel's own Edit and Cancel actions open on top.
 */
const AppointmentPopover = ({ appointment, anchorId, isPhone, onClose, ...rest }) => {
  const panelRef = useRef(null);
  const open = !!appointment;
  // No anchor means a deep link opened this, so there is nothing to sit beside.
  const selector = anchorId ? `[data-appointment-id="${anchorId}"]` : null;
  const { pos, lost } = useAnchoredPosition(selector, { open: open && !isPhone, panelRef });

  // The anchor scrolled away or stopped existing.
  useEffect(() => { if (lost) onClose(); }, [lost, onClose]);

  // Escape is handled centrally in Calendar.jsx, which closes the innermost
  // layer first, so only the outside click is wired here.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    // Deferred a tick: the click that opened this is still travelling.
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('touchstart', onDown);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = <AppointmentDetailContent appointment={appointment} onClose={onClose} {...rest} />;

  // A phone has no room beside anything, so the same content comes up from the
  // bottom instead.
  if (isPhone) {
    return (
      <div className="fixed inset-0 z-[90]">
        <div className="absolute inset-0 bg-black/25" onClick={onClose} />
        <div
          ref={panelRef}
          className="absolute inset-x-0 bottom-0 max-h-[88vh] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="pt-2 pb-1 flex justify-center flex-shrink-0">
            <span className="w-9 h-1 rounded-full bg-gray-300" />
          </div>
          {content}
        </div>
      </div>
    );
  }

  if (!pos) return null;

  // Centred when a deep link opened this with no card to point at.
  const style = pos.centred
    ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 380, maxHeight: '85vh' }
    : { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight };

  return (
    // No backdrop on purpose. A transparent sheet over the calendar would
    // swallow the next click, so clicking a second appointment would close this
    // panel without opening that one. Without it, mousedown closes and the
    // click that follows opens the card underneath, which is what a calendar
    // should do. Dismissal is the document listener above.
    <div
        ref={panelRef}
        role="dialog"
        aria-label="Appointment"
        style={style}
        className="fixed z-[90] bg-white rounded-xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden animate-scale-in"
      >
        {content}
    </div>
  );
};

export default AppointmentPopover;
