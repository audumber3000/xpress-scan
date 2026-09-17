import React from 'react';
import {
  Pen, Highlighter, Eraser, Undo2, Redo2, LayoutGrid,
} from 'lucide-react';
import { BACKDROPS, COLORS, SIZES, TOOLS } from './sketchModel';

/**
 * The controls, on one row.
 *
 * Every button here is something a clinician reaches for mid-sentence with a
 * patient watching, so there are no menus and nothing is more than one tap
 * away. Targets are 40px, which is the smallest thing a finger hits reliably on
 * a tablet held at arm's length.
 *
 * What is deliberately NOT here: zoom, pan, layers, shapes, text. This is a pad
 * for explaining a treatment plan in thirty seconds, not a drawing program, and
 * every one of those would cost a tap on the way to the thing people came for.
 */

const Btn = ({ active, disabled, onClick, title, children, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    aria-pressed={active === undefined ? undefined : !!active}
    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
      active
        ? 'border-[#2a276e] bg-[#2a276e] text-white'
        : danger
          ? 'border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
    } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-600`}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-0.5 h-7 w-px shrink-0 bg-gray-200" aria-hidden="true" />;

const SketchToolbar = ({
  tool, setTool, color, setColor, size, setSize,
  undo, redo, canUndo, canRedo, clearPage,
  page, setBackdrop, trailing = null,
}) => (
  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-2">
    <Btn active={tool === TOOLS.PEN} onClick={() => setTool(TOOLS.PEN)} title="Pen (P)">
      <Pen size={17} />
    </Btn>
    <Btn active={tool === TOOLS.MARKER} onClick={() => setTool(TOOLS.MARKER)} title="Highlighter (M)">
      <Highlighter size={17} />
    </Btn>
    <Btn active={tool === TOOLS.ERASER} onClick={() => setTool(TOOLS.ERASER)} title="Eraser (E)">
      <Eraser size={17} />
    </Btn>

    <Divider />

    {/* Colour and nib stay visible while erasing rather than disappearing —
        the eraser is a moment, and a toolbar that reshuffles under the hand is
        a toolbar you have to look at. */}
    <div className="flex items-center gap-1">
      {COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => { setColor(c.value); if (tool === TOOLS.ERASER) setTool(TOOLS.PEN); }}
          title={c.label}
          aria-label={c.label}
          aria-pressed={color === c.value}
          className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform ${
            color === c.value ? 'scale-110 border-gray-900' : 'border-white hover:scale-105'
          }`}
          style={{ backgroundColor: c.value, boxShadow: '0 0 0 1px rgba(0,0,0,0.12)' }}
        />
      ))}
    </div>

    <Divider />

    <div className="flex items-center gap-1">
      {SIZES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => setSize(s.value)}
          title={s.label}
          aria-label={s.label}
          aria-pressed={size === s.value}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            size === s.value ? 'border-[#2a276e] bg-[#2a276e]/5' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span
            className="rounded-full bg-gray-800"
            style={{ width: Math.max(4, s.value / 2), height: Math.max(4, s.value / 2) }}
          />
        </button>
      ))}
    </div>

    <Divider />

    <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 size={17} /></Btn>
    <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"><Redo2 size={17} /></Btn>
    {/* Words, not an icon: a bin sits beside the page thumbnails meaning
        "delete the page", and an eraser glyph here would read as the tool. */}
    <button
      type="button"
      onClick={clearPage}
      title="Wipe everything drawn on this page"
      className="inline-flex h-10 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
    >
      Clear page
    </button>

    <Divider />

    {/* The paper. Changing it never touches the ink already on the page, so a
        drawing can be moved onto the arch after the fact. */}
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white pl-2 pr-1 h-10">
      <LayoutGrid size={15} className="shrink-0 text-gray-400" />
      <select
        value={page.backdrop}
        onChange={(e) => setBackdrop(e.target.value)}
        aria-label="Page background"
        className="h-full cursor-pointer border-0 bg-transparent pr-1 text-xs font-semibold text-gray-700 outline-none"
      >
        {BACKDROPS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
      </select>
    </label>

    {/* Whatever the host wants on the far right: Save as PDF, Done. */}
    {trailing && <div className="ml-auto flex items-center gap-1.5">{trailing}</div>}
  </div>
);

export default SketchToolbar;
