export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: 'clinic_owner' | 'receptionist' | 'doctor';
  phone?: string;
  clinic?: {
    id: string;
    name: string;
    address?: string;
  };
}

export interface Analytics {
  patientVisits: number[];
  totalVisits: number;
  percentageChange: string;
  period: '1W' | '1M' | '3M' | '6M' | 'All';
}

export interface Transaction {
  id: string;
  patientName: string;
  patientId?: string;
  type: 'visit' | 'payment' | 'income' | 'pending';
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'success';
  description?: string;
}

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
  medicalHistory?: MedicalRecord[];
  billingHistory?: BillingRecord[];
}

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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../../config/api.config';

class ApiService {
  private baseURL = getApiBaseUrl();

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 [API] Testing connection to:', this.baseURL);
      const response = await fetch(`${this.baseURL}/`, {
        method: 'GET',
      });
      console.log('✅ [API] Connection test - Status:', response.status);
      return response.status === 200 || response.status === 404; // 404 is ok, means server is reachable
    } catch (error: any) {
      console.error('❌ [API] Connection test failed:', error.message);
      return false;
    }
  }

  async getUserInfo(): Promise<BackendUser | null> {
    try {
      const storedUser = await AsyncStorage.getItem('backend_user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
      return null;
    } catch (error) {
      console.error('Error fetching stored user:', error);
      return null;
    }
  }

  async getCurrentUser(): Promise<BackendUser | null> {
    try {
      console.log('🔍 [API] Fetching current user from:', `${this.baseURL}/auth/mobile/me`);
      
      const headers = await this.getAuthHeaders();
      console.log('🔑 [API] Headers:', JSON.stringify(headers, null, 2));
      
      const response = await fetch(`${this.baseURL}/auth/mobile/me`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] User data received:', JSON.stringify(data, null, 2));
      
      // Transform backend response to match BackendUser interface
      const user: BackendUser = {
        id: data.id.toString(),
        email: data.email,
        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        role: data.role,
        phone: data.phone,
        clinic: data.clinic ? {
          id: data.clinic.id.toString(),
          name: data.clinic.name,
          address: data.clinic.address,
        } : undefined,
      };

      // Store user info locally
      await AsyncStorage.setItem('backend_user', JSON.stringify(user));
      console.log('💾 [API] User data stored locally');
      
      return user;
    } catch (error: any) {
      console.error('❌ [API] Error fetching current user:', error);
      console.error('❌ [API] Error message:', error.message);
      console.error('❌ [API] Error stack:', error.stack);
      return null;
    }
  }

  async oauthLogin(idToken: string): Promise<{ user: BackendUser | null; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/auth/mobile/oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: idToken,
          device: {
            device_name: 'Mobile App',
            device_type: 'mobile',
            device_platform: 'iOS/Android',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Store tokens
      if (data.access_token) {
        await AsyncStorage.setItem('access_token', data.access_token);
      }
      if (data.refresh_token) {
        await AsyncStorage.setItem('refresh_token', data.refresh_token);
      }

      // Transform and store user data
      if (data.user) {
        const user: BackendUser = {
          id: data.user.id.toString(),
          email: data.user.email,
          name: data.user.name || `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim(),
          role: data.user.role,
          phone: data.user.phone,
          clinic: data.user.clinic ? {
            id: data.user.clinic.id.toString(),
            name: data.user.clinic.name,
            address: data.user.clinic.address,
          } : undefined,
        };
        
        await AsyncStorage.setItem('backend_user', JSON.stringify(user));
        return { user };
      }

      return { user: null };
    } catch (error: any) {
      console.error('Error during OAuth login:', error);
      return { user: null, error: error.message };
    }
  }

  async getAnalytics(period: '1W' | '1M' | '3M' | '6M' | 'All'): Promise<Analytics | null> {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${this.baseURL}/analytics?period=${period}`);
      // return await response.json();
      return null;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }
  }

  async getTransactions(limit?: number): Promise<Transaction[]> {
    try {
      console.log('💰 [API] Fetching transactions from:', `${this.baseURL}/payments`);
      
      const headers = await this.getAuthHeaders();
      const url = limit ? `${this.baseURL}/payments?limit=${limit}` : `${this.baseURL}/payments`;
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Transactions response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Transactions error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Transactions data received:', data.length, 'transactions');
      
      // Transform backend response to match Transaction interface
      const transactions: Transaction[] = data.map((payment: any) => ({
        id: payment.id.toString(),
        date: payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }) : 'N/A',
        description: payment.treatment_type || 'Payment',
        amount: payment.amount || 0,
        type: payment.status === 'success' ? 'income' : 'pending',
        status: payment.status || 'pending',
        patientName: payment.patient_name || 'Unknown Patient',
        patientId: payment.patient_id || payment.patientId || 'unknown',
      }));

      console.log('✅ [API] Transformed transactions:', transactions.length);
      return transactions;
    } catch (error: any) {
      console.error('❌ [API] Error fetching transactions:', error);
      console.error('❌ [API] Error message:', error.message);
      return [];
    }
  }

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

  async getPatient(patientId: string): Promise<Patient | null> {
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
      };

      console.log('✅ [API] Transformed patient details:', patient);
      return patient;
    } catch (error: any) {
      console.error('❌ [API] Error fetching patient details:', error);
      console.error('❌ [API] Error message:', error.message);
      return null;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'backend_user']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  async getProfileStats(): Promise<{ patients: number; appointments: number; rating: number } | null> {
    try {
      console.log('📊 [API] Fetching profile stats from:', `${this.baseURL}/dashboard/metrics`);
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/dashboard/metrics`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Stats response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Stats error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Stats data received:', JSON.stringify(data, null, 2));
      
      return {
        patients: data.total_patients?.value || 0,
        appointments: data.appointments_today?.value || 0,
        rating: 4.9, // This would come from a separate rating endpoint if available
      };
    } catch (error: any) {
      console.error('❌ [API] Error fetching profile stats:', error);
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
  }): Promise<void> {
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
      console.log('📡 [API] Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Create patient error response:', errorText);
        console.error('❌ [API] Response status:', response.status);
        console.error('❌ [API] Headers:', Object.fromEntries(response.headers.entries()));
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Patient created successfully:', data);
    } catch (error: any) {
      console.error('❌ [API] Error creating patient:', error);
      console.error('❌ [API] Error message:', error.message);
      console.error('❌ [API] Error stack:', error.stack);
      throw error;
    }
  }

  async getTreatmentTypes(): Promise<Array<{ id: number; name: string; price: number }>> {
    try {
      console.log('🏥 [API] Fetching treatment types...');
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/treatment-types`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Treatment types response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Treatment types error response:', errorText);
        return [];
      }

      const data = await response.json();
      console.log('✅ [API] Treatment types received:', data.length);
      
      return data.map((type: any) => ({
        id: type.id,
        name: type.name,
        price: type.price,
      }));
    } catch (error: any) {
      console.error('❌ [API] Error fetching treatment types:', error);
      return [];
    }
  }

  async getReferringDoctors(): Promise<Array<{ id: number; name: string }>> {
    try {
      console.log('👨‍⚕️ [API] Fetching referring doctors...');
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/referring-doctors`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Referring doctors response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Referring doctors error response:', errorText);
        return [];
      }

      const data = await response.json();
      console.log('✅ [API] Referring doctors received:', data.length);
      
      return data.map((doctor: any) => ({
        id: doctor.id,
        name: doctor.name,
      }));
    } catch (error: any) {
      console.error('❌ [API] Error fetching referring doctors:', error);
      return [];
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

export const apiService = new ApiService();
