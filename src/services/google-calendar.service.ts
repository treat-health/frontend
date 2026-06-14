import api, { type ApiResponse } from '../lib/api';

export interface GoogleCalendarConnectionStatus {
    connected: boolean;
    googleAccountEmail?: string | null;
    calendarId?: string | null;
    syncEnabled?: boolean;
    lastSyncedAt?: string | null;
    disconnectedAt?: string | null;
    hasRefreshToken?: boolean;
}

export interface GoogleCalendarSyncQueueResponse {
    jobId?: string | null;
    therapistId: string;
    lookaheadDays?: number | null;
    mode?: string;
    executeNow?: boolean;
    noSessionsFound?: boolean;
    eventCount?: number;
    importedSessions?: number;
    updatedSessions?: number;
    createdClients?: number;
    skippedEvents?: number;
    warnings?: string[];
    errors?: Array<{ eventId?: string; email?: string; message: string }>;
    lastSyncedAt?: string | null;
    queuedAt?: string;
    requestMeta?: {
        ipAddress?: string | null;
        userAgent?: string | null;
    };
}

export class GoogleCalendarService {
    async getAuthorizationUrl(returnTo = '/settings/integrations'): Promise<string> {
        const response = await api.get<ApiResponse<{ authorizationUrl: string }>>('/integrations/google/connect', {
            params: { returnTo },
        });

        if (!response.data.success || !response.data.data?.authorizationUrl) {
            throw new Error(response.data.message || 'Failed to create Google authorization URL');
        }

        return response.data.data.authorizationUrl;
    }

    async startConnect(returnTo = '/settings/integrations'): Promise<void> {
        const authorizationUrl = await this.getAuthorizationUrl(returnTo);
        globalThis.location.assign(authorizationUrl);
    }

    async getStatus(): Promise<GoogleCalendarConnectionStatus> {
        const response = await api.get<ApiResponse<GoogleCalendarConnectionStatus>>('/integrations/google/status');

        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || 'Failed to load Google Calendar status');
        }

        return response.data.data;
    }

    async sync(lookaheadDays?: number, executeNow = true): Promise<GoogleCalendarSyncQueueResponse> {
        const response = await api.post<ApiResponse<GoogleCalendarSyncQueueResponse>>('/integrations/google/sync', {
            lookaheadDays,
            mode: 'manual',
            executeNow,
        });

        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || 'Failed to queue Google Calendar sync');
        }

        return response.data.data;
    }

    async disconnect(): Promise<void> {
        const response = await api.post<ApiResponse<null>>('/integrations/google/disconnect');

        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to disconnect Google Calendar');
        }
    }
}

export const googleCalendarService = new GoogleCalendarService();
