/**
 * ImprovedDentalChart - Re-export from patient folder
 * 
 * This file maintains backward compatibility by re-exporting
 * the modular components from the patient folder.
 * 
 * The dental chart has been separated into the following components:
 * - ImprovedDentalChart (main component)
 * - ToothUnit (individual tooth rendering)
 * - CleanToothSVG (tooth SVG visualization)
 * - SurfaceSelectionModal (editing modal)
 * - dentalConstants (shared constants and data)
 * 
 * All components are now located in: /components/patient/
 */

export { default } from './patient/ImprovedDentalChart';
export { CONDITION_LABELS, TOOTH_NAMES } from './patient/dentalConstants';
