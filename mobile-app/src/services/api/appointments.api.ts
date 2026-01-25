import { BaseApiService } from './base.api';

export interface Appointment {
  id: string;
  patientId: string | null;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  startTime: string;
  endTime: string;
  status: 'Finished' | 'Encounter' | 'Registered' | 'Cancelled' | 'confirmed' | 'accepted' | 'rejected';
  type?: string;
  date: string;
  treatment?: string;
  notes?: string;
  duration: number | string;
}

export class AppointmentsApiService extends BaseApiService {
  async getAppointments(dateFrom?: string, dateTo?: string): Promise<Appointment[]> {
    try {
      console.log('📅 [API] Fetching appointments from:', dateFrom, 'to:', dateTo);

      const headers = await this.getAuthHeaders();
      let url = `${this.baseURL}/appointments`;

      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await fetch(url, {
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

      // Transform backend response to match Appointment interface
      return data.map((apt: any) => ({
        id: apt.id.toString(),
        patientId: apt.patient_id?.toString() || null,
        patientName: apt.patient_name || 'Unknown',
        patientEmail: apt.patient_email || '',
        patientPhone: apt.patient_phone || '',
        startTime: apt.start_time?.substring(0, 5) || '', // HH:MM
        endTime: apt.end_time?.substring(0, 5) || '',
        status: apt.status || 'confirmed',
        type: apt.treatment || 'General',
        date: apt.appointment_date,
        treatment: apt.treatment,
        notes: apt.notes,
        duration: apt.duration || 60
      }));
    } catch (error: any) {
      console.error('❌ [API] Error fetching appointments:', error);
      throw error;
    }
  }

  async updateAppointment(id: string, updateData: Partial<Appointment>): Promise<Appointment> {
    try {
      console.log('📅 [API] Updating appointment:', id, updateData);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/appointments/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const apt = await response.json();
      return {
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
        duration: apt.duration || 60
      };
    } catch (error: any) {
      console.error('❌ [API] Error updating appointment:', error);
      throw error;
    }
  }
}

export const appointmentsApiService = new AppointmentsApiService();