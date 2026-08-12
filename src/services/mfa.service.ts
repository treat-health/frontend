import api from '../lib/api';
import type { ApiResponse } from '../lib/api';

export interface MfaSetupData {
    qrCodeDataUrl: string;
    manualCode: string;
}

export interface MfaStatusData {
    isMfaEnabled: boolean;
}

export interface MfaAdminSettings {
    requiredRoles: string[];
}

export interface MfaVerifyResult {
    user: unknown;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}

const mfaService = {
    /** GET /auth/mfa/status — current user's MFA enabled state */
    getStatus: async (): Promise<MfaStatusData> => {
        const res = await api.get<ApiResponse<MfaStatusData>>('/auth/mfa/status');
        return res.data.data!;
    },

    /** POST /auth/mfa/setup — generate QR code + manual code */
    setup: async (mfaToken?: string): Promise<MfaSetupData> => {
        const config = mfaToken ? { headers: { Authorization: `Bearer ${mfaToken}` } } : undefined;
        const res = await api.post<ApiResponse<MfaSetupData>>('/auth/mfa/setup', undefined, config);
        return res.data.data!;
    },

    /** POST /auth/mfa/enable — confirm 6-digit code to activate MFA */
    enable: async (code: string, mfaToken?: string): Promise<void> => {
        const config = mfaToken ? { headers: { Authorization: `Bearer ${mfaToken}` } } : undefined;
        await api.post('/auth/mfa/enable', { code }, config);
    },

    /** POST /auth/mfa/disable — turn MFA off */
    disable: async (): Promise<void> => {
        await api.post('/auth/mfa/disable');
    },

    /** POST /auth/mfa/verify — exchange mfaToken + code for real tokens */
    verify: async (mfaToken: string, code: string): Promise<MfaVerifyResult> => {
        const res = await api.post<ApiResponse<MfaVerifyResult>>('/auth/mfa/verify', {
            mfaToken,
            code,
        });
        return res.data.data!;
    },

    /** GET /admin/mfa — which roles require MFA */
    getAdminSettings: async (): Promise<MfaAdminSettings> => {
        const res = await api.get<ApiResponse<MfaAdminSettings>>('/admin/mfa');
        return res.data.data!;
    },

    /** PUT /admin/mfa — update which roles require MFA */
    setAdminSettings: async (roles: string[]): Promise<MfaAdminSettings> => {
        const res = await api.put<ApiResponse<MfaAdminSettings>>('/admin/mfa', { roles });
        return res.data.data!;
    },
};

export default mfaService;
