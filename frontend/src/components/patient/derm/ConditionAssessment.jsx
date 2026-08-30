import React from 'react';
import { Stethoscope } from 'lucide-react';
import { Collapsible, PickOne, PickMany, SearchPicker, NumberField } from './DermControls';
import { summariseAssessment } from './dermSummaries';

/**
 * The three-to-five questions this particular condition needs.
 *
 * Driven entirely by the condition's own `assess` list, so acne asks about
 * grade and scarring and melasma asks about Wood's lamp depth, and neither
 * shows the other's fields. This is where the two-hundred-chip problem
 * actually gets solved: the vocabulary did not shrink, the screen just stopped
 * asking everything at once.
 *
 * Opens expanded when it is empty — there is work to do — and collapses to a
 * one-line summary once answered, so a patient with three conditions reads as
 * three lines rather than three screens.
 */

const renderField = (field, value, setValue) => {
  const common = { key: field.key, label: field.label, hint: field.hint };

  if (field.type === 'score') {
    return (
      <div key={field.key} className="max-w-[220px]">
        <NumberField
          {...common}
          value={value}
          onChange={setValue}
          max={field.max}
          placeholder={field.max ? `0–${field.max}` : ''}
        />
      </div>
    );
  }

  if (field.type === 'one') {
    return <PickOne key={field.key} {...common} options={field.options} value={value} onChange={setValue} />;
  }

  // Multi-select. Short lists stay as plain chips; anything longer gets the
  // searchable picker, which is the rule the whole control set is built on.
  return field.options.length > 8 ? (
    <SearchPicker key={field.key} {...common} options={field.options} values={value || []} onChange={setValue} />
  ) : (
    <PickMany key={field.key} {...common} options={field.options} values={value || []} onChange={setValue} />
  );
};

const ConditionAssessment = ({ condition, answers = {}, onChange, open, onToggle }) => {
  const set = (key) => (value) => onChange({ ...answers, [key]: value });
  const summary = summariseAssessment(condition, answers);

  return (
    <Collapsible
      Icon={Stethoscope}
      title={condition.label}
      hint={condition.blurb}
      summary={summary}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-6 pt-4">
        {condition.assess.map((field) => renderField(field, answers[field.key], set(field.key)))}
      </div>
    </Collapsible>
  );
};

export default ConditionAssessment;
