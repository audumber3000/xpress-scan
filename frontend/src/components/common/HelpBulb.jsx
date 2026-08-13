import React, { useState, useEffect } from 'react';
import { Lightbulb, X, PlayCircle, ChevronDown } from 'lucide-react';

/**
 * The help affordance that sits at the right-hand end of a section's tab row.
 *
 * One component for every section: the tabs differ, the shape of "how does this
 * work" does not. Content is keyed by section in HELP_CONTENT below, so adding
 * help to a new screen is a data change, not a component.
 *
 * The video is a placeholder until the real ones are recorded. It renders as an
 * obvious placeholder rather than a broken embed, so nobody ships it thinking
 * the video is live.
 */

export const HELP_CONTENT = {
  dashboard: {
    title: 'Your dashboard',
    blurb: 'Every number here answers a question, not just a count.',
    faqs: [
      { q: 'Why does the filter start on All time?',
        a: 'So the dashboard opens on your whole story rather than a month-to-date window that reads near-empty on the 1st. Change it from the dropdown at the top right and every card and chart follows.' },
      { q: 'What does Outstanding mean?',
        a: 'Money already billed on finalised invoices that has not been collected. It is deliberately not affected by the time filter: what you are owed is owed whichever window you are looking at.' },
      { q: 'Why is a large slice of Patients by gender "Not recorded"?',
        a: 'Gender is optional on the intake form. Anything not filled in is counted honestly rather than hidden, so the slices always add up to your real patient count.' },
    ],
  },
  payments: {
    title: 'Payments',
    blurb: 'What you have collected, what is still owed, and how the money arrives.',
    faqs: [
      { q: 'Collected is higher than my old Total Revenue. Why?',
        a: 'Total Revenue only counted invoices marked fully paid. Collected counts every rupee actually received, including part payments against bills that are still open. The old figure was understating you.' },
      { q: 'What is a payment plan?',
        a: 'Any invoice that has taken more than one instalment. The card shows how many are still running and how long a typical plan is, so you can spot the ones that have stalled.' },
      { q: 'Do the cards follow my filters?',
        a: 'Yes. Narrow to one patient, one status or one date range and the cards describe exactly the rows shown underneath them.' },
    ],
  },
  lab: {
    title: 'Lab work',
    blurb: 'Cases out with the lab, how long they take, and what they cost you.',
    faqs: [
      { q: 'How is turnaround worked out?',
        a: 'From when the order was raised to when it was last updated. Treat it as a guide rather than a contract: editing an old order will move its apparent turnaround.' },
      { q: 'What does "unbilled" mean on Lab spend?',
        a: 'Lab work you paid for that was never charged on to a patient. That is cost the clinic absorbed, so it is worth checking before it becomes a habit.' },
      { q: 'Where do lab bills show up in my accounts?',
        a: 'Entering a cost on a lab order creates a payable under Inventory, Payables. Marking it paid records it as an expense, which is when it reaches Activity and your net.' },
    ],
  },
  inventory: {
    title: 'Inventory',
    blurb: 'What is on the shelf, what needs reordering, and what you owe.',
    faqs: [
      { q: 'Why is there no stock value?',
        a: 'Stock value needs a unit price on every item. Until they all have one, a value card would confidently report a number that is mostly zeroes. Add prices and the card appears on its own.' },
      { q: 'Expiring says 0. Is my stock fine?',
        a: 'Only if your items have expiry dates recorded. If none do, the check has nothing to test and stays silent. The Needs attention card tells you which of the two it is.' },
      { q: 'Where did Payables go?',
        a: 'To the Expenses section, beside the ledger they feed. A lab bill is money you owe, not stock on a shelf, so it belongs with the rest of your outgoings. Inventory keeps its own Activity tab for stock movement.' },
    ],
  },
  expenses: {
    title: 'Expenses',
    blurb: 'What you owe, what you have spent, and who you pay it to.',
    faqs: [
      { q: 'Why does an Expenses screen show money coming in?',
        a: 'Because what went out only means something next to what came in. Hide the other half and a net position turns into a list of outgoings you cannot judge. The Ledger tab carries both, and Payments is still where collections are worked on.' },
      { q: 'Where do lab bills come from?',
        a: 'Putting a cost on a lab order raises a payable here automatically. That cost is what the lab charges you, and it is a separate number from whatever you charged the patient for the same work. Nothing on this page ever changes what a patient owes.' },
      { q: 'What happens when I mark a payable paid?',
        a: 'It is recorded as an expense, which is what puts it into the Ledger, the CSV export and the dashboard Net card. Get one wrong and Undo removes both the payment and its expense.' },
      { q: 'Why is a consultant listed under Vendors?',
        a: 'A visiting doctor is somebody you pay, the same as a lab. Giving them a vendor record with the Consultant category is what lets their fee be owed, settled and reported without a second system to keep in step.' },
    ],
  },
  patients: {
    title: 'Patients',
    blurb: 'Your patient list, daily register and imports.',
    faqs: [
      { q: 'What is the difference between Standard and Special Request import?',
        a: 'Standard takes our patient template. Special Request holds importers we have built for a specific clinic sheet, such as an invoice ledger export.' },
      { q: 'Will importing create duplicates?',
        a: 'The invoice importer creates fresh patients and does not match against your existing records, so anyone already in MolarPlus will appear twice. The preview tells you how many will be created before you commit.' },
      { q: 'Why do some imported patients have the number 0000000000?',
        a: 'Their sheet had no phone column and a number is required. Replace them before sending reminders, otherwise those messages will be attempted and fail.' },
    ],
  },
  settings: {
    title: 'Control Center',
    blurb: 'Staff, treatments, templates and everything clinic-wide.',
    faqs: [
      { q: 'What does a consultant fee do?',
        a: 'Set a doctor’s fee once on their staff record and it is applied automatically to every case they treat. Nobody types an amount per case, which is what makes the per-consultant split reliable.' },
      { q: 'Fixed or percentage?',
        a: 'Percentage is worked out on what the patient has actually paid, not what was billed, so you never owe a consultant money you have not received.' },
      { q: 'Does changing a rate affect past cases?',
        a: 'No. Each fee stores the amount worked out at the time, so last month stays as it was.' },
    ],
  },
};

const HelpBulb = ({ section, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const content = HELP_CONTENT[section];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!content) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="How this works"
        aria-label="How this works"
        className={`flex-shrink-0 w-9 h-9 grid place-items-center rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors ${className}`}
      >
        <Lightbulb size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          {/* Bottom sheet on a phone, side drawer from sm up — same shell as
              every other drawer in the app. */}
          <div className="absolute inset-x-0 bottom-0 top-14 rounded-t-2xl sm:rounded-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 w-full sm:max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 grid place-items-center flex-shrink-0">
                  <Lightbulb size={16} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 leading-tight">{content.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{content.blurb}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Placeholder, and looks like one on purpose. A broken embed
                  would read as a bug; this reads as "not recorded yet". */}
              <div className="aspect-video rounded-xl bg-gray-100 border border-dashed border-gray-300 grid place-items-center mb-5">
                <div className="text-center px-4">
                  <PlayCircle size={30} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-500">Walkthrough video</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Coming soon</p>
                </div>
              </div>

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                Common questions
              </h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {content.faqs.map((f, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div key={f.q} className="border-b border-gray-100 last:border-0">
                      <button
                        onClick={() => setOpenFaq(isOpen ? -1 : i)}
                        className="w-full flex items-center gap-2 px-4 py-3 min-h-[2.75rem] text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="flex-1 text-xs font-semibold text-gray-900">{f.q}</span>
                        <ChevronDown
                          size={15}
                          className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <p className="px-4 pb-3 text-xs text-gray-600 leading-relaxed">{f.a}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-400 mt-4 text-center">
                Still stuck? Reach the team from Support Center in the sidebar.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpBulb;
