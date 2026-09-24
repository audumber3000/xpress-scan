import React, { useEffect, useRef, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, Baseline, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, IndentIncrease,
  IndentDecrease, Table2, Minus, FileDown, RemoveFormatting, Quote, ChevronDown,
} from 'lucide-react';
import { FONT_FAMILIES, FONT_SIZES, TEXT_COLORS, HIGHLIGHTS } from './extensions';

/**
 * The formatting bar. Laid out like a word processor's, left to right in the
 * order people reach for things: history, paragraph style, font, character
 * marks, alignment, lists, then inserts.
 */

const Btn = ({ onClick, active, disabled, label, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}  // keep the selection in the page
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active || undefined}
    className={`h-8 min-w-8 px-1.5 rounded-md inline-flex items-center justify-center text-gray-600 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
      active ? 'bg-[#2a276e]/10 text-[#2a276e]' : 'hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

const Sep = () => <span className="w-px h-5 bg-gray-200 mx-1 shrink-0" aria-hidden="true" />;

const Select = ({ value, onChange, label, children, width = 'w-32' }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={label}
    title={label}
    className={`h-8 ${width} px-2 rounded-md border border-gray-200 bg-white text-[13px] text-gray-700 focus:outline-none focus:border-[#2a276e]`}
  >
    {children}
  </select>
);

/** A small colour menu, anchored under its button. */
const Swatches = ({ label, icon, colors, current, onPick, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Btn label={label} onClick={() => setOpen((v) => !v)} active={open}>
        <span className="flex flex-col items-center leading-none">
          {icon}
          <span className="block w-4 h-[3px] mt-0.5 rounded-sm" style={{ background: current || 'transparent' }} />
        </span>
        <ChevronDown size={11} className="ml-0.5 text-gray-400" />
      </Btn>
      {open && (
        <div className="absolute z-20 top-9 left-0 p-2 bg-white border border-gray-200 rounded-lg flex flex-col gap-2">
          <div className="flex gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(c); setOpen(false); }}
                title={c}
                aria-label={`${label} ${c}`}
                className="w-6 h-6 rounded-md border border-gray-200"
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onClear(); setOpen(false); }}
            className="text-xs text-gray-500 hover:text-gray-800 text-left"
          >
            None
          </button>
        </div>
      )}
    </div>
  );
};

const EditorToolbar = ({ editor }) => {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      block: e.isActive('heading', { level: 1 }) ? 'h1'
        : e.isActive('heading', { level: 2 }) ? 'h2'
        : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      font: e.getAttributes('textStyle').fontFamily || '',
      size: e.getAttributes('textStyle').fontSize || '',
      color: e.getAttributes('textStyle').color || '',
      highlight: e.getAttributes('highlight').color || '',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      inTable: e.isActive('table'),
      canSink: e.can().sinkListItem('listItem'),
      canLift: e.can().liftListItem('listItem'),
    }),
  });

  if (!editor || !s) return null;
  const c = () => editor.chain().focus();

  const setBlock = (v) => {
    if (v === 'p') c().setParagraph().run();
    else c().toggleHeading({ level: Number(v.slice(1)) }).run();
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-3 py-1.5 border-b border-gray-200 bg-white">
      <Btn label="Undo" onClick={() => c().undo().run()} disabled={!s.canUndo}><Undo2 size={16} /></Btn>
      <Btn label="Redo" onClick={() => c().redo().run()} disabled={!s.canRedo}><Redo2 size={16} /></Btn>
      <Sep />

      <Select label="Paragraph style" value={s.block} onChange={setBlock}>
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </Select>
      <Select
        label="Font"
        value={s.font}
        onChange={(v) => (v ? c().setFontFamily(v).run() : c().unsetFontFamily().run())}
      >
        {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </Select>
      <Select
        label="Font size"
        width="w-20"
        value={s.size}
        onChange={(v) => (v ? c().setFontSize(v).run() : c().unsetFontSize().run())}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((z) => <option key={z} value={z}>{parseInt(z, 10)}</option>)}
      </Select>
      <Sep />

      <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}><Underline size={16} /></Btn>
      <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough size={16} /></Btn>
      <Swatches
        label="Text colour"
        icon={<Baseline size={15} />}
        colors={TEXT_COLORS}
        current={s.color}
        onPick={(col) => c().setColor(col).run()}
        onClear={() => c().unsetColor().run()}
      />
      <Swatches
        label="Highlight"
        icon={<Highlighter size={15} />}
        colors={HIGHLIGHTS}
        current={s.highlight}
        onPick={(col) => c().setHighlight({ color: col }).run()}
        onClear={() => c().unsetHighlight().run()}
      />
      <Sep />

      <Btn label="Align left" active={s.left} onClick={() => c().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
      <Btn label="Centre" active={s.center} onClick={() => c().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
      <Btn label="Align right" active={s.right} onClick={() => c().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
      <Btn label="Justify" active={s.justify} onClick={() => c().setTextAlign('justify').run()}><AlignJustify size={16} /></Btn>
      <Sep />

      <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn label="Decrease indent" disabled={!s.canLift} onClick={() => c().liftListItem('listItem').run()}><IndentDecrease size={16} /></Btn>
      <Btn label="Increase indent" disabled={!s.canSink} onClick={() => c().sinkListItem('listItem').run()}><IndentIncrease size={16} /></Btn>
      <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
      <Sep />

      <Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table2 size={16} /><span className="ml-1 text-[12px] font-medium">Table</span>
      </Btn>
      <Btn label="Horizontal line" onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Btn>
      <Btn label="Page break" onClick={() => c().setPageBreak().run()}>
        <FileDown size={16} /><span className="ml-1 text-[12px] font-medium">Break</span>
      </Btn>
      <Btn label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={16} /></Btn>

      {s.inTable && (
        <div className="basis-full flex items-center gap-1 pt-1.5 mt-1 border-t border-gray-100 text-[12px]">
          <span className="text-gray-400 mr-1">Table</span>
          {[
            ['Row above', () => c().addRowBefore().run()],
            ['Row below', () => c().addRowAfter().run()],
            ['Column left', () => c().addColumnBefore().run()],
            ['Column right', () => c().addColumnAfter().run()],
            ['Delete row', () => c().deleteRow().run()],
            ['Delete column', () => c().deleteColumn().run()],
            ['Header row', () => c().toggleHeaderRow().run()],
            ['Merge / split', () => c().mergeOrSplit().run()],
            ['Delete table', () => c().deleteTable().run()],
          ].map(([label, fn]) => (
            <button
              key={label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={fn}
              className={`px-2 py-1 rounded-md hover:bg-gray-100 ${label.startsWith('Delete') ? 'text-red-600' : 'text-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditorToolbar;
