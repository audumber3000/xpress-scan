# Treatment Plan to Appointment Integration - Improvements

## Issues Fixed

### 1. ✅ Missing Time Field
**Problem:** Treatment plans didn't have a time field, so appointments couldn't be created with proper scheduling.

**Solution:** 
- Added `time` input field to treatment plan UI
- Shows time picker when editing treatment plans
- Displays formatted time (e.g., "10:00 AM") in view mode
- Default time is 10:00 AM

### 2. ✅ Visit Number Tracking
**Problem:** No way to track which visit number each treatment is.

**Solution:**
- Added `visit_number` field to treatment plans
- Auto-increments for each new treatment
- Displays as a badge in the UI (e.g., "Visit #1", "Visit #2")
- Shows in table header as "Visit #" column

### 3. ✅ Appointments Not Auto-Accepted
**Problem:** Appointments created from treatment plans had status "confirmed" instead of "accepted", so they didn't show on calendar.

**Solution:**
- Changed appointment status to `"accepted"` when created from treatment plan
- Appointments now automatically appear on the calendar
- No manual acceptance needed

### 4. ✅ Appointment Creation Integration
**Problem:** Treatment plans were saved but appointments weren't being created.

**Solution:**
- Backend automatically creates appointment when treatment plan has date + time
- Links appointment to treatment plan via `appointment_id`
- Appointment includes all details: patient, procedure, date, time, duration

---

## Changes Made

### Frontend

#### 1. **PatientTimeline.jsx** (`@/Users/audii3000/Documents/Personal Projects/xpress-scan/frontend/src/components/patient/PatientTimeline.jsx`)

**Added time input field:**
```javascript
<input
    type="time"
    value={editData.time || '10:00'}
    onChange={e => setEditData({ ...editData, time: e.target.value })}
    className="w-full p-2 border border-gray-200 rounded-lg text-xs"
/>
```

**Display formatted time and visit number:**
```javascript
<span className="text-xs text-[#2a276e] font-bold mt-1">
    {formatTime(item.time || '10:00')}
</span>
<span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
    Visit #{item.visit_number || index + 1}
</span>
```

**Updated table header:**
- Changed "Planned Date" → "Planned Date & Time"
- Changed "Sequence" → "Visit #"

**Updated visit number badge:**
- Shows as styled badge with gradient background
- Auto-increments for new items

#### 2. **PatientProfile.jsx** (`@/Users/audii3000/Documents/Personal Projects/xpress-scan/frontend/src/pages/PatientProfile.jsx`)

**Updated `generateTreatmentPlan()` function:**
```javascript
const generateTreatmentPlan = () => {
    const newPlan = [];
    let visitNumber = treatmentPlan.length + 1;
    
    // ... for each treatment
    newPlan.push({
        id: Date.now() + Math.random(),
        procedure: `Composite Restoration (${surface})`,
        tooth: toothNum,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '10:00',  // ✅ Added
        status: 'planned',
        cost: 1500,
        notes: `Decay detected on ${surface} surface`,
        visit_number: visitNumber++  // ✅ Added
    });
};
```

### Backend

#### 3. **treatment_plan_service.py** (`@/Users/audii3000/Documents/Personal Projects/xpress-scan/backend/domains/patient/services/treatment_plan_service.py`)

**Added time and visit_number to treatment plan:**
```python
new_plan = {
    "id": plan_data.get("id") or datetime.now().timestamp(),
    "procedure": plan_data.get("procedure"),
    "tooth": plan_data.get("tooth"),
    "date": plan_data.get("date"),
    "time": plan_data.get("time", "10:00"),  # ✅ Added
    "visit_number": plan_data.get("visit_number", len(treatment_plans) + 1),  # ✅ Added
    "status": plan_data.get("status", "planned"),
    "cost": plan_data.get("cost", 0),
    "notes": plan_data.get("notes", ""),
    "created_at": datetime.utcnow().isoformat(),
    "appointment_id": None
}
```

**Changed appointment status to auto-accept:**
```python
appointment = Appointment(
    clinic_id=clinic_id,
    patient_id=patient.id,
    patient_name=patient.name,
    patient_email=None,
    patient_phone=patient.phone,
    doctor_id=plan_data.get("doctor_id"),
    treatment=plan_data.get("procedure", "Treatment"),
    appointment_date=appointment_datetime,
    start_time=time_str,
    end_time=end_time,
    duration=duration,
    status="accepted",  # ✅ Changed from "confirmed" to "accepted"
    notes=plan_data.get("notes", f"Treatment plan: {plan_data.get('procedure')}")
)
```

---

## How It Works Now

### Creating a Treatment Plan with Appointment

1. **Go to Patient Profile** → Timeline tab
2. **Click "Add Manual Step"** or **"Generate from Chart"**
3. **Edit the treatment:**
   - Enter procedure name
   - Select date
   - **Select time** (e.g., 10:00 AM)
   - Enter cost
   - Add notes
4. **Click Save** (checkmark button)
5. **Click "Save Clinical Records"** at top of page

### What Happens Behind the Scenes

1. Treatment plan is saved to patient record with:
   - Visit number (auto-incremented)
   - Date and time
   - All other details

2. **Backend automatically creates appointment:**
   - Status: `"accepted"` (auto-approved)
   - Patient info populated
   - Treatment/procedure name
   - Date and time from plan
   - Duration: 60 minutes (default)
   - Links back to treatment plan

3. **Appointment appears on calendar:**
   - Shows in appointments list
   - Visible on calendar view
   - Can be edited/managed separately
   - Status is "accepted" so it's confirmed

### Visit Number Tracking

- **Visit #1, #2, #3...** shown in treatment plan table
- Auto-increments for each new treatment
- Helps track treatment sequence
- Shows which visit is which

---

## Testing Steps

1. **Create a treatment plan:**
   ```
   - Procedure: "Root Canal"
   - Date: Tomorrow
   - Time: 2:00 PM
   - Cost: 5000
   ```

2. **Save the patient data**

3. **Check the calendar/appointments page:**
   - Should see appointment for tomorrow at 2:00 PM
   - Status should be "accepted"
   - Patient name should be populated
   - Treatment should say "Root Canal"

4. **Verify visit numbers:**
   - First treatment should show "Visit #1"
   - Second treatment should show "Visit #2"
   - And so on...

---

## API Integration

### Frontend → Backend

When saving treatment plan:
```json
{
  "treatment_plan": [
    {
      "id": 1706123456789,
      "procedure": "Root Canal",
      "tooth": 14,
      "date": "2026-01-25",
      "time": "14:00",
      "visit_number": 1,
      "status": "planned",
      "cost": 5000,
      "notes": "Patient reports sensitivity"
    }
  ]
}
```

### Backend → Appointment Creation

Backend automatically creates:
```python
Appointment(
    patient_id=1,
    patient_name="John Doe",
    treatment="Root Canal",
    appointment_date="2026-01-25 14:00",
    start_time="14:00",
    end_time="15:00",
    status="accepted",  # Auto-approved!
    notes="Treatment plan: Root Canal"
)
```

---

## Benefits

✅ **Time field** - Appointments now have proper scheduling times
✅ **Visit tracking** - Easy to see which visit is which (Visit #1, #2, etc.)
✅ **Auto-acceptance** - No manual approval needed for treatment plan appointments
✅ **Calendar integration** - Appointments automatically appear on calendar
✅ **Linked data** - Treatment plans and appointments are connected via `appointment_id`
✅ **Better UX** - Doctors can plan treatments and schedule appointments in one place

---

## Notes

- Default time is 10:00 AM if not specified
- Default duration is 60 minutes
- Appointments are auto-accepted (status: "accepted")
- Visit numbers auto-increment starting from 1
- Time is displayed in 12-hour format (e.g., "2:00 PM")
- Backend stores time in 24-hour format (e.g., "14:00")
