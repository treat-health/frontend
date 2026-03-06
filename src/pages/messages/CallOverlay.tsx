import { useCallStore } from '../../stores/callStore';
import { useChatStore } from '../../stores/chatStore';
import { Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react';
import './CallOverlay.css';
import { useEffect, useState } from 'react';

/**
 * CallOverlay
 *
 * A floating UI component that renders the current state of a Twilio Voice Call.
 * It reads from `useCallStore` to detect if there's an active/incoming call.
 */
export default function CallOverlay() {
    const {
        status,
        isReceivingCall,
        remoteUserId,
        isMuted,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        error
    } = useCallStore();

    const { conversations } = useChatStore();
    const [durationSeconds, setDurationSeconds] = useState(0);

    // Duration timer for active calls
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (status === 'connected') {
            timer = setInterval(() => {
                setDurationSeconds(prev => prev + 1);
            }, 1000);
        } else {
            setDurationSeconds(0);
        }
        return () => clearInterval(timer);
    }, [status]);

    // Don't render if there's no call activity
    if (status === 'idle') return null;

    // Resolve remote user's name
    let remoteName = 'Unknown User';
    if (remoteUserId) {
        // Find conversation with this user
        const conv = conversations.find(c =>
            c.type === 'DIRECT' &&
            c.participants.some(p => p.user.id === remoteUserId)
        );
        if (conv) {
            const p = conv.participants.find(p => p.user.id === remoteUserId);
            if (p) {
                remoteName = `${p.user.firstName} ${p.user.lastName}`;
            }
        }
    }

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="call-overlay-backdrop">
            <div className={`call-modal ${status}`}>
                {/* Header / Avatar */}
                <div className="call-modal-avatar-wrapper">
                    <div className={`call-modal-avatar ${status === 'calling' || status === 'ringing' ? 'pulse' : ''}`}>
                        <User size={32} />
                    </div>
                </div>

                {/* Text Info */}
                <div className="call-modal-info">
                    <h3 className="call-modal-name">{remoteName}</h3>
                    <p className="call-modal-status">
                        {status === 'ringing' && 'Incoming audio call...'}
                        {status === 'calling' && 'Calling...'}
                        {status === 'connected' && formatDuration(durationSeconds)}
                    </p>
                    {error && (
                        <p className="call-modal-error">{error}</p>
                    )}
                </div>

                {/* Controls */}
                <div className="call-modal-controls">
                    {/* INCOMING CALL (RINGING) */}
                    {status === 'ringing' && isReceivingCall && (
                        <>
                            <button
                                className="call-btn accept-btn"
                                onClick={acceptCall}
                                title="Accept Call"
                            >
                                <Phone size={24} />
                            </button>
                            <button
                                className="call-btn decline-btn"
                                onClick={() => declineCall('Declined by user')}
                                title="Decline Call"
                            >
                                <PhoneOff size={24} />
                            </button>
                        </>
                    )}

                    {/* OUTBOUND CALLING or CONNECTED */}
                    {(status === 'calling' || status === 'connected') && (
                        <>
                            {status === 'connected' && (
                                <button
                                    className={`call-btn mute-btn ${isMuted ? 'muted' : ''}`}
                                    onClick={toggleMute}
                                    title={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                                </button>
                            )}

                            <button
                                className="call-btn hangup-btn"
                                onClick={endCall}
                                title="Hang Up"
                            >
                                <PhoneOff size={24} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
