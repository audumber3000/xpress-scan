import { BaseApiService } from './base.api';
import { getApiBaseUrl, getNexusBaseUrl } from '../../config/api.config';

// ─── Lab Orders ──────────────────────────────────────────────────────────────
export interface LabOrder {
  id: number;
  patient_id: number;
  vendor_id: number;
  case_paper_id?: number;
  work_type: string;
  tooth_number?: string;
  shade?: string;
  instructions?: string;
  due_date?: string;
  status: string;
  cost: number;
  patient_name?: string;
  vendor_name?: string;
  created_at: string;
  updated_at: string;
}

export interface LabOrderCreate {
  patient_id: number;
  vendor_id: number;
  work_type: string;
  tooth_number?: string;
  shade?: string;
  instructions?: string;
  due_date?: string;
  status?: string;
  cost?: number;
}

// ─── Inventory ───────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: number;
  name: string;
  category?: string;
  quantity: number;
  unit?: string;
  min_stock_level: number;
  price_per_unit: number;
  vendor_id?: number;
  vendor_name?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemCreate {
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  min_stock_level?: number;
  price_per_unit?: number;
  vendor_id?: number;
}

// ─── Consent Templates ───────────────────────────────────────────────────────
export interface ConsentTemplate {
  id: number;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsentTemplateCreate {
  name: string;
  content: string;
}

// ─── Vendors (needed for lab order creation) ─────────────────────────────────
export interface Vendor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────
export class UtilitiesApiService extends BaseApiService {

  // Lab Orders
  async getLabOrders(patientId?: number): Promise<LabOrder[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = patientId ? `?patient_id=${patientId}` : '';
      const res = await this.fetchWithTimeout(`${this.baseURL}/clinical/lab-orders${params}`, { headers });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  }

  async createLabOrder(data: LabOrderCreate): Promise<LabOrder | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/clinical/lab-orders`, {
        method: 'POST', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async updateLabOrder(id: number, data: Partial<LabOrderCreate>): Promise<LabOrder | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/clinical/lab-orders/${id}`, {
        method: 'PUT', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async deleteLabOrder(id: number): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/clinical/lab-orders/${id}`, {
        method: 'DELETE', headers,
      });
      return res.ok;
    } catch { return false; }
  }

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/inventory`, { headers });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  }

  async createInventoryItem(data: InventoryItemCreate): Promise<InventoryItem | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/inventory`, {
        method: 'POST', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async updateInventoryItem(id: number, data: Partial<InventoryItemCreate>): Promise<InventoryItem | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/inventory/${id}`, {
        method: 'PUT', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/inventory/${id}`, {
        method: 'DELETE', headers,
      });
      return res.ok;
    } catch { return false; }
  }

  // Consent Templates
  async getConsentTemplates(): Promise<ConsentTemplate[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/consents/templates`, { headers });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  }

  async createConsentTemplate(data: ConsentTemplateCreate): Promise<ConsentTemplate | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/consents/templates`, {
        method: 'POST', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async updateConsentTemplate(
    id: number,
    data: Partial<ConsentTemplateCreate> & { is_active?: boolean }
  ): Promise<ConsentTemplate | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/consents/templates/${id}`, {
        method: 'PUT', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  // Consent Link Generation (via Nexus service)
  async generateConsentLink(data: {
    patientId: number;
    patientName: string;
    phone: string;
    templateId: number;
    templateName: string;
    content: string;
    clinicId: number;
  }): Promise<{ token: string; signUrl: string } | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${getNexusBaseUrl()}/api/v1/consent/generate`, {
        method: 'POST', headers, body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  // Vendors (for lab order vendor selection)
  async getVendors(): Promise<Vendor[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/vendors`, { headers });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  }
}

export const utilitiesApiService = new UtilitiesApiService();
