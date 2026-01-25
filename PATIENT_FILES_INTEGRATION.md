# Patient Files API Integration - Summary

## Overview
Successfully integrated patient files APIs from backend to frontend with proper clean architecture. The integration includes dental charts, treatment plans with appointment linking, and file management (PDF, images, X-rays, DICOM).

---

## Backend Changes

### 1. Updated DTOs (`backend/core/dtos.py`)
Added clinical data fields to Patient DTOs:
- `dental_chart: Optional[Dict[str, Any]]` - Tooth-by-tooth dental conditions
- `tooth_notes: Optional[Dict[str, Any]]` - Clinical notes per tooth
- `treatment_plan: Optional[List[Dict[str, Any]]]` - Treatment plans array
- `prescriptions: Optional[List[Dict[str, Any]]]` - Prescriptions array

These fields are now in both `PatientUpdateDTO` and `PatientResponseDTO`.

### 2. Treatment Plan Service (`backend/domains/patient/services/treatment_plan_service.py`)
**New service** with full CRUD operations:
- `get_treatment_plans()` - Get all plans for a patient
- `create_treatment_plan()` - Create plan with optional appointment creation
- `update_treatment_plan()` - Update plan and sync with appointment
- `delete_treatment_plan()` - Delete plan and optionally delete appointment

**Key Feature**: When creating a treatment plan with date/time, it automatically creates an appointment in the calendar.

### 3. Treatment Plan Routes (`backend/domains/patient/routes/treatment_plans.py`)
RESTful endpoints:
- `GET /api/v1/patients/{patient_id}/treatment-plans`
- `POST /api/v1/patients/{patient_id}/treatment-plans`
- `PUT /api/v1/patients/{patient_id}/treatment-plans/{plan_id}`
- `DELETE /api/v1/patients/{patient_id}/treatment-plans/{plan_id}`

### 4. Patient Files Routes (`backend/domains/patient/routes/patient_files.py`)
File management endpoints:

**General Files:**
- `POST /api/v1/patients/{patient_id}/files/upload` - Upload PDF/images
- `GET /api/v1/patients/{patient_id}/files` - List all files
- `DELETE /api/v1/patients/{patient_id}/files/{file_name}` - Delete file

**X-ray Specific:**
- `POST /api/v1/patients/{patient_id}/xrays` - Upload X-ray with metadata
- `GET /api/v1/patients/{patient_id}/xrays` - List X-rays
- `DELETE /api/v1/patients/{patient_id}/xrays/{xray_id}` - Delete X-ray

Files are stored in: `./uploads/patient_files/{clinic_id}/{patient_id}/`

### 5. Registered Routes (`backend/main.py`)
Added to FastAPI app:
```python
app.include_router(treatment_plans.router, prefix="/api/v1/patients", tags=["treatment_plans"])
app.include_router(patient_files.router, prefix="/api/v1/patients", tags=["patient_files"])
```

---

## Frontend Changes

### 1. Patient Service Layer (`frontend/src/services/patientService.js`)
**New centralized API service** with clean, modular functions:

**Patient Operations:**
- `patientService.getPatients()`
- `patientService.getPatient(patientId)`
- `patientService.updatePatient(patientId, data)`
- `patientService.createPatient(data)`
- `patientService.deletePatient(patientId)`

**Treatment Plans:**
- `treatmentPlanService.getTreatmentPlans(patientId)`
- `treatmentPlanService.createTreatmentPlan(patientId, planData)`
- `treatmentPlanService.updateTreatmentPlan(patientId, planId, updates)`
- `treatmentPlanService.deleteTreatmentPlan(patientId, planId, deleteAppointment)`

**File Management:**
- `patientFilesService.uploadFile(patientId, file, notes)`
- `patientFilesService.getFiles(patientId)`
- `patientFilesService.deleteFile(patientId, fileName)`
- `patientFilesService.uploadXray(patientId, file, imageType, captureDate, notes)`
- `patientFilesService.getXrays(patientId)`
- `patientFilesService.deleteXray(patientId, xrayId)`

**Appointments & Payments:**
- `appointmentService.*` - Full CRUD for appointments
- `paymentService.*` - Payment operations

### 2. Updated PatientProfile (`frontend/src/pages/PatientProfile.jsx`)
Replaced direct `api` calls with service layer:
- Uses `patientService.getPatient()` to fetch patient data
- Uses `patientService.updatePatient()` to save dental charts, notes, treatment plans
- Uses `appointmentService.getAppointments()` for appointments
- Uses `paymentService.getPayments()` for payment history

### 3. Updated PatientFiles (`frontend/src/pages/PatientFiles.jsx`)
- Uses `patientService.getPatients()` instead of direct API call

---

## Architecture Benefits

### Clean Separation of Concerns
- **Backend**: Service → Repository → Database
- **Frontend**: Component → Service → API

### Modular & Maintainable
- All API calls centralized in `patientService.js`
- Easy to update endpoints without touching components
- Type-safe with JSDoc comments

### Treatment Plan + Appointment Integration
When a doctor creates a treatment plan with a date/time:
1. Treatment plan is saved to patient record
2. Appointment is automatically created in calendar
3. Both are linked via `appointment_id`
4. Updating/deleting plan can sync with appointment

---

## Testing Instructions

### Backend Testing
```bash
cd backend
# Start the server (make sure dependencies are installed)
uvicorn main:app --reload --port 8000
```

Test endpoints:
```bash
# Get patient with clinical data
curl http://localhost:8000/api/v1/patients/1

# Create treatment plan
curl -X POST http://localhost:8000/api/v1/patients/1/treatment-plans \
  -H "Content-Type: application/json" \
  -d '{
    "procedure": "Root Canal",
    "tooth": 14,
    "date": "2026-02-01",
    "time": "10:00",
    "cost": 5000,
    "create_appointment": true
  }'

# Upload file
curl -X POST http://localhost:8000/api/v1/patients/1/files/upload \
  -F "file=@test.pdf" \
  -F "notes=Test document"
```

### Frontend Testing
```bash
cd frontend
npm run dev
```

Navigate to:
1. **Patient Files** (`/patient-files`) - Should load patient list
2. **Patient Profile** (`/patient-profile/1`) - Should load with all tabs
3. **Dental Chart Tab** - Save dental chart data
4. **Timeline Tab** - View/create treatment plans
5. **Files Tab** - Upload/view files

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/patients/` | Get all patients |
| GET | `/api/v1/patients/{id}` | Get patient with clinical data |
| PUT | `/api/v1/patients/{id}` | Update patient (includes dental_chart, etc.) |
| GET | `/api/v1/patients/{id}/treatment-plans` | Get treatment plans |
| POST | `/api/v1/patients/{id}/treatment-plans` | Create treatment plan |
| PUT | `/api/v1/patients/{id}/treatment-plans/{plan_id}` | Update treatment plan |
| DELETE | `/api/v1/patients/{id}/treatment-plans/{plan_id}` | Delete treatment plan |
| POST | `/api/v1/patients/{id}/files/upload` | Upload file |
| GET | `/api/v1/patients/{id}/files` | List files |
| DELETE | `/api/v1/patients/{id}/files/{file_name}` | Delete file |
| POST | `/api/v1/patients/{id}/xrays` | Upload X-ray |
| GET | `/api/v1/patients/{id}/xrays` | List X-rays |
| DELETE | `/api/v1/patients/{id}/xrays/{xray_id}` | Delete X-ray |

---

## Files Modified/Created

### Backend
- ✅ `backend/core/dtos.py` - Added clinical fields to DTOs
- ✅ `backend/domains/patient/services/treatment_plan_service.py` - **NEW**
- ✅ `backend/domains/patient/routes/treatment_plans.py` - **NEW**
- ✅ `backend/domains/patient/routes/patient_files.py` - **NEW**
- ✅ `backend/main.py` - Registered new routes

### Frontend
- ✅ `frontend/src/services/patientService.js` - **NEW** centralized API service
- ✅ `frontend/src/pages/PatientProfile.jsx` - Updated to use service layer
- ✅ `frontend/src/pages/PatientFiles.jsx` - Updated to use service layer

---

## Next Steps (Optional Enhancements)

1. **File Download Endpoint** - Add endpoint to download/serve uploaded files
2. **DICOM Viewer** - Integrate DICOM viewer for X-ray images
3. **Treatment Plan Templates** - Pre-defined treatment plan templates
4. **Bulk File Upload** - Upload multiple files at once
5. **File Preview** - Preview PDFs and images in browser
6. **Treatment Plan Status Workflow** - Track plan progress (planned → in_progress → completed)

---

## Notes

- All endpoints require authentication (JWT token)
- File uploads use multipart/form-data
- Treatment plans stored as JSON in patient.treatment_plan column
- Appointments API already existed in `/api/v1/appointments`
- Clean architecture maintained throughout
- No breaking changes to existing functionality
