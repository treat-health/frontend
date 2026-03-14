/**
 * MeteredVoiceService
 *
 * Uses the Metered.ca WebRTC SDK (loaded via CDN)
 * to handle peer-to-peer voice calls. Call signaling (ringing, accept, decline,
 * end) continues to go through our WebSocket + REST layer — exactly as before.
 *
 * The Metered SDK joins the same room that the backend created in call.controller.ts.
 */

import api from '../lib/api';

// The Metered SDK is loaded as a global via <script> tag in index.html
declare global {
    interface Window {
        Metered: any;
    }
}

class MeteredVoiceService {
    private meeting: any = null;

    // Callback hook into Zustand store
    private onStateChange: (state: any) => void = () => { };

    public setOnStateChange(callback: (state: any) => void) {
        this.onStateChange = callback;
    }

    private updateState(partialState: any) {
        this.onStateChange(partialState);
    }

    /**
     * Fetch a voice token from the backend for the given conversation
     */
    private async fetchToken(conversationId: string): Promise<{ token: string; roomName: string; identity: string }> {
        const res = await api.post('/calls/voice/token', { conversationId });
        return {
            token: res.data?.data?.token || '',
            roomName: res.data?.data?.roomName || '',
            identity: res.data?.data?.identity || ''
        };
    }

    /**
     * Called once on app mount to ensure the SDK is ready.
     * With Metered, there is no long-lived "Device" registration because
     * it uses pure WebRTC — a new meeting instance is created per call.
     */
    public async registerDevice(_conversationId: string) {
        if (!(globalThis as any).Metered?.Meeting) {
            this.updateState({ error: 'Metered SDK not loaded. Check index.html script tag.' });
            return;
        }

        this.updateState({ isReady: true, error: null });
    }

    /**
     * Join the Metered room for the call.
     * Called after the call is accepted (receiver) or confirmed (caller).
     */
    public async makeCall(conversationId: string) {
        if (!(globalThis as any).Metered?.Meeting) {
            throw new Error('Metered SDK not loaded. Check index.html script tag.');
        }

        try {
            // Fetch token for the active call tied to this conversation.
            const { token, roomName, identity } = await this.fetchToken(conversationId);

            if (!token || !roomName) {
                throw new Error('No Metered token or room received from backend');
            }

            this.meeting = new (globalThis as any).Metered.Meeting();
            this.bindMeetingEvents();

            await this.meeting.join({
                roomURL: roomName, // Backend returns the full room URL or room ID
                participantName: identity || 'participant',
                meetingToken: token,
                // Audio only for voice calls
                video: false,
                audio: true
            });

            this.updateState({ activeMeteredCall: this.meeting });

        } catch (error: any) {
            console.error('[MeteredVoiceService] Failed to join meeting:', error);
            this.updateState({ activeMeteredCall: null, error: error.message });
            throw error;
        }
    }

    private bindMeetingEvents() {
        if (!this.meeting) return;

        this.meeting.on('remoteTrackStarted', (trackItem: any) => {
            if (trackItem.type === 'audio') {
                // Attach remote audio to DOM so the user can hear the caller
                const audioEl = document.createElement('audio');
                audioEl.autoplay = true;
                audioEl.id = `remote-audio-${trackItem.participantSessionId}`;
                audioEl.srcObject = new MediaStream([trackItem.track]);
                document.body.appendChild(audioEl);
            }
        });

        this.meeting.on('remoteTrackStopped', (trackItem: any) => {
            const el = document.getElementById(`remote-audio-${trackItem.participantSessionId}`);
            el?.remove();
        });

        this.meeting.on('participantLeft', () => {
            // Remote party hung up
            this.updateState({ activeMeteredCall: null });
        });

        this.meeting.on('meetingEnded', () => {
            this.cleanup();
            this.updateState({ activeMeteredCall: null });
        });

        this.meeting.on('error', (err: any) => {
            console.error('[MeteredVoiceService] Meeting error:', err);
            this.updateState({ error: err?.message || 'Voice call error occurred', activeMeteredCall: null });
        });
    }

    /**
     * Mute / unmute local audio track
     */
    public mute(shouldMute: boolean) {
        if (this.meeting) {
            if (shouldMute) {
                this.meeting.muteAudio?.();
            } else {
                this.meeting.unmuteAudio?.();
            }
        }
    }

    /**
     * Disconnect from the call
     */
    public disconnect() {
        if (this.meeting) {
            this.meeting.leaveMeeting?.();
        }
        this.cleanup();
    }

    private cleanup() {
        // Remove any dangling audio elements
        document.querySelectorAll('[id^="remote-audio-"]').forEach(el => el.remove());
        this.meeting = null;
    }

    public destroy() {
        this.disconnect();
        this.updateState({ isReady: false, activeMeteredCall: null });
    }
}

export const meteredVoiceService = new MeteredVoiceService();
