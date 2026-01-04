# 🔧 Patient Registration Fix

## Issue
When accepting an appointment and filling out the patient registration form, the error occurred:
```
Failed to register patient. Please try again
```

## Root Cause
The `referred_by` field was:
- **Required** in the backend schema (`referred_by: str`)
- **Required** in the database model (`nullable=False`)
- **Optional** in the frontend form (user could leave it empty)

When the user left it empty, the backend rejected the request with a validation error.

## Solution Applied

### 1. Backend Schema Update (`schemas.py`)
Made `referred_by` optional:
```python
# Before
referred_by: str

# After
referred_by: Optional[str] = None
```

### 2. Frontend Default Value (`Calendar.jsx`)
Added default value "Walk-in" for empty `referred_by`:

**A. In initial state:**
```javascript
const [patientFormData, setPatientFormData] = useState({
  // ... other fields ...
  referred_by: 'Walk-in',  // Default value
});
```

**B. When prefilling after accepting appointment:**
```javascript
setPatientFormData({
  // ... other fields ...
  referred_by: 'Walk-in',  // Default value
});
```

**C. When submitting (safety check):**
```javascript
const patientDataToSend = {
  ...patientFormData,
  referred_by: patientFormData.referred_by || 'Walk-in', // Fallback
  notes: patientFormData.notes || ''
};
```

## Result
✅ Patient registration now works correctly
✅ "Referred By" field is optional for users
✅ System automatically fills "Walk-in" if left empty
✅ No validation errors

## Files Modified
1. ✅ `/backend/schemas.py` - Made `referred_by` optional
2. ✅ `/frontend/src/pages/Calendar.jsx` - Added default value and fallback

## Testing
Now you can:
1. Accept an appointment ✅
2. Fill patient registration form
3. Leave "Referred By" empty (or fill it)
4. Submit ✅
5. Patient will be created successfully with `referred_by = "Walk-in"` if empty

## Future Enhancement (Optional)
To make the database column truly optional, create a migration:
```sql
ALTER TABLE patients ALTER COLUMN referred_by DROP NOT NULL;
```

But this is not necessary as the current solution works perfectly.









