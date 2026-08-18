import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { tokenStorage } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import mfaService, { emailOtpService } from '../services/mfa.service';

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
 * User account lifecycle status enum
 */
export type AccountStatus =
    | 'ACTIVE'
    | 'INACTIVE'
    | 'SUSPENDED'
    | 'DELETION_REQUESTED'
    | 'DELETED';

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
    accountStatus: AccountStatus;
    deletionRequestedAt: string | null;
    deletedAt: string | null;
    deletionReason: string | null;
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
    // MFA challenge state
    mfaPending: boolean;
    mfaSetupPending: boolean;
    mfaToken: string | null;
    // Email OTP gate state (first login)
    emailOtpPending: boolean;

    // Actions
    login: (credentials: LoginCredentials) => Promise<void>;
    verifyEmailOtp: (code: string) => Promise<void>;
    resendEmailOtp: () => Promise<void>;
    verifyMfa: (code: string) => Promise<void>;
    clearMfa: () => void;
    register: (data: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
    setUser: (user: User, tokens: { accessToken: string; refreshToken: string }) => void;
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
            mfaPending: false,
            mfaSetupPending: false,
            mfaToken: null,
            emailOtpPending: false,

            login: async (credentials: LoginCredentials) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await api.post<ApiResponse<any>>('/auth/login', credentials);

                    if (response.data.success && response.data.data) {
                        const data = response.data.data;

                        // ── Email OTP gate (first-ever login) ──────────────────
                        if (data.requiresEmailOtp === true) {
                            set({
                                emailOtpPending: true,
                                mfaToken: data.mfaToken,
                                isLoading: false,
                            });
                            return;
                        }

                        // MFA setup required
                        if (data.requiresMfaSetup === true) {
                            set({
                                mfaSetupPending: true,
                                mfaToken: data.mfaToken,
                                isLoading: false,
                            });
                            return;
                        }

                        // MFA challenge — backend returned mfaToken instead of full tokens
                        if (data.requiresMfa === true) {
                            set({
                                mfaPending: true,
                                mfaToken: data.mfaToken,
                                isLoading: false,
                            });
                            return;
                        }

                        // Normal login — store tokens and user
                        const { user, tokens } = data;
                        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
                        set({ user, isAuthenticated: true, isLoading: false, mfaPending: false, mfaSetupPending: false, emailOtpPending: false, mfaToken: null });
                    } else {
                        throw new Error(response.data.message || 'Login failed');
                    }
                } catch (error: any) {
                    const message = error.response?.data?.message || error.message || 'Login failed';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            verifyEmailOtp: async (code: string) => {
                const mfaToken = (useAuthStore.getState() as AuthState).mfaToken;
                if (!mfaToken) throw new Error('No OTP session active. Please log in again.');

                set({ isLoading: true, error: null });
                try {
                    const result = await emailOtpService.verify(mfaToken, code);

                    // After email OTP, backend may still require TOTP challenge (if already set up)
                    if (result.requiresMfa) {
                        set({ emailOtpPending: false, mfaPending: true, mfaToken: result.mfaToken!, isLoading: false });
                        return;
                    }

                    // Full tokens issued — user goes to dashboard
                    const { user, tokens, mfaSetupRecommended } = result as any;
                    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
                    set({ user, isAuthenticated: true, isLoading: false, emailOtpPending: false, mfaToken: null, error: null });
                    // Return the nudge flag so LoginPage can show a toast after navigating
                    return mfaSetupRecommended as boolean | undefined;
                } catch (error: any) {
                    const message = error.response?.data?.message || error.message || 'Invalid code';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            resendEmailOtp: async () => {
                const mfaToken = (useAuthStore.getState() as AuthState).mfaToken;
                if (!mfaToken) throw new Error('No OTP session active. Please log in again.');
                await emailOtpService.resend(mfaToken);
            },

            verifyMfa: async (code: string) => {
                const mfaToken = (useAuthStore.getState() as AuthState).mfaToken;
                if (!mfaToken) throw new Error('No MFA session active. Please log in again.');

                set({ isLoading: true, error: null });
                try {
                    const result = await mfaService.verify(mfaToken, code);
                    const { user, tokens } = result as any;
                    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
                    set({ user, isAuthenticated: true, isLoading: false, mfaPending: false, mfaSetupPending: false, mfaToken: null });
                } catch (error: any) {
                    const message = error.response?.data?.message || error.message || 'Invalid code';
                    set({ error: message, isLoading: false });
                    throw new Error(message);
                }
            },

            clearMfa: () => set({ mfaPending: false, mfaSetupPending: false, emailOtpPending: false, mfaToken: null, error: null }),

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

            setUser: (user: User, tokens: { accessToken: string; refreshToken: string }) => {
                tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
                set({ user, isAuthenticated: true, isLoading: false, error: null });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);

export default useAuthStore;
