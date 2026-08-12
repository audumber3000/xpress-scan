import React from 'react';
import MedicationGroupsTab from '../../components/vendors/MedicationGroupsTab';

/**
 * Control Center → Prescription Sets.
 *
 * Lives here rather than in Inventory because it is configuration: a set is
 * decided once and then used, the same as a treatment's price or a document
 * template. Inventory answers a different question, which is what is on the
 * shelf today and what is running out.
 *
 * It also sits beside Treatments & Pricing on purpose, since a set is linked
 * to a treatment type.
 */
const PrescriptionSets = () => (
  <div className="p-4 md:p-6">
    <MedicationGroupsTab />
  </div>
);

export default PrescriptionSets;
