import { BaseApiService } from './base.api';

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

export class TransactionsApiService extends BaseApiService {
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
}

export const transactionsApiService = new TransactionsApiService();