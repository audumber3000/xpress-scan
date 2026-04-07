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

export interface LedgerItem {
  id: string;
  type: 'invoice' | 'expense';
  date: string;
  amount: number;
  payment_method?: string;
  category: string;
  description: string;
  entityName?: string;
  entityId?: string;
  status?: string;
  billFileUrl?: string;
  invoice_number?: string;
  time?: string;
}

export class TransactionsApiService extends BaseApiService {
  async getTransactions(limit?: number, clinicId?: string): Promise<Transaction[]> {
    try {
      console.log('💰 [API] Fetching transactions for clinic:', clinicId);

      const headers = await this.getAuthHeaders();
      // Using /invoices/ endpoint which matches the web frontend's "Payments" view
      const clinicParam = clinicId ? `&clinic_id=${clinicId}` : '';
      const url = `${this.baseURL}/invoices/?limit=${limit || 100}${clinicParam}`;
      const response = await this.fetchWithTimeout(url, {
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

  async getLedger(limit?: number, clinicId?: string): Promise<LedgerItem[]> {
    try {
      console.log('📊 [API] Fetching ledger for clinic:', clinicId);

      const headers = await this.getAuthHeaders();
      const clinicParam = clinicId ? `&clinic_id=${clinicId}` : '';
      const url = `${this.baseURL}/ledger/?limit=${limit || 100}${clinicParam}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawItems = await response.json();

      console.log('✅ [API] Ledger items received:', rawItems.length);

      // Transform LedgerItemOut format to LedgerItem interface
      const ledgerItems: LedgerItem[] = rawItems.map((item: any) => {
        const itemDate = item.date ? new Date(item.date) : null;

        return {
          id: item.id.toString(),
          type: item.type as 'invoice' | 'expense',
          date: itemDate ? itemDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'N/A',
          time: itemDate ? itemDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          }) : undefined,
          amount: item.amount || 0,
          payment_method: item.payment_method,
          category: item.category || 'General',
          description: item.description || '',
          entityName: item.entity_name || 'N/A',
          entityId: item.entity_id?.toString(),
          status: item.status,
          billFileUrl: item.bill_file_url,
          invoice_number: item.invoice_number,
        };
      });

      return ledgerItems;
    } catch (error: any) {
      console.error('❌ [API] Error fetching ledger:', error);
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

  async getInvoice(invoiceId: string): Promise<any> {
    try {
      console.log('📄 [API] Fetching invoice details:', invoiceId);
      const headers = await this.getAuthHeaders();
      const url = `${this.baseURL}/invoices/${invoiceId}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [API] Error fetching invoice:', error);
      throw error;
    }
  }

  async getExpense(expenseId: string): Promise<any> {
    try {
      console.log('💸 [API] Fetching expense details:', expenseId);
      const headers = await this.getAuthHeaders();
      const url = `${this.baseURL}/ledger/expenses/${expenseId}`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [API] Error fetching expense:', error);
      throw error;
    }
  }
}

export const transactionsApiService = new TransactionsApiService();