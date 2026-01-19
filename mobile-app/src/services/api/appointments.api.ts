import { BaseApiService } from './base.api';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  startTime: string;
  endTime: string;
  status: 'Finished' | 'Encounter' | 'Registered' | 'Cancelled';
  type?: string;
  date: string;
}

export class AppointmentsApiService extends BaseApiService {
  async getAppointments(date?: string, view?: 'week' | 'month'): Promise<Appointment[]> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseURL}/appointments?date=${date}&view=${view}`);
      // return await response.json();
      return [];
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  }
}

export const appointmentsApiService = new AppointmentsApiService();