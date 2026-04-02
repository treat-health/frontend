import { create } from 'zustand';
import api from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type { User, UserRole, TreatmentStatus } from './authStore';

/**
 * Invite info returned when creating a user
 */
export interface InviteInfo {
    inviteToken: string;
    inviteLink: string;
    expiresAt: string;
}

/**
 * Create user input
 */
export interface CreateUserInput {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
    state?: string;
    password?: string;
    sendInvite?: boolean;
}

/**
 * User with invite info (for create response)
 */
export interface UserWithInvite {
    user: User;
    invite?: InviteInfo;
}

/**
 * Pagination response
 */
export interface PaginatedUsers {
    users: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * List users query params
 */
export interface ListUsersQuery {
    page?: number;
    limit?: number;
    role?: UserRole;
    treatmentStatus?: TreatmentStatus;
    state?: string;
    isActive?: boolean;
    search?: string;
    sortBy?: 'createdAt' | 'firstName' | 'lastName' | 'email';
    sortOrder?: 'asc' | 'desc';
}

/**
 * User store state
 */
interface UserState {
    users: User[];
    selectedUser: User | null;
    pagination: PaginatedUsers['pagination'] | null;
    isLoading: boolean;
    error: string | null;
    lastInvite: InviteInfo | null;

    // Actions
    fetchUsers: (query?: ListUsersQuery) => Promise<void>;
    createUser: (input: CreateUserInput) => Promise<UserWithInvite>;
    updateUser: (id: string, input: Partial<CreateUserInput>) => Promise<User>;
    toggleUserStatus: (id: string) => Promise<User>;
    deleteUser: (id: string) => Promise<void>;
    resendInvite: (id: string) => Promise<InviteInfo>;
    resetCredentials: (id: string) => Promise<InviteInfo>;
    setSelectedUser: (user: User | null) => void;
    clearError: () => void;
    clearLastInvite: () => void;
}

/**
 * User management store
 */
export const useUserStore = create<UserState>()((set, _get) => ({
    users: [],
    selectedUser: null,
    pagination: null,
    isLoading: false,
    error: null,
    lastInvite: null,

    fetchUsers: async (query: ListUsersQuery = {}) => {
        set({ isLoading: true, error: null });
        try {
            const params = new URLSearchParams();
            if (query.page) params.append('page', String(query.page));
            if (query.limit) params.append('limit', String(query.limit));
            if (query.role) params.append('role', query.role);
            if (query.treatmentStatus) params.append('treatmentStatus', query.treatmentStatus);
            if (query.state) params.append('state', query.state);
            if (query.isActive !== undefined) params.append('isActive', String(query.isActive));
            if (query.search) params.append('search', query.search);
            if (query.sortBy) params.append('sortBy', query.sortBy);
            if (query.sortOrder) params.append('sortOrder', query.sortOrder);

            const response = await api.get<ApiResponse<PaginatedUsers>>(`/users?${params.toString()}`);

            if (response.data.success && response.data.data) {
                set({
                    users: response.data.data.users,
                    pagination: response.data.data.pagination,
                    isLoading: false,
                });
            } else {
                throw new Error(response.data.message || 'Failed to fetch users');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to fetch users';
            set({ error: message, isLoading: false });
        }
    },

    createUser: async (input: CreateUserInput) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<ApiResponse<UserWithInvite>>('/users', input);

            if (response.data.success && response.data.data) {
                const result = response.data.data;
                // Add new user to list
                set((state) => ({
                    users: [result.user, ...state.users],
                    lastInvite: result.invite || null,
                    isLoading: false,
                }));
                return result;
            } else {
                throw new Error(response.data.message || 'Failed to create user');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to create user';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    updateUser: async (id: string, input: Partial<CreateUserInput>) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.patch<ApiResponse<User>>(`/users/${id}`, input);

            if (response.data.success && response.data.data) {
                const updatedUser = response.data.data;
                set((state) => ({
                    users: state.users.map((u) => (u.id === id ? updatedUser : u)),
                    selectedUser: state.selectedUser?.id === id ? updatedUser : state.selectedUser,
                    isLoading: false,
                }));
                return updatedUser;
            } else {
                throw new Error(response.data.message || 'Failed to update user');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to update user';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    toggleUserStatus: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.patch<ApiResponse<User>>(`/users/${id}/toggle-status`);

            if (response.data.success && response.data.data) {
                const updatedUser = response.data.data;
                set((state) => ({
                    users: state.users.map((u) => (u.id === id ? updatedUser : u)),
                    isLoading: false,
                }));
                return updatedUser;
            } else {
                throw new Error(response.data.message || 'Failed to toggle user status');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to toggle user status';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    deleteUser: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.delete<ApiResponse>(`/users/${id}`);

            if (response.data.success) {
                set((state) => ({
                    users: state.users.filter((u) => u.id !== id),
                    isLoading: false,
                }));
            } else {
                throw new Error(response.data.message || 'Failed to delete user');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to delete user';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    resendInvite: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<ApiResponse<InviteInfo>>(`/users/${id}/resend-invite`);

            if (response.data.success && response.data.data) {
                set({ lastInvite: response.data.data, isLoading: false });
                return response.data.data;
            } else {
                throw new Error(response.data.message || 'Failed to resend invite');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to resend invite';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    resetCredentials: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post<ApiResponse<InviteInfo>>(`/users/${id}/reset-credentials`);

            if (response.data.success && response.data.data) {
                set({ lastInvite: response.data.data, isLoading: false });
                return response.data.data;
            } else {
                throw new Error(response.data.message || 'Failed to reset credentials');
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to reset credentials';
            set({ error: message, isLoading: false });
            throw new Error(message);
        }
    },

    setSelectedUser: (user: User | null) => set({ selectedUser: user }),
    clearError: () => set({ error: null }),
    clearLastInvite: () => set({ lastInvite: null }),
}));

export default useUserStore;
