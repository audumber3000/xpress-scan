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
    async getClinics(): Promise<ClinicInfo[]> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinics/`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error fetching clinics:', error);
            return [];
        }
    }

    async getClinicInfo(): Promise<ClinicInfo | null> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinics/me`, {
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

    async ownerAddClinic(data: { name: string, address?: string, phone?: string, email?: string }): Promise<ClinicInfo | null> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinics/owner/add`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('❌ [API] Error adding clinic branch:', error);
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error('❌ [API] Error adding clinic branch:', error);
            return null;
        }
    }

    async getStaff(): Promise<StaffMember[]> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinic-users/`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinic-users/`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinic-users/${id}`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/attendance/week?week_start=${weekStart}`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/${id}`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/${id}`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/permissions/roles`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/permissions/resources`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/permissions/users/${userId}/permissions`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/permissions/users/${userId}/role`, {
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
            const response = await this.fetchWithTimeout(`${this.baseURL}/permissions/sync-roles`, {
                method: 'POST',
                headers,
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error syncing roles:', error);
            return false;
        }
    }

    async markAttendance(data: { user_id: string; date: string; status: string; reason?: string }): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseURL}/attendance`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error marking attendance:', error);
            return false;
        }
    }

    // ── Practice Settings ──
    private getPracticeSettingsBackendCategory(category: string): string {
        const map: Record<string, string> = {
            'chief-complaints':   'complaint',
            'clinical-advice':    'advice',
            'on-examination':     'finding',
            'clinical-findings':  'finding',
            'diagnosis':          'diagnosis',
            'final-diagnosis':    'diagnosis',
            'medical-history':    'medical-condition',
            'dental-history':     'dental-history',
            'allergies':          'allergy',
            'ongoing-medication': 'current-medication',
            'additional-fees':    'additional-fee',
        };
        return map[category] || category;
    }

    async getPracticeSettings(category: string): Promise<any[]> {
        try {
            const headers = await this.getAuthHeaders();
            if (category === 'procedures') {
                const r = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/`, { headers });
                if (!r.ok) return [];
                return await r.json();
            }
            const bc = this.getPracticeSettingsBackendCategory(category);
            const r = await this.fetchWithTimeout(`${this.baseURL}/clinical/settings/?category=${bc}`, { headers });
            if (!r.ok) return [];
            return await r.json();
        } catch (error) {
            console.error('❌ [API] Error fetching practice settings:', error);
            return [];
        }
    }

    async createPracticeSetting(data: { name: string; description?: string; cost?: number; category: string }): Promise<any | null> {
        try {
            const headers = await this.getAuthHeaders();
            if (data.category === 'procedures') {
                const r = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/`, {
                    method: 'POST', headers, body: JSON.stringify(data),
                });
                if (!r.ok) return null;
                return await r.json();
            }
            const bc = this.getPracticeSettingsBackendCategory(data.category);
            const r = await this.fetchWithTimeout(`${this.baseURL}/clinical/settings/`, {
                method: 'POST', headers, body: JSON.stringify({ ...data, category: bc }),
            });
            if (!r.ok) return null;
            return await r.json();
        } catch (error) {
            console.error('❌ [API] Error creating practice setting:', error);
            return null;
        }
    }

    async updatePracticeSetting(id: string, data: any): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            if (data.category === 'procedures') {
                const r = await this.fetchWithTimeout(`${this.baseURL}/treatment-types/${id}/`, {
                    method: 'PUT', headers, body: JSON.stringify(data),
                });
                return r.ok;
            }
            const bc = this.getPracticeSettingsBackendCategory(data.category);
            const r = await this.fetchWithTimeout(`${this.baseURL}/clinical/settings/${id}/`, {
                method: 'PUT', headers, body: JSON.stringify({ ...data, category: bc }),
            });
            return r.ok;
        } catch (error) {
            console.error('❌ [API] Error updating practice setting:', error);
            return false;
        }
    }

    async deletePracticeSetting(id: string, category: string): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const url = category === 'procedures'
                ? `${this.baseURL}/treatment-types/${id}/`
                : `${this.baseURL}/clinical/settings/${id}/`;
            const r = await this.fetchWithTimeout(url, { method: 'DELETE', headers });
            return r.ok;
        } catch (error) {
            console.error('❌ [API] Error deleting practice setting:', error);
            return false;
        }
    }

    // ── Template Configs (Invoice / Prescription / Consent) ──
    async getTemplateConfigs(): Promise<any[]> {
        try {
            const headers = await this.getAuthHeaders();
            const r = await this.fetchWithTimeout(`${this.baseURL}/template-configs`, { headers });
            if (!r.ok) return [];
            return await r.json();
        } catch (error) {
            console.error('❌ [API] Error fetching template configs:', error);
            return [];
        }
    }

    async getTemplateVariants(category: 'invoice' | 'prescription' | 'consent'): Promise<{ id: string; name: string; description: string; thumbnail: string }[]> {
        try {
            const headers = await this.getAuthHeaders();
            const r = await this.fetchWithTimeout(`${this.baseURL}/template-configs/variants/${category}`, { headers });
            if (!r.ok) return [];
            const data = await r.json();
            return data?.variants || [];
        } catch (error) {
            console.error('❌ [API] Error fetching variants:', error);
            return [];
        }
    }

    async previewTemplate(payload: {
        category: 'invoice' | 'prescription' | 'consent';
        template_id?: string;
        primary_color?: string;
        footer_text?: string;
        logo_url?: string | null;
    }): Promise<string | null> {
        try {
            const headers = await this.getAuthHeaders();
            const r = await this.fetchWithTimeout(`${this.baseURL}/template-configs/preview`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            if (!r.ok) {
                console.warn('[API] Preview failed:', r.status);
                return null;
            }
            const data = await r.json();
            return data?.html ?? null;
        } catch (error) {
            console.error('❌ [API] Error fetching preview:', error);
            return null;
        }
    }

    async uploadTemplateLogo(
        category: 'invoice' | 'prescription' | 'consent',
        file: { uri: string; name: string; type: string },
    ): Promise<{ logo_url: string; storage_key: string } | null> {
        try {
            const headers = await this.getAuthHeaders();
            const formData = new FormData();
            formData.append('category', category);
            formData.append('file', file as any);

            const r = await this.fetchWithTimeout(`${this.baseURL}/template-configs/logo`, {
                method: 'POST',
                headers: { ...headers, Accept: 'application/json' },
                body: formData as any,
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                console.error('❌ [API] Logo upload failed:', err);
                return null;
            }
            return await r.json();
        } catch (error) {
            console.error('❌ [API] Error uploading logo:', error);
            return null;
        }
    }

    async saveTemplateConfig(data: {
        category: string;
        template_id: string;
        logo_url?: string;
        primary_color?: string;
        footer_text?: string;
        gst_number?: string;
    }): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const r = await this.fetchWithTimeout(`${this.baseURL}/template-configs`, {
                method: 'POST', headers, body: JSON.stringify(data),
            });
            if (r.ok && data.category === 'invoice' && data.gst_number !== undefined) {
                await this.fetchWithTimeout(`${this.baseURL}/clinics/me`, {
                    method: 'PATCH', headers,
                    body: JSON.stringify({ gst_number: data.gst_number, logo_url: data.logo_url, invoice_template: data.template_id }),
                }).catch(() => {});
            }
            return r.ok;
        } catch (error) {
            console.error('❌ [API] Error saving template config:', error);
            return false;
        }
    }

    // ── Clinic Info Update ──
    async updateClinicInfo(id: string, data: Partial<ClinicInfo>): Promise<boolean> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await this.fetchWithTimeout(`${this.baseURL}/clinics/${id}`, {
                method: 'PUT', headers, body: JSON.stringify(data),
            });
            return response.ok;
        } catch (error) {
            console.error('❌ [API] Error updating clinic info:', error);
            return false;
        }
    }
}

export const adminApiService = new AdminApiService();
