import { create } from 'zustand';
import api from '../lib/api';
import { twilioVoiceService } from '../services/twilioVoice';
import { getSocket } from '../lib/socket';
import { Call } from '@twilio/voice-sdk';
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
    activeTwilioCall: Call | null;

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
    activeTwilioCall: null,
    error: null,
};

export const useCallStore = create<CallStoreState>((set, get) => {
    // Sync Twilio Device state changes into Zustand
    twilioVoiceService.setOnStateChange((partialState) => {
        set((state) => ({ ...state, ...partialState }));
    });

    return {
        ...IDLE_STATE,
        isReady: false,

        initDevice: async (convId: string) => {
            try {
                await twilioVoiceService.registerDevice(convId);
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

            const { callId, conversationId, activeTwilioCall } = get();
            if (!callId || !conversationId) return;

            const socket = getSocket();

            try {
                if (activeTwilioCall) {
                    activeTwilioCall.accept();
                }

                socket?.emit('call:accept', { callId, conversationId });
                set({ status: 'connected', isReceivingCall: false, error: null });
            } catch (err: any) {
                set({ error: err.message || 'Failed to accept call', status: 'idle', isReceivingCall: false });
            }
        },

        declineCall: (reason?: string) => {
            const { callId, conversationId, activeTwilioCall } = get();
            if (!callId || !conversationId) return;

            if (activeTwilioCall) {
                activeTwilioCall.reject();
            }

            const socket = getSocket();
            socket?.emit('call:decline', { callId, conversationId, reason: reason || 'declined' });

            set({ ...IDLE_STATE });
        },

        endCall: () => {
            const { callId, conversationId, activeTwilioCall } = get();

            if (activeTwilioCall) {
                activeTwilioCall.disconnect();
            }

            if (callId && conversationId) {
                const socket = getSocket();
                socket?.emit('call:end', { callId, conversationId });
            }

            set({ ...IDLE_STATE });
        },

        toggleMute: () => {
            const { activeTwilioCall, isMuted } = get();
            if (activeTwilioCall) {
                activeTwilioCall.mute(!isMuted);
                set({ isMuted: !isMuted });
            }
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
            // Only update if we're the one who initiated the call
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
                // As the caller, now connect via Twilio
                if (state.remoteUserId && state.callId) {
                    twilioVoiceService.makeCall(state.remoteUserId, state.callId).catch(err => {
                        set({ error: err.message, ...IDLE_STATE });
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
                if (state.activeTwilioCall) {
                    state.activeTwilioCall.disconnect();
                }
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
