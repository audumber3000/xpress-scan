import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { ArrowLeft, Info } from 'lucide-react';
import Spinner from '../../common/Spinner';
import Toggle from '../../common/Toggle';
import ConfirmDialog from '../../common/ConfirmDialog';
import EditorToolbar from './EditorToolbar';
import { consentExtensions } from './extensions';
import {
  isHtmlContent, plainToHtml, isEmptyHtml, CONSENT_LANGUAGES, CONSENT_CATEGORIES,
} from '../consentContent';
import './consentEditor.css';

/**
 * Writing a consent form, full screen, on an A4 page.
 *
 * Replaces a 16-row textarea in a side drawer. Consent wording is long and
 * structured (headings, numbered risks, a table of teeth), and the drawer
 * gave a dentist a letterbox to write a legal document through.
 *
 * Old plain-text forms open with each line as a paragraph and are saved as
 * formatted wording from then on. Until someone saves one here, it keeps
 * printing exactly as it always has.
 *
 * template: the row being edited, or null for a new form
 * onSave:   async ({ name, content, language, category, is_active }) => void
 *           throws to keep the editor open
 */
const ConsentEditor = ({ open, template, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const initialHtml = useMemo(() => {
    const content = template?.content || '';
    return isHtmlContent(content) ? content : plainToHtml(content);
  }, [template]);

  const editor = useEditor({
    extensions: consentExtensions,
    content: '',
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        'aria-label': 'Consent form wording',
      },
    },
    onUpdate: () => setDirty(true),
  });

  // Reset every time it opens, so a cancelled edit never leaks into the next.
  useEffect(() => {
    if (!open || !editor) return;
    setName(template?.name || '');
    setLanguage(template?.language || 'en');
    setCategory(template?.category || '');
    setActive(template ? template.is_active !== false : true);
    setError('');
    editor.commands.setContent(initialHtml || '', { emitUpdate: false });
    setDirty(false);
    requestAnimationFrame(() => editor.commands.focus('end'));
  }, [open, template, editor, initialHtml]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        attemptClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  const attemptClose = () => {
    if (dirty) setConfirmLeave(true);
    else onClose();
  };

  const save = async () => {
    if (saving || !editor) return;
    const html = editor.getHTML();
    if (!name.trim()) { setError('Give the form a name.'); return; }
    if (isEmptyHtml(html)) { setError('The form has no wording yet.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        content: html,
        language,
        category: category || null,
        is_active: active,
      });
      setDirty(false);
    } catch (e) {
      setError(e?.message || 'Could not save the form.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-gray-50 flex flex-col" role="dialog" aria-modal="true" aria-label="Consent form editor">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
        <button
          type="button"
          onClick={attemptClose}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <input
          id="consent-editor-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          placeholder="Name this form, e.g. Consent for tooth extraction"
          maxLength={100}
          aria-label="Form name"
          className="flex-1 min-w-0 text-base font-semibold text-gray-900 bg-transparent px-2 py-1.5 rounded-md border border-transparent hover:border-gray-200 focus:border-[#2a276e] focus:outline-none"
        />
        {error && <span className="hidden sm:block text-xs text-red-600 shrink-0">{error}</span>}
        <button
          type="button"
          onClick={attemptClose}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-[#2a276e] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1548] inline-flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? 'Saving' : template ? 'Save changes' : 'Create form'}
          {saving && <Spinner />}
        </button>
      </div>

      <EditorToolbar editor={editor} />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* The page */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8" onClick={() => editor?.commands.focus()}>
          <div
            className="consent-page mx-auto bg-white border border-gray-200 rounded-sm px-8 sm:px-14 py-12 max-w-[794px] min-h-[1000px]"
            onClick={(e) => e.stopPropagation()}
          >
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Details */}
        <aside className="md:w-72 shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 p-5 overflow-y-auto flex flex-col gap-5">
          {error && <p className="sm:hidden text-xs text-red-600">{error}</p>}
          <div>
            <label htmlFor="consent-editor-language" className="block text-xs font-medium text-gray-500 mb-1.5">Language</label>
            <select
              id="consent-editor-language"
              value={language}
              onChange={(e) => { setLanguage(e.target.value); setDirty(true); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#2a276e]"
            >
              {CONSENT_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native === l.label ? l.label : `${l.native} (${l.label})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="consent-editor-category" className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
            <select
              id="consent-editor-category"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setDirty(true); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#2a276e]"
            >
              <option value="">No category</option>
              {CONSENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Active</p>
              <p className="text-xs text-gray-500">Drafts stay out of the send list.</p>
            </div>
            <Toggle id="consent-editor-active" checked={active} onChange={(v) => { setActive(v); setDirty(true); }} label="Active" />
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-[#2a276e]" />
            <span>
              Your clinic header, the patient's name and ID, the date and the signature box are
              added to every printed form, so there is no need to type them here.
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Ctrl/⌘ + S saves. Esc goes back.</p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        tone="danger"
        title="Leave without saving?"
        message="The changes you made to this form will be lost."
        actions={[
          { label: 'Keep editing', variant: 'primary', onClick: () => setConfirmLeave(false) },
          { label: 'Discard changes', variant: 'secondary', onClick: () => { setConfirmLeave(false); onClose(); } },
        ]}
        cancelLabel={null}
      />
    </div>
  );
};

export default ConsentEditor;
