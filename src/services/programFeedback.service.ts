import axios from 'axios';
import api, { API_BASE_URL } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
    ClientProgramFeedbackOverview,
    CreateProgramFeedbackInput,
    ProgramFeedbackItem,
    ProgramFeedbackInvitationOverview,
    ProgramFeedbackListQuery,
    ProgramFeedbackListResponse,
    UpdateProgramFeedbackInput,
} from '../types/programFeedback.types';

const publicApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

export const programFeedbackApi = {
    getMyOverview: async (): Promise<ClientProgramFeedbackOverview> => {
        const response = await api.get<ApiResponse<ClientProgramFeedbackOverview>>('/feedback/me');
        return response.data.data || { eligible: false, attemptedSessionsCount: 0, attemptedSessionDates: [], activeInvitation: null, submissions: [] };
    },

    getInvitationOverview: async (token: string): Promise<ProgramFeedbackInvitationOverview> => {
        const response = await publicApi.get<ApiResponse<ProgramFeedbackInvitationOverview>>(`/feedback/invitation/${token}`);
        if (!response.data.data) {
            throw new Error(response.data.message || 'Invitation not found');
        }
        return response.data.data;
    },

    submitInvitationFeedback: async (token: string, data: CreateProgramFeedbackInput): Promise<{ success: boolean; data: ProgramFeedbackItem; message?: string }> => {
        const response = await publicApi.post(`/feedback/invitation/${token}`, data);
        return response.data;
    },

    createFeedback: async (data: CreateProgramFeedbackInput): Promise<{ success: boolean; data: ProgramFeedbackItem; message?: string }> => {
        const response = await api.post('/feedback', data);
        return response.data;
    },

    listFeedback: async (params?: ProgramFeedbackListQuery): Promise<{ success: boolean; data: ProgramFeedbackListResponse }> => {
        const response = await api.get('/feedback', { params });
        return response.data;
    },

    getFeedbackById: async (id: string): Promise<{ success: boolean; data: ProgramFeedbackItem }> => {
        const response = await api.get(`/feedback/${id}`);
        return response.data;
    },

    resendInvitation: async (id: string): Promise<{ success: boolean; data: ProgramFeedbackItem; message?: string }> => {
        const response = await api.post(`/feedback/${id}/resend`);
        return response.data;
    },

    updateFeedback: async (id: string, data: UpdateProgramFeedbackInput): Promise<{ success: boolean; data: ProgramFeedbackItem; message?: string }> => {
        const response = await api.patch(`/feedback/${id}`, data);
        return response.data;
    },
};

export default programFeedbackApi;
