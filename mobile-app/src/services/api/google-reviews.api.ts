import { BaseApiService } from './base.api';

export interface GooglePlaceStatus {
  linked: boolean;
  place_id?: string;
  place_name?: string;
  place_address?: string;
  current_rating?: number;
  total_review_count?: number;
  accumulated_count?: number;
  last_synced_at?: string;
  lat?: number;
  lng?: number;
}

export interface GoogleReview {
  id: number;
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  text: string;
  review_time?: string;
}

export interface ReviewSummary {
  total: number;
  excellent: number;
  excellent_pct: number;
  good: number;
  good_pct: number;
  bad: number;
  bad_pct: number;
}

export interface ReviewsResponse {
  reviews: GoogleReview[];
  total: number;
  page: number;
  summary: ReviewSummary;
}

export interface Competitor {
  place_id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  is_our_clinic: boolean;
  badges: string[];
  summary?: string;
  velocity?: number;
  review_gap?: number;
}

export interface CompetitorsResponse {
  competitors: Competitor[];
  your_rating: number;
  your_review_count: number;
  synced_at: string;
  from_cache: boolean;
}

export class GoogleReviewsApiService extends BaseApiService {
  async getStatus(): Promise<GooglePlaceStatus> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/google-places/status`, { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('❌ [GOOGLE] getStatus error:', err);
      return { linked: false };
    }
  }

  async getReviews(page = 1, limit = 20, rating?: number): Promise<ReviewsResponse | null> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `${this.baseURL}/google-places/reviews?page=${page}&limit=${limit}`;
      if (rating) url += `&rating=${rating}`;
      const res = await this.fetchWithTimeout(url, { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('❌ [GOOGLE] getReviews error:', err);
      return null;
    }
  }

  async getCompetitors(scope: '5km' | 'city'): Promise<CompetitorsResponse | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(
        `${this.baseURL}/google-places/competitors?scope=${scope}`,
        { headers },
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('❌ [GOOGLE] getCompetitors error:', err);
      return null;
    }
  }

  async searchPlaces(query: string): Promise<{ place_id: string; name: string; address: string; description?: string }[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(
        `${this.baseURL}/google-places/search?q=${encodeURIComponent(query)}`,
        { headers },
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      // Backend returns { results: [...] }
      return Array.isArray(data) ? data : (data.results ?? []);
    } catch (err) {
      console.error('❌ [GOOGLE] searchPlaces error:', err);
      return [];
    }
  }

  async linkPlace(placeId: string): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(
        `${this.baseURL}/google-places/link?place_id=${encodeURIComponent(placeId)}`,
        { method: 'POST', headers },
      );
      return res.ok;
    } catch (err) {
      console.error('❌ [GOOGLE] linkPlace error:', err);
      return false;
    }
  }

  async syncReviews(): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/google-places/sync`, {
        method: 'POST',
        headers,
      });
      return res.ok;
    } catch (err) {
      console.error('❌ [GOOGLE] sync error:', err);
      return false;
    }
  }
}

export const googleReviewsApiService = new GoogleReviewsApiService();
