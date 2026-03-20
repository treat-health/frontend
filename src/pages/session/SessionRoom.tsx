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
const SESSION_TAB_LOCK_TTL_MS = 15000;
const AUTO_RETRY_BASE_DELAY_MS = 2000;
const AUTO_RETRY_MAX_ATTEMPTS = 2;

type JoinState = 'LOADING' | 'WAITING' | 'ACKNOWLEDGMENT' | 'JOINING' | 'LEFT' | 'COMPLETED';
type ExitContext = 'LEFT' | 'NETWORK' | null;
type ConnectionState = 'IDLE' | 'JOINING' | 'WAITING' | 'CONNECTED' | 'RECONNECTING' | 'FAILED';

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

interface SdkRemoteParticipant {
    id: string;
    name: string;
    sourceParticipantId: string;
    identityKey: string;
    hasVideo: boolean;
    hasAudio: boolean;
    joinedAt: number;
    lastTrackAt: number;
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
        .replace(/[`"'']/g, '')
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
    userDisplayName: string;
    joinState: JoinState;
    navigate: (to: string) => void | Promise<void>;
    setAiMonitoringConsent: (value: boolean) => void;
    setIsLoading: (value: boolean) => void;
    setIsVideoOff: (value: boolean) => void;
    setAttentionAdapter: (adapter: AttentionRoomAdapter | null) => void;
    setIsInRoom: (value: boolean) => void;
    setConnectionState: (value: ConnectionState) => void;
    setRemoteParticipants: React.Dispatch<React.SetStateAction<SdkRemoteParticipant[]>>;
    setExitContext: (value: ExitContext) => void;
    setJoinState: (value: JoinState) => void;
    remoteVideoRef: React.RefObject<HTMLDivElement | null>;
    localStreamRef: React.RefObject<MediaStream | null>;
    remoteStreamsRef: React.RefObject<Map<string, HTMLElement>>;
    roomRef: React.RefObject<MeteredMeeting | null>;
    sessionDetailsRef: React.RefObject<SessionDetails | null>;
    disconnectIntentRef: React.RefObject<'LEAVE' | 'COMPLETE' | null>;
    clearVideoContainers: () => void;
    setLocalPreviewStream: (stream: MediaStream | null) => void;
}) {
    const joinAttemptRef = useRef(0);
    const joinInFlightRef = useRef(false);
    const {
        id,
        userId,
        userDisplayName,
        joinState,
        navigate,
        setAiMonitoringConsent,
        setIsLoading,
        setIsVideoOff,
        setAttentionAdapter,
        setIsInRoom,
        setConnectionState,
        setRemoteParticipants,
        setExitContext,
        setJoinState,
        remoteVideoRef,
        localStreamRef,
        remoteStreamsRef,
        roomRef,
        sessionDetailsRef,
        disconnectIntentRef,
        clearVideoContainers,
        setLocalPreviewStream,
    } = params;

    useEffect(() => {
        if (!id || !userId || joinState !== 'JOINING') return;
        if (joinInFlightRef.current || roomRef.current) return;

        const joinAttemptId = ++joinAttemptRef.current;
        let isUnmounting = false;
        let joinedMeeting: MeteredMeeting | null = null;
        const listeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
        const localTrackCleanupCallbacks: Array<() => void> = [];
        let joinTimeout: ReturnType<typeof setTimeout> | null = null;
        let firstRemoteTrackTimeout: ReturnType<typeof setTimeout> | null = null;
        let hasReceivedRemoteTrack = false;

        joinInFlightRef.current = true;
        setConnectionState('JOINING');

        joinTimeout = setTimeout(() => {
            if (joinAttemptRef.current !== joinAttemptId || isUnmounting) return;
            console.error('[SessionRoom] join:timeout', { joinAttemptId, sessionId: id, userId });
            setIsLoading(false);
            setConnectionState('FAILED');
            setExitContext('NETWORK');
            setJoinState('LEFT');
            roomRef.current?.leaveMeeting?.();
            roomRef.current = null;
        }, 20000);

        const initMeteredVideo = async () => {
            if (!id || !userId) return;

            console.info('[SessionRoom] join:start', {
                joinAttemptId,
                sessionId: id,
                userId,
            });

            if (!(globalThis as any).Metered?.Meeting) {
                toast.error('Video SDK not loaded. Please refresh the page.');
                setIsLoading(false);
                return;
            }

            try {
                const response = await api.post(`/sessions/${id}/media-token`);
                const { token, roomName, roomUrl, aiMonitoringConsent: consentFromServer } = response.data;
                setAiMonitoringConsent(!!consentFromServer);

                if (isUnmounting || joinAttemptRef.current !== joinAttemptId) return;

                console.info('[SessionRoom] join:token_received', {
                    joinAttemptId,
                    roomName,
                    roomUrl,
                    tokenLength: typeof token === 'string' ? token.length : 0,
                });

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

                if (joinAttemptRef.current !== joinAttemptId) {
                    localStream.getTracks().forEach((t) => t.stop());
                    return;
                }

                console.info('[SessionRoom] join:local_stream_ready', {
                    joinAttemptId,
                    localVideoTracks: localStream.getVideoTracks().map((track) => ({
                        id: track.id,
                        enabled: track.enabled,
                        readyState: track.readyState,
                    })),
                    localAudioTracks: localStream.getAudioTracks().map((track) => ({
                        id: track.id,
                        enabled: track.enabled,
                        readyState: track.readyState,
                    })),
                });

                localStreamRef.current = localStream;
                setLocalPreviewStream(localStream);
                localStream.getTracks().forEach((track) => {
                    const onEnded = () => {
                        console.warn('[SessionRoom] track:local_ended', {
                            joinAttemptId,
                            type: track.kind,
                            trackId: track.id,
                            readyState: track.readyState,
                        });
                    };
                    const onMute = () => {
                        console.warn('[SessionRoom] track:local_muted', {
                            joinAttemptId,
                            type: track.kind,
                            trackId: track.id,
                        });
                    };
                    const onUnmute = () => {
                        console.info('[SessionRoom] track:local_unmuted', {
                            joinAttemptId,
                            type: track.kind,
                            trackId: track.id,
                        });
                    };
                    track.addEventListener('ended', onEnded);
                    track.addEventListener('mute', onMute);
                    track.addEventListener('unmute', onUnmute);
                    localTrackCleanupCallbacks.push(() => {
                        track.removeEventListener('ended', onEnded);
                        track.removeEventListener('mute', onMute);
                        track.removeEventListener('unmute', onUnmute);
                    });
                });

                const meeting = new (globalThis as any).Metered.Meeting();
                roomRef.current = meeting;
                joinedMeeting = meeting;

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

                const on = (event: string, handler: (...args: unknown[]) => void) => {
                    meeting.on(event, handler);
                    listeners.push({ event, handler });
                };

                const participantRegistry = new Map<string, { participantId: string; participantKey: string; active: boolean; lastUpdatedAt: number }>();
                const participantTrackMap = new Map<string, { videoTrackId?: string; audioTrackId?: string }>();
                const bufferedTracks = new Map<string, { participantId: string; participantName: string; videoTrack?: MediaStreamTrack; audioTrack?: MediaStreamTrack; bufferedAt: number }>();

                const parseParticipantIdentity = (participantName: string) => {
                    const raw = participantName.trim();
                    if (!raw) {
                        return { appUserId: '', displayName: '' };
                    }
                    const separatorIndex = raw.indexOf('|');
                    if (separatorIndex <= 0 || separatorIndex >= raw.length - 1) {
                        return { appUserId: '', displayName: raw };
                    }
                    return {
                        appUserId: raw.slice(0, separatorIndex).trim(),
                        displayName: raw.slice(separatorIndex + 1).trim(),
                    };
                };

                const normalizeDisplayName = (participantName: string) => {
                    const normalized = participantName.trim().replace(/\s+/g, ' ');
                    if (!normalized) return 'Participant';
                    if (/^anonymous[-_\s]/i.test(normalized)) return 'Participant';
                    return normalized;
                };

                const toDomSafeKey = (value: string) => value.replace(/[^a-z0-9_-]/gi, '-');
                const resolveParticipantMeta = (participantId: string, participantName: string) => {
                    const normalizedParticipantId = participantId.trim();
                    const parsedIdentity = parseParticipantIdentity(participantName);
                    const normalizedParticipantName = (parsedIdentity.displayName || participantName).trim();
                    const normalizedName = normalizedParticipantName.toLowerCase().replace(/\s+/g, ' ');
                    const stableIdentity = normalizedParticipantId || parsedIdentity.appUserId;
                    const identityKey = stableIdentity
                        ? `sid:${stableIdentity}`
                        : normalizedName
                            ? `name:${normalizedName}`
                            : 'unknown';
                    const participantKey = toDomSafeKey(identityKey);
                    const displayName = normalizeDisplayName(normalizedParticipantName);
                    return { identityKey, participantKey, displayName, stableIdentity };
                };

                const resolveTrackParticipantId = (trackItem: any) => {
                    const directId = String(trackItem?.participantSessionId ?? trackItem?.participantId ?? '').trim();
                    if (directId) return directId;
                    const parsedIdentity = parseParticipantIdentity(String(trackItem?.participantName ?? trackItem?.name ?? ''));
                    return parsedIdentity.appUserId || '';
                };

                const resolveTrackType = (trackItem: any): 'video' | 'audio' | 'unknown' => {
                    // 1. Explicit type field from SDK payload
                    const typeFromPayload = String(trackItem?.type ?? '').toLowerCase();
                    if (typeFromPayload === 'video' || typeFromPayload === 'audio') {
                        return typeFromPayload;
                    }
                    // 2. Nested .track.kind
                    const kindFromTrack = String(trackItem?.track?.kind ?? '').toLowerCase();
                    if (kindFromTrack === 'video' || kindFromTrack === 'audio') {
                        return kindFromTrack;
                    }
                    // 3. Direct .kind on event (if event IS the track)
                    const kindDirect = String(trackItem?.kind ?? '').toLowerCase();
                    if (kindDirect === 'video' || kindDirect === 'audio') {
                        return kindDirect;
                    }
                    // 4. Check alternate property names
                    const altTrack = trackItem?.mediaStreamTrack ?? trackItem?.mediaTrack ?? trackItem?.streamTrack;
                    const altKind = String(altTrack?.kind ?? '').toLowerCase();
                    if (altKind === 'video' || altKind === 'audio') {
                        return altKind;
                    }
                    return 'unknown';
                };

                const resolveMediaTrack = (trackItem: any, trackType: 'video' | 'audio' | 'unknown') => {
                    // 1. trackItem.track (most common SDK convention)
                    if (trackItem?.track instanceof MediaStreamTrack) {
                        return trackItem.track as MediaStreamTrack;
                    }
                    // 2. trackItem itself IS a MediaStreamTrack (some SDKs pass track directly)
                    if (trackItem instanceof MediaStreamTrack) {
                        return trackItem;
                    }
                    // 3. Alternate property names used by various Metered SDK versions
                    const altTrack = trackItem?.mediaStreamTrack ?? trackItem?.mediaTrack ?? trackItem?.streamTrack;
                    if (altTrack instanceof MediaStreamTrack) {
                        return altTrack as MediaStreamTrack;
                    }
                    // 4. Extract from stream/remoteStream
                    const streamCandidate = trackItem?.stream ?? trackItem?.remoteStream;
                    if (streamCandidate instanceof MediaStream) {
                        if (trackType === 'video') {
                            return streamCandidate.getVideoTracks()[0] ?? null;
                        }
                        if (trackType === 'audio') {
                            return streamCandidate.getAudioTracks()[0] ?? null;
                        }
                        return streamCandidate.getTracks()[0] ?? null;
                    }
                    return null;
                };

                const detachElementMedia = (element: HTMLElement | null) => {
                    if (!element) return;
                    const mediaElement = element as HTMLMediaElement;
                    if (mediaElement.srcObject) {
                        mediaElement.srcObject = null;
                    }
                };

                const upsertRemoteParticipant = (
                    participantId: string,
                    participantName: string,
                    patch?: Partial<Omit<SdkRemoteParticipant, 'id' | 'name' | 'joinedAt' | 'identityKey'>>,
                ) => {
                    if (!participantId && !participantName) return;
                    const { identityKey, participantKey, displayName, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                    if (identityKey === 'unknown') return;
                    const effectiveSourceId = stableIdentity || participantId;
                    setRemoteParticipants((current) => {
                        const existing = current.find((participant) => participant.identityKey === identityKey || participant.sourceParticipantId === effectiveSourceId);
                        if (!existing) {
                            return [
                                ...current,
                                {
                                    id: participantKey,
                                    name: displayName,
                                    sourceParticipantId: effectiveSourceId,
                                    identityKey,
                                    hasVideo: patch?.hasVideo ?? false,
                                    hasAudio: patch?.hasAudio ?? false,
                                    joinedAt: Date.now(),
                                    lastTrackAt: patch?.lastTrackAt ?? Date.now(),
                                },
                            ];
                        }
                        return current.map((participant) => participant.identityKey === existing.identityKey
                            ? {
                                ...participant,
                                id: participantKey,
                                name: displayName || participant.name,
                                sourceParticipantId: effectiveSourceId || participant.sourceParticipantId,
                                hasVideo: patch?.hasVideo ?? participant.hasVideo,
                                hasAudio: patch?.hasAudio ?? participant.hasAudio,
                                lastTrackAt: patch?.lastTrackAt ?? participant.lastTrackAt,
                            }
                            : participant);
                    });
                };

                const removeRemoteParticipant = (participantId: string, participantName = '') => {
                    if (!participantId && !participantName) return;
                    const { identityKey, participantKey, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                    const effectiveSourceId = stableIdentity || participantId;
                    setRemoteParticipants((current) => current.filter((participant) => participant.identityKey !== identityKey && participant.sourceParticipantId !== effectiveSourceId && participant.id !== participantKey));
                };

                const ensureVideoElement = (participantKey: string, track: MediaStreamTrack) => {
                    const existingElement = document.getElementById(`metered-remote-video-${participantKey}`);
                    const existingTrackId = (existingElement as HTMLVideoElement | null)?.dataset.trackId;
                    if (existingElement && existingTrackId === track.id) return;
                    detachElementMedia(existingElement);
                    existingElement?.remove();
                    const remoteVideo = document.createElement('video');
                    remoteVideo.id = `metered-remote-video-${participantKey}`;
                    remoteVideo.autoplay = true;
                    remoteVideo.playsInline = true;
                    remoteVideo.style.width = '100%';
                    remoteVideo.style.height = '100%';
                    remoteVideo.style.objectFit = 'cover';
                    remoteVideo.srcObject = new MediaStream([track]);
                    remoteVideo.dataset.trackId = track.id;
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.appendChild(remoteVideo);
                    }
                    remoteStreamsRef.current.set(`video-${participantKey}`, remoteVideo);
                };

                const ensureAudioElement = (participantKey: string, track: MediaStreamTrack) => {
                    const existingElement = document.getElementById(`metered-remote-audio-${participantKey}`);
                    const existingTrackId = (existingElement as HTMLAudioElement | null)?.dataset.trackId;
                    if (existingElement && existingTrackId === track.id) {
                        // Same track already attached — verify it's actually playing
                        const existingAudio = existingElement as HTMLAudioElement;
                        console.info('[SessionRoom] audio:remote_element_reuse', {
                            joinAttemptId,
                            participantKey,
                            trackId: track.id,
                            paused: existingAudio.paused,
                            muted: existingAudio.muted,
                            volume: existingAudio.volume,
                            readyState: existingAudio.readyState,
                            srcObjectActive: !!(existingAudio.srcObject as MediaStream)?.active,
                        });
                        return;
                    }
                    detachElementMedia(existingElement);
                    existingElement?.remove();

                    const audioElement = document.createElement('audio');
                    audioElement.id = `metered-remote-audio-${participantKey}`;
                    audioElement.autoplay = true;
                    audioElement.muted = false;   // Explicit: never start muted
                    audioElement.volume = 1.0;    // Explicit: full volume
                    audioElement.setAttribute('playsinline', 'true');
                    audioElement.srcObject = new MediaStream([track]);
                    audioElement.dataset.trackId = track.id;
                    document.body.appendChild(audioElement);
                    remoteStreamsRef.current.set(`audio-${participantKey}`, audioElement);

                    // Attempt playback and log the result — never silently swallow autoplay errors
                    audioElement.play()
                        .then(() => {
                            console.info('[SessionRoom] audio:remote_play_success', {
                                joinAttemptId,
                                participantKey,
                                trackId: track.id,
                                paused: audioElement.paused,
                                muted: audioElement.muted,
                                volume: audioElement.volume,
                                readyState: audioElement.readyState,
                            });
                        })
                        .catch((playError) => {
                            // Autoplay was blocked — this is the #1 reason for "no audio heard"
                            console.error('[SessionRoom] audio:remote_play_BLOCKED', {
                                joinAttemptId,
                                participantKey,
                                trackId: track.id,
                                errorName: playError?.name,
                                errorMessage: playError?.message,
                                paused: audioElement.paused,
                                muted: audioElement.muted,
                                hint: 'Browser autoplay policy blocked audio. User interaction may be required.',
                            });
                        });
                };

                const removeTrackElements = (participantKey: string) => {
                    const videoElement = document.getElementById(`metered-remote-video-${participantKey}`);
                    detachElementMedia(videoElement);
                    videoElement?.remove();
                    const audioElement = document.getElementById(`metered-remote-audio-${participantKey}`);
                    detachElementMedia(audioElement);
                    audioElement?.remove();
                    remoteStreamsRef.current.delete(`video-${participantKey}`);
                    remoteStreamsRef.current.delete(`audio-${participantKey}`);
                };

                const attachRemoteTrack = (trackItem: any) => {
                    const participantId = resolveTrackParticipantId(trackItem);
                    const participantName = String(trackItem?.participantName ?? trackItem?.name ?? 'Participant');
                    let trackType = resolveTrackType(trackItem);
                    let mediaTrack = resolveMediaTrack(trackItem, trackType);

                    // ── Audio diagnostic: if trackType is unknown or mediaTrack is null, attempt last-resort extraction ──
                    if (!mediaTrack || trackType === 'unknown') {
                        // Scan ALL event properties to find any MediaStreamTrack
                        const allKeys = trackItem && typeof trackItem === 'object' ? Object.keys(trackItem) : [];
                        let fallbackTrack: MediaStreamTrack | null = null;
                        let fallbackSource = '';
                        for (const key of allKeys) {
                            const val = trackItem[key];
                            if (val instanceof MediaStreamTrack) {
                                fallbackTrack = val;
                                fallbackSource = key;
                                break;
                            }
                            if (val instanceof MediaStream) {
                                const tracks = val.getTracks();
                                if (tracks.length > 0) {
                                    fallbackTrack = tracks[0];
                                    fallbackSource = `${key}.getTracks()[0]`;
                                    break;
                                }
                            }
                        }
                        console.warn('[SessionRoom] track:fallback_extraction', {
                            joinAttemptId,
                            originalTrackType: trackType,
                            originalMediaTrack: mediaTrack ? 'exists' : 'null',
                            fallbackFound: !!fallbackTrack,
                            fallbackSource,
                            fallbackTrackKind: fallbackTrack?.kind,
                            fallbackTrackId: fallbackTrack?.id,
                            fallbackTrackEnabled: fallbackTrack?.enabled,
                            fallbackTrackReadyState: fallbackTrack?.readyState,
                            eventKeys: allKeys,
                        });
                        if (fallbackTrack) {
                            mediaTrack = fallbackTrack;
                            if (trackType === 'unknown') {
                                trackType = (fallbackTrack.kind === 'audio' || fallbackTrack.kind === 'video')
                                    ? fallbackTrack.kind
                                    : 'unknown';
                            }
                        }
                    }

                    const { identityKey, participantKey, displayName, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                    if (identityKey === 'unknown') {
                        console.warn('[SessionRoom] track:unresolvable_identity_ignored', {
                            joinAttemptId,
                            type: trackType,
                            participantSessionId: trackItem?.participantSessionId,
                            participantId: trackItem?.participantId,
                            participantName,
                            trackId: mediaTrack?.id,
                        });
                        return;
                    }
                    const effectiveSourceId = stableIdentity || participantId;
                    const participantState = participantRegistry.get(identityKey);
                    if (!participantState || !participantState.active) {
                        if (effectiveSourceId) {
                            participantRegistry.set(identityKey, {
                                participantId: effectiveSourceId,
                                participantKey,
                                active: true,
                                lastUpdatedAt: Date.now(),
                            });
                            upsertRemoteParticipant(effectiveSourceId, displayName, { lastTrackAt: Date.now() });
                            console.warn('[SessionRoom] participant:synthesized_from_track', {
                                joinAttemptId,
                                participantId: effectiveSourceId,
                                participantName: displayName,
                                identityKey,
                            });
                        } else {
                            const buffered = bufferedTracks.get(identityKey) ?? {
                                participantId,
                                participantName: displayName,
                                bufferedAt: Date.now(),
                            };
                            if (trackType === 'video' && mediaTrack) {
                                buffered.videoTrack = mediaTrack;
                            }
                            if (trackType === 'audio' && mediaTrack) {
                                buffered.audioTrack = mediaTrack;
                            }
                            bufferedTracks.set(identityKey, buffered);
                            console.warn('[SessionRoom] track:orphan_buffered', {
                                joinAttemptId,
                                participantId: effectiveSourceId,
                                participantName: displayName,
                                identityKey,
                                type: trackType,
                                trackId: mediaTrack?.id,
                            });
                            return;
                        }
                    }

                    const existingTracks = participantTrackMap.get(identityKey) ?? {};
                    if (trackType === 'video' && mediaTrack) {
                        if (existingTracks.videoTrackId !== mediaTrack.id) {
                            ensureVideoElement(participantKey, mediaTrack);
                            participantTrackMap.set(identityKey, { ...existingTracks, videoTrackId: mediaTrack.id });
                        }
                        upsertRemoteParticipant(effectiveSourceId, displayName, { hasVideo: true, lastTrackAt: Date.now() });
                    } else if (trackType === 'audio' && mediaTrack) {
                        if (existingTracks.audioTrackId !== mediaTrack.id) {
                            ensureAudioElement(participantKey, mediaTrack);
                            participantTrackMap.set(identityKey, { ...existingTracks, audioTrackId: mediaTrack.id });
                        }
                        upsertRemoteParticipant(effectiveSourceId, displayName, { hasAudio: true, lastTrackAt: Date.now() });
                        console.info('[SessionRoom] audio:track_attached_success', {
                            joinAttemptId,
                            participantKey,
                            trackId: mediaTrack.id,
                            trackEnabled: mediaTrack.enabled,
                            trackReadyState: mediaTrack.readyState,
                            effectiveSourceId,
                        });
                    } else {
                        // CRITICAL: This means audio/video track was NOT recognized or extracted
                        console.error('[SessionRoom] track:IGNORED_missing_media_track', {
                            joinAttemptId,
                            participantId: effectiveSourceId,
                            participantName: displayName,
                            type: trackType,
                            mediaTrackResolved: !!mediaTrack,
                            eventType: trackItem?.type,
                            eventKind: trackItem?.kind,
                            eventKeys: trackItem && typeof trackItem === 'object' ? Object.keys(trackItem) : [],
                            hint: 'This is WHY hasAudio stays Off — the audio track could not be resolved from the event payload.',
                        });
                    }
                };

                const drainBufferedTracks = (participantId: string, participantName: string) => {
                    const { identityKey } = resolveParticipantMeta(participantId, participantName);
                    const buffered = bufferedTracks.get(identityKey);
                    if (!buffered) return;
                    if (buffered.videoTrack) {
                        attachRemoteTrack({
                            type: 'video',
                            track: buffered.videoTrack,
                            participantSessionId: participantId,
                            participantName,
                        });
                    }
                    if (buffered.audioTrack) {
                        attachRemoteTrack({
                            type: 'audio',
                            track: buffered.audioTrack,
                            participantSessionId: participantId,
                            participantName,
                        });
                    }
                    bufferedTracks.delete(identityKey);
                };

                const bootstrapExistingParticipants = async () => {
                    try {
                        const participants = await meeting.getParticipants?.();
                        if (!Array.isArray(participants)) return;
                        let discoveredRemote = 0;
                        participants.forEach((participant: any) => {
                            const participantId = String(
                                participant?.participantSessionId
                                ?? participant?.participantId
                                ?? participant?.id
                                ?? '',
                            ).trim();
                            const participantName = String(
                                participant?.participantName
                                ?? participant?.name
                                ?? participant?.identity
                                ?? '',
                            ).trim();
                            if (!participantId && !participantName) return;
                            const { identityKey, participantKey, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                            if (identityKey === 'unknown') return;
                            const effectiveSourceId = stableIdentity || participantId;
                            if (effectiveSourceId && userId && effectiveSourceId === userId) return;
                            discoveredRemote += 1;
                            participantRegistry.set(identityKey, {
                                participantId: effectiveSourceId,
                                participantKey,
                                active: true,
                                lastUpdatedAt: Date.now(),
                            });
                            upsertRemoteParticipant(effectiveSourceId, participantName, { lastTrackAt: Date.now() });
                            drainBufferedTracks(effectiveSourceId, participantName);
                        });
                        if (discoveredRemote > 0) {
                            console.info('[SessionRoom] participants:bootstrapped', {
                                joinAttemptId,
                                discoveredRemote,
                            });
                            setConnectionState('CONNECTED');
                        } else {
                            setConnectionState('WAITING');
                        }
                    } catch (error) {
                        console.warn('[SessionRoom] participants:bootstrap_failed', {
                            joinAttemptId,
                            message: error instanceof Error ? error.message : 'unknown',
                        });
                    }
                };

                on('remoteTrackStarted', (trackPayload: unknown) => {
                    const trackItem = trackPayload as any;
                    if (isUnmounting) return;

                    // ── RAW PAYLOAD DUMP: Do NOT assume shape ──
                    const rawKeys = trackItem && typeof trackItem === 'object' ? Object.keys(trackItem) : [];
                    const candidateTrackFields: Record<string, string> = {};
                    for (const key of ['track', 'mediaStreamTrack', 'mediaTrack', 'streamTrack', 'stream', 'remoteStream']) {
                        const val = trackItem?.[key];
                        candidateTrackFields[key] = val instanceof MediaStreamTrack
                            ? `MediaStreamTrack(id=${val.id}, kind=${val.kind}, enabled=${val.enabled}, readyState=${val.readyState})`
                            : val instanceof MediaStream
                                ? `MediaStream(id=${val.id}, active=${val.active}, tracks=${val.getTracks().length})`
                                : val === undefined ? 'undefined' : val === null ? 'null' : typeof val;
                    }
                    console.info('[SessionRoom] RAW:remoteTrackStarted', {
                        joinAttemptId,
                        typeof: typeof trackItem,
                        isMediaStreamTrack: trackItem instanceof MediaStreamTrack,
                        keys: rawKeys,
                        candidateTrackFields,
                        type: trackItem?.type,
                        kind: trackItem?.kind,
                        participantSessionId: trackItem?.participantSessionId,
                        participantId: trackItem?.participantId,
                        participantName: trackItem?.participantName,
                        name: trackItem?.name,
                        rawPayload: trackItem,
                    });

                    const participantId = String(trackItem?.participantSessionId ?? trackItem?.participantId ?? '');
                    const trackType = resolveTrackType(trackItem);
                    const mediaTrack = resolveMediaTrack(trackItem, trackType);
                    console.info('[SessionRoom] track:remote_started', {
                        joinAttemptId,
                        type: trackType,
                        participantSessionId: participantId,
                        trackId: mediaTrack?.id,
                        trackEnabled: mediaTrack?.enabled,
                        trackReadyState: mediaTrack?.readyState,
                        trackMuted: mediaTrack?.muted,
                        resolvedTrackSource: mediaTrack
                            ? (trackItem?.track === mediaTrack ? '.track'
                                : trackItem === mediaTrack ? 'event_itself'
                                : trackItem?.mediaStreamTrack === mediaTrack ? '.mediaStreamTrack'
                                : trackItem?.mediaTrack === mediaTrack ? '.mediaTrack'
                                : trackItem?.streamTrack === mediaTrack ? '.streamTrack'
                                : 'from_stream')
                            : 'NOT_RESOLVED',
                    });
                    attachRemoteTrack(trackItem);

                    // Audio-specific: verify DOM element was created and is playing
                    if (trackType === 'audio' && mediaTrack) {
                        const participantName = String(trackItem?.participantName ?? trackItem?.name ?? '');
                        const { participantKey } = resolveParticipantMeta(participantId, participantName);
                        const audioEl = document.getElementById(`metered-remote-audio-${participantKey}`) as HTMLAudioElement | null;
                        console.info('[SessionRoom] audio:remote_element_verify', {
                            joinAttemptId,
                            participantKey,
                            trackId: mediaTrack.id,
                            elementExists: !!audioEl,
                            elementPaused: audioEl?.paused,
                            elementMuted: audioEl?.muted,
                            elementVolume: audioEl?.volume,
                            elementReadyState: audioEl?.readyState,
                            srcObjectActive: !!(audioEl?.srcObject as MediaStream)?.active,
                            srcObjectTrackCount: (audioEl?.srcObject as MediaStream)?.getTracks().length,
                        });
                    }

                    hasReceivedRemoteTrack = true;
                    if (firstRemoteTrackTimeout) {
                        clearTimeout(firstRemoteTrackTimeout);
                        firstRemoteTrackTimeout = null;
                    }
                });

                on('remoteTrackStopped', (trackPayload: unknown) => {
                    const trackItem = trackPayload as any;

                    // ── RAW PAYLOAD DUMP: Do NOT assume shape ──
                    const rawKeys = trackItem && typeof trackItem === 'object' ? Object.keys(trackItem) : [];
                    const candidateTrackFields: Record<string, string> = {};
                    for (const key of ['track', 'mediaStreamTrack', 'mediaTrack', 'streamTrack', 'stream', 'remoteStream']) {
                        const val = trackItem?.[key];
                        candidateTrackFields[key] = val instanceof MediaStreamTrack
                            ? `MediaStreamTrack(id=${val.id}, kind=${val.kind}, enabled=${val.enabled}, readyState=${val.readyState})`
                            : val instanceof MediaStream
                                ? `MediaStream(id=${val.id}, active=${val.active}, tracks=${val.getTracks().length})`
                                : val === undefined ? 'undefined' : val === null ? 'null' : typeof val;
                    }
                    console.info('[SessionRoom] RAW:remoteTrackStopped', {
                        joinAttemptId,
                        typeof: typeof trackItem,
                        isMediaStreamTrack: trackItem instanceof MediaStreamTrack,
                        keys: rawKeys,
                        candidateTrackFields,
                        type: trackItem?.type,
                        kind: trackItem?.kind,
                        participantSessionId: trackItem?.participantSessionId,
                        participantId: trackItem?.participantId,
                        participantName: trackItem?.participantName,
                        rawPayload: trackItem,
                    });

                    const participantId = resolveTrackParticipantId(trackItem);
                    const participantName = String(trackItem?.participantName ?? trackItem?.name ?? '');
                    const trackType = resolveTrackType(trackItem);
                    const mediaTrack = resolveMediaTrack(trackItem, trackType);
                    const { identityKey, participantKey, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                    const effectiveSourceId = stableIdentity || participantId;
                    console.info('[SessionRoom] track:remote_stopped', {
                        joinAttemptId,
                        type: trackType,
                        participantSessionId: effectiveSourceId,
                        trackId: mediaTrack?.id ?? '(unresolved)',
                        resolvedTrackSource: mediaTrack
                            ? (trackItem?.track === mediaTrack ? '.track'
                                : trackItem === mediaTrack ? 'event_itself'
                                : trackItem?.mediaStreamTrack === mediaTrack ? '.mediaStreamTrack'
                                : trackItem?.mediaTrack === mediaTrack ? '.mediaTrack'
                                : 'from_stream')
                            : 'NOT_RESOLVED',
                    });
                    const existingTracks = participantTrackMap.get(identityKey) ?? {};
                    if (trackType === 'video') {
                        const videoElement = document.getElementById(`metered-remote-video-${participantKey}`);
                        detachElementMedia(videoElement);
                        videoElement?.remove();
                        remoteStreamsRef.current.delete(`video-${participantKey}`);
                        participantTrackMap.set(identityKey, { ...existingTracks, videoTrackId: undefined });
                        setRemoteParticipants((current) => current.map((participant) => participant.id === participantKey || participant.sourceParticipantId === effectiveSourceId
                            ? { ...participant, hasVideo: false }
                            : participant));
                    }
                    if (trackType === 'audio') {
                        const audioElement = document.getElementById(`metered-remote-audio-${participantKey}`) as HTMLAudioElement | null;
                        // Diagnostic: log element state before removal
                        console.info('[SessionRoom] audio:remote_element_removing', {
                            joinAttemptId,
                            participantKey,
                            trackId: mediaTrack?.id ?? '(unresolved)',
                            elementExists: !!audioElement,
                            elementPaused: audioElement?.paused,
                            elementMuted: audioElement?.muted,
                            srcObjectActive: !!(audioElement?.srcObject as MediaStream)?.active,
                        });
                        detachElementMedia(audioElement);
                        audioElement?.remove();
                        remoteStreamsRef.current.delete(`audio-${participantKey}`);
                        participantTrackMap.set(identityKey, { ...existingTracks, audioTrackId: undefined });
                        setRemoteParticipants((current) => current.map((participant) => participant.id === participantKey || participant.sourceParticipantId === effectiveSourceId
                            ? { ...participant, hasAudio: false }
                            : participant));
                    }
                });

                on('localTrackStarted', (trackPayload: unknown) => {
                    const trackItem = trackPayload as any;
                    const sdkTrackId = trackItem?.track?.id;
                    const sdkTrackKind = trackItem?.track?.kind ?? trackItem?.type;

                    // Enterprise debug: compare SDK track IDs with localStreamRef to detect stream provenance
                    const localRefTracks = localStreamRef.current?.getTracks() ?? [];
                    const matchesLocalRef = localRefTracks.some(t => t.id === sdkTrackId);

                    console.info('[SessionRoom] track:local_started', {
                        joinAttemptId,
                        type: sdkTrackKind,
                        sdkTrackId,
                        sdkTrackEnabled: trackItem?.track?.enabled,
                        sdkTrackReadyState: trackItem?.track?.readyState,
                        localStreamRefTrackIds: localRefTracks.map(t => ({ id: t.id, kind: t.kind })),
                        matchesLocalRef,
                        verdict: matchesLocalRef
                            ? 'SDK is using OUR provided localStream'
                            : 'SDK created its OWN stream — localStreamRef is ORPHANED',
                    });
                });

                on('trackStarted', (trackPayload: unknown) => {
                    const trackItem = trackPayload as any;
                    const trackType = resolveTrackType(trackItem);
                    console.info('[SessionRoom] track:started', {
                        joinAttemptId,
                        type: trackType,
                        participantSessionId: trackItem?.participantSessionId,
                        trackId: trackItem?.track?.id,
                    });
                    if (trackType === 'video' || trackType === 'audio') {
                        attachRemoteTrack(trackItem);
                        hasReceivedRemoteTrack = true;
                        if (firstRemoteTrackTimeout) {
                            clearTimeout(firstRemoteTrackTimeout);
                            firstRemoteTrackTimeout = null;
                        }
                    }
                });

                on('trackStopped', (trackPayload: unknown) => {
                    const trackItem = trackPayload as any;
                    console.info('[SessionRoom] track:stopped', {
                        joinAttemptId,
                        type: trackItem?.type,
                        participantSessionId: trackItem?.participantSessionId,
                        trackId: trackItem?.track?.id,
                    });
                });

                on('participantJoined', (participantPayload: unknown) => {
                    const participant = participantPayload as any;
                    const participantId = String(participant?.participantSessionId ?? participant?.participantId ?? participant?.id ?? '');
                    const participantName = String(participant?.participantName ?? participant?.name ?? 'Participant');
                    const { identityKey, participantKey, displayName, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                    const effectiveSourceId = stableIdentity || participantId;
                    participantRegistry.set(identityKey, {
                        participantId: effectiveSourceId,
                        participantKey,
                        active: true,
                        lastUpdatedAt: Date.now(),
                    });
                    console.info('[SessionRoom] participant:joined', {
                        joinAttemptId,
                        participant,
                    });
                    toast(`${displayName} joined the room`);
                    upsertRemoteParticipant(effectiveSourceId, participantName, { lastTrackAt: Date.now() });
                    drainBufferedTracks(effectiveSourceId, participantName);
                });

                on('participantLeft', (participantPayload: unknown) => {
                    const participant = participantPayload as any;
                    const participantId = String(participant?.participantSessionId ?? participant?.participantId ?? participant?.id ?? '');
                    const participantName = String(participant?.participantName ?? participant?.name ?? '');
                    const { identityKey, participantKey, displayName, stableIdentity } = resolveParticipantMeta(participantId, participantName);
                    const effectiveSourceId = stableIdentity || participantId;
                    participantRegistry.set(identityKey, {
                        participantId: effectiveSourceId,
                        participantKey,
                        active: false,
                        lastUpdatedAt: Date.now(),
                    });
                    console.info('[SessionRoom] participant:left', {
                        joinAttemptId,
                        participant,
                    });
                    toast(`${displayName} left the room`);
                    removeTrackElements(participantKey);
                    removeTrackElements(toDomSafeKey(`sid:${participantId}`));
                    participantTrackMap.delete(identityKey);
                    bufferedTracks.delete(identityKey);
                    removeRemoteParticipant(effectiveSourceId, participantName);
                });

                on('reconnecting', () => {
                    setConnectionState('RECONNECTING');
                    toast.loading('Connection lost. Reconnecting...', { id: 'reconnect-toast' });
                });

                on('reconnected', () => {
                    // Safely re-evaluate: if remote participants exist, go CONNECTED; otherwise WAITING.
                    // Do NOT hard-code WAITING — that regresses a live connection back to waiting state.
                    setRemoteParticipants((currentParticipants) => {
                        setConnectionState(currentParticipants.length > 0 ? 'CONNECTED' : 'WAITING');
                        return currentParticipants; // no mutation, just reading
                    });
                    toast.success('Reconnected successfully!', { id: 'reconnect-toast' });

                    // Re-bootstrap participants to catch any tracks that arrived during reconnection
                    bootstrapExistingParticipants().catch(() => undefined);

                    console.info('[SessionRoom] reconnected:state_restored', { joinAttemptId });
                });

                on('meetingEnded', () => {
                    toast.dismiss('reconnect-toast');
                    const disconnectIntent = disconnectIntentRef.current;
                    disconnectIntentRef.current = null;
                    const latestSession = sessionDetailsRef.current;

                    clearVideoContainers();
                    localTrackCleanupCallbacks.forEach((cleanup) => cleanup());
                    setRemoteParticipants([]);
                    setIsInRoom(false);
                    setConnectionState('IDLE');
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

                on('error', (errorPayload: unknown) => {
                    const err = errorPayload as any;
                    console.error('[MeteredVideo] Error:', err);
                    setConnectionState('FAILED');
                    setExitContext('NETWORK');
                    setJoinState('LEFT');
                    toast.error(`Could not connect: ${err?.message || 'Unknown error'}`);
                });

                const roomCandidate = (roomUrl || roomName || id || '').trim();
                const normalizedCandidate = normalizeMeteredRoomUrl(roomCandidate);
                const sdkRoomUrl = roomUrl
                    ? normalizeMeteredRoomUrl(roomUrl)
                    : normalizedCandidate;

                console.info('[SessionRoom] join:resolved_room', {
                    joinAttemptId,
                    roomCandidate,
                    sdkRoomUrl,
                    usesHttpsPrefix: /^https?:\/\//i.test(String(roomUrl || roomName || '')),
                });

                await meeting.join({
                    roomURL: sdkRoomUrl,
                    accessToken: token,
                    meetingToken: token,
                    participantName: userId,
                    video: true,
                    audio: true,
                    localStream
                });

                console.info('[SessionRoom] join:success', {
                    joinAttemptId,
                    sessionId: id,
                    userId,
                });

                if (isUnmounting || joinAttemptRef.current !== joinAttemptId) {
                    meeting.leaveMeeting?.();
                    return;
                }

                if (joinTimeout) {
                    clearTimeout(joinTimeout);
                    joinTimeout = null;
                }

                // Ensure the initial local tracks are unmuted locally before publishing
                localStream.getAudioTracks().forEach((track) => { track.enabled = true; });
                localStream.getVideoTracks().forEach((track) => { track.enabled = true; });

                console.info('[SessionRoom] local:stream_configured', {
                    joinAttemptId,
                    localAudioTrackCount: localStream.getAudioTracks().length,
                    localVideoTrackCount: localStream.getVideoTracks().length,
                    localStreamRefTrackIds: localStream.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
                });

                setIsInRoom(true);
                setIsLoading(false);
                setConnectionState('WAITING');
                await bootstrapExistingParticipants();
                firstRemoteTrackTimeout = setTimeout(() => {
                    if (joinAttemptRef.current !== joinAttemptId || isUnmounting || !roomRef.current || hasReceivedRemoteTrack) return;
                    console.warn('[SessionRoom] track:first_remote_timeout', { joinAttemptId, sessionId: id, userId });
                    setConnectionState('WAITING');
                }, 15000);

                api.post(`/sessions/${id}/start`).catch((err) => {
                    console.warn('Manual start fallback failed or session already started', err);
                });

            } catch (err: any) {
                console.error('[SessionRoom] Failed to join Metered room:', err);
                console.error('[SessionRoom] join:failure', {
                    joinAttemptId,
                    sessionId: id,
                    userId,
                    name: err?.name,
                    message: err?.message,
                    stack: err?.stack,
                });

                if (err.message?.includes('Permission denied') || err.name === 'NotAllowedError') {
                    toast.error('Browser denied camera/microphone access. Please check your permissions.');
                } else if (err.response?.data?.message) {
                    toast.error(err.response.data.message);
                    const latestSession = sessionDetailsRef.current;
                    if (latestSession && canRejoinSession(latestSession)) {
                        setExitContext('NETWORK');
                        setJoinState('LEFT');
                    } else {
                        navigate('/dashboard');
                    }
                } else {
                    toast.error(`Could not connect: ${err.message || 'Unknown error'}`);
                    const latestSession = sessionDetailsRef.current;
                    if (latestSession && canRejoinSession(latestSession)) {
                        setExitContext('NETWORK');
                        setJoinState('LEFT');
                    }
                }

                if (!isUnmounting) setIsLoading(false);
                setConnectionState('FAILED');
            } finally {
                joinInFlightRef.current = false;
                if (joinTimeout) {
                    clearTimeout(joinTimeout);
                    joinTimeout = null;
                }
            }
        };

        initMeteredVideo();

        return () => {
            isUnmounting = true;
            joinAttemptRef.current += 1;
            joinInFlightRef.current = false;
            if (joinTimeout) clearTimeout(joinTimeout);
            if (firstRemoteTrackTimeout) clearTimeout(firstRemoteTrackTimeout);
            if (joinedMeeting) {
                const meetingAny = joinedMeeting as unknown as { off?: (event: string, handler: (...args: unknown[]) => void) => void };
                listeners.forEach(({ event, handler }) => {
                    meetingAny.off?.(event, handler);
                });
            }
            localTrackCleanupCallbacks.forEach((cleanup) => cleanup());
            if (roomRef.current) {
                roomRef.current.leaveMeeting?.();
                roomRef.current = null;
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
                setLocalPreviewStream(null);
            }
            setRemoteParticipants([]);
            setIsInRoom(false);
            setConnectionState('IDLE');
        };
    }, [
        id,
        userId,
        userDisplayName,
        joinState,
        navigate,
        setAiMonitoringConsent,
        setIsLoading,
        setIsVideoOff,
        setAttentionAdapter,
        setIsInRoom,
        setConnectionState,
        setRemoteParticipants,
        setExitContext,
        setJoinState,
        remoteVideoRef,
        localStreamRef,
        remoteStreamsRef,
        roomRef,
        sessionDetailsRef,
        disconnectIntentRef,
        clearVideoContainers,
        setLocalPreviewStream,
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
    isInRoom: boolean;
    hasRemoteParticipants: boolean;
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
        isInRoom,
        hasRemoteParticipants,
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
        if (!sessionDetails || !isInRoom) {
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
    }, [sessionDetails, isInRoom, joinState, isCompletingSession, applyCompletedSessionState, setTimeRemainingMs]);

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
                console.info('[SessionRoom] presence:fetch_start', { sessionId: id, silent: !!options?.silent });
                const res = await api.get(`/sessions/${id}/presence`);
                if (!mounted || presenceRefreshAbortRef.current) return;

                const nextPresence = res.data.data as PresenceSummary;
                console.info('[SessionRoom] presence:fetch_success', {
                    sessionId: id,
                    status: nextPresence.status,
                    participants: nextPresence.participants.map((participant) => ({
                        userId: participant.userId,
                        state: participant.state,
                        isConnected: participant.isConnected,
                        joinCount: participant.joinCount,
                        reconnectCount: participant.reconnectCount,
                        lastJoinedAt: participant.lastJoinedAt,
                        lastLeftAt: participant.lastLeftAt,
                    })),
                    recentEvents: nextPresence.recentEvents.slice(0, 5).map((event) => ({
                        id: event.id,
                        eventType: event.eventType,
                        source: event.source,
                        userId: event.userId,
                        occurredAt: event.occurredAt,
                    })),
                });
                setPresenceSummary(nextPresence);
                setPresenceError(null);

                setSessionDetails((current) => {
                    if (!current || nextPresence.status === current.status) return current;
                    return { ...current, status: nextPresence.status };
                });
            } catch (error: unknown) {
                if (!mounted || presenceRefreshAbortRef.current) return;
                const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
                console.error('[SessionRoom] presence:fetch_failure', {
                    sessionId: id,
                    message: axiosMsg ?? (error instanceof Error ? error.message : 'unknown'),
                });
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
            console.warn('[SessionRoom] presence:socket_unavailable', { sessionId: id });
            return () => {
                mounted = false;
            };
        }

        const handlePresenceUpdated = (data: { sessionId: string }) => {
            if (data.sessionId !== id) return;
            console.info('[SessionRoom] presence:socket_update_received', data);
            void fetchPresenceSummary({ silent: true });
        };

        socket.on('session:presence_updated', handlePresenceUpdated);

        return () => {
            mounted = false;
            socket.off('session:presence_updated', handlePresenceUpdated);
        };
    }, [id, user, presenceRefreshAbortRef, setIsPresenceLoading, setPresenceSummary, setPresenceError, setSessionDetails]);

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
        if (!isLoading && isInRoom && !hasRemoteParticipants && joinState === 'JOINING') {
            const timeout = setTimeout(() => {
                toast("The other participant hasn't joined yet. You can continue waiting, or leave and follow up with them.", {
                    duration: 8000,
                    icon: '⏳'
                });
            }, 5 * 60 * 1000);

            return () => clearTimeout(timeout);
        }
    }, [isLoading, isInRoom, hasRemoteParticipants, joinState]);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function SessionRoom() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [isLoading, setIsLoading] = useState(true);
    const [isInRoom, setIsInRoom] = useState(false);
    const [remoteParticipants, setRemoteParticipants] = useState<SdkRemoteParticipant[]>([]);
    const [connectionState, setConnectionState] = useState<ConnectionState>('IDLE');
    const [retryAttempt, setRetryAttempt] = useState(0);
    const [retryInMs, setRetryInMs] = useState<number | null>(null);
    const [isMultiTabBlocked, setIsMultiTabBlocked] = useState(false);

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
    const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);

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
    const tabIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lockHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const localPresenceState = isInRoom ? 'CONNECTED' : 'NOT_JOINED';
    const hasRemoteParticipants = remoteParticipants.length > 0;
    const sessionTabLockKey = id && user?.id ? `treat-health:session-tab-lock:${id}:${user.id}` : null;

    const readSessionTabLock = useCallback((): { tabId: string; updatedAt: number } | null => {
        if (!sessionTabLockKey) return null;
        try {
            const raw = localStorage.getItem(sessionTabLockKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as unknown;
            if (!parsed || typeof parsed !== 'object') return null;
            const candidate = parsed as { tabId?: unknown; updatedAt?: unknown };
            if (typeof candidate.tabId !== 'string' || typeof candidate.updatedAt !== 'number') return null;
            return { tabId: candidate.tabId, updatedAt: candidate.updatedAt };
        } catch {
            return null;
        }
    }, [sessionTabLockKey]);

    const writeSessionTabLock = useCallback((state: 'JOINING' | 'ACTIVE') => {
        if (!sessionTabLockKey) return;
        const payload = {
            tabId: tabIdRef.current,
            sessionId: id,
            userId: user?.id,
            state,
            updatedAt: Date.now(),
        };
        localStorage.setItem(sessionTabLockKey, JSON.stringify(payload));
    }, [id, sessionTabLockKey, user?.id]);

    const releaseSessionTabLock = useCallback(() => {
        if (!sessionTabLockKey) return;
        const current = readSessionTabLock();
        if (current?.tabId === tabIdRef.current) {
            localStorage.removeItem(sessionTabLockKey);
        }
    }, [readSessionTabLock, sessionTabLockKey]);

    const acquireSessionTabLock = useCallback((state: 'JOINING' | 'ACTIVE') => {
        if (!sessionTabLockKey) return true;
        const current = readSessionTabLock();
        const now = Date.now();
        const hasFreshForeignLock = !!current
            && current.tabId !== tabIdRef.current
            && now - current.updatedAt < SESSION_TAB_LOCK_TTL_MS;

        if (hasFreshForeignLock) {
            console.warn('[SessionRoom] session:multi_tab_blocked', {
                sessionId: id,
                userId: user?.id,
                holderTabId: current?.tabId,
                currentTabId: tabIdRef.current,
            });
            return false;
        }

        writeSessionTabLock(state);
        return true;
    }, [id, readSessionTabLock, sessionTabLockKey, user?.id, writeSessionTabLock]);

    const clearVideoContainers = useCallback(() => {
        const detachMediaElement = (element: Element) => {
            const mediaElement = element as HTMLMediaElement;
            if (mediaElement.srcObject) {
                mediaElement.srcObject = null;
            }
        };
        if (localVideoRef.current) {
            localVideoRef.current.querySelectorAll('video,audio').forEach(detachMediaElement);
            localVideoRef.current.innerHTML = '';
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.querySelectorAll('video,audio').forEach(detachMediaElement);
            remoteVideoRef.current.innerHTML = '';
        }
        document.querySelectorAll('[id^="metered-remote-audio-"], [id^="metered-remote-video-"]').forEach((element) => {
            detachMediaElement(element);
            element.remove();
        });
        remoteStreamsRef.current.clear();
    }, []);

    const disconnectRoom = useCallback((intent: 'LEAVE' | 'COMPLETE') => {
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
        setIsInRoom(false);
        setRemoteParticipants([]);
        setAttentionAdapter(null);
        setLocalPreviewStream(null);
        releaseSessionTabLock();
    }, [clearVideoContainers, releaseSessionTabLock, setAttentionAdapter]);

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
        isInRoom,
        hasRemoteParticipants,
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

    const startJoining = useCallback(() => {
        const lockAcquired = acquireSessionTabLock('JOINING');
        if (!lockAcquired) {
            setIsMultiTabBlocked(true);
            setIsLoading(false);
            setConnectionState('FAILED');
            setExitContext('LEFT');
            setJoinState('LEFT');
            toast.error('This session is already active in another tab.');
            return;
        }
        setIsMultiTabBlocked(false);
        setRetryAttempt(0);
        setRetryInMs(null);
        setExitContext(null);
        setIsLoading(true);
        setConnectionState('JOINING');
        setJoinState('JOINING');
    }, [acquireSessionTabLock]);

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
        setConnectionState('IDLE');
        setExitContext('LEFT');
        setJoinState(!sessionAlreadyCompleted && rejoinable ? 'LEFT' : 'COMPLETED');

        toast.success(sessionAlreadyCompleted ? 'Session completed. Rejoin is now closed.' : rejoinMessage, { duration: 5000 });

        if (returnToDashboard) {
            navigate('/dashboard');
        }
    };

    useEffect(() => {
        const active = joinState === 'JOINING' || isInRoom;
        if (!active || !sessionTabLockKey) {
            if (lockHeartbeatRef.current) {
                clearInterval(lockHeartbeatRef.current);
                lockHeartbeatRef.current = null;
            }
            return;
        }

        const lockState = isInRoom ? 'ACTIVE' : 'JOINING';
        const hasLock = acquireSessionTabLock(lockState);
        if (!hasLock) {
            setIsMultiTabBlocked(true);
            setConnectionState('FAILED');
            setIsLoading(false);
            setExitContext('LEFT');
            setJoinState('LEFT');
            return;
        }
        setIsMultiTabBlocked(false);
        writeSessionTabLock(lockState);

        lockHeartbeatRef.current = setInterval(() => {
            writeSessionTabLock(isInRoom ? 'ACTIVE' : 'JOINING');
        }, Math.floor(SESSION_TAB_LOCK_TTL_MS / 3));

        return () => {
            if (lockHeartbeatRef.current) {
                clearInterval(lockHeartbeatRef.current);
                lockHeartbeatRef.current = null;
            }
            if (!isInRoom && joinState !== 'JOINING') {
                releaseSessionTabLock();
            }
        };
    }, [acquireSessionTabLock, isInRoom, joinState, releaseSessionTabLock, sessionTabLockKey, setJoinState, writeSessionTabLock]);

    useEffect(() => {
        if (!sessionTabLockKey) return;
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== sessionTabLockKey) return;
            const current = readSessionTabLock();
            if (!current) {
                setIsMultiTabBlocked(false);
                return;
            }
            const isForeignLock = current.tabId !== tabIdRef.current && Date.now() - current.updatedAt < SESSION_TAB_LOCK_TTL_MS;
            if (isForeignLock && (isInRoom || joinState === 'JOINING')) {
                console.warn('[SessionRoom] session:multi_tab_conflict_detected', {
                    sessionId: id,
                    userId: user?.id,
                    holderTabId: current.tabId,
                    currentTabId: tabIdRef.current,
                });
            }
            setIsMultiTabBlocked(isForeignLock);
        };
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, [id, isInRoom, joinState, readSessionTabLock, sessionTabLockKey, user?.id]);

    useEffect(() => () => {
        releaseSessionTabLock();
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        if (retryTickTimerRef.current) {
            clearInterval(retryTickTimerRef.current);
            retryTickTimerRef.current = null;
        }
        if (lockHeartbeatRef.current) {
            clearInterval(lockHeartbeatRef.current);
            lockHeartbeatRef.current = null;
        }
    }, [releaseSessionTabLock]);

    const handleRetryJoin = useCallback(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        if (retryTickTimerRef.current) {
            clearInterval(retryTickTimerRef.current);
            retryTickTimerRef.current = null;
        }
        setRetryInMs(null);
        startJoining();
    }, [startJoining]);

    useEffect(() => {
        if (connectionState !== 'FAILED' || joinState === 'COMPLETED' || isMultiTabBlocked || retryAttempt >= AUTO_RETRY_MAX_ATTEMPTS) {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (retryTickTimerRef.current) {
                clearInterval(retryTickTimerRef.current);
                retryTickTimerRef.current = null;
            }
            setRetryInMs(null);
            return;
        }

        const delayMs = Math.min(15000, AUTO_RETRY_BASE_DELAY_MS * Math.pow(2, retryAttempt));
        const startAt = Date.now() + delayMs;
        setRetryInMs(delayMs);
        toast(`Connection issue detected. Retrying in ${Math.ceil(delayMs / 1000)}s...`, { duration: 3500, icon: '🔄' });

        retryTickTimerRef.current = setInterval(() => {
            const remaining = Math.max(0, startAt - Date.now());
            setRetryInMs(remaining);
        }, 500);

        retryTimerRef.current = setTimeout(() => {
            if (retryTickTimerRef.current) {
                clearInterval(retryTickTimerRef.current);
                retryTickTimerRef.current = null;
            }
            setRetryInMs(null);
            setRetryAttempt((previous) => previous + 1);
            startJoining();
        }, delayMs);

        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (retryTickTimerRef.current) {
                clearInterval(retryTickTimerRef.current);
                retryTickTimerRef.current = null;
            }
        };
    }, [connectionState, isMultiTabBlocked, joinState, retryAttempt, startJoining]);

    useEffect(() => {
        if (connectionState === 'CONNECTED') {
            setRetryAttempt(0);
            setRetryInMs(null);
        }
    }, [connectionState]);

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
        userDisplayName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Participant',
        joinState,
        navigate,
        setAiMonitoringConsent,
        setIsLoading,
        setIsVideoOff,
        setAttentionAdapter,
        setIsInRoom,
        setConnectionState,
        setRemoteParticipants,
        setExitContext,
        setJoinState,
        remoteVideoRef,
        localStreamRef,
        remoteStreamsRef,
        roomRef,
        sessionDetailsRef,
        disconnectIntentRef,
        clearVideoContainers,
        setLocalPreviewStream,
    });

    useEffect(() => {
        if (!localPreviewStream || !localVideoRef.current) return;
        localVideoRef.current.innerHTML = '';
        const videoTracks = localPreviewStream.getVideoTracks();
        if (videoTracks.length === 0) return;
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
    }, [localPreviewStream, joinState, isLoading]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            roomRef.current?.leaveMeeting?.();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
                localStreamRef.current = null;
            }
            releaseSessionTabLock();
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (retryTickTimerRef.current) {
                clearInterval(retryTickTimerRef.current);
                retryTickTimerRef.current = null;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [localStreamRef, releaseSessionTabLock, roomRef]);

    useEffect(() => {
        console.info('[SessionRoom] state:snapshot', {
            isInRoom,
            connectionState,
            remoteParticipants: remoteParticipants.map((participant) => ({
                id: participant.id,
                name: participant.name,
                hasVideo: participant.hasVideo,
                hasAudio: participant.hasAudio,
            })),
        });
    }, [isInRoom, remoteParticipants, connectionState]);

    useEffect(() => {
        if (!isInRoom) {
            if (connectionState !== 'FAILED' && connectionState !== 'JOINING') {
                setConnectionState('IDLE');
            }
            return;
        }
        if (connectionState === 'RECONNECTING' || connectionState === 'FAILED') {
            return;
        }
        setConnectionState(hasRemoteParticipants ? 'CONNECTED' : 'WAITING');
    }, [isInRoom, hasRemoteParticipants, connectionState]);

    const sessionStatusLabel = connectionState === 'CONNECTED'
        ? 'Connected securely'
        : isMultiTabBlocked
            ? 'Blocked by active tab'
        : connectionState === 'RECONNECTING'
            ? 'Reconnecting...'
            : connectionState === 'FAILED'
                ? 'Connection failed'
                : 'Waiting for others to join...';
    const waitingPlaceholderLabel = connectionState === 'RECONNECTING'
        ? 'Reconnecting to participant...'
        : isMultiTabBlocked
            ? 'Session is active in another tab.'
        : connectionState === 'FAILED'
            ? retryInMs && retryInMs > 0
                ? `Connection failed. Retrying in ${Math.max(1, Math.ceil(retryInMs / 1000))}s...`
                : 'Connection failed. Retry now.'
            : connectionState === 'JOINING'
                ? 'Joining secure room...'
                : 'Waiting for participant to join...';

    // ── Enterprise toggle handlers ──
    // PRIMARY: Call Metered SDK methods (stopAudio/startAudio, stopVideo/startVideo)
    //   which properly publish/unpublish tracks to the SFU.
    // NOTE: muteAudio/unmuteAudio only mutes an ALREADY-shared track.
    //   stopAudio/startAudio actually starts/stops SHARING — the crucial difference.
    // FALLBACK: Also sync raw track.enabled for local rendering consistency.
    // Uses functional setState to prevent stale closure race conditions.

    const toggleMute = () => {
        const meeting = roomRef.current;
        const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];

        // Compute explicit next state BEFORE any side-effects
        setIsMuted((prev) => {
            const nextMuted = !prev;

            // Pre-toggle audit
            console.info('[SessionRoom] toggle:mute:pre', {
                currentUiMuted: prev,
                nextUiMuted: nextMuted,
                hasMeetingRef: !!meeting,
                audioTrackCount: audioTracks.length,
                audioTracks: audioTracks.map(t => ({
                    id: t.id,
                    enabled: t.enabled,
                    readyState: t.readyState,
                    muted: t.muted,
                })),
            });

            // Guard: if track ended (device disconnected), warn loudly
            const hasDeadTrack = audioTracks.some(t => t.readyState === 'ended');
            if (hasDeadTrack) {
                console.error('[SessionRoom] toggle:mute:DEAD_TRACK', {
                    hint: 'Audio track readyState is "ended". Microphone may have been disconnected. Unmuting will NOT restore audio.',
                    audioTracks: audioTracks.map(t => ({ id: t.id, readyState: t.readyState })),
                });
            }

            // PRIMARY: SDK-level stopAudio/startAudio — this PUBLISHES or UNPUBLISHES
            // audio to the SFU. This is what changes participant.sharingAudio on the remote side.
            if (meeting) {
                try {
                    if (nextMuted) {
                        meeting.stopAudio?.();
                    } else {
                        meeting.startAudio?.();
                    }
                } catch (sdkErr) {
                    console.error('[SessionRoom] toggle:mute:SDK_ERROR', {
                        nextMuted,
                        sdkMethod: nextMuted ? 'stopAudio' : 'startAudio',
                        error: sdkErr instanceof Error ? sdkErr.message : sdkErr,
                    });
                }
            }

            // FALLBACK: sync raw track.enabled for local consistency
            audioTracks.forEach(t => {
                if (t.readyState === 'live') {
                    t.enabled = !nextMuted;
                }
            });

            // Post-toggle verification
            const postTracks = localStreamRef.current?.getAudioTracks() ?? [];
            console.info('[SessionRoom] toggle:mute:post', {
                nowMuted: nextMuted,
                audioTracks: postTracks.map(t => ({
                    id: t.id,
                    enabled: t.enabled,
                    readyState: t.readyState,
                    muted: t.muted,
                })),
                trackEnabledMatchesUi: postTracks.every(t => t.enabled === !nextMuted),
            });

            return nextMuted;
        });
    };

    const toggleVideo = () => {
        const meeting = roomRef.current;

        setIsVideoOff((prev) => {
            const nextVideoOff = !prev;

            console.info('[SessionRoom] toggle:video:before', {
                wasVideoOff: prev,
                willBeVideoOff: nextVideoOff,
                hasMeeting: !!meeting,
                localVideoTracks: localStreamRef.current?.getVideoTracks().map(t => ({
                    id: t.id, enabled: t.enabled, readyState: t.readyState,
                })) ?? [],
            });

            // Primary: SDK-level stop/start video (signals remote side + stops sending track)
            if (meeting) {
                if (nextVideoOff) {
                    meeting.stopVideo?.();
                } else {
                    meeting.startVideo?.();
                }
            }

            // Fallback: raw track sync for local rendering
            localStreamRef.current?.getVideoTracks().forEach(t => {
                t.enabled = !nextVideoOff;
            });

            console.info('[SessionRoom] toggle:video:after', {
                nowVideoOff: nextVideoOff,
                localVideoTracks: localStreamRef.current?.getVideoTracks().map(t => ({
                    id: t.id, enabled: t.enabled, readyState: t.readyState,
                })) ?? [],
            });

            return nextVideoOff;
        });
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
                {!hasRemoteParticipants && (
                    <div className="video-placeholder">
                        <Users size={52} />
                        <p>{waitingPlaceholderLabel}</p>
                        {connectionState === 'FAILED' && !isMultiTabBlocked && (
                            <button
                                type="button"
                                className="notes-save-btn"
                                onClick={handleRetryJoin}
                                style={{ marginTop: '0.75rem' }}
                            >
                                Retry connection
                            </button>
                        )}
                    </div>
                )}

                {/* ─── Floating Header ─── */}
                <header className="session-room-header">
                    <div className="session-info">
                        <h2>Therapy Session</h2>
                        <span className="session-status">
                            <span className={`status-dot ${connectionState === 'CONNECTED' ? 'connected' : 'waiting'}`} />
                            {sessionStatusLabel}
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
                                    <span className={`participant-presence-badge ${getPresenceStateTone(localPresenceState)}`}>
                                        {formatPresenceStateLabel(localPresenceState)}
                                    </span>
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
                            {remoteParticipants.map((participant) => {
                                const presenceMatch = presenceParticipants.find((presenceParticipant) => presenceParticipant.userId === participant.sourceParticipantId);
                                const resolvedName = presenceMatch
                                    ? `${presenceMatch.firstName ?? ''} ${presenceMatch.lastName ?? ''}`.trim() || participant.name
                                    : participant.name;
                                const initials = resolvedName
                                    .split(' ')
                                    .map((part) => part[0] ?? '')
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase() || 'P';

                                return (
                                    <div key={participant.id} className="participant-card presence-card">
                                        <div className="participant-item participant-item-compact">
                                            <div className="participant-avatar" style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' }}>{initials}</div>
                                            <div className="participant-info">
                                                <span className="participant-name">{resolvedName}</span>
                                                <span className="participant-role">{formatRoleLabel(presenceMatch?.role ?? 'participant')}</span>
                                            </div>
                                            <span className={`participant-presence-badge ${getPresenceStateTone('CONNECTED')}`}>
                                                Live in room
                                            </span>
                                        </div>

                                        <div className="presence-meta-grid">
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Video</span>
                                                <strong>{participant.hasVideo ? 'On' : 'Off'}</strong>
                                            </div>
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Audio</span>
                                                <strong>{participant.hasAudio ? 'On' : 'Off'}</strong>
                                            </div>
                                            <div className="presence-meta-item">
                                                <span className="presence-meta-label">Joined</span>
                                                <strong>{formatDateTime(new Date(participant.joinedAt).toISOString())}</strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {remoteParticipants.length === 0 && (
                                <div className="presence-panel-state compact">Participants not joined yet.</div>
                            )}

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
                                <span className="info-value">
                                    {connectionState === 'CONNECTED'
                                        ? '🟢 In Progress'
                                        : connectionState === 'RECONNECTING'
                                            ? '🟠 Reconnecting'
                                            : connectionState === 'FAILED'
                                                ? '🔴 Failed'
                                                : '🟡 Waiting'}
                                </span>
                            </div>
                            {connectionState === 'FAILED' && !isMultiTabBlocked && (
                                <div className="info-row">
                                    <span className="info-label">Recovery</span>
                                    <button
                                        type="button"
                                        className="notes-save-btn"
                                        onClick={handleRetryJoin}
                                        style={{ padding: '0.35rem 0.65rem', minWidth: 'auto' }}
                                    >
                                        Retry now
                                    </button>
                                </div>
                            )}
                            {isMultiTabBlocked && (
                                <div className="presence-panel-error">
                                    Another tab is already using this session. Close that tab to continue here.
                                </div>
                            )}
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
