import { BaseApiService } from './base.api';

/**
 * Offers and discounts: a clinic's reusable whole-invoice discounts.
 *
 * Created here, applied at billing time. Mirrors `backend/domains/finance/
 * routes/offers.py` and the web's Control Center → Offers page, which was the
 * only place they could be managed until now.
 *
 * Creating and editing is owner-only on the server (`require_clinic_owner`);
 * listing is not, because billing needs to read them.
 */

export interface Offer {
  id: number;
  clinic_id: number;
  name: string;
  code?: string | null;
  /** 'percentage' | 'amount' */
  discount_type: string;
  value: number;
  valid_from?: string | null;
  valid_to?: string | null;
  min_invoice_amount?: number | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface OfferInput {
  name: string;
  code?: string | null;
  discount_type: string;
  value: number;
  valid_from?: string | null;
  valid_to?: string | null;
  min_invoice_amount?: number | null;
  is_active: boolean;
}

/**
 * Is this offer usable today?
 *
 * Deliberately the same three tests as `_is_live` on the server: active, and
 * today inside the date window. A screen that calls an expired offer "Live"
 * sends somebody to apply a discount that billing will then refuse.
 */
export function isOfferLive(offer: Offer, today = new Date()): boolean {
  if (!offer.is_active) return false;
  const day = today.toISOString().slice(0, 10);
  if (offer.valid_from && day < offer.valid_from) return false;
  if (offer.valid_to && day > offer.valid_to) return false;
  return true;
}

class OffersApiService extends BaseApiService {
  async list(): Promise<Offer[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/offers`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async create(data: OfferInput): Promise<Offer> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/offers`, {
      method: 'POST', headers, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.reason(res));
    return res.json();
  }

  async update(id: number, data: Partial<OfferInput>): Promise<Offer> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/offers/${id}`, {
      method: 'PUT', headers, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.reason(res));
    return res.json();
  }

  async remove(id: number): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/offers/${id}`, {
      method: 'DELETE', headers,
    });
    return res.ok;
  }

  private async reason(res: Response): Promise<string> {
    try {
      const body = await res.json();
      return body?.detail || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

export const offersApiService = new OffersApiService();
