import { BaseApiService } from './base.api';

/** One patient's entry in the day's register. */
export interface DailyVisit {
  id: number;
  patient_id: number;
  patient_name?: string;
  patient_phone?: string;
  display_id?: string;
  age?: number;
  gender?: string;
  village?: string;
  visit_date: string;
  is_repeat: boolean;
  doctor_id?: number;
  doctor_name?: string;
  reason?: string;
  source: string; // manual | check_in | case_paper | invoice
  appointment_id?: number;
  notes?: string;
  created_at?: string;
  case_paper_count: number;
  invoice_count: number;
  billed_amount: number;
  due_amount: number;
  collected_amount: number;
  paid_invoice_count: number;
  is_locked: boolean;
}

export interface DailyRegisterKpis { total: number; new: number; repeat: number; }

export interface DailyRegisterResponse {
  date: string;
  is_today: boolean;
  kpis: DailyRegisterKpis;
  previous: { date: string; kpis: DailyRegisterKpis };
  pending: { no_case_paper: number; not_billed: number };
  entries: DailyVisit[];
}

/** A candidate returned by the duplicate check when registering someone. */
export interface DuplicateMatch {
  id: number;
  name: string;
  phone?: string;
  display_id?: string;
  village?: string;
  registered_on?: string;
  created_at?: string;
}

export class DailyRegisterApiService extends BaseApiService {
  /** The register for a day (defaults to today), with KPIs and the week-on-week comparison. */
  async getRegister(date?: string): Promise<DailyRegisterResponse> {
    const headers = await this.getAuthHeaders();
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await this.fetchWithTimeout(`${this.baseURL}/daily-register${qs}`, { headers });
    if (!res.ok) throw new Error(`Failed to load the register (HTTP ${res.status})`);
    return res.json();
  }

  /** Existing patients that might be the same person — same check the calendar uses. */
  async checkDuplicates(name?: string, phone?: string): Promise<DuplicateMatch[]> {
    const headers = await this.getAuthHeaders();
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (phone) params.set('phone', phone);
    const res = await this.fetchWithTimeout(
      `${this.baseURL}/patients/check-duplicates?${params.toString()}`,
      { headers },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  /** Register a patient for a day. */
  async addEntry(payload: {
    patient_id: number;
    reason?: string | null;
    doctor_id?: number | null;
    visit_date?: string | null;
  }): Promise<DailyVisit> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/daily-register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let detail: string | undefined;
      try { detail = (await res.json())?.detail; } catch { /* non-JSON */ }
      throw new Error(detail || `Couldn't add to the register (HTTP ${res.status})`);
    }
    return res.json();
  }

  /** Correct an entry's reason / doctor / notes. */
  async updateEntry(entryId: number, patch: {
    reason?: string | null;
    doctor_id?: number | null;
    notes?: string | null;
  }): Promise<DailyVisit> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/daily-register/${entryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      let detail: string | undefined;
      try { detail = (await res.json())?.detail; } catch { /* non-JSON */ }
      throw new Error(detail || `Couldn't update the entry (HTTP ${res.status})`);
    }
    return res.json();
  }

  /** Remove an entry. Refused server-side once a paid/part-paid bill exists that day. */
  async removeEntry(entryId: number): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/daily-register/${entryId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      let detail: string | undefined;
      try { detail = (await res.json())?.detail; } catch { /* non-JSON */ }
      throw new Error(detail || `Couldn't remove the entry (HTTP ${res.status})`);
    }
  }

  /** Every day this patient appeared in the register, newest first. */
  async getPatientVisits(patientId: number): Promise<DailyVisit[]> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/daily-register/patient/${patientId}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  /** Absolute URL for the day sheet export (csv | pdf), for share/print flows. */
  exportUrl(date: string, format: 'csv' | 'pdf'): string {
    return `${this.baseURL}/daily-register/export?date=${encodeURIComponent(date)}&format=${format}`;
  }
}

export const dailyRegisterApiService = new DailyRegisterApiService();
