import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';

/**
 * What the consent editor can produce. Every tag and style here must survive
 * the backend allowlist in backend/domains/consent/rich_content.py, or it is
 * silently dropped on save. Links are off for that reason: an <a> in a signed
 * consent PDF has nowhere useful to go, so the sanitiser does not allow one.
 */

/** A forced page break, printed by WeasyPrint as `break-after: page`. */
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  // Not an extension priority: that would put this node first in the schema,
  // and ProseMirror fills every new empty block (a fresh table cell) with the
  // first block type it finds. Only the parse rule outranks the plain <hr>.
  parseHTML() {
    return [{ tag: 'hr[data-page-break]', priority: 100 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true' })];
  },
  addCommands() {
    return {
      setPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name }),
    };
  },
});

export const consentExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
    code: false,
    codeBlock: false,
  }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TableKit.configure({ table: { resizable: false } }),
  PageBreak,
];

// Families the PDF renderer actually has (fonts-noto-core and DejaVu ship in
// the backend image), so the printed form matches the page on screen.
export const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Noto Sans', value: 'Noto Sans' },
  { label: 'Noto Serif', value: 'Noto Serif' },
  { label: 'DejaVu Sans', value: 'DejaVu Sans' },
  { label: 'Liberation Serif', value: 'Liberation Serif' },
];

export const FONT_SIZES = ['11px', '12px', '13px', '14px', '16px', '18px', '20px', '24px'];

export const TEXT_COLORS = ['#111827', '#6b7280', '#2a276e', '#1d4ed8', '#067647', '#b54708', '#d92d20'];
export const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'];
