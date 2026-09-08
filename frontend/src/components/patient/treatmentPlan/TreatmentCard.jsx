import React, { useState, useRef, useEffect, memo } from 'react';
import { MoreVertical, Pencil, Trash2, Minus, Plus } from 'lucide-react';
import ToothSurfaceMap from '../ToothSurfaceMap';
import { getCurrencySymbol } from '../../../utils/currency';
import {
  STATUS_META, STATUS_ORDER, statusOf, toothList, isCombined,
  qtyOf, unitPrice, itemTotal, formatDate, surfacesLabel,
} from './planUtils';
import { universalToFDI } from '../../../utils/toothNumbering';
import { normaliseSurfaces } from '../dentalConstants';

/**
 * One procedure on the board.
 *
 * This used to be declared inside PatientTimeline's render body, which meant
 * React saw a brand-new component type on every parent state change and threw
 * the whole subtree away — the card remounted, and any input inside it lost
 * focus mid-word. It is its own module now, and memoised, so typing in the edit
 * form survives the parent re-rendering around it.
 */

/* A value the clinic never entered is said to be missing, not invented. The
   board used to print "Reversible pulpitis" and a 600 fee on any card that had
   neither, which reads as clinical fact and is not. */
const Missing = ({ children = 'Not recorded' }) => (
  <span className="text-gray-400 font-normal italic">{children}</span>
);

const TreatmentCard = ({
  item,
  isHistory = false,
  teethData = {},
  currentUserName,
  onEditStart,
  onDelete,
  onStatusChange,
  onQtyChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [menuOpen]);

  const status = statusOf(item);
  const teeth = toothList(item);
  const combined = isCombined(item);
  const qty = qtyOf(item);
  const price = unitPrice(item);
  const doctorName = item.doctor || currentUserName || 'Treating doctor';

  return (
    <div
      draggable={!isHistory}
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', String(item.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      /* Border-only, like every other card in the app. The hover signal is the
         border warming to the accent, not a shadow appearing. */
      className={`group relative flex flex-col gap-3 mb-3 pb-0 bg-white border border-gray-200 rounded-xl p-4
        transition-[border-color] duration-150 ease-out hover:border-[#2a276e]/40
        ${!isHistory ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* Who and when */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
        <span className="text-[11px] font-medium text-gray-500">
          {formatDate(item.date || item.appointment_date)}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-gray-700">
            <div className="w-4 h-4 shrink-0 rounded-full bg-[#2a276e] flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: '7px', lineHeight: 1 }}>
                {doctorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'DR'}
              </span>
            </div>
            <span className="text-[11px] font-medium truncate max-w-[100px]">{doctorName}</span>
          </div>

          {!isHistory && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuOpen}
                aria-label="Procedure actions"
                className="p-1 rounded-md text-gray-500 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:text-gray-900 hover:bg-gray-100 active:scale-[0.97]"
              >
                <MoreVertical size={16} />
              </button>

              {/* Grows from the button it belongs to, not from its own middle. */}
              {menuOpen && (
                <div
                  role="menu"
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-full mt-1 w-40 py-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20 animate-scale-in"
                >
                  <button
                    type="button" role="menuitem"
                    onClick={() => { setMenuOpen(false); onEditStart(item); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-medium text-gray-700 cursor-pointer transition-colors duration-150 hover:bg-gray-50"
                  >
                    <Pencil size={13} /> Edit procedure
                  </button>
                  <button
                    type="button" role="menuitem"
                    onClick={() => { setMenuOpen(false); onDelete(item); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-medium text-red-600 cursor-pointer transition-colors duration-150 hover:bg-red-50"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tooth, diagnosis, procedure */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center w-16 shrink-0">
          <p className="w-full pb-1 mb-1 text-center text-[11px] font-medium text-gray-500 border-b border-gray-50">
            {combined ? 'Teeth' : 'Tooth'}
          </p>

          {combined ? (
            /* A quadrant scaling is one procedure over many teeth. Drawing one
               of them and hiding the rest would misreport what was agreed. */
            <div className="flex flex-wrap gap-1 justify-center pt-1">
              {teeth.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-[#2a276e]/5 text-[#2a276e] text-[10px] font-bold">
                  {universalToFDI(t)}
                </span>
              ))}
            </div>
          ) : teeth.length === 1 ? (
            <>
              <div className="w-14 h-16 pointer-events-none">
                {/* toothNum so the letters are right for this tooth, and
                    normalised so anything marked on the old facial arch still
                    shows instead of silently missing. */}
                <ToothSurfaceMap
                  toothNum={teeth[0]}
                  surfaces={normaliseSurfaces(teethData[teeth[0]]?.surfaces)}
                  readOnly
                />
              </div>
              <p className="mt-0.5 text-lg font-black text-gray-900">#{universalToFDI(teeth[0])}</p>
            </>
          ) : (
            <div className="h-16 flex items-center justify-center">
              <span className="px-2 py-1 rounded bg-gray-50 text-gray-400 text-[10px] font-bold tracking-wider">
                GENERAL
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0 border-l border-gray-100 pl-4 py-1">
          <div className="mb-3">
            <p className="text-[11px] font-medium text-gray-500 mb-0.5">Diagnosis</p>
            <p className="text-[13px] font-medium text-gray-900 leading-tight line-clamp-2">
              {item.diagnosis || <Missing />}
            </p>
          </div>
          <div className="mt-auto pb-1">
            <p className="text-[11px] font-medium text-gray-500 mb-0.5">Procedure</p>
            <p className="text-[15px] font-black text-[#2a276e] leading-tight">
              {item.procedure || <Missing>Untitled procedure</Missing>}
              {surfacesLabel(item) && (
                <span className="ml-1.5 text-[13px] font-bold text-gray-400">{surfacesLabel(item)}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Money */}
      <div className="grid grid-cols-3 gap-2 items-end p-3 rounded-lg bg-[#f8f9fc] border border-gray-100">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Qty</p>
          <div className="flex items-center gap-1 w-max p-0.5 bg-white border border-gray-200 rounded">
            <button
              type="button" onClick={() => onQtyChange(item, -1)} aria-label="Decrease quantity"
              className="h-5 w-5 flex items-center justify-center rounded bg-gray-50 text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-900 active:scale-[0.9]"
            >
              <Minus size={11} strokeWidth={3} />
            </button>
            <span className="w-5 text-center text-[13px] font-black text-gray-900">{qty}</span>
            <button
              type="button" onClick={() => onQtyChange(item, 1)} aria-label="Increase quantity"
              className="h-5 w-5 flex items-center justify-center rounded bg-gray-50 text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-900 active:scale-[0.9]"
            >
              <Plus size={11} strokeWidth={3} />
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Fee</p>
          <p className="text-sm font-bold text-gray-600">
            {price === null
              ? <span className="text-gray-400 font-medium italic">Not set</span>
              : `${getCurrencySymbol()}${price.toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Total</p>
          <p className="text-[16px] font-black text-emerald-600 leading-none">
            {price === null ? '—' : `${getCurrencySymbol()}${itemTotal(item).toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Advance the work without dragging */}
      {!isHistory ? (
        <div className="flex -mx-4 mt-2 border-t border-gray-100 divide-x divide-gray-100 overflow-hidden rounded-b-xl">
          {STATUS_ORDER.filter((s) => s !== status).map((s) => (
            <button
              key={s} type="button" onClick={() => onStatusChange(item, s)}
              className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-[background-color,color] duration-150 ease-out ${STATUS_META[s].action}`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      ) : (
        <div className="pb-4" />
      )}
    </div>
  );
};

export default memo(TreatmentCard);
