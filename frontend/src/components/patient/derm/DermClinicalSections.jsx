import React, { useState, useMemo } from 'react';
import { ScanLine, FlaskConical, Scissors, Stethoscope } from 'lucide-react';

import ConditionPicker from './ConditionPicker';
import ConditionAssessment from './ConditionAssessment';
import PatientFactorsSection from './PatientFactorsSection';
import HairScalpSection from './HairScalpSection';
import LesionSection from './LesionSection';
import PlanBuilder from './PlanBuilder';
import { Collapsible, SearchPicker, TextField } from './DermControls';
import { CONDITIONS_BY_ID } from './dermProtocols';
import { withDermDefaults, INVESTIGATIONS } from './dermVocabulary';
import { summariseAssessment } from './dermSummaries';

/**
 * The dermatology case paper.
 *
 * ── The shape of the screen ──────────────────────────────────────────────────
 *
 *   Treating today        the hinge — everything below reshapes around it
 *   Per-condition blocks  three to five questions each, expanded while empty
 *   Patient factors       collapsed, summarised, feeds the safety rails
 *   Scalp and hair        appears on its own when a hair condition is picked
 *   Other findings        the full lesion vocabulary, for the undiagnosed rash
 *   Investigations        collapsed until something is ordered
 *   Plan                  shortlist, safety flags, and a course
 *   Diagnosis             what it is, and what else it might be
 *
 * ── What changed and why ─────────────────────────────────────────────────────
 *
 * The first build rendered every vocabulary as chips at once: roughly two
 * hundred of them, for a consult that needs about fifteen. Three rules fixed it
 * and they are worth keeping:
 *
 *   1. Ask the condition first. Everything specific follows from it, so the
 *      screen shows the four questions acne needs instead of the union of every
 *      question dermatology has.
 *   2. A section that is shut must still say what is in it. Compression, not
 *      concealment — the whole consult is readable down the left edge.
 *   3. Long lists get ranked and searched, never printed. Selected items stay
 *      visible, six common ones sit under them, the rest is a search box.
 *
 * Nothing was removed. The full morphology vocabulary still exists in Other
 * findings; it just stopped being the first thing on screen.
 *
 * Everything below this component — lab orders, prescriptions, documents,
 * inventory, clinical notes and the whole action bar — is shared with the
 * dental case paper unchanged, because none of it is dental.
 */

const HAIR_CONDITIONS = new Set(['aga', 'telogen_effluvium']);

const DermClinicalSections = ({ form, onFormChange, patientData }) => {
  const derm = withDermDefaults(form.derm_findings);
  const setDerm = (next) => onFormChange({ ...form, derm_findings: next });

  const conditions = derm.conditions || [];
  const assessments = derm.assessments || {};

  // Which collapsibles the user has explicitly toggled. Anything not in here
  // falls back to the sensible default below, so the screen opens useful and
  // then stays exactly where she puts it.
  const [toggled, setToggled] = useState({});
  const flip = (key, fallback) =>
    setToggled((t) => ({ ...t, [key]: !(t[key] ?? fallback) }));
  const isOpen = (key, fallback) => toggled[key] ?? fallback;

  const hairRelevant = conditions.some((c) => HAIR_CONDITIONS.has(c)) || derm.hair?.is_relevant;

  // The patient facts the safety rails read. Assembled here so the plan does
  // not have to know where on the case paper each one lives.
  const patientContext = useMemo(() => ({
    fitzpatrick: derm.profile?.fitzpatrick,
    menstrualStatus: derm.history?.menstrual_status,
    pastTreatments: derm.history?.past_treatments,
  }), [derm.profile, derm.history]);

  const investigations = derm.investigations || {};
  const setInvestigations = (patch) =>
    setDerm({ ...derm, investigations: { ...investigations, ...patch } });

  return (
    <section className="space-y-3">
      <ConditionPicker
        selected={conditions}
        onChange={(next) => setDerm({ ...derm, conditions: next })}
      />

      {conditions.map((id) => {
        const condition = CONDITIONS_BY_ID[id];
        if (!condition) return null;
        const answers = assessments[id] || {};
        // Expanded while there is nothing in it, collapsed once answered.
        const answered = Boolean(summariseAssessment(condition, answers));
        return (
          <ConditionAssessment
            key={id}
            condition={condition}
            answers={answers}
            onChange={(next) => setDerm({ ...derm, assessments: { ...assessments, [id]: next } })}
            open={isOpen(`cond:${id}`, !answered)}
            onToggle={() => flip(`cond:${id}`, !answered)}
          />
        );
      })}

      <PatientFactorsSection
        form={form}
        onFormChange={onFormChange}
        derm={derm}
        onDermChange={setDerm}
        patientGender={patientData?.gender}
        open={isOpen('factors', conditions.length === 0)}
        onToggle={() => flip('factors', conditions.length === 0)}
      />

      {hairRelevant && (
        <Collapsible
          Icon={Scissors}
          title="Scalp and hair"
          hint="Pattern, pull test, trichoscopy"
          summary={[
            derm.hair?.scale && derm.hair?.stage
              ? `${derm.hair.scale === 'ludwig' ? 'Ludwig' : 'Norwood'} ${derm.hair.stage}`
              : '',
            derm.hair?.pull_test ? `pull test ${derm.hair.pull_test.toLowerCase()}` : '',
          ].filter(Boolean).join(' · ')}
          open={isOpen('hair', true)}
          onToggle={() => flip('hair', true)}
        >
          <div className="pt-4">
            <HairScalpSection
              hair={{ ...derm.hair, is_relevant: true }}
              onChange={(hair) => setDerm({ ...derm, hair })}
              embedded
            />
          </div>
        </Collapsible>
      )}

      <Collapsible
        Icon={ScanLine}
        title="Other findings"
        hint="Describe anything the blocks above do not cover"
        summary={
          derm.lesions?.length
            ? derm.lesions.map((l) => l.site).filter(Boolean).slice(0, 3).join(', ') +
              (derm.lesions.length > 3 ? ` +${derm.lesions.length - 3}` : '')
            : ''
        }
        count={derm.lesions?.length || 0}
        open={isOpen('lesions', conditions.length === 0)}
        onToggle={() => flip('lesions', conditions.length === 0)}
      >
        <div className="pt-4">
          <LesionSection
            lesions={derm.lesions}
            onChange={(lesions) => setDerm({ ...derm, lesions })}
            embedded
          />
        </div>
      </Collapsible>

      <Collapsible
        Icon={FlaskConical}
        title="Investigations"
        hint="Ordered or done at the chairside"
        summary={(investigations.ordered || []).slice(0, 3).join(', ')}
        count={investigations.ordered?.length || 0}
        open={isOpen('ix', false)}
        onToggle={() => flip('ix', false)}
      >
        <div className="pt-4 space-y-5">
          <SearchPicker
            label="Ordered or performed"
            options={INVESTIGATIONS}
            values={investigations.ordered}
            onChange={(v) => setInvestigations({ ordered: v })}
            common={8}
          />
          {investigations.ordered?.length > 0 && (
            <TextField
              label="Findings"
              value={investigations.findings}
              onChange={(v) => setInvestigations({ findings: v })}
              placeholder="Wood's lamp enhancement, KOH result, dermoscopy pattern..."
              rows={3}
            />
          )}
        </div>
      </Collapsible>

      <PlanBuilder derm={derm} onDermChange={setDerm} patientContext={patientContext} />

      {/* Diagnosis stays open and last. It is the line the rest of the record
          exists to support, and it is what the next doctor reads first. */}
      <section className="border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-7 h-7 rounded-lg bg-[#2a276e]/5 flex items-center justify-center text-[#2a276e] shrink-0">
            <Stethoscope size={15} />
          </span>
          <h3 className="text-sm font-bold text-gray-900">Diagnosis</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField
            label="Provisional"
            value={form.diagnosis}
            onChange={(v) => onFormChange({ ...form, diagnosis: v })}
            placeholder="e.g. Melasma, mixed type"
            rows={2}
          />
          <TextField
            label="Differential"
            hint="Half of dermatology is the second thing on the list"
            value={derm.differential}
            onChange={(v) => setDerm({ ...derm, differential: v })}
            placeholder="e.g. PIH, lichen planus pigmentosus"
            rows={2}
          />
        </div>
        <div className="mt-5">
          <TextField
            label="Examination summary"
            hint="For the parts that resist a checkbox"
            value={form.clinical_examination}
            onChange={(v) => onFormChange({ ...form, clinical_examination: v })}
            placeholder="Free text..."
            rows={2}
          />
        </div>
      </section>
    </section>
  );
};

export default DermClinicalSections;
