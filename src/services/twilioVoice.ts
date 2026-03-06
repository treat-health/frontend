import { Device } from '@twilio/voice-sdk';
import api from '../lib/api';

class TwilioVoiceService {
    private device: Device | null = null;
    private isRegistered = false;

    // Track state to notify Zustand store
    private onStateChange: (state: any) => void = () => { };

    // Timer refs
    private refreshInterval: number | null = null;

    public setOnStateChange(callback: (state: any) => void) {
        this.onStateChange = callback;
    }

    private updateState(partialState: any) {
        this.onStateChange(partialState);
    }

    /**
     * Fetch a new token from the backend
     */
    private async fetchToken(conversationId: string): Promise<string> {
        try {
            const res = await api.post('/calls/voice/token', { conversationId });
            return res.data?.data?.token || '';
        } catch (error) {
            console.error('[TwilioVoiceService] Failed to fetch token', error);
            throw error;
        }
    }

    /**
     * Start the refresh loop to proactively rotate short-lived tokens
     */
    private startTokenRefreshLoop(conversationId: string) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh every 50 minutes (assuming 1 hr TTL on backend)
        this.refreshInterval = window.setInterval(async () => {
            if (this.device && this.isRegistered) {
                console.log('[TwilioVoiceService] Proactively refreshing Voice token...');
                try {
                    const newToken = await this.fetchToken(conversationId);
                    this.device.updateToken(newToken);
                } catch (error) {
                    console.error('[TwilioVoiceService] Token refresh failed:', error);
                }
            }
        }, 50 * 60 * 1000);
    }

    /**
     * Initialize the Twilio Device and register with Twilio to receive incoming calls
     */
    public async registerDevice(conversationId: string) {
        try {
            const token = await this.fetchToken(conversationId);
            if (!token) throw new Error('No token received');

            this.device = new Device(token, {
                // Device configurations
                codecPreferences: ['opus', 'pcmu'] as any[]
            });

            // Bind events
            this.bindDeviceEvents(conversationId);

            // Register with Twilio infrastructure to receive incoming calls
            await this.device.register();
            this.startTokenRefreshLoop(conversationId);

        } catch (error: any) {
            console.error('[TwilioVoiceService] Error registering device:', error);
            this.updateState({ error: error.message || 'Failed to initialize voice calls' });
        }
    }

    private bindDeviceEvents(conversationId: string) {
        if (!this.device) return;

        this.device.on('registered', () => {
            console.log('[TwilioVoiceService] Device registered successfully');
            this.isRegistered = true;
            this.updateState({ isReady: true });
        });

        this.device.on('unregistered', () => {
            console.log('[TwilioVoiceService] Device unregistered');
            this.isRegistered = false;
            this.updateState({ isReady: false });
        });

        this.device.on('error', (twilioError: any) => {
            console.error('[TwilioVoiceService] Twilio Device Error:', twilioError);

            // 31000 - Network connection lost
            // 31208 - Registration failed due to network
            if (twilioError.code === 31000 || twilioError.code === 31208) {
                console.log('[TwilioVoiceService] Network error detected. Attempting recovery...');
                setTimeout(() => {
                    this.registerDevice(conversationId); // Try to re-register
                }, 5000);
            }

            // Provide user-friendly errors
            let uiError = 'An audio call error occurred.';
            if (twilioError.code === 31204 || twilioError.name === 'NotAllowedError') {
                uiError = 'Microphone access is required for calls. Please check your browser settings.';
            }

            this.updateState({ error: uiError });
        });

        this.device.on('tokenWillExpire', async () => {
            console.log('[TwilioVoiceService] Token expiring soon. Refreshing natively...');
            try {
                const newToken = await this.fetchToken(conversationId);
                this.device?.updateToken(newToken);
            } catch (error) {
                console.error('[TwilioVoiceService] Native refresh failed', error);
            }
        });

        this.device.on('incoming', (call: any) => {
            console.log('[TwilioVoiceService] Incoming call event Fired (Note: Custom signaling handles UI)');
            // We usually handle incoming UI via socket "call:ringing" instead of this
            // but we must Accept/Reject via this object when user interacts.
            // Store the active Twilio Call object to the Zustand store
            this.updateState({ activeTwilioCall: call });

            call.on('disconnect', () => {
                this.updateState({ activeTwilioCall: null });
            });
            call.on('cancel', () => {
                this.updateState({ activeTwilioCall: null });
            });
            call.on('reject', () => {
                this.updateState({ activeTwilioCall: null });
            });
        });
    }

    /**
     * Start an outbound call
     */
    public async makeCall(toUserId: string, callId: string) {
        if (!this.device || !this.isRegistered) {
            throw new Error('Device is not ready to make calls');
        }

        try {
            // We pass parameters to the Twilio Webhook via custom parameters
            const call = await this.device.connect({
                params: {
                    To: `client:${toUserId}`,
                    CallId: callId
                }
            });

            this.updateState({ activeTwilioCall: call });

            // Bind events for the outbound leg
            call.on('disconnect', () => {
                this.updateState({ activeTwilioCall: null });
            });
            call.on('error', (err: any) => {
                console.error('[TwilioVoice] Call error:', err);
                this.updateState({ activeTwilioCall: null, error: err.message });
            });

        } catch (error) {
            console.error('[TwilioVoiceService] Failed to make call', error);
            throw error;
        }
    }

    /**
     * Destroy context on cleanup
     */
    public destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }
        this.isRegistered = false;
        this.updateState({ isReady: false, activeTwilioCall: null });
    }
}

export const twilioVoiceService = new TwilioVoiceService();
