import { BaseApiService } from '../../../services/api/base.api';

/**
 * The in-app notification inbox — the phone's half of the web header bell.
 *
 * Deliberately separate from `notifications.api.ts` in this same folder, which
 * wraps `/notification-admin`: that one is the OUTBOUND patient-messaging
 * console (wallet, MSG91 templates, delivery logs). This one is the staff
 * member's own inbox and reads `/notifications`.
 */

export type Severity = 'info' | 'action' | 'critical';

export interface InboxItem {
  id: number;
  event_type: string;
  severity: Severity;
  title: string;
  body?: string | null;
  link?: string | null;
  count: number;
  entity_type?: string | null;
  entity_id?: number | null;
  read: boolean;
  created_at?: string | null;
}

export interface InboxPage {
  notifications: InboxItem[];
  has_more: boolean;
  next_before_id: number | null;
}

const EMPTY_PAGE: InboxPage = { notifications: [], has_more: false, next_before_id: null };

class InboxApi extends BaseApiService {
  /**
   * One page of notifications, newest first.
   *
   * Keyset paginated on `before_id` rather than an offset, matching the server:
   * the list grows at the head while it is being read, and an offset would
   * repeat or skip rows as new notifications land between pages.
   */
  async list(beforeId?: number | null, limit = 30): Promise<InboxPage> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (beforeId) params.append('before_id', String(beforeId));
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/notifications?${params}`, { headers });
      if (!res.ok) return EMPTY_PAGE;
      return (await res.json()) as InboxPage;
    } catch {
      // An unreachable inbox is an empty inbox, never a crashed screen.
      return EMPTY_PAGE;
    }
  }

  /** Just the badge number, for the tab. Cheap enough to poll. */
  async unreadCount(): Promise<number> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/notifications/unread-count`, { headers });
      if (!res.ok) return 0;
      return (await res.json())?.unread ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Mark one as read. Returns whether it stuck, so the caller can put an
   * optimistic update back if it did not.
   */
  async markRead(id: number): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/notifications/${id}/read`, {
        method: 'POST',
        headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async markAllRead(): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/notifications/read-all`, {
        method: 'POST',
        headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const inboxApi = new InboxApi();
