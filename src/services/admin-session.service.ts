import api from '../lib/api';

export type AdminBulkScheduleType = 'WEEKLY' | 'MONTHLY';

export interface AdminBulkSessionCreatePayload {
    clientIds: string[];
    therapistId: string;
    scheduleType: AdminBulkScheduleType;
    startTimeUTC: string;
    endTimeUTC: string;
    daysOfWeek?: number[];
    startDate?: string;
    endDate?: string;
}

export interface AdminBulkSessionValidationError {
    code: string;
    message: string;
    clientId?: string;
    scheduledAt?: string;
}

export interface AdminBulkSessionCreateResult {
    success: boolean;
    createdCount: number;
    totalRequestedRows: number;
    scheduleType?: AdminBulkScheduleType;
    startTimeUTC?: string;
    endTimeUTC?: string;
    validationErrors: AdminBulkSessionValidationError[];
}

class AdminSessionService {
    async bulkCreateSessions(payload: AdminBulkSessionCreatePayload): Promise<AdminBulkSessionCreateResult> {
        const response = await api.post('/admin/sessions/bulk-create', payload);
        return response.data?.data as AdminBulkSessionCreateResult;
    }
}

export const adminSessionService = new AdminSessionService();
