# Appointment Workflow Features

## Overview
This document describes the enhanced appointment management workflow with accept/reject functionality and patient registration.

## Features Implemented

### 1. Appointment Status Management
- **Three statuses**: `confirmed`, `accepted`, `rejected`
- Default status for new appointments: `confirmed`
- Status updates via API: `PUT /appointments/{id}`

### 2. Accept/Reject Buttons
- **Location**: Appointment detail panel (right-side drawer)
- **Visibility**: Only shown for appointments with status `confirmed`
- **Behavior**:
  - **Accept**: Changes status to `accepted` and opens patient registration form
  - **Reject**: Changes status to `rejected` after confirmation dialog
  - Buttons disappear after action is taken

### 3. Visual Status Indicators

#### On Calendar
- **Green checkmark (✓)**: Accepted appointments
- **Red cross (✗)**: Rejected appointments
- **No indicator**: Pending/confirmed appointments

#### In Detail Panel
- **Status badge** with color coding:
  - Green: ✓ Accepted
  - Red: ✗ Rejected
  - Yellow: ⏳ Pending Confirmation
- **Status message box**:
  - Green box for accepted: "Appointment Accepted - Patient registration completed"
  - Red box for rejected: "Appointment Rejected - This appointment has been declined"

### 4. Patient Registration Form

#### When Shown
- Automatically opens after accepting an appointment
- Right-side drawer modal (same style as appointment detail)

#### Pre-filled Fields
- **Patient Name**: From appointment (read-only)
- **Phone**: From appointment
- **Treatment Type**: From appointment
- **Notes**: From appointment notes

#### Required Fields
- Patient Name ✓ (pre-filled)
- Age
- Gender (Male/Female/Other)
- Village/City
- Phone ✓ (pre-filled)
- Treatment Type ✓ (pre-filled)
- Payment Type (default: Cash)

#### Optional Fields
- Referred By
- Notes

#### Submission
1. Creates a new patient record via `POST /patients/`
2. Links patient to appointment via `PUT /appointments/{id}` with `patient_id`
3. Refreshes appointment list
4. Closes both forms

### 5. State Management

#### New State Variables
```javascript
const [showPatientForm, setShowPatientForm] = useState(false);
const [patientFormData, setPatientFormData] = useState({
  name: '',
  age: '',
  gender: '',
  village: '',
  phone: '',
  referred_by: '',
  treatment_type: '',
  notes: '',
  payment_type: 'Cash'
});
```

#### API Endpoints Used
- `GET /appointments?date_from=...&date_to=...` - Fetch appointments
- `POST /appointments/` - Create new appointment
- `PUT /appointments/{id}` - Update appointment status/link patient
- `POST /patients/` - Create new patient

## User Workflow

### Scenario 1: Accepting an Appointment
1. User clicks on appointment in calendar
2. Appointment detail panel opens from right
3. User sees "Accept" and "Reject" buttons
4. User clicks "Accept Appointment"
5. Status updates to `accepted` ✓
6. Patient registration form opens automatically
7. User fills in required patient details (age, gender, village, payment type)
8. User clicks "Complete Registration"
9. Patient record is created and linked to appointment
10. Success message shown, forms close
11. Calendar updates with green checkmark ✓ on appointment

### Scenario 2: Rejecting an Appointment
1. User clicks on appointment in calendar
2. Appointment detail panel opens from right
3. User clicks "Reject" button
4. Confirmation dialog appears: "Are you sure you want to reject this appointment?"
5. User confirms
6. Status updates to `rejected` ✗
7. Red cross appears on appointment in calendar
8. Detail panel shows "Appointment Rejected" message in red

### Scenario 3: Viewing Accepted/Rejected Appointments
1. User clicks on appointment with status indicator
2. Detail panel opens
3. Accept/Reject buttons are hidden
4. Status message box is shown (green or red)
5. Only "See Patient Details" button is available

## UI Components

### Appointment Card (Calendar View)
```jsx
<div className="relative">
  {/* Status Badge - Top Right */}
  {appointment.status === 'accepted' && (
    <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full">
      <svg>✓</svg>
    </div>
  )}
  {appointment.status === 'rejected' && (
    <div className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full">
      <svg>✗</svg>
    </div>
  )}
  {/* Appointment Info */}
</div>
```

### Detail Panel - Action Buttons
```jsx
{selectedAppointment.status === 'confirmed' && (
  <div className="flex gap-3">
    <button onClick={handleAcceptAppointment}>
      ✓ Accept Appointment
    </button>
    <button onClick={handleRejectAppointment}>
      ✗ Reject
    </button>
  </div>
)}
```

### Patient Registration Form
- Full-screen right drawer
- Scroll-enabled content area
- Fixed header and footer
- Form validation (HTML5 + required attributes)
- Submit button in footer: "Complete Registration"

## Technical Details

### Status Flow
```
New Appointment → "confirmed"
                    ↓
      ┌─────────────┴─────────────┐
      ↓                           ↓
  "accepted"                 "rejected"
      ↓
  Patient Registration
      ↓
  Patient Linked
```

### Data Structure

#### Appointment Object (Frontend)
```javascript
{
  id: 1,
  patientName: "John Doe",
  patientEmail: "john@example.com",
  patientPhone: "1234567890",
  patientAvatar: "JD",
  treatment: "Root Canal",
  doctor: "Dr. Smith",
  startTime: "10:00",
  endTime: "11:00",
  date: "2025-12-26",
  status: "confirmed", // or "accepted" or "rejected"
  color: "bg-blue-100 border-blue-200 text-blue-800",
  notes: ""
}
```

#### Patient Form Data
```javascript
{
  name: "John Doe",           // Pre-filled from appointment
  age: "35",                  // User enters
  gender: "Male",             // User selects
  village: "Downtown",        // User enters
  phone: "1234567890",        // Pre-filled from appointment
  referred_by: "Dr. Jones",   // Optional
  treatment_type: "Root Canal", // Pre-filled from appointment
  notes: "First visit",       // Pre-filled from appointment notes
  payment_type: "Cash"        // User selects (default: Cash)
}
```

## Future Enhancements (Optional)
- [ ] Email notification on acceptance/rejection
- [ ] SMS notification to patient
- [ ] Reschedule appointment option
- [ ] Cancel appointment (different from reject)
- [ ] View patient history from detail panel
- [ ] Edit appointment details
- [ ] Batch accept/reject multiple appointments
- [ ] Filter appointments by status
- [ ] Export appointments to PDF/CSV

## Testing Checklist
- [x] Accept appointment - status updates to "accepted"
- [x] Reject appointment - status updates to "rejected"
- [x] Green checkmark appears on accepted appointments
- [x] Red cross appears on rejected appointments
- [x] Patient form opens after accepting
- [x] Patient form has all required fields
- [x] Patient registration creates new patient
- [x] Patient is linked to appointment after registration
- [x] Buttons disappear after accept/reject
- [x] Status message box appears correctly
- [x] Confirmation dialog for rejection

## Files Modified
1. `/frontend/src/pages/Calendar.jsx`
   - Added state management for patient form
   - Added accept/reject handlers
   - Added patient registration handler
   - Updated appointment detail panel UI
   - Added status indicators to calendar appointments
   - Added patient registration form modal

## API Requirements
Backend endpoints must support:
- `PUT /appointments/{id}` with `status` field
- `PUT /appointments/{id}` with `patient_id` field
- `POST /patients/` with all required patient fields













