import { BaseApiService } from './base.api';

export interface MedicalRecord {
  id: string;
  date: string;
  diagnosis: string;
  treatment: string;
  doctor: string;
  notes?: string;
}

export interface BillingRecord {
  id: string;
  date: string;
  service: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  lastVisit: string;
  nextAppointment?: string;
  status: 'Active' | 'Inactive';
  billingHistory?: BillingRecord[];
  dentalChart?: any;
  toothNotes?: any;
  treatmentPlan?: any[];
  prescriptions?: any[];
}

export class PatientsApiService extends BaseApiService {
  async getPatients(): Promise<Patient[]> {
    try {
      console.log('👥 [API] Fetching patients from:', `${this.baseURL}/patients`);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/patients`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Patients response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Patients error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Patients data received:', data.length, 'patients');

      // Transform backend response to match Patient interface
      const patients: Patient[] = data.map((patient: any) => ({
        id: patient.id.toString(),
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email || '',
        address: patient.village || '',
        lastVisit: patient.created_at ? new Date(patient.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 'N/A',
        status: 'Active', // Default status
      }));

      console.log('✅ [API] Transformed patients:', patients.length);
      return patients;
    } catch (error: any) {
      console.error('❌ [API] Error fetching patients:', error);
      console.error('❌ [API] Error message:', error.message);
      return [];
    }
  }

  async getPatientDetails(patientId: string): Promise<Patient | null> {
    try {
      console.log('👥 [API] Fetching patient from:', `${this.baseURL}/patients/${patientId}`);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/patients/${patientId}`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Patient details response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Patient details error response:', errorText);

        if (response.status === 404) {
          console.error('❌ [API] Patient not found');
          return null;
        }

        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Patient details received:', JSON.stringify(data, null, 2));

      // Transform backend response to match Patient interface
      const patient: Patient = {
        id: data.id.toString(),
        name: data.name,
        age: data.age || 0,
        gender: data.gender || 'Unknown',
        phone: data.phone || '',
        email: data.email,
        address: data.village || data.address,
        lastVisit: data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 'N/A',
        nextAppointment: data.next_appointment,
        status: data.sync_status === 'synced' || data.created_at ? 'Active' : 'Inactive',
        dentalChart: data.dental_chart || {},
        toothNotes: data.tooth_notes || {},
        treatmentPlan: data.treatment_plan || [],
        prescriptions: data.prescriptions || [],
      };

      console.log('✅ [API] Transformed patient details:', patient);
      return patient;
    } catch (error: any) {
      console.error('❌ [API] Error fetching patient details:', error);
      console.error('❌ [API] Error message:', error.message);
      return null;
    }
  }

  async createPatient(patientData: {
    name: string;
    age: number;
    gender: string;
    village: string;
    phone: string;
    referred_by?: string;
    treatment_type: string;
    notes?: string;
    payment_type: string;
  }): Promise<any> {
    try {
      console.log('👥 [API] Creating patient...');
      console.log('📋 [API] Patient data:', JSON.stringify(patientData, null, 2));

      const headers = await this.getAuthHeaders();
      console.log('🔑 [API] Headers:', headers);

      const requestBody = JSON.stringify(patientData);
      console.log('📤 [API] Request body:', requestBody);

      const response = await fetch(`${this.baseURL}/patients`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      console.log('📡 [API] Create patient response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Create patient error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Patient created successfully:', data);
      return data;
    } catch (error: any) {
      console.error('❌ [API] Error creating patient:', error);
      throw error;
    }
  }

  async updatePatient(patientId: string, updateData: Partial<any>): Promise<any> {
    try {
      console.log('👥 [API] Updating patient:', patientId);
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/patients/${patientId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ [API] Error updating patient:', error);
      throw error;
    }
  }

  async deletePatient(patientId: string): Promise<void> {
    try {
      console.log('🗑️ [API] Deleting patient:', patientId);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/patients/${patientId}`, {
        method: 'DELETE',
        headers: headers,
      });

      console.log('📡 [API] Delete patient response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Delete patient error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      console.log('✅ [API] Patient deleted successfully');
    } catch (error: any) {
      console.error('❌ [API] Error deleting patient:', error);
      throw error;
    }
  }
}

export const patientsApiService = new PatientsApiService();