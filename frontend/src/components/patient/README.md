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
- `SURFACES`: Surface definitions with descriptions

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
