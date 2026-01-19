// API Services Index
// Export all API services for easy importing

export { baseApiService } from './base.api';
export { authApiService, type BackendUser } from './auth.api';
export { patientsApiService, type Patient, type MedicalRecord, type BillingRecord } from './patients.api';
export { transactionsApiService, type Transaction } from './transactions.api';
export { analyticsApiService, type Analytics } from './analytics.api';
export { appointmentsApiService, type Appointment } from './appointments.api';
export { treatmentApiService } from './treatment.api';