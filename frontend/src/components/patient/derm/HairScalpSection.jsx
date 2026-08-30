import React from 'react';
import { Scissors } from 'lucide-react';
import {
  HAIR_COMPLAINTS, NORWOOD_STAGES, LUDWIG_GRADES, PULL_TEST_RESULTS,
  SCALP_FINDINGS, HAIR_SHAFT_FINDINGS,
} from './dermVocabulary';
import {
  SectionHeading, Section, PickOne, SearchPicker, TextField, NumberField,
} from './DermControls';

/**
 * Scalp and hair.
 *
 * A hair and skin clinic sees as much trichology as dermatology, and hair does
 * not fit the lesion vocabulary at all: pattern loss has a stage, not a
 * morphology, and the useful findings come from a pull test and trichoscopy.
 *
 * Appears on its own when a hair condition is being treated, which is the
 * normal route in now. Standalone mode is kept for the case where the doctor
 * wants to examine the scalp without having declared a hair diagnosis.
 *
 * Norwood and Ludwig are offered as a choice rather than picked from the
 * patient's gender. They are not interchangeable, female pattern loss is
 * sometimes staged on Norwood, and guessing from a gender field is how a record
 * ends up staged on the wrong scale.
 */

const SCALES = [
  { value: 'norwood', label: 'Norwood-Hamilton', hint: 'Male pattern, I to VII' },
  { value: 'ludwig',  label: 'Ludwig',           hint: 'Female pattern, I to III' },
];

const HairScalpSection = ({ hair = {}, onChange, embedded = false }) => {
  const set = (patch) => onChange({ ...hair, ...patch });
  const stages = hair.scale === 'ludwig' ? LUDWIG_GRADES : NORWOOD_STAGES;

  const fields = (
    <div className="space-y-7">
      <SearchPicker
        label="Hair complaints"
        options={HAIR_COMPLAINTS}
        values={hair.complaints}
        onChange={(v) => set({ complaints: v })}
        common={6}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PickOne
          label="Staging scale"
          options={SCALES}
          value={hair.scale}
          // Changing scale clears the stage: a "IV" means different things on
          // Norwood and Ludwig, and Ludwig has no IV at all.
          onChange={(v) => set({ scale: v, stage: '' })}
        />
        {hair.scale && (
          <PickOne
            label={hair.scale === 'ludwig' ? 'Ludwig grade' : 'Norwood stage'}
            options={stages}
            value={hair.stage}
            onChange={(v) => set({ stage: v })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PickOne
          label="Hair pull test"
          hint="Positive when more than about 6 of 60 hairs come away"
          options={PULL_TEST_RESULTS}
          value={hair.pull_test}
          onChange={(v) => set({ pull_test: v })}
        />
        {hair.pull_test === 'Positive' && (
          <NumberField
            label="Hairs extracted"
            value={hair.pull_test_count}
            onChange={(v) => set({ pull_test_count: v })}
            placeholder="Count"
            suffix="hairs"
          />
        )}
      </div>

      <SearchPicker
        label="Scalp findings"
        hint="What the scalp and trichoscope show"
        options={SCALP_FINDINGS}
        values={hair.scalp_findings}
        onChange={(v) => set({ scalp_findings: v })}
        common={7}
      />

      <SearchPicker
        label="Hair shaft"
        options={HAIR_SHAFT_FINDINGS}
        values={hair.shaft_findings}
        onChange={(v) => set({ shaft_findings: v })}
      />

      <TextField
        label="Trichoscopy notes"
        value={hair.trichoscopy_notes}
        onChange={(v) => set({ trichoscopy_notes: v })}
        placeholder="Density, hair diameter variability, follicular units per field..."
        rows={3}
      />
    </div>
  );

  // Inside a Collapsible the heading and the relevance decision are already
  // handled, so this is only the fields.
  if (embedded) return fields;

  return (
    <Section>
      <SectionHeading
        Icon={Scissors}
        title="Scalp and hair"
        hint="Pattern, pull test and trichoscopy"
        right={
          <button
            onClick={() => set({ is_relevant: !hair.is_relevant })}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              hair.is_relevant
                ? 'bg-[#2a276e] text-white hover:bg-[#211e58]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {hair.is_relevant ? 'Examined' : 'Add hair examination'}
          </button>
        }
      />
      {hair.is_relevant ? fields : (
        <p className="text-xs text-gray-400">
          Not part of this visit. Switch it on if the scalp or hair was examined.
        </p>
      )}
    </Section>
  );
};

export default HairScalpSection;
