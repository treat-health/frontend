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

// Metered SDK types are globally declared in src/types/metered.d.ts
import type { MeteredMeeting } from '../types/metered';

function normalizeMeteredRoomUrl(input?: string | null): string {
    if (!input) return '';

    return input
        .trim()
        .replaceAll(/[`"']/g, '')
        .replace(/\/+$/, '')
        .replace(/^https?:\/\//i, '');
}

class MeteredVoiceService {
    private meeting: MeteredMeeting | null = null;

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

            const meeting = new (globalThis as unknown as { Metered: { Meeting: new() => MeteredMeeting } }).Metered.Meeting();
            this.meeting = meeting;
            this.bindMeetingEvents();

            await meeting.join({
                roomURL: normalizeMeteredRoomUrl(roomName),
                name: identity || 'participant',
                accessToken: token,
            });

            // Following the same enterprise-grade pattern as SessionRoom.tsx:
            // join() only establishes connectivity; startAudio() publishes the media.
            try {
                await meeting.startAudio();
            } catch (audioErr) {
                console.error('[MeteredVoiceService] Failed to start audio:', audioErr);
                throw audioErr;
            }

            this.updateState({ activeMeteredCall: this.meeting });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown voice call error';
            console.error('[MeteredVoiceService] Failed to join meeting:', error);
            this.updateState({ activeMeteredCall: null, error: msg });
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
