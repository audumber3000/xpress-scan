import React from 'react';
import { UserRound } from 'lucide-react';
import ClinicalMultiSelect from '../ClinicalMultiSelect';
import {
  FITZPATRICK_TYPES, SKIN_TYPES, ONSET_TYPES, COURSE_TYPES, SYMPTOMS,
  AGGRAVATING_FACTORS, RELIEVING_FACTORS, PAST_TREATMENTS,
  TREATMENT_RESPONSE, MENSTRUAL_STATUS,
} from './dermVocabulary';
import {
  Collapsible, PickOne, PickMany, SearchPicker, TextField, SeveritySlider, Label,
} from './DermControls';
import { summarisePatientFactors } from './dermSummaries';

/**
 * Who she is, and what has already been tried.
 *
 * Collapsed by default with a summary line, because these answers change
 * slowly. On a follow-up visit the doctor wants to see "Fitzpatrick IV ·
 * Combination · 8 months, progressive · self-prescribed steroid" and move on;
 * she does not want to re-read eleven controls to learn nothing new.
 *
 * Three of these fields are not passive history — they drive the safety rails
 * in the plan below:
 *
 *   Fitzpatrick IV–VI          PIH risk, and caps on peel depth and laser fluence
 *   Pregnant or lactating      rules out isotretinoin, retinoids, hydroquinone
 *   Self-prescribed steroid    raises steroid-modified tinea and steroid rosacea
 *
 * That is why they sit in a section of their own rather than dissolved into the
 * notes: something downstream reads them.
 */

const DURATION_UNITS = ['days', 'weeks', 'months', 'years'];

const PatientFactorsSection = ({
  form, onFormChange, derm, onDermChange, patientGender, open, onToggle,
}) => {
  const profile = derm.profile || {};
  const history = derm.history || {};

  const setProfile = (patch) => onDermChange({ ...derm, profile: { ...profile, ...patch } });
  const setHistory = (patch) => onDermChange({ ...derm, history: { ...history, ...patch } });

  const askMenstrual = (patientGender || '').toLowerCase().startsWith('f');

  return (
    <Collapsible
      Icon={UserRound}
      title="Patient factors"
      hint="Skin type, how long, what has been tried"
      summary={summarisePatientFactors(derm)}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-7 pt-4">
        <PickOne
          label="Fitzpatrick skin type"
          hint="How the skin responds to sun. Decides peel depth and laser fluence."
          options={FITZPATRICK_TYPES}
          value={profile.fitzpatrick}
          onChange={(v) => setProfile({ fitzpatrick: v })}
          columns="grid-cols-3 lg:grid-cols-6"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
          <PickOne
            label="Skin type"
            options={SKIN_TYPES}
            value={profile.skin_type}
            onChange={(v) => setProfile({ skin_type: v })}
          />
          {askMenstrual && (
            <PickOne
              label="Menstrual and pregnancy status"
              hint="Decides what can be prescribed"
              options={MENSTRUAL_STATUS}
              value={history.menstrual_status}
              onChange={(v) => setHistory({ menstrual_status: v })}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <Label hint="The most useful question in the history">Duration</Label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={history.duration_value ?? ''}
                onChange={(e) => setHistory({ duration_value: e.target.value })}
                placeholder="How long"
                className="flex-1 min-w-0 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-[#2a276e] focus:ring-2 focus:ring-[#2a276e]/20 outline-none"
              />
              <select
                value={history.duration_unit || 'days'}
                onChange={(e) => setHistory({ duration_unit: e.target.value })}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-[#2a276e] outline-none"
              >
                {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <PickOne label="Onset" options={ONSET_TYPES} value={history.onset} onChange={(v) => setHistory({ onset: v })} />
          <PickOne label="Course since" options={COURSE_TYPES} value={history.course} onChange={(v) => setHistory({ course: v })} />
        </div>

        <SearchPicker
          label="Symptoms"
          options={SYMPTOMS}
          values={history.symptoms}
          onChange={(v) => setHistory({ symptoms: v })}
          common={6}
        />
        {history.symptoms?.includes('Itching') && (
          <SeveritySlider
            label="Itch severity"
            value={history.itch_severity}
            onChange={(v) => setHistory({ itch_severity: v })}
          />
        )}

        <SearchPicker
          label="Made worse by"
          options={AGGRAVATING_FACTORS}
          values={history.aggravating}
          onChange={(v) => setHistory({ aggravating: v })}
        />
        <SearchPicker
          label="Helped by"
          options={RELIEVING_FACTORS}
          values={history.relieving}
          onChange={(v) => setHistory({ relieving: v })}
        />

        <SearchPicker
          label="Already tried"
          hint="Over-the-counter steroid creams change the picture, so ask directly"
          options={PAST_TREATMENTS}
          values={history.past_treatments}
          onChange={(v) => setHistory({ past_treatments: v })}
          common={8}
        />
        {history.past_treatments?.length > 0 &&
          !history.past_treatments.includes('No prior treatment') && (
          <PickMany
            label="Response to that"
            options={TREATMENT_RESPONSE}
            values={history.treatment_response ? [history.treatment_response] : []}
            onChange={(v) => setHistory({ treatment_response: v.filter((x) => x !== history.treatment_response)[0] || '' })}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
          <ClinicalMultiSelect
            category="complaint"
            label="Presenting complaints"
            placeholder="e.g. Acne, Pigmentation, Hair fall"
            selectedValues={form.chief_complaint}
            onChange={(vals) => onFormChange({ ...form, chief_complaint: vals })}
          />
          <ClinicalMultiSelect
            category="medical-condition"
            label="Medical history"
            placeholder="e.g. Thyroid, PCOS, Diabetes"
            selectedValues={form.medical_history}
            onChange={(vals) => onFormChange({ ...form, medical_history: vals })}
          />
          <ClinicalMultiSelect
            category="allergy"
            label="Allergies"
            placeholder="e.g. Sulfa, Fragrance, Nickel"
            selectedValues={form.allergies}
            onChange={(vals) => onFormChange({ ...form, allergies: vals })}
          />
          <ClinicalMultiSelect
            category="dental-history"
            label="Treatment history"
            placeholder="e.g. Previous peels, laser sessions"
            selectedValues={form.dental_history}
            onChange={(vals) => onFormChange({ ...form, dental_history: vals })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField
            label="Family history"
            value={history.family_history}
            onChange={(v) => setHistory({ family_history: v })}
            placeholder="Similar problem in the family?"
          />
          <TextField
            label="Occupation and exposure"
            value={history.occupation_exposure}
            onChange={(v) => setHistory({ occupation_exposure: v })}
            placeholder="Work, chemicals, sun hours, water contact"
          />
        </div>
      </div>
    </Collapsible>
  );
};

export default PatientFactorsSection;
