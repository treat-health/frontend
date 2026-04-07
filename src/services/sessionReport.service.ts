import api from '../lib/api';
import type { ApiResponse } from '../lib/api';

export interface SessionTranscript {
    text: string | null;
    summary: string | null;
    keyPoints: string[];
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null;
    wordCount: number;
    generatedAt: string;
    attentionMetrics?: {
        participants: Array<{
            participantName: string;
            role: string;
            cameraOffSeconds: number;
            micOffSeconds: number;
            audioInactiveSeconds: number;
            nudgesCount: number;
        }>;
        timeline: Array<{
            timestamp: string;
            type: string;
            participantName: string;
            role: string;
            reason?: string | null;
        }>;
    } | null;
}

class SessionReportService {
    /**
     * Fetch the AI transcript/report for a specific session ID
     * Accessible by assigned CLIENT, THERAPIST, or any ADMIN/PROGRAM_DIRECTOR
     */
    async getSessionReport(sessionId: string): Promise<SessionTranscript> {
        try {
            const response = await api.get<ApiResponse<SessionTranscript>>(`/sessions/${sessionId}/report`);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || 'Failed to fetch session report');
            }
            return response.data.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to fetch session report';
            throw new Error(message);
        }
    }
}

export const sessionReportService = new SessionReportService();
