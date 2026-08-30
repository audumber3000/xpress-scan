import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import {
  PRIMARY_MORPHOLOGY, SECONDARY_CHANGES, CONFIGURATIONS, DISTRIBUTIONS,
  LESION_COLOURS, BORDER_TYPES, PALPATION_FINDINGS, BODY_REGIONS,
  ABCDE_FLAGS, describeLesion,
} from './dermVocabulary';
import { PickOne, PickMany, SearchPicker, TextField, NumberField, Label } from './DermControls';

/**
 * One lesion, described properly.
 *
 * This is the derm equivalent of the tooth drawer: you pick a thing on the body
 * and say what is wrong with it. A drawer rather than a modal because adding a
 * lesion is creating something new, which is the rule this app follows.
 *
 * Morphology is the only field the Save button insists on. Everything else is
 * optional because a busy clinic will not fill in eleven fields for a wart, but
 * "papule" alone is already a better record than "rash", and the rule the
 * literature is emphatic about is never writing "lesion" on its own.
 *
 * ABCDE only appears once the lesion is pigmented. Asking for melanoma criteria
 * on a pustule trains people to ignore the section, and then it is not there
 * when it matters.
 */

const PIGMENTED = ['Brown', 'Black', 'Hyperpigmented', 'Variegated', 'Blue', 'Grey'];

const LesionDrawer = ({ lesion, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState(lesion);

  useEffect(() => { setDraft(lesion); }, [lesion]);

  if (!lesion) return null;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isPigmented = PIGMENTED.includes(draft.colour);
  const canSave = Boolean(draft.site && draft.morphology);
  const preview = describeLesion(draft);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">

        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {lesion.morphology ? 'Edit finding' : 'Record a finding'}
            </h2>
            {preview && <p className="text-xs text-gray-500 mt-0.5 capitalize">{preview}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          <div>
            <Label hint="Be as specific as the examination allows">Site</Label>
            <select
              value={draft.site || ''}
              onChange={(e) => set({ site: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none"
            >
              <option value="">Select a site</option>
              {BODY_REGIONS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.sites.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <PickOne
            label="Primary morphology"
            hint="Required. The one word that says what this actually is."
            options={PRIMARY_MORPHOLOGY}
            value={draft.morphology}
            onChange={(v) => set({ morphology: v })}
            columns="grid-cols-2"
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Size"
              value={draft.size_mm}
              onChange={(v) => set({ size_mm: v })}
              placeholder="Longest"
              suffix="mm"
            />
            <NumberField
              label="Across"
              hint="Perpendicular to the first"
              value={draft.size_mm_2}
              onChange={(v) => set({ size_mm_2: v })}
              placeholder="Width"
              suffix="mm"
            />
          </div>

          <SearchPicker
            label="Colour"
            options={LESION_COLOURS}
            values={draft.colour ? [draft.colour] : []}
            onChange={(v) => set({ colour: v.filter((x) => x !== draft.colour)[0] || '' })}
            common={6}
          />

          {isPigmented && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Pigmented — check ABCDE
                </span>
              </div>
              <PickMany
                options={ABCDE_FLAGS}
                values={draft.abcde}
                onChange={(v) => set({ abcde: v })}
              />
              {draft.abcde?.length >= 2 && (
                <p className="text-[11px] text-amber-800 mt-3 font-semibold">
                  {draft.abcde.length} criteria met. Consider dermoscopy and a biopsy.
                </p>
              )}
            </div>
          )}

          <SearchPicker
            label="Secondary change"
            hint="What has happened to it since"
            options={SECONDARY_CHANGES}
            values={draft.secondary}
            onChange={(v) => set({ secondary: v })}
            common={6}
          />

          <SearchPicker
            label="Configuration"
            hint="How the individual lesions sit together"
            options={CONFIGURATIONS}
            values={draft.configuration ? [draft.configuration] : []}
            onChange={(v) => set({ configuration: v.filter((x) => x !== draft.configuration)[0] || '' })}
            common={5}
          />

          <SearchPicker
            label="Distribution"
            options={DISTRIBUTIONS}
            values={draft.distribution ? [draft.distribution] : []}
            onChange={(v) => set({ distribution: v.filter((x) => x !== draft.distribution)[0] || '' })}
            common={6}
          />

          <PickOne
            label="Border"
            options={BORDER_TYPES}
            value={draft.border}
            onChange={(v) => set({ border: v })}
          />

          <SearchPicker
            label="On palpation"
            options={PALPATION_FINDINGS}
            values={draft.palpation}
            onChange={(v) => set({ palpation: v })}
            common={6}
          />

          <TextField
            label="Notes"
            value={draft.notes}
            onChange={(v) => set({ notes: v })}
            placeholder="Dermoscopy findings, anything the fields above cannot carry..."
            rows={3}
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          {onDelete && (
            <button
              onClick={() => onDelete(lesion.id)}
              className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Remove this finding"
            >
              <Trash2 size={17} />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={!canSave}
            title={canSave ? undefined : 'Pick a site and a morphology first'}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-[#2a276e] hover:bg-[#211e58] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save finding
          </button>
        </div>
      </div>
    </div>
  );
};

export default LesionDrawer;
