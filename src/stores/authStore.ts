import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { tokenStorage } from '../lib/api';
import type { ApiResponse } from '../lib/api';

/**
 * User role enum
 */
export type UserRole =
    | 'ADMIN'
    | 'THERAPIST'
    | 'CLIENT'
    | 'ADMISSIONS_REP'
    | 'CARE_COORDINATOR'
    | 'PROGRAM_DIRECTOR'
    | 'INSURANCE_TEAM'
    | 'PSYCHIATRIC_PROVIDER';

/**
 * User Treatment Status enum
 */
export type TreatmentStatus =
    | 'ACTIVE'
    | 'SUCCESSFUL_COMPLETION'
    | 'ACA'
    | 'ADMINISTRATIVE_DISCHARGE'
    | 'TRANSFER_TO_HIGH_LEVEL_CARE'
    | 'REFER_TO_OUTSIDE_AGENCY';

/**
 * User type
 */
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: UserRole;
    state: string | null;
    isActive: boolean;
    treatmentStatus?: TreatmentStatus;
    emailVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
    email: string;
    password: string;
}

/**
 * Register data
 */
export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
    state?: string;
}

/**
 * Auth API responses
 */
interface AuthResponse {
    user: User;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}

/**
 * Auth store state
 */
interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

/**
 * Auth store
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (credentials: LoginCredentials) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);

                    if (response.data.success && response.data.data) {
                        const { user, tokens } = response.data.data;
                        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
                        set({ user, isAuthenticated: true, isLoading: false });
                    } else {
                        throw new Error(response.data.message || 'Login failed');
                    }
                } catch (error: any) {
                    const message = error.response?.data?.message || error.message || 'Login failed';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            register: async (data: RegisterData) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);

                    if (response.data.success && response.data.data) {
                        const { user, tokens } = response.data.data;
                        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
                        set({ user, isAuthenticated: true, isLoading: false });
                    } else {
                        throw new Error(response.data.message || 'Registration failed');
                    }
                } catch (error: any) {
                    const message = error.response?.data?.message || error.message || 'Registration failed';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            logout: async () => {
                set({ isLoading: true });
                try {
                    const refreshToken = tokenStorage.getRefreshToken();
                    if (refreshToken) {
                        await api.post('/auth/logout', { refreshToken }).catch(() => { });
                    }
                } finally {
                    tokenStorage.clearTokens();
                    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
                }
            },

            checkAuth: async () => {
                const token = tokenStorage.getAccessToken();
                if (!token) {
                    set({ user: null, isAuthenticated: false });
                    return;
                }

                set({ isLoading: true });
                try {
                    const response = await api.get<ApiResponse<User>>('/auth/me');
                    if (response.data.success && response.data.data) {
                        set({ user: response.data.data, isAuthenticated: true, isLoading: false });
                    } else {
                        throw new Error('Failed to get user');
                    }
                } catch (error) {
                    tokenStorage.clearTokens();
                    set({ user: null, isAuthenticated: false, isLoading: false });
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);

export default useAuthStore;
