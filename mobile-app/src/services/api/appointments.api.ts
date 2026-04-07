import { BaseApiService } from './base.api';

export interface Appointment {
  id: string;
  patientId: string | null;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  startTime: string;
  endTime: string;
  status:
    | 'Finished'
    | 'Encounter'
    | 'Registered'
    | 'Cancelled'
    | 'confirmed'
    | 'accepted'
    | 'rejected'
    | 'checking';
  type?: string;
  date: string;
  treatment?: string;
  notes?: string;
  duration: number | string;
}

export interface AppointmentUpdatePayload {
  status?: string;
  rejection_reason?: string | null;
  patient_id?: number | null;
  doctor_id?: number | null;
  chair_number?: string;
  treatment?: string;
  notes?: string;
  patient_age?: number | null;
  patient_gender?: string;
  patient_village?: string;
  patient_referred_by?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
}

export interface DuplicatePatient {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: string;
  village?: string;
}

const mapAppointment = (apt: any): Appointment => ({
  id: apt.id.toString(),
  patientId: apt.patient_id?.toString() || null,
  patientName: apt.patient_name || 'Unknown',
  patientEmail: apt.patient_email || '',
  patientPhone: apt.patient_phone || '',
  startTime: apt.start_time?.substring(0, 5) || '',
  endTime: apt.end_time?.substring(0, 5) || '',
  status: apt.status || 'confirmed',
  type: apt.treatment || 'General',
  date: apt.appointment_date,
  treatment: apt.treatment,
  notes: apt.notes,
  duration: apt.duration || 60,
});

export class AppointmentsApiService extends BaseApiService {
  async getAppointments(dateFrom?: string, dateTo?: string): Promise<Appointment[]> {
    try {
      console.log('📅 [API] Fetching appointments from:', dateFrom, 'to:', dateTo);

      const headers = await this.getAuthHeaders();
      let url = `${this.baseURL}/appointments/`;

      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Appointments response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Appointments error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Appointments data received:', data.length);

      return data.map(mapAppointment);
    } catch (error: any) {
      console.error('❌ [API] Error fetching appointments:', error);
      throw error;
    }
  }

  async createAppointment(data: {
    patient_id?: number | null;
    patient_name: string;
    patient_email?: string;
    patient_phone?: string;
    clinic_id: number;
    doctor_id?: number | null;
    treatment?: string;
    appointment_date: string; // YYYY-MM-DD
    start_time: string; // HH:MM
    end_time: string; // HH:MM
    duration?: number;
    status?: string;
    notes?: string;
    chair_number?: string;
    patient_age?: number;
  }): Promise<Appointment> {
    try {
      console.log('📅 [API] Creating appointment:', data);

      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/appointments/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const apt = await response.json();
      return mapAppointment(apt);
    } catch (error: any) {
      console.error('❌ [API] Error creating appointment:', error);
      throw error;
    }
  }

  async updateAppointment(id: string, updateData: AppointmentUpdatePayload): Promise<Appointment> {
    try {
      console.log('📅 [API] Updating appointment:', id, updateData);

      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/appointments/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const apt = await response.json();
      return mapAppointment(apt);
    } catch (error: any) {
      console.error('❌ [API] Error updating appointment:', error);
      throw error;
    }
  }

  async getAppointment(id: string): Promise<Appointment> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/appointments/${id}`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      return mapAppointment(await response.json());
    } catch (error: any) {
      console.error('❌ [API] Error fetching appointment details:', error);
      throw error;
    }
  }

  async searchPatients(query: string): Promise<DuplicatePatient[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/appointments/search-patients?q=${encodeURIComponent(query)}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ [API] Error searching patients:', error);
      return [];
    }
  }

  async checkPatientDuplicates(payload: {
    name?: string;
    phone?: string;
    email?: string;
  }): Promise<DuplicatePatient[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams();
      if (payload.name) params.append('name', payload.name);
      if (payload.phone) params.append('phone', payload.phone);
      if (payload.email) params.append('email', payload.email);

      const response = await this.fetchWithTimeout(
        `${this.baseURL}/patients/check-duplicates?${params.toString()}`,
        { method: 'GET', headers },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ [API] Error checking duplicate patients:', error);
      return [];
    }
  }
}

export const appointmentsApiService = new AppointmentsApiService();