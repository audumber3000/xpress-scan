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

export interface PatientFile {
  file_name: string;
  file_path: string;
  file_type: 'pdf' | 'image' | 'dicom' | 'xray' | 'other';
  file_size: number;
  uploaded_at: string;
  notes?: string;
}

export interface XrayFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  image_type: string;
  capture_date: string;
  notes?: string;
  created_at: string;
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
      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/`, {
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
      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/${patientId}`, {
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

      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/`, {
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
      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/${patientId}`, {
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
      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/${patientId}`, {
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

  async getFiles(patientId: string): Promise<PatientFile[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/${patientId}/files`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch patient files');
      return await response.json();
    } catch (error) {
      console.error('Error getting patient files:', error);
      return [];
    }
  }

  async uploadFile(patientId: string, file: any, notes?: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const formData = new FormData();
      formData.append('file', file);
      if (notes) formData.append('notes', notes);

      const response = await fetch(`${this.baseURL}/patients/${patientId}/files/upload`, {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload file');
      }
      return await response.json();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async getXrays(patientId: string): Promise<XrayFile[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/patients/${patientId}/xrays`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch x-rays');
      return await response.json();
    } catch (error) {
      console.error('Error getting x-rays:', error);
      return [];
    }
  }

  // ─── Case Papers ───────────────────────────────────────────
  async getCasePapers(patientId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/clinical/case-papers/patient/${patientId}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ [API] getCasePapers error:', error);
      return [];
    }
  }

  async createCasePaper(data: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/clinical/case-papers`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`HTTP ${response.status}: ${txt}`);
    }
    return await response.json();
  }

  async updateCasePaper(id: string, data: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/clinical/case-papers/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`HTTP ${response.status}: ${txt}`);
    }
    return await response.json();
  }

  // ─── Clinical Prescriptions ────────────────────────────────
  async getClinicalPrescriptions(patientId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/clinical/prescriptions/patient/${patientId}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ [API] getClinicalPrescriptions error:', error);
      return [];
    }
  }

  async createClinicalPrescription(data: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/clinical/prescriptions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  async updateClinicalPrescription(id: string, data: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/clinical/prescriptions/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  // ─── Lab Orders ────────────────────────────────────────────
  async getLabOrders(casePaperId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/clinical/lab-orders?case_paper_id=${casePaperId}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ [API] getLabOrders error:', error);
      return [];
    }
  }

  async createLabOrder(data: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/clinical/lab-orders`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  // ─── Patient Documents ─────────────────────────────────────
  async getPatientDocuments(patientId: string, casePaperId?: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `${this.baseURL}/documents/patient/${patientId}`;
      if (casePaperId) url += `?case_paper_id=${casePaperId}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET', headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ [API] getPatientDocuments error:', error);
      return [];
    }
  }

  // ─── Invoices ──────────────────────────────────────────────
  async getInvoices(patientId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/invoices?patient_id=${patientId}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ [API] getInvoices error:', error);
      return [];
    }
  }

  async createInvoice(data: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/invoices`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  async sendInvoiceWhatsApp(invoiceId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(
      `${this.baseURL}/invoices/${invoiceId}/send-whatsapp`,
      { method: 'POST', headers },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  // ─── Payments ──────────────────────────────────────────────
  async getPayments(patientId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/payments?patient_id=${patientId}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ [API] getPayments error:', error);
      return [];
    }
  }
}

export const patientsApiService = new PatientsApiService();