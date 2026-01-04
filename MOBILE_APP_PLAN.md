# Mobile App Implementation Plan

## Overview
The mobile app has two distinct UIs based on user role:
- **Admin/Clinic Owner**: Bottom tab navigation (existing)
- **Employee/Receptionist**: Home screen with grid cards (new)

## Current Status

### ✅ Completed
1. **Role-based UI Structure**
   - AuthContext with role detection
   - Conditional navigation (AdminTabNavigator vs EmployeeStackNavigator)
   - Login screen

2. **Employee Home Screen**
   - Grid layout with 3 columns
   - Clock in/out card with geofencing UI
   - Menu cards: Patients, Appointments, Payments, Patient Files, Settings

3. **Backend API for Clock In/Out**
   - `/attendance-mobile/clock-in` - Clock in with location
   - `/attendance-mobile/clock-out` - Clock out with location
   - `/attendance-mobile/status` - Get current clock status
   - `/attendance-mobile/history` - Get attendance history
   - Geofencing validation (100m radius from clinic)

4. **Employee Settings Screen**
   - Limited settings for employees
   - Account information display
   - Logout functionality

### 🚧 In Progress
1. **Clock In/Out Integration**
   - Connect EmployeeHomeScreen to backend API
   - Add reverse geocoding for address
   - Handle geofencing errors gracefully

### 📋 Pending
1. **Patient Registration Screen**
   - Form for adding new patients
   - Similar to web platform

2. **Mobile-Optimized Calendar View**
   - Clean calendar UI for appointments
   - Month/week/day views
   - Add/edit appointments

3. **Payments Screen**
   - View payments
   - Add payments
   - Similar to web platform

4. **Patient Files Screen**
   - View patient details
   - Dental chart
   - Reports and X-rays

5. **Database Migrations**
   - Add location fields to attendance table
   - Add latitude/longitude to clinics table (for geofencing)

## File Structure

```
mobile/
├── src/
│   ├── context/
│   │   └── AuthContext.js          ✅ Created
│   ├── screens/
│   │   ├── LoginScreen.js           ✅ Created
│   │   ├── EmployeeHomeScreen.js    ✅ Created
│   │   ├── EmployeeSettingsScreen.js ✅ Created
│   │   ├── PatientFilesScreen.js    ✅ Created (wrapper)
│   │   ├── HomeScreen.js            ✅ Exists (Admin)
│   │   ├── PatientsScreen.js        ✅ Exists
│   │   ├── CalendarScreen.js        ✅ Exists
│   │   ├── PaymentsScreen.js        ✅ Exists
│   │   └── SettingsScreen.js        ✅ Exists (Admin)
│   ├── navigation/
│   │   ├── AppNavigator.js          ✅ Created
│   │   ├── AdminTabNavigator.js     ✅ Created
│   │   ├── EmployeeStackNavigator.js ✅ Created
│   │   └── TabNavigator.js          ✅ Exists (old)
│   └── utils/
│       └── api.js                   ✅ Updated
```

## Backend APIs

### New Endpoints
- `POST /attendance-mobile/clock-in` - Clock in with location
- `POST /attendance-mobile/clock-out` - Clock out with location
- `GET /attendance-mobile/status` - Get clock status
- `GET /attendance-mobile/history` - Get attendance history

### Required Database Changes
1. Add location fields to `attendance` table:
   - `clock_in_latitude`, `clock_in_longitude`
   - `clock_in_address`, `clock_in_accuracy`
   - `clock_out_latitude`, `clock_out_longitude`
   - `clock_out_address`, `clock_out_accuracy`
   - `hours_worked`

2. Add location to `clinics` table (for geofencing):
   - `latitude`, `longitude`

## Next Steps

1. **Run migrations:**
```bash
cd backend
python migrate_add_attendance_location_fields.py
python migrate_add_clinic_location.py  # Need to create
```

2. **Update EmployeeHomeScreen:**
   - Connect to `/attendance-mobile/status` on load
   - Connect clock in/out buttons to API
   - Add reverse geocoding for address display
   - Handle geofencing errors

3. **Create remaining screens:**
   - Patient registration (mobile-optimized)
   - Calendar view (mobile-optimized)
   - Payments (mobile-optimized)

4. **Testing:**
   - Test geofencing with real locations
   - Test role-based navigation
   - Test all employee features

## Design Notes

- **Employee UI**: Simple, card-based navigation on home screen
- **Admin UI**: Traditional bottom tabs
- **Shared Screens**: Patient files, appointments, payments use same components
- **Color Scheme**: Purple (#6C4CF3) for headers, Green (#16a34a) for primary actions

