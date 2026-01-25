import { BaseApiService } from './base.api';

export interface Transaction {
  id: string;
  patientName: string;
  patientId?: string;
  type: 'visit' | 'payment' | 'income' | 'pending';
  amount: number;
  date: string;
  time?: string;
  status: 'completed' | 'pending' | 'success';
  description?: string;
  treatment?: string;
}

export class TransactionsApiService extends BaseApiService {
  async getTransactions(limit?: number): Promise<Transaction[]> {
    try {
      console.log('💰 [API] Fetching transactions from:', `${this.baseURL}/invoices/`);

      const headers = await this.getAuthHeaders();
      // Using /invoices/ endpoint which matches the web frontend's "Payments" view
      const url = `${this.baseURL}/invoices/?limit=${limit || 100}`;
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawItems = await response.json();

      console.log('✅ [API] Invoices received:', rawItems.length);

      // Transform InvoiceOut format to Transaction interface
      const transactions: Transaction[] = rawItems.map((invoice: any) => {
        const createdAt = invoice.created_at ? new Date(invoice.created_at) : null;

        // Map backend invoice status to frontend transaction status
        let status: 'completed' | 'pending' | 'success' = 'pending';
        if (invoice.status === 'paid_verified') status = 'success';
        else if (invoice.status === 'paid_unverified') status = 'pending';

        return {
          id: invoice.id.toString(),
          date: createdAt ? createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'N/A',
          time: createdAt ? createdAt.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }) : undefined,
          description: `Invoice #${invoice.invoice_number}`,
          amount: invoice.total || 0,
          type: (invoice.status === 'paid_verified' || invoice.status === 'paid_unverified') ? 'income' : 'pending',
          status: status,
          patientName: invoice.patient_name || 'Unknown Patient',
          patientId: invoice.patient_id?.toString() || 'unknown',
          treatment: invoice.notes || invoice.line_items?.[0]?.description || 'Dental Treatment',
        };
      });

      return transactions;
    } catch (error: any) {
      console.error('❌ [API] Error fetching transactions:', error);
      return [];
    }
  }

  async getPatientTransactions(patientId: string): Promise<Transaction[]> {
    try {
      const all = await this.getTransactions();
      return all.filter(t => t.patientId === patientId);
    } catch (error) {
      console.error('❌ [API] Error fetching patient transactions:', error);
      return [];
    }
  }
}

export const transactionsApiService = new TransactionsApiService();