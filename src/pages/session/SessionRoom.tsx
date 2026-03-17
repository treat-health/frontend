import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Loader2, PanelRight, X, Info, CheckCircle, Clock, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { connectSocket, getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import SessionReportPanel from '../../components/session/SessionReportPanel';
import { useAttentionMonitor, type AttentionRoomAdapter } from '../../hooks/useAttentionMonitor';
import './SessionRoom.css';

// Metered SDK types are globally declared in src/types/metered.d.ts
// MeteredMeeting interface is available globally from that declaration file.
import type { MeteredMeeting } from '../../types/metered';

const ROOM_OPEN_EARLY_MINUTES = 15;
const ROOM_REJOIN_GRACE_MINUTES = 0; // Strict session end

type JoinState = 'LOADING' | 'WAITING' | 'ACKNOWLEDGMENT' | 'JOINING' | 'LEFT' | 'COMPLETED';
type ExitContext = 'LEFT' | 'NETWORK' | null;

interface SessionDetails {
    id: string;
    status: string;
    scheduledAt: string;
    durationMins: number;
    clientId: string;
    therapistId: string;
    notes?: string | null;
}

interface PresenceParticipantSummary {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    state: string;
    isConnected: boolean;
    firstJoinedAt: string | null;
    lastJoinedAt: string | null;
    lastLeftAt: string | null;
    lastSeenAt: string | null;
    totalConnectedSeconds: number;
    joinCount: number;
    reconnectCount: number;
    lastDisconnectReason: string | null;
}

interface PresenceEventSummary {
    id: string;
    eventType: string;
    source: string;
    userId: string | null;
    role: string | null;
    occurredAt: string;
    disconnectReason: string | null;
    connectionId: string | null;
    providerRoomId: string | null;
    providerParticipantId: string | null;
    metadata?: Record<string, unknown> | null;
}

interface PresenceSummary {
    sessionId: string;
    status: string;
    roomWindow: {
        opensAt: string;
        closesAt: string;
        canRejoinNow: boolean;
    };
    participants: PresenceParticipantSummary[];
    recentEvents: PresenceEventSummary[];
}

function parseSessionDate(value: string) {
    const trimmedValue = value.trim();

    if (/z$/i.test(trimmedValue) || /[+-]\d{2}:\d{2}$/.test(trimmedValue)) {
        return new Date(trimmedValue);
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmedValue)) {
        return new Date(trimmedValue.replace(' ', 'T') + 'Z');
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmedValue)) {
        return new Date(`${trimmedValue}Z`);
    }

    return new Date(trimmedValue);
}

function getSessionTiming(session: SessionDetails) {
    const scheduledStartMs = parseSessionDate(session.scheduledAt).getTime();
    const scheduledEndMs = scheduledStartMs + session.durationMins * 60 * 1000;

    return {
        scheduledStartMs,
        scheduledEndMs,
        roomOpenMs: scheduledStartMs - ROOM_OPEN_EARLY_MINUTES * 60 * 1000,
        rejoinDeadlineMs: scheduledEndMs + ROOM_REJOIN_GRACE_MINUTES * 60 * 1000,
    };
}

function isSessionTerminal(session: SessionDetails) {
    return ['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(session.status);
}

function canRejoinSession(session: SessionDetails, nowMs = Date.now()) {
    if (isSessionTerminal(session)) {
        return false;
    }

    const { roomOpenMs, rejoinDeadlineMs } = getSessionTiming(session);
    return nowMs >= roomOpenMs && nowMs <= rejoinDeadlineMs;
}

function normalizeMeteredRoomUrl(input?: string | null) {
    if (!input) return '';
    return input
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '');
}

function formatSessionDateTime(iso: string) {
    return parseSessionDate(iso).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
    });
}

function formatTimestamp(timestampMs: number) {
    return new Date(timestampMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value?: string | null) {
    if (!value) return '—';
    return parseSessionDate(value).toLocaleString([], {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
        timeZoneName: 'short',
    });
}

function formatConnectedDuration(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

function formatRoleLabel(role?: string | null) {
    return role ? role.replaceAll('_', ' ').toLowerCase() : 'participant';
}

function formatPresenceStateLabel(state: string) {
    switch (state) {
        case 'CONNECTED':
            return 'Live in room';
        case 'DISCONNECTED':
            return 'Disconnected';
        case 'COMPLETED':
            return 'Session completed';
        case 'EXPIRED':
            return 'Window expired';
        default:
            return 'Not joined yet';
    }
}

function getPresenceStateTone(state: string) {
    switch (state) {
        case 'CONNECTED':
            return 'live';
        case 'DISCONNECTED':
            return 'away';
        case 'COMPLETED':
            return 'complete';
        default:
            return 'pending';
    }
}

function formatPresenceEventLabel(eventType: string) {
    return eventType.replaceAll('_', ' ').toLowerCase();
}

function getPresenceEventDescription(event: PresenceEventSummary, participants: PresenceParticipantSummary[]) {
    const actor = participants.find((participant) => participant.userId === event.userId);
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'System';

    switch (event.eventType) {
        case 'PARTICIPANT_CONNECTED':
            return `${actorName} joined the room`;
        case 'PARTICIPANT_DISCONNECTED': {
            const disconnectSuffix = event.disconnectReason ? ` · ${event.disconnectReason}` : '';
            return `${actorName} left the room${disconnectSuffix}`;
        }
        case 'ROOM_CREATED':
            return 'Secure room created';
        case 'ROOM_ENDED':
            return 'Room lifecycle closed';
        case 'TOKEN_ISSUED':
            return `${actorName} was authorized to join`;
        case 'SESSION_COMPLETED':
            return `${actorName} completed the session`;
        default:
            return formatPresenceEventLabel(event.eventType);
    }
}

function createTrackAdapter(track: MediaStreamTrack, kind: 'video' | 'audio') {
    const listeners: Record<string, Array<() => void>> = {};

    const registerListener = (event: string, handler: () => void) => {
        const eventListeners = listeners[event] ?? [];
        eventListeners.push(handler);
        listeners[event] = eventListeners;
    };

    return {
        kind,
        get isEnabled() { return track.enabled; },
        mediaStreamTrack: track,
        on: registerListener,
    };
}


interface SessionStatusScreenProps {
    title: string;
    message: string;
    onClose: () => void;
}

function SessionStatusScreen({ title, message, onClose }: Readonly<SessionStatusScreenProps>) {
    return (
        <div className="session-room-loading" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <CheckCircle size={64} style={{ color: 'var(--primary-color)' }} />
            <h2>{title}</h2>
            <p>{message}</p>
            <div style={{ marginTop: '2rem' }}>
                <button className="btn btn-submit" onClick={onClose}>Return to Dashboard</button>
            </div>
        </div>
    );
}

interface SessionRejoinScreenProps {
    heading: string;
    message: string;
    scheduledRangeLabel: string | null;
    rejoinDeadlineLabel: string | null;
    onClose: () => void;
    onRejoin: () => void;
}

function SessionRejoinScreen({
    heading,
    message,
    scheduledRangeLabel,
    rejoinDeadlineLabel,
    onClose,
    onRejoin,
}: Readonly<SessionRejoinScreenProps>) {
    return (
        <div className="session-room-loading">
            <button
                type="button"
                className="session-overlay-close-btn"
                onClick={onClose}
                aria-label="Close session window"
                title="Close"
            >
                <X size={18} />
            </button>
            <div className="pre-join-modal session-rejoin-modal">
                <CheckCircle size={36} className="text-primary mb-4" />
                <h2>{heading}</h2>
                <p className="session-rejoin-copy">{message}</p>

                <div className="session-rejoin-card">
                    <div className="session-rejoin-row">
                        <span>Session time</span>
                        <strong>{scheduledRangeLabel}</strong>
                    </div>
                    {rejoinDeadlineLabel && (
                        <div className="session-rejoin-row">
                            <span>Rejoin available until</span>
                            <strong>{rejoinDeadlineLabel}</strong>
                        </div>
                    )}
                </div>

                <button
                    className="btn btn-submit"
                    onClick={onRejoin}
                    style={{ width: '100%', marginTop: '1.5rem' }}
                >
                    Rejoin Session
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={onClose}
                    style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
}

interface SessionExitDialogProps {
    canUserCompleteSession: boolean;
    isCompletingSession: boolean;
    rejoinDeadlineLabel: string | null;
    onCancel: () => void;
    onComplete: () => void;
    onLeave: (returnToDashboard: boolean) => void;
}

function SessionExitDialog({
    canUserCompleteSession,
    isCompletingSession,
    rejoinDeadlineLabel,
    onCancel,
    onComplete,
    onLeave,
}: Readonly<SessionExitDialogProps>) {
    return (
        <dialog
            className="session-dialog-backdrop"
            open
            onCancel={onCancel}
            aria-labelledby="session-exit-dialog-title"
        >
            <div
                className="session-dialog"
            >
                <div className="session-dialog-header">
                    <h3 id="session-exit-dialog-title">Leave call?</h3>
                    <button type="button" className="session-dialog-close" onClick={onCancel}>
                        <X size={16} />
                    </button>
                </div>
                <p className="session-dialog-copy">
                    Leaving disconnects only you. The session stays rejoinable until <strong>{rejoinDeadlineLabel || 'the scheduled end time'}</strong>.
                </p>
                <div className="session-dialog-actions">
                    <button type="button" className="session-dialog-btn primary" onClick={() => onLeave(false)}>
                        Leave Call
                    </button>
                    <button type="button" className="session-dialog-btn secondary" onClick={() => onLeave(true)}>
                        Leave & Return to Dashboard
                    </button>
                    {canUserCompleteSession && (
                        <button
                            type="button"
                            className="session-dialog-btn danger"
                            onClick={onComplete}
                            disabled={isCompletingSession}
                        >
                            {isCompletingSession ? 'Completing…' : 'Complete Session'}
                        </button>
                    )}
                    <button type="button" className="session-dialog-btn ghost" onClick={onCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        </dialog>
    );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function renderPreJoinStage(params: {
    isLoading: boolean;
    joinState: JoinState;
    sessionDetails: SessionDetails | null;
    isGraceWindowExpired: boolean;
    hasAcknowledged: boolean;
    waitMinutesLeft: number;
    waitMinuteLabel: string;
    roomOpenLabel: string | null;
    scheduledRangeLabel: string | null;
    rejoinDeadlineLabel: string | null;
    exitContext: ExitContext;
    onCloseOverlay: () => ReactNode;
    onCloseDashboard: () => void;
    onStartJoining: () => void;
    onToggleAcknowledged: (checked: boolean) => void;
}): ReactNode {
    const {
        isLoading,
        joinState,
        sessionDetails,
        isGraceWindowExpired,
        hasAcknowledged,
        waitMinutesLeft,
        waitMinuteLabel,
        roomOpenLabel,
        scheduledRangeLabel,
        rejoinDeadlineLabel,
        exitContext,
        onCloseOverlay,
        onCloseDashboard,
        onStartJoining,
        onToggleAcknowledged,
    } = params;

    if (isLoading && joinState === 'JOINING') {
        return (
            <div className="session-room-loading">
                {onCloseOverlay()}
                <Loader2 className="animate-spin" size={48} />
                <p>Preparing secure session environment...</p>
            </div>
        );
    }

    if (joinState === 'COMPLETED') {
        let completedTitle = 'Session Unavailable';
        let completedMessage = 'This session is no longer available to join.';

        if (sessionDetails?.status === 'COMPLETED') {
            completedTitle = 'Session Completed';
            completedMessage = 'This session has ended and is permanently closed.';
        } else if (isGraceWindowExpired) {
            completedTitle = 'Session Window Closed';
            completedMessage = 'The secure rejoin window has ended for this session.';
        }

        return <SessionStatusScreen title={completedTitle} message={completedMessage} onClose={onCloseDashboard} />;
    }

    if (joinState === 'WAITING' && sessionDetails) {
        return (
            <div className="session-room-loading" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
                {onCloseOverlay()}
                <Clock size={48} style={{ color: 'var(--primary-color)' }} />
                <h2>Waiting Room</h2>
                <p>Your session is scheduled for <strong>{formatSessionDateTime(sessionDetails.scheduledAt)}</strong>.</p>
                <p>
                    The secure room opens 15 minutes prior at{' '}
                    <strong>{roomOpenLabel || 'the scheduled opening time'}</strong>.
                </p>
                <div style={{ marginTop: '2rem', padding: '1rem 2rem', background: '#e0f2fe', borderRadius: '8px', color: '#0369a1', fontWeight: 600 }}>
                    Opening in approx. {waitMinutesLeft} {waitMinuteLabel}
                </div>
            </div>
        );
    }

    if (joinState === 'ACKNOWLEDGMENT') {
        return (
            <div className="session-room-loading">
                {onCloseOverlay()}
                <div className="pre-join-modal">
                    <Video size={36} className="text-primary mb-4" />
                    <h2>Ready to join?</h2>

                    <div className="pre-join-notice">
                        <p><strong>For session quality and safety, please keep your camera on and remain present.</strong></p>
                        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            We use local technical signals (camera/mic status and audio activity) to ensure everyone is present.
                            <br />Your session remains completely private.
                        </p>
                    </div>

                    <label className="pre-join-checkbox">
                        <input
                            type="checkbox"
                            checked={hasAcknowledged}
                            onChange={(e) => onToggleAcknowledged(e.target.checked)}
                        />
                        <span>I understand and agree</span>
                    </label>

                    <button
                        className="btn btn-submit"
                        disabled={!hasAcknowledged}
                        onClick={onStartJoining}
                        style={{ width: '100%', marginTop: '1.5rem', opacity: hasAcknowledged ? 1 : 0.6 }}
                    >
                        Join Session
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={onCloseDashboard}
                        style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    if (joinState === 'LEFT' && sessionDetails) {
        const heading = exitContext === 'NETWORK' ? 'Connection interrupted' : 'You left the call';
        const message = exitContext === 'NETWORK'
            ? 'Your secure session was interrupted, but the room is still open for you.'
            : 'You are safely out of the room, and you can hop back in whenever you are ready.';

        return (
            <SessionRejoinScreen
                heading={heading}
                message={message}
                scheduledRangeLabel={scheduledRangeLabel}
                rejoinDeadlineLabel={rejoinDeadlineLabel}
                onClose={onCloseDashboard}
                onRejoin={onStartJoining}
            />
        );
    }

    return null;
}

function useMeteredJoinEffect(params: {
    id?: string;
    userId: string | null;
    joinState: JoinState;
    navigate: (to: string) => void | Promise<void>;
    sessionDetails: SessionDetails | null;
    setAiMonitoringConsent: (value: boolean) => void;
    setIsLoading: (value: boolean) => void;
    setIsVideoOff: (value: boolean) => void;
    setAttentionAdapter: (adapter: AttentionRoomAdapter | null) => void;
    setIsConnected: (value: boolean) => void;
    setExitContext: (value: ExitContext) => void;
    setJoinState: (value: JoinState) => void;
    localVideoRef: React.RefObject<HTMLDivElement | null>;
    remoteVideoRef: React.RefObject<HTMLDivElement | null>;
    localStreamRef: React.RefObject<MediaStream | null>;
    remoteStreamsRef: React.RefObject<Map<string, HTMLElement>>;
    roomRef: React.RefObject<MeteredMeeting | null>;
    sessionDetailsRef: React.RefObject<SessionDetails | null>;
    disconnectIntentRef: React.RefObject<'LEAVE' | 'COMPLETE' | null>;
    clearVideoContainers: () => void;
}) {
    const {
        id,
        userId,
        joinState,
        navigate,
        sessionDetails,
        setAiMonitoringConsent,
        setIsLoading,
        setIsVideoOff,
        setAttentionAdapter,
        setIsConnected,
        setExitContext,
        setJoinState,
        localVideoRef,
        remoteVideoRef,
        localStreamRef,
        remoteStreamsRef,
        roomRef,
        sessionDetailsRef,
        disconnectIntentRef,
        clearVideoContainers,
    } = params;

    useEffect(() => {
        if (!id || !userId || joinState !== 'JOINING') return;

        let isUnmounting = false;

        // eslint-disable-next-line sonarjs/cognitive-complexity
        const initMeteredVideo = async () => {
            if (!id || !userId) return;

            if (!(globalThis as any).Metered?.Meeting) {
                toast.error('Video SDK not loaded. Please refresh the page.');
                setIsLoading(false);
                return;
            }

            try {
                const response = await api.post(`/sessions/${id}/media-token`);
                const { token, roomName, roomUrl, aiMonitoringConsent: consentFromServer } = response.data;
                setAiMonitoringConsent(!!consentFromServer);

                if (isUnmounting) return;

                let localStream: MediaStream;
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
                } catch (err: any) {
                    if (err.message?.includes('video') || err.name === 'NotReadableError') {
                        console.warn('Video unavailable, falling back to audio-only:', err.message);
                        toast.error('Camera unavailable. Joining with audio only.', { duration: 5000 });
                        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        setIsVideoOff(true);
                    } else {
                        throw err;
                    }
                }

                if (isUnmounting) {
                    localStream.getTracks().forEach((t) => t.stop());
                    return;
                }

                localStreamRef.current = localStream;

                if (localVideoRef.current) {
                    localVideoRef.current.innerHTML = '';
                    const videoTracks = localStream.getVideoTracks();
                    if (videoTracks.length > 0) {
                        const localVideo = document.createElement('video');
                        localVideo.autoplay = true;
                        localVideo.muted = true;
                        localVideo.playsInline = true;
                        localVideo.srcObject = new MediaStream([videoTracks[0]]);
                        localVideo.style.width = '100%';
                        localVideo.style.height = '100%';
                        localVideo.style.objectFit = 'cover';
                        localVideo.style.transform = 'scaleX(-1)';
                        localVideo.style.display = 'block';
                        localVideoRef.current.appendChild(localVideo);
                    }
                }

                const meeting = new (globalThis as any).Metered.Meeting();
                roomRef.current = meeting;

                const videoTracks = localStream.getVideoTracks();
                const audioTracks = localStream.getAudioTracks();

                const videoAdapters = videoTracks.map((t) => createTrackAdapter(t, 'video'));
                const audioAdapters = audioTracks.map((t) => createTrackAdapter(t, 'audio'));
                const adapter: AttentionRoomAdapter = {
                    localParticipant: {
                        videoTracks: new Map(videoAdapters.map((a, i) => [`video-${i}`, { track: a, isEnabled: videoAdapters[i].isEnabled }])),
                        audioTracks: new Map(audioAdapters.map((a, i) => [`audio-${i}`, { track: a, isEnabled: audioAdapters[i].isEnabled }])),
                        on: (_event: string, _handler: any) => { /* not used for local */ }
                    }
                };
                setAttentionAdapter(adapter);

                meeting.on('remoteTrackStarted', (trackItem: any) => {
                    if (isUnmounting) return;
                    if (trackItem.type === 'video') {
                        const remoteVideo = document.createElement('video');
                        remoteVideo.id = `metered-remote-video-${trackItem.participantSessionId}`;
                        remoteVideo.autoplay = true;
                        remoteVideo.playsInline = true;
                        remoteVideo.style.width = '100%';
                        remoteVideo.style.height = '100%';
                        remoteVideo.style.objectFit = 'cover';
                        remoteVideo.srcObject = new MediaStream([trackItem.track]);
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.appendChild(remoteVideo);
                        }
                        remoteStreamsRef.current.set(`video-${trackItem.participantSessionId}`, remoteVideo);
                        setIsConnected(true);
                    } else if (trackItem.type === 'audio') {
                        const audioEl = document.createElement('audio');
                        audioEl.id = `metered-remote-audio-${trackItem.participantSessionId}`;
                        audioEl.autoplay = true;
                        audioEl.srcObject = new MediaStream([trackItem.track]);
                        document.body.appendChild(audioEl);
                        remoteStreamsRef.current.set(`audio-${trackItem.participantSessionId}`, audioEl);
                    }
                });

                meeting.on('remoteTrackStopped', (trackItem: any) => {
                    const videoEl = document.getElementById(`metered-remote-video-${trackItem.participantSessionId}`);
                    videoEl?.remove();
                    const audioEl = document.getElementById(`metered-remote-audio-${trackItem.participantSessionId}`);
                    audioEl?.remove();
                    remoteStreamsRef.current.delete(`video-${trackItem.participantSessionId}`);
                    remoteStreamsRef.current.delete(`audio-${trackItem.participantSessionId}`);
                });

                meeting.on('participantJoined', (participant: any) => {
                    toast(`${participant.participantName || 'Participant'} joined the room`);
                    setIsConnected(true);
                });

                const refreshConnectionState = async () => {
                    try {
                        const participants = await meeting.getParticipants?.();
                        if (!participants || participants.length === 0) {
                            setIsConnected(false);
                        }
                    } catch {
                        setIsConnected(false);
                    }
                };

                meeting.on('participantLeft', (participant: any) => {
                    toast(`${participant.participantName || 'Participant'} left the room`);
                    void refreshConnectionState();
                });

                meeting.on('reconnecting', () => {
                    toast.loading('Connection lost. Reconnecting...', { id: 'reconnect-toast' });
                });

                meeting.on('reconnected', () => {
                    toast.success('Reconnected successfully!', { id: 'reconnect-toast' });
                });

                meeting.on('meetingEnded', () => {
                    toast.dismiss('reconnect-toast');
                    const disconnectIntent = disconnectIntentRef.current;
                    disconnectIntentRef.current = null;
                    const latestSession = sessionDetailsRef.current;

                    clearVideoContainers();
                    setIsConnected(false);
                    setIsLoading(false);
                    roomRef.current = null;
                    setAttentionAdapter(null);

                    if (disconnectIntent === 'LEAVE' || disconnectIntent === 'COMPLETE') return;

                    if (latestSession?.status === 'COMPLETED') {
                        setExitContext(null);
                        setJoinState('COMPLETED');
                        return;
                    }

                    if (latestSession && canRejoinSession(latestSession)) {
                        setExitContext('NETWORK');
                        setJoinState('LEFT');
                        toast.error('Connection lost. You can rejoin if the session window is still open.', { duration: 6000 });
                    }
                });

                meeting.on('error', (err: any) => {
                    console.error('[MeteredVideo] Error:', err);
                    toast.error(`Could not connect: ${err?.message || 'Unknown error'}`);
                });

                const sdkRoomUrl = normalizeMeteredRoomUrl(roomUrl || roomName || id || '');

                await meeting.join({
                    roomURL: sdkRoomUrl,
                    accessToken: token,
                    meetingToken: token,
                    participantName: userId,
                    localStream
                });

                if (isUnmounting) {
                    meeting.leaveMeeting?.();
                    return;
                }

                setIsLoading(false);

                api.post(`/sessions/${id}/start`).catch((err) => {
                    console.warn('Manual start fallback failed or session already started', err);
                });

            } catch (err: any) {
                console.error('[SessionRoom] Failed to join Metered room:', err);

                if (err.message?.includes('Permission denied') || err.name === 'NotAllowedError') {
                    toast.error('Browser denied camera/microphone access. Please check your permissions.');
                } else if (err.response?.data?.message) {
                    toast.error(err.response.data.message);
                    if (sessionDetails && canRejoinSession(sessionDetails)) {
                        setExitContext('NETWORK');
                        setJoinState('LEFT');
                    } else {
                        navigate('/dashboard');
                    }
                } else {
                    toast.error(`Could not connect: ${err.message || 'Unknown error'}`);
                }

                if (!isUnmounting) setIsLoading(false);
            }
        };

        initMeteredVideo();

        return () => {
            isUnmounting = true;
            if (roomRef.current) {
                roomRef.current.leaveMeeting?.();
                roomRef.current = null;
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
        };
    }, [
        id,
        userId,
        joinState,
        navigate,
        sessionDetails,
        setAiMonitoringConsent,
        setIsLoading,
        setIsVideoOff,
        setAttentionAdapter,
        setIsConnected,
        setExitContext,
        setJoinState,
        localVideoRef,
        remoteVideoRef,
        localStreamRef,
        remoteStreamsRef,
        roomRef,
        sessionDetailsRef,
        disconnectIntentRef,
        clearVideoContainers,
    ]);
}

function useSessionLifecycleEffects(params: {
    id?: string;
    user: any;
    navigate: (to: string) => void | Promise<void>;
    sessionDetails: SessionDetails | null;
    setSessionDetails: React.Dispatch<React.SetStateAction<SessionDetails | null>>;
    setSessionNotes: (value: string) => void;
    setJoinState: React.Dispatch<React.SetStateAction<JoinState>>;
    setIsLoading: (value: boolean) => void;
    isLoading: boolean;
    setTimeRemainingMs: (value: number | null) => void;
    isConnected: boolean;
    joinState: JoinState;
    isCompletingSession: boolean;
    applyCompletedSessionState: (options?: { toastMessage?: string; shouldToast?: boolean }) => void;
    presenceRefreshAbortRef: React.RefObject<boolean>;
    sessionDetailsRef: React.RefObject<SessionDetails | null>;
    setPresenceSummary: React.Dispatch<React.SetStateAction<PresenceSummary | null>>;
    setPresenceError: (value: string | null) => void;
    setIsPresenceLoading: (value: boolean) => void;
    setIsSidebarOpen: (value: boolean) => void;
    setSidebarTab: (value: 'info' | 'people' | 'report') => void;
    setReportRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
}) {
    const {
        id,
        user,
        navigate,
        sessionDetails,
        setSessionDetails,
        setSessionNotes,
        setJoinState,
        setIsLoading,
        isLoading,
        setTimeRemainingMs,
        isConnected,
        joinState,
        isCompletingSession,
        applyCompletedSessionState,
        presenceRefreshAbortRef,
        sessionDetailsRef,
        setPresenceSummary,
        setPresenceError,
        setIsPresenceLoading,
        setIsSidebarOpen,
        setSidebarTab,
        setReportRefreshTrigger,
    } = params;

    useEffect(() => {
        let mounted = true;

        const fetchSessionDetails = async () => {
            try {
                if (!id) return;
                const res = await api.get(`/sessions/${id}`);
                if (!mounted) return;

                const session = res.data.data;
                setSessionDetails(session);
                setSessionNotes(session.notes || '');
            } catch (err: unknown) {
                if (mounted) {
                    const message = err instanceof Error ? err.message : 'Failed to fetch session details';
                    const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                    toast.error(axiosMessage ?? message);
                    navigate('/dashboard');
                }
            }
        };

        fetchSessionDetails();

        return () => {
            mounted = false;
        };
    }, [id, navigate, setSessionDetails, setSessionNotes]);

    useEffect(() => {
        if (!sessionDetails) return;

        const updateJoinAvailability = () => {
            const session = sessionDetails;
            const now = Date.now();

            if (isSessionTerminal(session)) {
                setJoinState('COMPLETED');
                setIsLoading(false);
                return;
            }

            const { roomOpenMs, rejoinDeadlineMs } = getSessionTiming(session);
            const isRoomOpen = now >= roomOpenMs;
            const rejoinWindowOpen = now <= rejoinDeadlineMs;

            if (!rejoinWindowOpen) {
                setJoinState('COMPLETED');
                setIsLoading(false);
                return;
            }

            setJoinState((currentState) => {
                if (currentState === 'JOINING' || currentState === 'COMPLETED') {
                    return currentState;
                }

                if (currentState === 'LEFT' && canRejoinSession(session, now)) {
                    return 'LEFT';
                }

                return isRoomOpen ? 'ACKNOWLEDGMENT' : 'WAITING';
            });
        };

        updateJoinAvailability();
        const interval = setInterval(updateJoinAvailability, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [sessionDetails, setJoinState, setIsLoading]);

    useEffect(() => {
        if (!sessionDetails || !isConnected) {
            setTimeRemainingMs(null);
            return;
        }

        const tick = () => {
            const now = Date.now();
            const timing = getSessionTiming(sessionDetails);
            const remaining = timing.scheduledEndMs - now;

            if (remaining <= 0) {
                setTimeRemainingMs(0);
                if (joinState !== 'COMPLETED' && !isCompletingSession) {
                    applyCompletedSessionState({
                        shouldToast: true,
                        toastMessage: 'Session time has elapsed. The room is now permanently closed.',
                    });
                }
            } else {
                setTimeRemainingMs(remaining);
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [sessionDetails, isConnected, joinState, isCompletingSession, applyCompletedSessionState, setTimeRemainingMs]);

    useEffect(() => {
        presenceRefreshAbortRef.current = false;
        return () => {
            presenceRefreshAbortRef.current = true;
        };
    }, [presenceRefreshAbortRef]);

    useEffect(() => {
        sessionDetailsRef.current = sessionDetails;
    }, [sessionDetails, sessionDetailsRef]);

    useEffect(() => {
        if (!id || !user) return;

        let mounted = true;

        const fetchPresenceSummary = async (options?: { silent?: boolean }) => {
            if (!options?.silent) {
                setIsPresenceLoading(true);
            }

            try {
                const res = await api.get(`/sessions/${id}/presence`);
                if (!mounted || presenceRefreshAbortRef.current) return;

                const nextPresence = res.data.data as PresenceSummary;
                setPresenceSummary(nextPresence);
                setPresenceError(null);

                if (sessionDetails && nextPresence.status !== sessionDetails.status) {
                    setSessionDetails({ ...sessionDetails, status: nextPresence.status });
                }
            } catch (error: unknown) {
                if (!mounted || presenceRefreshAbortRef.current) return;
                const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
                setPresenceError(axiosMsg ?? 'Unable to load live session presence');
            } finally {
                if (mounted && !presenceRefreshAbortRef.current) {
                    setIsPresenceLoading(false);
                }
            }
        };

        void fetchPresenceSummary();

        const socket = getSocket() ?? connectSocket();
        if (!socket) {
            return () => {
                mounted = false;
            };
        }

        const handlePresenceUpdated = (data: { sessionId: string }) => {
            if (data.sessionId !== id) return;
            void fetchPresenceSummary({ silent: true });
        };

        socket.on('session:presence_updated', handlePresenceUpdated);

        return () => {
            mounted = false;
            socket.off('session:presence_updated', handlePresenceUpdated);
        };
    }, [id, sessionDetails, user, presenceRefreshAbortRef, setIsPresenceLoading, setPresenceSummary, setPresenceError, setSessionDetails]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleTranscriptionReady = (data: { sessionId: string }) => {
            if (data.sessionId === id) {
                toast.success('AI Session Report is ready!', { duration: 5000, icon: '✨' });
                setReportRefreshTrigger((prev) => prev + 1);
                setIsSidebarOpen(true);
                setSidebarTab('report');
            }
        };

        socket.on('session:transcription_ready', handleTranscriptionReady);
        return () => {
            socket.off('session:transcription_ready', handleTranscriptionReady);
        };
    }, [id, setReportRefreshTrigger, setIsSidebarOpen, setSidebarTab]);

    useEffect(() => {
        if (!id || !user) return;

        const socket = getSocket() ?? connectSocket();
        if (!socket) return;

        const handleSessionCompleted = (data: {
            sessionId: string;
            completedByUserId?: string;
        }) => {
            if (data.sessionId !== id) return;

            applyCompletedSessionState({
                shouldToast: data.completedByUserId !== user.id,
                toastMessage: 'This session has been completed. Rejoin is now closed.',
            });
        };

        socket.on('session:completed', handleSessionCompleted);

        return () => {
            socket.off('session:completed', handleSessionCompleted);
        };
    }, [id, user, applyCompletedSessionState]);

    useEffect(() => {
        if (!isLoading && !isConnected && joinState === 'JOINING') {
            const timeout = setTimeout(() => {
                toast("The other participant hasn't joined yet. You can continue waiting, or leave and follow up with them.", {
                    duration: 8000,
                    icon: '⏳'
                });
            }, 5 * 60 * 1000);

            return () => clearTimeout(timeout);
        }
    }, [isLoading, isConnected, joinState]);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function SessionRoom() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    // Media State
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Sidebar panel
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'info' | 'people' | 'report'>('people');
    const [sessionNotes, setSessionNotes] = useState('');
    const [reportRefreshTrigger, setReportRefreshTrigger] = useState(0);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [isCompletingSession, setIsCompletingSession] = useState(false);
    const [exitContext, setExitContext] = useState<ExitContext>(null);

    // Explicit session metadata & waiting room state
    const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
    const [joinState, setJoinState] = useState<JoinState>('LOADING');
    const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
    const [hasAcknowledged, setHasAcknowledged] = useState(false);
    const [aiMonitoringConsent, setAiMonitoringConsent] = useState(false);
    const [presenceSummary, setPresenceSummary] = useState<PresenceSummary | null>(null);
    const [isPresenceLoading, setIsPresenceLoading] = useState(false);
    const [presenceError, setPresenceError] = useState<string | null>(null);

    // WebRTC Refs (provider-agnostic)
    const localVideoRef = useRef<HTMLDivElement>(null);
    const remoteVideoRef = useRef<HTMLDivElement>(null);
    const roomRef = useRef<MeteredMeeting | null>(null); // Metered meeting instance
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamsRef = useRef<Map<string, HTMLElement>>(new Map());
    const disconnectIntentRef = useRef<'LEAVE' | 'COMPLETE' | null>(null);
    const presenceRefreshAbortRef = useRef(false);
    const sessionDetailsRef = useRef<SessionDetails | null>(null);
    const [attentionAdapter, setAttentionAdapter] = useState<AttentionRoomAdapter | null>(null);

    // Role detection & feature gating
    let roleInSession: 'CLIENT' | 'THERAPIST' | 'UNKNOWN' = 'UNKNOWN';
    if (user?.id === sessionDetails?.clientId) {
        roleInSession = 'CLIENT';
    } else if (user?.id === sessionDetails?.therapistId) {
        roleInSession = 'THERAPIST';
    }
    const isMonitoringEnabled = aiMonitoringConsent && import.meta.env.VITE_SESSION_ATTENTION_MONITORING_ENABLED !== 'false';

    // Hook up attention monitor (uses provider-agnostic adapter built after Metered join)
    useAttentionMonitor({
        sessionId: id || '',
        room: attentionAdapter,
        role: roleInSession,
        enabled: isMonitoringEnabled && !!attentionAdapter
    });

    const canUserCompleteSession = user?.role === 'THERAPIST' || user?.role === 'ADMIN' || user?.role === 'PROGRAM_DIRECTOR';
    const canViewDetailedPresence = user?.role === 'THERAPIST' || user?.role === 'ADMIN' || user?.role === 'PROGRAM_DIRECTOR';
    const sessionTiming = sessionDetails ? getSessionTiming(sessionDetails) : null;
    const rejoinDeadlineLabel = sessionTiming ? formatTimestamp(sessionTiming.rejoinDeadlineMs) : null;
    const scheduledRangeLabel = sessionDetails && sessionTiming
        ? `${formatSessionDateTime(sessionDetails.scheduledAt)} – ${formatTimestamp(sessionTiming.scheduledEndMs)}`
        : null;
    const presenceParticipants = presenceSummary?.participants ?? [];
    const localPresence = presenceParticipants.find((participant) => participant.userId === user?.id) ?? null;
    const remotePresenceParticipants = presenceParticipants.filter((participant) => participant.userId !== user?.id);

    const clearVideoContainers = useCallback(() => {
        if (localVideoRef.current) {
            localVideoRef.current.innerHTML = '';
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = '';
        }
        // Also remove any dangling audio elements that were appended to body by Metered
        document.querySelectorAll('[id^="metered-remote-audio-"]').forEach(el => el.remove());
        remoteStreamsRef.current.clear();
    }, []);

    const disconnectRoom = (intent: 'LEAVE' | 'COMPLETE') => {
        disconnectIntentRef.current = intent;
        if (roomRef.current) {
            roomRef.current.leaveMeeting?.();
            roomRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        clearVideoContainers();
        setIsConnected(false);
        setAttentionAdapter(null);
    };

    const applyCompletedSessionState = useCallback((options?: { toastMessage?: string; shouldToast?: boolean }) => {
        disconnectRoom('COMPLETE');
        setSessionDetails((current) => {
            if (!current) return current;
            const nextSession = { ...current, status: 'COMPLETED' };
            sessionDetailsRef.current = nextSession;
            return nextSession;
        });
        setPresenceSummary((current) => current ? {
            ...current,
            status: 'COMPLETED',
            roomWindow: {
                ...current.roomWindow,
                canRejoinNow: false,
            },
        } : current);
        setShowExitDialog(false);
        setExitContext(null);
        setJoinState('COMPLETED');
        setIsLoading(false);

        if (options?.shouldToast && options.toastMessage) {
            toast.success(options.toastMessage, { duration: 5000 });
        }
    }, [disconnectRoom]);

    useSessionLifecycleEffects({
        id,
        user,
        navigate,
        sessionDetails,
        setSessionDetails,
        setSessionNotes,
        setJoinState,
        setIsLoading,
        isLoading,
        setTimeRemainingMs,
        isConnected,
        joinState,
        isCompletingSession,
        applyCompletedSessionState,
        presenceRefreshAbortRef,
        sessionDetailsRef,
        setPresenceSummary,
        setPresenceError,
        setIsPresenceLoading,
        setIsSidebarOpen,
        setSidebarTab,
        setReportRefreshTrigger,
    });

    const startJoining = () => {
        setExitContext(null);
        setIsLoading(true);
        setJoinState('JOINING');
    };

    const handleLeaveCall = (returnToDashboard = false) => {
        const latestSession = sessionDetailsRef.current;
        const sessionAlreadyCompleted = latestSession?.status === 'COMPLETED';
        const rejoinable = !!latestSession && canRejoinSession(latestSession);
        const rejoinMessage = rejoinDeadlineLabel
            ? `You left the call. You can rejoin until ${rejoinDeadlineLabel}.`
            : 'You left the call.';

        setShowExitDialog(false);
        setIsSidebarOpen(false);
        disconnectRoom('LEAVE');
        setIsLoading(false);
        setExitContext('LEFT');
        setJoinState(!sessionAlreadyCompleted && rejoinable ? 'LEFT' : 'COMPLETED');

        toast.success(sessionAlreadyCompleted ? 'Session completed. Rejoin is now closed.' : rejoinMessage, { duration: 5000 });

        if (returnToDashboard) {
            navigate('/dashboard');
        }
    };

    const handleCompleteSession = async () => {
        if (!id || !sessionDetails || !canUserCompleteSession) return;

        try {
            setIsCompletingSession(true);
            await api.post(`/sessions/${id}/end`);
            applyCompletedSessionState({
                shouldToast: true,
                toastMessage: 'Session completed. Rejoin is now closed.',
            });
        } catch (error: unknown) {
            console.error('Failed to complete session:', error);
            const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(axiosMsg ?? 'Unable to complete the session right now.');
        } finally {
            setIsCompletingSession(false);
        }
    };


    useMeteredJoinEffect({
        id,
        userId: user?.id ?? null,
        joinState,
        navigate,
        sessionDetails,
        setAiMonitoringConsent,
        setIsLoading,
        setIsVideoOff,
        setAttentionAdapter,
        setIsConnected,
        setExitContext,
        setJoinState,
        localVideoRef,
        remoteVideoRef,
        localStreamRef,
        remoteStreamsRef,
        roomRef,
        sessionDetailsRef,
        disconnectIntentRef,
        clearVideoContainers,
    });

    // Attach local video after DOM mounts (Metered streams local tracks during join; handled inline)
    // This effect is a no-op for Metered but kept to avoid breaking any future local-video re-attachment logic.
    useEffect(() => {
        // Local video is already attached during initMeteredVideo's getUserMedia step
    }, [isLoading]);

    // Handlers — toggle Metered audio/video tracks directly on the localStream
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => { track.enabled = isMuted; }); // flip
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTracks = localStreamRef.current.getVideoTracks();
            videoTracks.forEach(track => { track.enabled = isVideoOff; }); // flip
            setIsVideoOff(!isVideoOff);
        }
    };

    const handleSaveNotes = async () => {
        try {
            if (!id) return;
            await api.patch(`/sessions/${id}/notes`, { notes: sessionNotes });
            toast.success('Notes saved successfully!');
        } catch (error) {
            console.error('Failed to save notes:', error);
            toast.error('Failed to save notes.');
        }
    };

    const renderOverlayCloseButton = () => (
        <button
            type="button"
            className="session-overlay-close-btn"
            onClick={() => navigate('/dashboard')}
            aria-label="Close session window"
            title="Close"
        >
            <X size={18} />
        </button>
    );

    const isGraceWindowExpired = sessionDetails ? !canRejoinSession(sessionDetails) && !isSessionTerminal(sessionDetails) : false;
    const waitMsLeft = sessionTiming ? Math.max(0, sessionTiming.roomOpenMs - Date.now()) : 0;
    const waitMinutesLeft = Math.ceil(waitMsLeft / 60000);
    const waitMinuteLabel = waitMinutesLeft === 1 ? 'minute' : 'minutes';
    const roomOpenLabel = sessionTiming ? formatDateTime(new Date(sessionTiming.roomOpenMs).toISOString()) : null;

    const preJoinStage = renderPreJoinStage({
        isLoading,
        joinState,
        sessionDetails,
        isGraceWindowExpired,
        hasAcknowledged,
        waitMinutesLeft,
        waitMinuteLabel,
        roomOpenLabel,
        scheduledRangeLabel,
        rejoinDeadlineLabel,
        exitContext,
        onCloseOverlay: renderOverlayCloseButton,
        onCloseDashboard: () => { void navigate('/dashboard'); },
        onStartJoining: startJoining,
        onToggleAcknowledged: setHasAcknowledged,
    });

    if (preJoinStage) {
        return preJoinStage;
    }

    const formatCountdown = (ms: number | null) => {
        if (ms === null || ms < 0) return '00:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const isWarningState = timeRemainingMs !== null && timeRemainingMs <= 300000; // 5 mins

    const userInitial = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'ME';
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'You';

    return (
        <div className="session-room-container">

            {/* ── Left: Full-screen video area ── */}
            <div className="session-room-main">

                {/* Remote video fills the entire space */}
                <div ref={remoteVideoRef} className="remote-video" />

                {/* Waiting placeholder (shown when no remote participant yet) */}
                {!isConnected && (
                    <div className="video-placeholder">
                        <Users size={52} />
                        <p>Waiting for participant to join...</p>
                    </div>
                )}

                {/* ─── Floating Header ─── */}
                <header className="session-room-header">
                    <div className="session-info">
                        <h2>Therapy Session</h2>
                        <span className="session-status">
                            <span className={`status-dot ${isConnected ? 'connected' : 'waiting'}`} />
                            {isConnected ? 'Connected securely' : 'Waiting for others to join...'}
                        </span>
                        {sessionDetails && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>
                                    Scheduled {formatSessionDateTime(sessionDetails.scheduledAt)}
                                    {' '}–{' '}
                                    {sessionTiming ? formatTimestamp(sessionTiming.scheduledEndMs) : ''}
                                </span>
                                {timeRemainingMs !== null && (
                                    <span style={{ 
                                        background: isWarningState ? '#fee2e2' : '#f1f5f9', 
                                        color: isWarningState ? '#dc2626' : '#475569', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <Clock size={12} /> {formatCountdown(timeRemainingMs)} remaining
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="header-right">
                        <span className="badge">End-to-End Encrypted (P2P)</span>
                        <button
                            className={`sidebar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
                            onClick={() => setIsSidebarOpen(prev => !prev)}
                            title="Session Panel"
                        >
                            <PanelRight size={18} />
                        </button>
                    </div>
                </header>

                {/* ─── Local PIP (bottom-right, above controls) ─── */}
                <div className="local-video-wrapper">
                    <div
                        ref={localVideoRef}
                        className="local-video"
                    />
                    {isVideoOff && (
                        <div className="local-video-placeholder">
                            <VideoOff size={22} />
                            <span>Camera off</span>
                        </div>
                    )}
                    <span className="local-label">You</span>
                </div>

                {/* ─── Warning Banner (5 mins remaining) ─── */}
                {isWarningState && timeRemainingMs > 0 && (
                    <div className="session-warning-banner" style={{
                        position: 'absolute',
                        top: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(220, 38, 38, 0.9)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        animation: 'pulse-danger 2s infinite'
                    }}>
                        <Clock size={18} />
                        Session will end in {formatCountdown(timeRemainingMs)}
                    </div>
                )}

                {/* ─── Floating Controls Bar ─── */}
                <footer className="session-room-controls">
                    {/* Mic toggle */}
                    <button
                        className={`control-btn ${isMuted ? 'muted' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    >
                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    {/* Camera toggle */}
                    <button
                        className={`control-btn ${isVideoOff ? 'video-off' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                        {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                    </button>

                    {/* End call */}
                    <button
                        className="control-btn leave-btn"
                        onClick={() => setShowExitDialog(true)}
                        title="Leave Call"
                    >
                        <PhoneOff size={24} />
                    </button>
                </footer>
            </div>

            {/* ── Right: Slide-out Sidebar Panel ── */}
            <aside className={`session-sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
                <div className="sidebar-header">
                    <h3>Session Panel</h3>
                    <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="sidebar-tabs">
                    <button
                        className={`sidebar-tab ${sidebarTab === 'people' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('people')}
                    >
                        <Users size={14} /> Participants
                    </button>
                    <button
                        className={`sidebar-tab ${sidebarTab === 'info' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('info')}
                    >
                        <Info size={14} /> Notes
                    </button>
                    <button
                        className={`sidebar-tab ${sidebarTab === 'report' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('report')}
                    >
                        <Sparkles size={14} /> AI Report
                    </button>
                </div>

                <div className="sidebar-content">
                    {sidebarTab === 'report' && (
                        <SessionReportPanel
                            sessionId={id!}
                            refreshTrigger={reportRefreshTrigger}
                        />
                    )}

                    {sidebarTab === 'people' && (
                        <>
                            <div className="participant-item">
                                <div className="participant-avatar">{userInitial}</div>
                                <div className="participant-info">
                                    <span className="participant-name">{userName} (You)</span>
                                    <span className="participant-role">{formatRoleLabel(user?.role)}</span>
                                    {localPresence && (
                                        <span className={`participant-presence-badge ${getPresenceStateTone(localPresence.state)}`}>
                                            {formatPresenceStateLabel(localPresence.state)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isPresenceLoading && (
                                <div className="presence-panel-state">
                                    <Loader2 size={16} className="client-spin" />
                                    <span>Refreshing live presence…</span>
                                </div>
                            )}
                            {presenceError && (
                                <div className="presence-panel-error">{presenceError}</div>
                            )}
                            {remotePresenceParticipants.map((participant) => {
                                const initials = `${participant.firstName?.[0] || ''}${participant.lastName?.[0] || ''}`.toUpperCase() || 'P';

                                return (
                                    <div key={participant.userId} className="participant-card presence-card">
                                        <div className="participant-item participant-item-compact">
                                            <div className="participant-avatar" style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' }}>{initials}</div>
                                            <div className="participant-info">
                                                <span className="participant-name">{participant.firstName} {participant.lastName}</span>
                                                <span className="participant-role">{formatRoleLabel(participant.role)}</span>
                                            </div>
                                            <span className={`participant-presence-badge ${getPresenceStateTone(participant.state)}`}>
                                                {formatPresenceStateLabel(participant.state)}
                                            </span>
                                        </div>

                                        <div className="presence-meta-grid">
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Last joined</span>
                                                <strong>{formatDateTime(participant.lastJoinedAt)}</strong>
                                            </div>
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Last left</span>
                                                <strong>{formatDateTime(participant.lastLeftAt)}</strong>
                                            </div>
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Connected time</span>
                                                <strong>{formatConnectedDuration(participant.totalConnectedSeconds)}</strong>
                                            </div>
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Rejoins</span>
                                                <strong>{participant.reconnectCount}</strong>
                                            </div>
                                        </div>

                                        {canViewDetailedPresence && participant.lastDisconnectReason && (
                                            <div className="presence-footnote">
                                                Last disconnect reason: {participant.lastDisconnectReason}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {presenceSummary && canViewDetailedPresence && (
                                <div className="presence-audit-card">
                                    <div className="presence-audit-header">
                                        <h4>Presence audit trail</h4>
                                        <span>Live</span>
                                    </div>
                                    <div className="presence-audit-summary">
                                        <div>
                                            <span className="presence-meta-label">Room window</span>
                                            <strong>{formatDateTime(presenceSummary.roomWindow.opensAt)} → {formatDateTime(presenceSummary.roomWindow.closesAt)}</strong>
                                        </div>
                                        <div>
                                            <span className="presence-meta-label">Rejoin eligibility</span>
                                            <strong>{presenceSummary.roomWindow.canRejoinNow ? 'Open now' : 'Closed'}</strong>
                                        </div>
                                    </div>

                                    <div className="presence-event-list">
                                        {presenceSummary.recentEvents.length === 0 ? (
                                            <div className="presence-panel-state compact">No presence events yet.</div>
                                        ) : (
                                            presenceSummary.recentEvents.slice(0, 8).map((event) => (
                                                <div key={event.id} className="presence-event-item">
                                                    <div>
                                                        <p className="presence-event-title">
                                                            {getPresenceEventDescription(event, presenceParticipants)}
                                                        </p>
                                                        <p className="presence-event-subtitle">
                                                            {formatPresenceEventLabel(event.eventType)} • {event.source.toLowerCase().replaceAll('_', ' ')}
                                                        </p>
                                                    </div>
                                                    <span className="presence-event-time">{formatDateTime(event.occurredAt)}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {sidebarTab === 'info' && (
                        <>
                            <div className="info-row">
                                <span className="info-label">Status</span>
                                <span className="info-value">{isConnected ? '🟢 In Progress' : '🟡 Waiting'}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Encryption</span>
                                <span className="info-value">Encrypted (TLS)</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Session ID</span>
                                <span className="info-value" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>{id?.slice(0, 8)}...</span>
                            </div>
                            {rejoinDeadlineLabel && (
                                <div className="info-row">
                                    <span className="info-label">Rejoin window</span>
                                    <span className="info-value">Until {rejoinDeadlineLabel}</span>
                                </div>
                            )}
                            <div style={{ marginTop: '1rem' }}>
                                <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.5rem' }}>Session Notes</p>
                                <textarea
                                    className="session-notes-area"
                                    placeholder="Type your session notes here..."
                                    value={sessionNotes}
                                    onChange={e => setSessionNotes(e.target.value)}
                                />
                                <button className="notes-save-btn" onClick={handleSaveNotes}>
                                    Save Notes
                                </button>
                            </div>
                            <div className="session-action-card">
                                <p className="session-action-title">Leave vs complete</p>
                                <p className="session-action-copy">
                                    Leave Call keeps the room rejoinable until the secure session window closes.
                                </p>
                                {canUserCompleteSession && (
                                    <button
                                        className="session-complete-btn"
                                        onClick={() => setShowExitDialog(true)}
                                        disabled={isCompletingSession}
                                    >
                                        {isCompletingSession ? 'Completing…' : 'Review leave & completion options'}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </aside>

            {showExitDialog && (
                <SessionExitDialog
                    canUserCompleteSession={canUserCompleteSession}
                    isCompletingSession={isCompletingSession}
                    rejoinDeadlineLabel={rejoinDeadlineLabel}
                    onCancel={() => setShowExitDialog(false)}
                    onComplete={handleCompleteSession}
                    onLeave={handleLeaveCall}
                />
            )}
        </div>
    );
}
