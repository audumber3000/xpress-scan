/**
 * Patient Service - API calls for patient files, dental charts, treatment plans
 */
import { api } from '../utils/api';

// ==================== Patient CRUD ====================
export const patientService = {
  /**
   * Get all patients for the clinic
   */
  getPatients: async (params = {}) => {
    return await api.get('/patients/', { params });
  },

  /**
   * Get a specific patient by ID
   */
  getPatient: async (patientId) => {
    return await api.get(`/patients/${patientId}`);
  },

  /**
   * Update patient data (including dental chart, tooth notes, treatment plan, prescriptions)
   */
  updatePatient: async (patientId, data) => {
    return await api.put(`/patients/${patientId}`, data);
  },

  /**
   * Create a new patient
   */
  createPatient: async (data) => {
    return await api.post('/patients/', data);
  },

  /**
   * Delete a patient
   */
  deletePatient: async (patientId) => {
    return await api.delete(`/patients/${patientId}`);
  },
};

// ==================== Treatment Plans ====================
export const treatmentPlanService = {
  /**
   * Get all treatment plans for a patient
   */
  getTreatmentPlans: async (patientId) => {
    return await api.get(`/patients/${patientId}/treatment-plans`);
  },

  /**
   * Create a new treatment plan (optionally creates appointment)
   */
  createTreatmentPlan: async (patientId, planData) => {
    return await api.post(`/patients/${patientId}/treatment-plans`, planData);
  },

  /**
   * Update a treatment plan
   */
  updateTreatmentPlan: async (patientId, planId, updates) => {
    return await api.put(`/patients/${patientId}/treatment-plans/${planId}`, updates);
  },

  /**
   * Delete a treatment plan (optionally deletes associated appointment)
   */
  deleteTreatmentPlan: async (patientId, planId, deleteAppointment = true) => {
    return await api.delete(`/patients/${patientId}/treatment-plans/${planId}`, {
      params: { delete_appointment: deleteAppointment }
    });
  },
};

// ==================== Patient Files ====================
export const patientFilesService = {
  /**
   * Upload a file for a patient (PDF, image, etc.)
   */
  uploadFile: async (patientId, file, notes = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) {
      formData.append('notes', notes);
    }

    return await api.post(`/patients/${patientId}/files/upload`, formData);
  },

  /**
   * Get all files for a patient
   */
  getFiles: async (patientId) => {
    return await api.get(`/patients/${patientId}/files`);
  },

  /**
   * Delete a patient file
   */
  deleteFile: async (patientId, fileName) => {
    return await api.delete(`/patients/${patientId}/files/${fileName}`);
  },

  /**
   * Upload an X-ray image with metadata
   */
  uploadXray: async (patientId, file, imageType, captureDate, notes = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('image_type', imageType);
    formData.append('capture_date', captureDate);
    if (notes) {
      formData.append('notes', notes);
    }

    return await api.post(`/patients/${patientId}/xrays`, formData);
  },

  /**
   * Get all X-ray images for a patient
   */
  getXrays: async (patientId) => {
    return await api.get(`/patients/${patientId}/xrays`);
  },

  /**
   * Delete an X-ray image
   */
  deleteXray: async (patientId, xrayId) => {
    return await api.delete(`/patients/${patientId}/xrays/${xrayId}`);
  },
};

// ==================== Appointments ====================
export const appointmentService = {
  /**
   * Get all appointments with optional filters
   */
  getAppointments: async (params = {}) => {
    return await api.get('/appointments', { params });
  },

  /**
   * Get a specific appointment
   */
  getAppointment: async (appointmentId) => {
    return await api.get(`/appointments/${appointmentId}`);
  },

  /**
   * Create a new appointment
   */
  createAppointment: async (data) => {
    return await api.post('/appointments', data);
  },

  /**
   * Update an appointment
   */
  updateAppointment: async (appointmentId, updates) => {
    return await api.put(`/appointments/${appointmentId}`, updates);
  },

  /**
   * Delete an appointment
   */
  deleteAppointment: async (appointmentId) => {
    return await api.delete(`/appointments/${appointmentId}`);
  },
};

// ==================== Payments ====================
export const paymentService = {
  /**
   * Get all payments with optional filters
   */
  getPayments: async (params = {}) => {
    return await api.get('/payments', { params });
  },

  /**
   * Get payments for a specific patient
   */
  getPatientPayments: async (patientId) => {
    return await api.get('/payments', { params: { patient_id: patientId } });
  },

  /**
   * Create a new payment
   */
  createPayment: async (data) => {
    return await api.post('/payments', data);
  },
};

export default {
  patient: patientService,
  treatmentPlan: treatmentPlanService,
  files: patientFilesService,
  appointment: appointmentService,
  payment: paymentService,
};
