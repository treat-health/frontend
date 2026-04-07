import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// API base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'treat_access_token';
const REFRESH_TOKEN_KEY = 'treat_refresh_token';

/**
 * API response type
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    errors?: Array<{ field?: string; message: string }>;
}

/**
 * Token storage utilities
 */
export const tokenStorage = {
    getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
    getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
    setTokens: (accessToken: string, refreshToken: string): void => {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    },
    clearTokens: (): void => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    },
};

/**
 * Create base axios instance for external requests (like S3 uploads)
 */
export const axiosInstance: AxiosInstance = axios.create({
    timeout: 30000,
});

/**
 * Create API instance with base URL
 */
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

/**
 * Request interceptor - add auth token
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = tokenStorage.getAccessToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => { throw error; }
);

/**
 * Response interceptor - handle token refresh
 */
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError<ApiResponse>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // If 401 and we have a refresh token, try to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            const refreshToken = tokenStorage.getRefreshToken();

            if (!refreshToken) {
                tokenStorage.clearTokens();
                globalThis.location.href = '/login';
                throw error;
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => { throw err; });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
                    `${API_BASE_URL}/auth/refresh`,
                    { refreshToken }
                );

                if (response.data.success && response.data.data) {
                    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
                    tokenStorage.setTokens(accessToken, newRefreshToken);
                    processQueue(null, accessToken);
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError as Error, null);
                tokenStorage.clearTokens();
                globalThis.location.href = '/login';
                throw refreshError;
            } finally {
                isRefreshing = false;
            }
        }

        throw error;
    }
);

export default api;
