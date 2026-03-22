import api from '../lib/api';
import type {
    Issue,
    PaginatedIssues,
    CreateIssueInput,
    UpdateIssueStatusInput,
    CreateIssueCommentInput,
    IssueComment,
    ListIssuesQuery
} from '../types/issue.types';

export const issueApi = {
    /**
     * Create a new issue
     */
    createIssue: async (data: CreateIssueInput): Promise<{ success: boolean; data: Issue; message?: string }> => {
        const response = await api.post('/issues', data);
        return response.data;
    },

    /**
     * Get issues list (Admins see all/filtered, Users see their own)
     */
    listIssues: async (params?: ListIssuesQuery): Promise<{ success: boolean; data: PaginatedIssues }> => {
        const response = await api.get('/issues', { params });
        return response.data;
    },

    /**
     * Get a single issue by ID (with comments)
     */
    getIssueById: async (id: string): Promise<{ success: boolean; data: Issue }> => {
        const response = await api.get(`/issues/${id}`);
        return response.data;
    },

    /**
     * Update an issue's status (Admin only)
     */
    updateIssueStatus: async (id: string, data: UpdateIssueStatusInput): Promise<{ success: boolean; data: Issue; message?: string }> => {
        const response = await api.patch(`/issues/${id}/status`, data);
        return response.data;
    },

    /**
     * Add a comment to an issue
     */
    addComment: async (id: string, data: CreateIssueCommentInput): Promise<{ success: boolean; data: IssueComment; message?: string }> => {
        const response = await api.post(`/issues/${id}/comments`, data);
        return response.data;
    }
};

export default issueApi;
