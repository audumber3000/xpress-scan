# Patient Components

This folder contains all components related to patient dental charts and records.

## Components

### ImprovedDentalChart
Main dental chart component that displays the full dental chart with interactive teeth.

**Props:**
- `teethData` (object): Data for all teeth (status and surfaces)
- `selectedTooth` (number): Currently selected tooth number
- `onToothSelect` (function): Callback when a tooth is selected
- `onSurfaceConditionChange` (function): Callback when surface condition changes
- `onToothStatusChange` (function): Callback when tooth status changes
- `editable` (boolean): Whether the chart is editable (default: true)

### ToothUnit
Renders a single tooth with its status and surface conditions.

**Props:**
- `toothNum` (number): The tooth number
- `isUpper` (boolean): Whether this is an upper tooth
- `status` (string): Tooth status (present, missing, implant, rootCanal)
- `surfaces` (object): Surface conditions (M, O, D, B, L)
- `isSelected` (boolean): Whether this tooth is currently selected
- `onToothPress` (function): Callback when tooth is clicked

### CleanToothSVG
Renders a clean tooth visualization with gradients and proper orientation.

**Props:**
- `toothNum` (number): The tooth number for unique gradient IDs
- `isUpper` (boolean): Whether this is an upper tooth (affects orientation)

### SurfaceSelectionModal
Modal for editing tooth status and surface conditions.

**Props:**
- `visible` (boolean): Whether the modal is visible
- `toothNum` (number): The tooth number being edited
- `currentSurfaces` (object): Current surface conditions
- `currentStatus` (string): Current tooth status
- `onClose` (function): Callback to close modal
- `onSurfaceConditionChange` (function): Callback when surface condition changes
- `onToothStatusChange` (function): Callback when tooth status changes

## Constants

### dentalConstants.js
Contains all shared constants and data:
- `UNIVERSAL_UPPER`: Array of upper tooth numbers
- `UNIVERSAL_LOWER`: Array of lower tooth numbers
- `TOOTH_NAMES`: Object mapping tooth numbers to names
- `SURFACE_COLORS`: Color scheme for surface conditions
- `CONDITION_LABELS`: Labels for conditions
- `STATUS_COLORS`: Colors for tooth status
- `STATUS_LABELS`: Labels for tooth status
- `SURFACES`: the neutral five, for when no specific tooth is in hand

Surfaces are a property of the tooth, not a fixed list. Prefer these over
`SURFACES` wherever a tooth is known:
- `surfacesFor(tooth)`: the five, named for that tooth. Anteriors (canine to
  canine) carry an **incisal** edge rather than an occlusal surface; upper teeth
  face the **palate** rather than the tongue. The stored key never changes —
  `M O D B L` are written exactly as before, and only `short`/`label` vary.
- `surfacesForMany(teeth)`: the same for a selection, judging each axis
  separately. A quadrant is certainly all upper (so palatal) while mixing front
  and back teeth (so the biting surface has no single name).
- `formatSurfaces(tooth, keys)`: `['O','D']` on #10 reads `"ID"`.
- `normaliseSurfaces(surfaces)`: folds the retired `F` key into `B`.

Condition and work are two axes, not one status:
- `TOOTH_CONDITIONS` / `WORK_TYPES_BY_STAGE`: what can be chosen. Extraction is
  planned-only — an extracted tooth is *missing*, not "existing extraction work".
- `deriveStatus({condition, work, workType})`: the legacy single `status`, which
  is still written so the chart, the PDFs and the mobile app need no changes.
- `readToothState(toothData)`: the two axes back out, reconstructed from a
  legacy `status` when the newer fields are absent.

## Usage

```javascript
import { ImprovedDentalChart } from './components/patient';

// Or import individual components
import ImprovedDentalChart from './components/patient/ImprovedDentalChart';
import { TOOTH_NAMES, CONDITION_LABELS } from './components/patient/dentalConstants';
```

## File Structure

```
patient/
├── CleanToothSVG.jsx          # Tooth SVG visualization
├── ToothUnit.jsx              # Individual tooth component
├── SurfaceSelectionModal.jsx  # Editing modal
├── ImprovedDentalChart.jsx    # Main chart component
├── dentalConstants.js         # Shared constants
├── index.js                   # Barrel exports
└── README.md                  # This file
```
