import React from 'react';
import ClinicalMultiSelect from './ClinicalMultiSelect';
import { ClipboardList } from 'lucide-react';

const ClinicalExamSection = ({ form, onFormChange }) => {
  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-[#2a276e]/5 flex items-center justify-center text-[#2a276e]">
          <ClipboardList size={18} />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Clinical Examination</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ClinicalMultiSelect 
          category="complaint"
          label="Chief Complaints"
          placeholder="e.g. Pain, Swelling, Checkup"
          selectedValues={form.chief_complaint}
          onChange={(vals) => onFormChange({...form, chief_complaint: vals})}
        />
        <ClinicalMultiSelect 
          category="medical-condition"
          label="Medical History"
          placeholder="e.g. Diabetes, Hypertension"
          selectedValues={form.medical_history}
          onChange={(vals) => onFormChange({...form, medical_history: vals})}
        />
        <ClinicalMultiSelect 
          category="dental-history"
          label="Dental History"
          placeholder="e.g. Previous RCT, Extractions"
          selectedValues={form.dental_history}
          onChange={(vals) => onFormChange({...form, dental_history: vals})}
        />
        <ClinicalMultiSelect 
          category="allergy"
          label="Allergies"
          placeholder="e.g. Penicillin, Latex"
          selectedValues={form.allergies}
          onChange={(vals) => onFormChange({...form, allergies: vals})}
        />
      </div>
    </section>
  );
};

export default ClinicalExamSection;
