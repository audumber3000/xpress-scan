import React from 'react';
import { X, CheckSquare } from 'lucide-react';
import { universalToFDI } from '../../utils/toothNumbering';
import { modKeyLabel } from '../../utils/platform';
import { QUADRANTS } from './useToothSelection';

/**
 * The group-selection controls, and a plain statement of what is selected.
 *
 * The statement matters more than the buttons. A doctor about to apply a fee to
 * a selection needs to see the selection written out — "16, 15, 14, 13" — not
 * infer it from four highlighted shapes and hope they counted right.
 */
const CHIP =
  'h-7 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider cursor-pointer ' +
  'transition-[background-color,color] duration-150 ease-out';

const GroupButton = ({ children, onClick, title }) => (
  <button
    type="button" onClick={onClick} title={title}
    className={`${CHIP} text-gray-500 hover:bg-white hover:text-[#2a276e]`}
  >
    {children}
  </button>
);

const Key = ({ children }) => (
  <kbd className="px-1.5 py-0.5 mx-0.5 rounded border border-gray-200 bg-white font-sans text-[10px] font-bold text-gray-600">
    {children}
  </kbd>
);

const ToothSelectionBar = ({
  selectedTeeth = [], multiMode, onMultiModeChange,
  onQuadrant, onArch, onClear, onRemove, onOpen,
}) => {
  const numeric = selectedTeeth.filter((t) => Number.isFinite(Number(t)));
  const count = numeric.length;
  const mod = modKeyLabel();

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* The hint sits with the selection controls rather than under the
            chart, because that is where someone working out how to pick four
            teeth is already looking. It changes with the mode: in multi mode
            the modifier key it would otherwise teach is redundant. */}
        <p className="text-[11px] text-gray-400 leading-snug">
          {multiMode
            ? 'Tap each tooth to pick it, and tap again to drop it. Turn this off to go back to one at a time.'
            : (
              <>
                <Key>{mod}</Key> click for separate teeth ·
                <Key>Shift</Key> for a run · drag across several ·
                the quadrant headings take a whole quadrant
              </>
            )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onMultiModeChange(!multiMode)}
            aria-pressed={multiMode}
            title="Pick several teeth by tapping them, with no key held down"
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13px] font-semibold cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] ${
              multiMode
                ? 'bg-[#2a276e] border-[#2a276e] text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            <CheckSquare size={15} />
            Select multiple
          </button>

          <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg">
            {Object.entries(QUADRANTS).map(([key, q]) => (
              <GroupButton key={key} onClick={() => onQuadrant(key)} title={`${q.label} quadrant`}>
                {key}
              </GroupButton>
            ))}
          </div>

          <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-lg">
            <GroupButton onClick={() => onArch('upper')} title="Whole upper arch">Upper</GroupButton>
            <GroupButton onClick={() => onArch('lower')} title="Whole lower arch">Lower</GroupButton>
            <GroupButton onClick={() => onArch('all')} title="Every tooth">All</GroupButton>
          </div>
        </div>
      </div>

      {/* While picking a group, this is the running tally and the way out of
          it, so it shows from the very first tick. Outside that mode it stays
          hidden until there is actually a group — a running commentary on a
          single tooth would be noise on a flow that is already fine. */}
      {(multiMode ? count > 0 : count > 1) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 bg-[#2a276e]/[0.04] border border-[#2a276e]/15 rounded-xl animate-view-fade-in">
          <span className="text-xs font-bold text-[#2a276e] whitespace-nowrap">
            {count} {count === 1 ? 'tooth' : 'teeth'} selected
          </span>

          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {numeric.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-white border border-[#2a276e]/15 text-[11px] font-bold text-[#2a276e]"
              >
                {universalToFDI(t)}
                <button
                  type="button" onClick={() => onRemove(t)}
                  aria-label={`Remove tooth ${universalToFDI(t)} from the selection`}
                  className="p-0.5 rounded cursor-pointer text-[#2a276e]/40 transition-colors duration-150 hover:text-red-500"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              </span>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button" onClick={onClear}
              className="h-7 px-2.5 rounded-md text-[11px] font-bold text-gray-500 cursor-pointer transition-[background-color,color] duration-150 ease-out hover:bg-white hover:text-gray-900"
            >
              Clear
            </button>
            <button
              type="button" onClick={onOpen}
              className="h-7 px-3.5 rounded-md bg-[#2a276e] text-white text-[11px] font-bold cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-[#1a1548] active:scale-[0.97]"
            >
              Done · {count} {count === 1 ? 'tooth' : 'teeth'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToothSelectionBar;
