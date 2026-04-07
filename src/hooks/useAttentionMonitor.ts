import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api, { tokenStorage } from '../lib/api';

// Generic interface so this hook works across different room providers.
// The hook only needs: localParticipant with audioTracks/videoTracks.
// With Metered we pass in a lightweight adapter object built in SessionRoom.tsx.
export interface AttentionRoomAdapter {
    localParticipant: {
        audioTracks: Map<string, { track: AttentionTrackAdapter | null; isEnabled?: boolean }>;
        videoTracks: Map<string, { track: AttentionTrackAdapter | null; isEnabled?: boolean }>;
        on: (event: string, handler: (...args: any[]) => void) => void;
        off?: (event: string, handler: (...args: any[]) => void) => void;
    };
}

export interface AttentionTrackAdapter {
    kind: 'audio' | 'video';
    isEnabled: boolean;
    mediaStreamTrack?: MediaStreamTrack;
    on: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
}

interface AttentionMonitorProps {
    sessionId: string;
    room: AttentionRoomAdapter | null;
    role: string;
    enabled: boolean;
    mediaState?: {
        isMicOff: boolean;
        isCameraOff: boolean;
    };
}

interface BufferEvent {
    type: string;
    timestamp: string;
    meta?: any;
}

const NUDGE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const GRACE_PERIOD_MS = 15 * 1000; // 15 seconds
const AUDIO_INACTIVITY_THRESHOLD_MS = 10 * 1000; // 10 seconds empty audio
const AUDIO_VOLUME_THRESHOLD = 5; // Out of 255 byte scale
const BATCH_INTERVAL_MS = 30 * 1000; // 30 seconds

export function useAttentionMonitor({ sessionId, room, role, enabled, mediaState }: AttentionMonitorProps) {
    const eventBuffer = useRef<BufferEvent[]>([]);
    const lastNudgeTime = useRef<number>(0);
    const hookStartTime = useRef<number>(Date.now());

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceStartMSRef = useRef<number | null>(null);
    const isAudioInactiveRef = useRef<boolean>(false);

    // Track active states to avoid duplicate events
    const stateRefs = useRef({
        cameraOff: false,
        micOff: false,
    });

    const addEvent = (type: string, meta?: any) => {
        if (!enabled) return;
        eventBuffer.current.push({
            type,
            timestamp: new Date().toISOString(),
            meta
        });
    };

    const flushEvents = () => {
        if (eventBuffer.current.length === 0 || !enabled) return;

        const payload = [...eventBuffer.current];
        eventBuffer.current = []; // clear buffer

        api.post(`/sessions/${sessionId}/attention-events`, { events: payload })
            .catch(err => console.error('Failed to flush attention events', err));
    };

    const flushEventsBeacon = () => {
        if (eventBuffer.current.length === 0 || !enabled) return;

        const payload = eventBuffer.current;
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/sessions/${sessionId}/attention-events`;

        const token = tokenStorage.getAccessToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch(url, {
            method: 'POST',
            body: JSON.stringify({ events: payload }),
            headers,
            keepalive: true
        }).catch(err => console.error('Failed to flush events during unload:', err));
    };

    const attemptNudge = (message: string, reason: string) => {
        if (!enabled) return;

        const now = Date.now();
        if (now - hookStartTime.current < GRACE_PERIOD_MS) return;
        if (now - lastNudgeTime.current < NUDGE_COOLDOWN_MS) return;

        lastNudgeTime.current = now;
        toast(message, {
            icon: '⚠️',
            duration: 6000,
            id: 'attention-nudge',
            style: { background: '#1e1e2d', color: '#f3f4f6', border: '1px solid #4b5563' }
        });

        addEvent('NUDGE_SHOWN', { reason });
    };

    useEffect(() => {
        if (!enabled || !mediaState) return;

        if (mediaState.isCameraOff && !stateRefs.current.cameraOff) {
            stateRefs.current.cameraOff = true;
            addEvent('CAMERA_OFF_START');
            attemptNudge("Looks like your camera is off - please turn it on if possible.", 'camera_off');
        } else if (!mediaState.isCameraOff && stateRefs.current.cameraOff) {
            stateRefs.current.cameraOff = false;
            addEvent('CAMERA_OFF_END');
        }

        if (mediaState.isMicOff && !stateRefs.current.micOff) {
            stateRefs.current.micOff = true;
            addEvent('MIC_OFF_START');
            attemptNudge("Your microphone is off - please unmute if you're speaking.", 'mic_off');
        } else if (!mediaState.isMicOff && stateRefs.current.micOff) {
            stateRefs.current.micOff = false;
            addEvent('MIC_OFF_END');
        }
    }, [enabled, mediaState?.isCameraOff, mediaState?.isMicOff]);

    // 1. Setup recurring flush and beforeunload
    useEffect(() => {
        if (!enabled) return;

        hookStartTime.current = Date.now();
        addEvent('PARTICIPANT_JOINED', { role });

        const interval = setInterval(flushEvents, BATCH_INTERVAL_MS);

        const handleBeforeUnload = () => flushEventsBeacon();
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (enabled) {
                addEvent('PARTICIPANT_LEFT');
                flushEvents();
            }
        };
    }, [sessionId, enabled]);

    // 2. Setup Track Listeners & Audio Analysis (provider-agnostic via adapter)
    useEffect(() => {
        if (!room || !enabled) return;

        const localParticipant = room.localParticipant;

        const attachTrackListeners = (track: AttentionTrackAdapter) => {
            if (track.kind === 'video') {
                if (!track.isEnabled && !stateRefs.current.cameraOff) {
                    stateRefs.current.cameraOff = true;
                    addEvent('CAMERA_OFF_START');
                    attemptNudge("Looks like your camera is off - please turn it on if possible.", 'camera_off');
                }

                track.on('disabled', () => {
                    if (!stateRefs.current.cameraOff) {
                        stateRefs.current.cameraOff = true;
                        addEvent('CAMERA_OFF_START');
                        attemptNudge("Looks like your camera is off - please turn it on if possible.", 'camera_off');
                    }
                });

                track.on('enabled', () => {
                    if (stateRefs.current.cameraOff) {
                        stateRefs.current.cameraOff = false;
                        addEvent('CAMERA_OFF_END');
                    }
                });
            }

            if (track.kind === 'audio') {
                if (!track.isEnabled && !stateRefs.current.micOff) {
                    stateRefs.current.micOff = true;
                    addEvent('MIC_OFF_START');
                    attemptNudge("Your microphone is off - please unmute if you're speaking.", 'mic_off');
                }

                track.on('disabled', () => {
                    if (!stateRefs.current.micOff) {
                        stateRefs.current.micOff = true;
                        addEvent('MIC_OFF_START');
                        attemptNudge("Your microphone is off - please unmute if you're speaking.", 'mic_off');
                    }
                });

                track.on('enabled', () => {
                    if (stateRefs.current.micOff) {
                        stateRefs.current.micOff = false;
                        addEvent('MIC_OFF_END');
                    }
                });

                // Setup Web Audio API for inactivity proxy
                try {
                    const mediaStreamTrack = track.mediaStreamTrack;
                    if (mediaStreamTrack) {
                        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const mediaStream = new MediaStream([mediaStreamTrack]);
                        const source = audioContext.createMediaStreamSource(mediaStream);
                        const analyser = audioContext.createAnalyser();

                        analyser.fftSize = 256;
                        source.connect(analyser);

                        if (audioContext.state === 'suspended') {
                            audioContext.resume().catch(err => console.warn('Could not resume AudioContext', err));
                        }

                        audioContextRef.current = audioContext;
                        analyserRef.current = analyser;
                    }
                } catch (e) {
                    console.warn('AudioContext not supported or restricted, skipping audio inactivity detection', e);
                }
            }
        };

        // Attach to existing tracks
        localParticipant.videoTracks.forEach(pub => {
            if (pub.track) attachTrackListeners(pub.track);
        });
        localParticipant.audioTracks.forEach(pub => {
            if (pub.track) attachTrackListeners(pub.track);
        });

        localParticipant.on('trackPublished', (publication: any) => {
            if (publication.track) attachTrackListeners(publication.track as AttentionTrackAdapter);
        });

        // Loop for audio inactivity check
        let animationFrameId: number;

        const checkAudioActivity = () => {
            if (!analyserRef.current) return;

            // If mic is off, don't double-penalise with "audio inactive"
            if (stateRefs.current.micOff) {
                if (isAudioInactiveRef.current) {
                    isAudioInactiveRef.current = false;
                    addEvent('AUDIO_INACTIVE_END');
                    silenceStartMSRef.current = null;
                }
                animationFrameId = requestAnimationFrame(checkAudioActivity);
                return;
            }

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const isQuiet = average < AUDIO_VOLUME_THRESHOLD;

            if (isQuiet) {
                if (silenceStartMSRef.current === null) {
                    silenceStartMSRef.current = Date.now();
                } else {
                    const silenceDuration = Date.now() - silenceStartMSRef.current;
                    if (silenceDuration >= AUDIO_INACTIVITY_THRESHOLD_MS && !isAudioInactiveRef.current) {
                        isAudioInactiveRef.current = true;
                        addEvent('AUDIO_INACTIVE_START');
                        attemptNudge("We haven't detected audio for a bit - are you still there?", 'audio_inactive');
                    }
                }
            } else {
                silenceStartMSRef.current = null;
                if (isAudioInactiveRef.current) {
                    isAudioInactiveRef.current = false;
                    addEvent('AUDIO_INACTIVE_END');
                }
            }

            setTimeout(() => {
                animationFrameId = requestAnimationFrame(checkAudioActivity);
            }, 500);
        };

        if (analyserRef.current) {
            checkAudioActivity();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(e => console.error(e));
            }
        };
    }, [room, enabled]);
}

