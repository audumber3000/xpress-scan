import { BaseApiService } from '../../../services/api/base.api';

/**
 * Notification Center API — wraps the same `/notification-admin` and
 * `/integrations/wareach` endpoints the web admin uses, so mobile has full parity
 * (stats, wallet + top-up, preferences, logs, template test-send, WA Reach).
 */

export interface Preference {
  event_type: string;
  channels: string[];
  is_enabled: boolean;
}

export interface WalletTxn {
  id: number;
  amount: number;
  transaction_type: 'credit' | 'debit';
  description?: string;
  status: string;
  created_at?: string;
}

export interface Wallet {
  balance: number;
  last_topup_at?: string | null;
  transactions?: WalletTxn[];
}

export interface NotifLog {
  id: number;
  channel: string;
  recipient: string;
  event_type?: string;
  status: string;
  cost?: number;
  error_message?: string;
  created_at?: string;
}

export interface WareachStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  phone_number?: string | null;
  connected?: boolean;
  is_pro?: boolean;
}

class NotificationsApi extends BaseApiService {
  private async getJson(path: string): Promise<any> {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}${path}`, { headers: h });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  private async postJson(path: string, body?: any): Promise<any> {
    const h = await this.getAuthHeaders();
    const r = await this.fetchWithTimeout(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try { detail = (await r.json())?.detail || detail; } catch {}
      throw new Error(detail);
    }
    return r.json();
  }

  // ─── Overview / preferences ───────────────────────────────
  getChannelStatus() { return this.getJson('/notification-admin/channel-status'); }
  getStats() { return this.getJson('/notification-admin/stats'); }
  async getPreferences(): Promise<Preference[]> {
    const p = await this.getJson('/notification-admin/preferences');
    return Array.isArray(p) ? p : [];
  }
  async getWallet(): Promise<Wallet> {
    const w = await this.getJson('/notification-admin/wallet');
    return w || { balance: 0, transactions: [] };
  }
  async savePreferences(preferences: Preference[]): Promise<boolean> {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/notification-admin/preferences`, {
        method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      return r.ok;
    } catch { return false; }
  }

  // ─── Wallet top-up (Cashfree) ─────────────────────────────
  topupWallet(amount: number): Promise<{ payment_session_id: string; order_id: string; provider: string }> {
    return this.postJson('/notification-admin/wallet/topup', { amount });
  }
  async verifyTopup(orderId: string): Promise<{ success: boolean; balance?: number; status?: string; message?: string }> {
    const h = await this.getAuthHeaders();
    const r = await this.fetchWithTimeout(
      `${this.baseURL}/notification-admin/wallet/verify?order_id=${encodeURIComponent(orderId)}`,
      { headers: h },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ─── Logs ─────────────────────────────────────────────────
  async getLogs(page = 1, filter: { channel?: string; status?: string } = {}): Promise<{ logs: NotifLog[]; total: number }> {
    const params = new URLSearchParams({ page: String(page), per_page: '20' });
    if (filter.channel) params.set('channel', filter.channel);
    if (filter.status) params.set('status', filter.status);
    const data = await this.getJson(`/notification-admin/logs?${params.toString()}`);
    return { logs: data?.logs || [], total: data?.total || 0 };
  }

  // ─── Templates + test send ────────────────────────────────
  async getTemplates(): Promise<Record<string, { id: number; title: string; content: string; variables: string[] }>> {
    return (await this.getJson('/notification-admin/templates')) || {};
  }
  templateTestSend(event_type: string, channel: string, recipient: string):
    Promise<{ cost?: number; new_balance?: number }> {
    return this.postJson('/notification-admin/test/template-send', { event_type, channel, recipient });
  }

  // ─── WA Reach ─────────────────────────────────────────────
  async getWareachStatus(): Promise<WareachStatus> {
    return (await this.getJson('/integrations/wareach/status')) ||
      { status: 'disconnected', phone_number: null, connected: false, is_pro: false };
  }
  wareachConnect(): Promise<{ status: string; qr?: string }> {
    return this.postJson('/integrations/wareach/connect');
  }
  async wareachQr(): Promise<{ status: string; qr?: string }> {
    return (await this.getJson('/integrations/wareach/qr')) || { status: 'connecting' };
  }
  wareachDisconnect(): Promise<{ status: string }> {
    return this.postJson('/integrations/wareach/disconnect');
  }

  // ─── Manual WhatsApp clinic setting ───────────────────────
  async setManualWhatsApp(value: boolean): Promise<boolean> {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/clinics/me`, {
        method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_whatsapp: value }),
      });
      return r.ok;
    } catch { return false; }
  }
}

export const notificationsApi = new NotificationsApi();
