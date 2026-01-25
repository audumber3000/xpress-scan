import { BaseApiService } from './base.api';

export interface ClinicInfo {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    gst_number?: string;
    timings?: any;
}

export interface StaffMember {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    phone?: string;
}

export class AdminApiService extends BaseApiService {
    async getClinicInfo(): Promise<ClinicInfo | null> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/clinics/me`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching clinic info:', error);
            return null;
        }
    }

    async getStaff(): Promise<StaffMember[]> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/clinic-users`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching staff:', error);
            return [];
        }
    }

    async addStaffMember(data: any): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/clinic-users`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error adding staff member:', error);
            return false;
        }
    }

    async updateStaffMember(id: string, data: any): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/clinic-users/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error updating staff member:', error);
            return false;
        }
    }

    async getAttendanceForWeek(weekStart: string): Promise<any> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/attendance/week?week_start=${weekStart}`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching attendance:', error);
            return null;
        }
    }

    async getTreatmentTypes(): Promise<any[]> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/treatment-types`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching treatment types:', error);
            return [];
        }
    }

    async createTreatmentType(data: any): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/treatment-types`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error creating treatment type:', error);
            return false;
        }
    }

    async updateTreatmentType(id: string, data: any): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/treatment-types/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error updating treatment type:', error);
            return false;
        }
    }

    async deleteTreatmentType(id: string): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/treatment-types/${id}`, {
                method: 'DELETE',
                headers
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error deleting treatment type:', error);
            return false;
        }
    }

    async getRoles(): Promise<any[]> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/permissions/roles`, {
                method: 'GET',
                headers,
            });
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching roles:', error);
            return [];
        }
    }

    async getResources(): Promise<any[]> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/permissions/resources`, {
                method: 'GET',
                headers,
            });
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching resources:', error);
            return [];
        }
    }

    async getUserPermissions(userId: string): Promise<any> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/permissions/users/${userId}/permissions`, {
                method: 'GET',
                headers,
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching user permissions:', error);
            return null;
        }
    }

    async updateUserRole(userId: string, role: string): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/permissions/users/${userId}/role`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ user_id: userId, role })
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error updating user role:', error);
            return false;
        }
    }

    async syncRoles(): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${this.baseURL}/permissions/sync-roles`, {
                method: 'POST',
                headers,
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error syncing roles:', error);
            return false;
        }
    }
}

export const adminApiService = new AdminApiService();
