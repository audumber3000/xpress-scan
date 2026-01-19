import { BaseApiService } from './base.api';

export class TreatmentApiService extends BaseApiService {
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
}

export const treatmentApiService = new TreatmentApiService();