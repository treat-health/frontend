import api from '../lib/api';
import type { ApiResponse } from '../lib/api';

/**
 * Appointment / Session Interface
 */
export interface Appointment {
    id: string;
    clientId: string;
    therapistId: string;
    type: string;
    scheduledAt: string; // ISO Date String
    durationMins: number;
    notes?: string;
    status: string; // SCHEDULED, CANCELLED, COMPLETED, etc.
    client: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    therapist: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}

export interface CreateAppointmentDto {
    clientId: string;
    therapistId: string;
    scheduledAt: string; // ISO String
    durationMins: number;
    type: string;
    notes?: string;
}

export interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

class SchedulingService {
    /**
     * Get list of appointments
     */
    async getAppointments(query?: any): Promise<Appointment[]> {
        const response = await api.get<ApiResponse<Appointment[]>>('/scheduling/appointments', { params: query });
        return response.data.data || [];
    }

    /**
     * Create a new appointment (Admin/Staff)
     */
    async createAppointment(data: CreateAppointmentDto, idempotencyKey?: string): Promise<Appointment> {
        const config = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined;
        const response = await api.post<ApiResponse<Appointment>>('/scheduling/appointments', data, config);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || 'Failed to create appointment');
        }
        return response.data.data;
    }

    /**
     * Get users by role (for dropdowns)
     */
    async getUsersByRole(role: 'CLIENT' | 'THERAPIST'): Promise<UserSummary[]> {
        const response = await api.get<ApiResponse<UserSummary[]>>(`/users/by-role/${role}`);
        return response.data.data || [];
    }

    /**
     * Get client's own appointments
     */
    async getMyAppointments(includeCompleted = false): Promise<Appointment[]> {
        const response = await api.get<ApiResponse<Appointment[]>>('/scheduling/my-appointments', {
            params: { includeCompleted: includeCompleted.toString() }
        });
        return response.data.data || [];
    }

    /**
     * Cancel appointment
     */
    async cancelAppointment(id: string, reason?: string): Promise<Appointment> {
        const response = await api.post<ApiResponse<Appointment>>(`/scheduling/appointments/${id}/cancel`, { reason });
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || 'Failed to cancel appointment');
        }
        return response.data.data;
    }

    /**
     * Get therapist's schedule for a date range
     */
    async getTherapistSchedule(fromDate: string, toDate: string): Promise<Appointment[]> {
        const response = await api.get<ApiResponse<Appointment[]>>('/scheduling/therapist-schedule', {
            params: { fromDate, toDate }
        });
        return response.data.data || [];
    }

    /**
     * Mark appointment as complete (Therapist)
     */
    async completeSession(id: string, notes: string): Promise<Appointment> {
        const response = await api.post<ApiResponse<Appointment>>(`/scheduling/appointments/${id}/complete`, { notes });
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || 'Failed to complete session');
        }
        return response.data.data;
    }

    /**
     * Mark appointment as no-show (Therapist)
     */
    async markNoShow(id: string): Promise<Appointment> {
        const response = await api.post<ApiResponse<Appointment>>(`/scheduling/appointments/${id}/no-show`);
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || 'Failed to mark no-show');
        }
        return response.data.data;
    }
}

export const schedulingService = new SchedulingService();
