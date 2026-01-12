# Backend API Integration Guide

## Overview
This document outlines the API endpoints needed to connect the mobile app to your backend.

## Base URL
Update in `/src/services/api/apiService.ts`:
```typescript
private baseURL = 'https://your-actual-backend-url.com/api';
```

## Required API Endpoints

### 1. Analytics
**GET** `/analytics?period={period}`
- Parameters: `period` = '1W' | '1M' | '3M' | '6M' | 'All'
- Response:
```json
{
  "patientVisits": [65, 59, 80, 42, 65, 68, 45],
  "totalVisits": 32372,
  "percentageChange": "+5.66%",
  "period": "1M"
}
```

### 2. Transactions
**GET** `/transactions?limit={limit}`
- Parameters: `limit` (optional) - number of transactions to return
- Response:
```json
[
  {
    "id": "1",
    "patientName": "John Doe",
    "patientId": "patient_123",
    "type": "visit",
    "amount": 150,
    "date": "Today, 10:30 AM",
    "status": "completed"
  }
]
```

### 3. Appointments
**GET** `/appointments?date={date}&view={view}`
- Parameters: 
  - `date` (optional) - ISO date string
  - `view` (optional) - 'week' | 'month'
- Response:
```json
[
  {
    "id": "1",
    "patientId": "patient_123",
    "patientName": "John Doe",
    "startTime": "10:00 AM",
    "endTime": "11:00 AM",
    "status": "Finished",
    "type": "Checkup",
    "date": "2026-01-24"
  }
]
```

### 4. Patients
**GET** `/patients`
- Response:
```json
[
  {
    "id": "1",
    "name": "John Doe",
    "age": 34,
    "gender": "Male",
    "phone": "+1 234 567 8900",
    "email": "john@example.com",
    "address": "123 Main St",
    "lastVisit": "Jan 24, 2026",
    "nextAppointment": "Feb 15, 2026",
    "status": "Active"
  }
]
```

### 5. Patient Details
**GET** `/patients/{patientId}`
- Response:
```json
{
  "id": "1",
  "name": "John Doe",
  "age": 34,
  "gender": "Male",
  "phone": "+1 234 567 8900",
  "email": "john@example.com",
  "address": "123 Main St",
  "lastVisit": "Jan 24, 2026",
  "nextAppointment": "Feb 15, 2026",
  "status": "Active",
  "medicalHistory": [
    {
      "id": "1",
      "date": "Jan 20, 2026",
      "diagnosis": "Cavity",
      "treatment": "Filling",
      "doctor": "Smith",
      "notes": "Follow up in 6 months"
    }
  ],
  "billingHistory": [
    {
      "id": "1",
      "date": "Jan 20, 2026",
      "service": "Dental Filling",
      "amount": 150,
      "status": "paid"
    }
  ]
}
```

### 6. User Profile
**GET** `/user/profile`
- Response:
```json
{
  "id": "user_123",
  "email": "doctor@clinic.com",
  "name": "Dr. John Smith",
  "role": "clinic_owner",
  "phone": "+1 555 123 4567",
  "clinic": {
    "id": "clinic_123",
    "name": "Smile Dental Clinic",
    "address": "123 Medical Center, NY 10001"
  }
}
```

## Implementation Steps

1. **Update Base URL**: Replace the placeholder URL in `apiService.ts`
2. **Add Authentication Headers**: Implement token-based auth in API calls
3. **Test Each Endpoint**: Verify data structure matches interfaces
4. **Handle Errors**: Add proper error handling and user feedback
5. **Add Loading States**: Already implemented in screens
6. **Cache Data**: Consider implementing data caching for better UX

## Authentication
Add authorization headers to all API calls:
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## Error Handling
All API methods should handle errors gracefully and return null/empty arrays on failure.
