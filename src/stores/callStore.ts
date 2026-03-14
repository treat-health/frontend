import { create } from 'zustand';
import api from '../lib/api';
import { meteredVoiceService } from '../services/meteredVoice';
import { getSocket } from '../lib/socket';
import toast from 'react-hot-toast';

const ensureAudioPermissions = async (): Promise<boolean> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
            toast.error('Microphone access is required for calls. Please check browser settings.');
        } else {
            toast.error('Could not access microphone.');
        }
        return false;
    }
};

export type CallStateStatus = 'idle' | 'calling' | 'ringing' | 'connected';

export interface CallStoreState {
    status: CallStateStatus;
    isReceivingCall: boolean;
    callId: string | null;
    conversationId: string | null;
    remoteUserId: string | null;
    isMuted: boolean;
    isReady: boolean;
    error: string | null;
    activeMeteredCall: any | null; // Metered meeting instance

    // Actions
    initDevice: (conversationId: string) => Promise<void>;
    startCall: (conversationId: string, toUserId: string) => Promise<void>;
    acceptCall: () => Promise<void>;
    declineCall: (reason?: string) => void;
    endCall: () => void;
    toggleMute: () => void;
    resetCall: () => void;

    // Socket Event Handlers
    handleCallCreated: (data: { callId: string; conversationId: string; toUserId: string }) => void;
    handleIncomingRinging: (data: { callId: string; conversationId: string; fromUserId: string }) => void;
    handleCallAccepted: (data: { callId: string; conversationId: string; byUserId: string }) => void;
    handleCallDeclined: (data: { callId: string; conversationId: string; byUserId: string; reason: string }) => void;
    handleCallEnded: (data: { callId: string; conversationId: string; byUserId: string }) => void;
    handleAnsweredElsewhere: (data: { callId: string; conversationId: string; handledByDeviceId: string }) => void;
    handleCallError: (data: { message: string }) => void;
    handleCallConnected: (data: { callId: string; conversationId: string }) => void;
}

const IDLE_STATE = {
    status: 'idle' as CallStateStatus,
    isReceivingCall: false,
    callId: null,
    conversationId: null,
    remoteUserId: null,
    isMuted: false,
    activeMeteredCall: null,
    error: null,
};

export const useCallStore = create<CallStoreState>((set, get) => {
    // Sync Metered service state changes into Zustand
    meteredVoiceService.setOnStateChange((partialState) => {
        set((state) => ({ ...state, ...partialState }));
    });

    return {
        ...IDLE_STATE,
        isReady: false,

        initDevice: async (convId: string) => {
            try {
                await meteredVoiceService.registerDevice(convId);
                set({ error: null });
            } catch (error: any) {
                set({ error: error.message || 'Failed to initialize calling device' });
            }
        },

        /**
         * Initiator starts a call via the strictly-enforced REST API.
         */
        startCall: async (conversationId: string, toUserId: string) => {
            const hasMic = await ensureAudioPermissions();
            if (!hasMic) return;

            const socket = getSocket();
            if (!socket?.connected) {
                toast.error('Cannot start call while disconnected from server');
                return;
            }

            // Optimistically set UI to "calling"
            set({
                status: 'calling',
                conversationId,
                remoteUserId: toUserId,
                error: null,
                callId: null,
            });

            try {
                // Server-authoritative REST call
                const res = await api.post('/calls/voice/initiate', { conversationId, toUserId });
                set({ callId: res.data.data.callId });
            } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to initiate call');
                set({ ...IDLE_STATE });
            }
        },

        acceptCall: async () => {
            const hasMic = await ensureAudioPermissions();
            if (!hasMic) return;

            const { callId, conversationId } = get();
            if (!callId || !conversationId) return;

            const socket = getSocket();

            try {
                socket?.emit('call:accept', { callId, conversationId });
                set({ status: 'connected', isReceivingCall: false, error: null });
            } catch (err: any) {
                set({ error: err.message || 'Failed to accept call', status: 'idle', isReceivingCall: false });
            }
        },

        declineCall: (reason?: string) => {
            const { callId, conversationId } = get();
            if (!callId || !conversationId) return;

            meteredVoiceService.disconnect();

            const socket = getSocket();
            socket?.emit('call:decline', { callId, conversationId, reason: reason || 'declined' });

            set({ ...IDLE_STATE });
        },

        endCall: () => {
            const { callId, conversationId } = get();

            meteredVoiceService.disconnect();

            if (callId && conversationId) {
                const socket = getSocket();
                socket?.emit('call:end', { callId, conversationId });
            }

            set({ ...IDLE_STATE });
        },

        toggleMute: () => {
            const { isMuted } = get();
            meteredVoiceService.mute(!isMuted);
            set({ isMuted: !isMuted });
        },

        resetCall: () => {
            set({ ...IDLE_STATE });
        },

        // ─── Socket Event Handlers ───

        /**
         * Server confirms call was created and provides callId.
         * Only the CALLER receives this.
         */
        handleCallCreated: ({ callId, conversationId }) => {
            const state = get();
            if (state.status === 'calling' && state.conversationId === conversationId) {
                set({ callId });
            }
        },

        handleIncomingRinging: ({ callId, conversationId, fromUserId }) => {
            const { status } = get();
            if (status !== 'idle') {
                // Already in a call, auto-decline
                const socket = getSocket();
                socket?.emit('call:decline', { callId, conversationId, reason: 'busy' });
                return;
            }

            set({
                status: 'ringing',
                isReceivingCall: true,
                callId,
                conversationId,
                remoteUserId: fromUserId,
            });
        },

        handleCallAccepted: ({ callId }) => {
            const state = get();
            if (state.callId === callId && state.status === 'calling') {
                set({ status: 'connected' });
                // As caller, join the Metered room now that receiver accepted
                if (state.conversationId) {
                    meteredVoiceService.makeCall(state.conversationId).catch(err => {
                        set({ ...IDLE_STATE, error: err.message });
                    });
                }
            }
        },

        handleCallDeclined: ({ callId, reason }) => {
            const state = get();
            if (state.callId === callId) {
                toast.error(`Call was ${reason}`);
                set({ ...IDLE_STATE });
            }
        },

        handleCallEnded: ({ callId }) => {
            const state = get();
            if (state.callId === callId) {
                meteredVoiceService.disconnect();
                set({ ...IDLE_STATE });
            }
        },

        handleAnsweredElsewhere: ({ callId }) => {
            const state = get();
            if (state.callId === callId && state.isReceivingCall) {
                set({ ...IDLE_STATE });
            }
        },

        handleCallError: ({ message }) => {
            toast.error(message || 'Call error occurred');
            set({ ...IDLE_STATE });
        },

        handleCallConnected: ({ callId }) => {
            const state = get();
            if (state.callId === callId) {
                set({ status: 'connected' });
            }
        },
    };
});
