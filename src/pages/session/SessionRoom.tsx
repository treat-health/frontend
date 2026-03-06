import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Loader2, PanelRight, X, Info, CheckCircle, Clock, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import * as TwilioVideo from 'twilio-video';
import SessionReportPanel from '../../components/session/SessionReportPanel';
import { useAttentionMonitor } from '../../hooks/useAttentionMonitor';
import './SessionRoom.css';

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

    // Explicit session metadata & waiting room state
    const [sessionDetails, setSessionDetails] = useState<any>(null);
    const [joinState, setJoinState] = useState<'LOADING' | 'WAITING' | 'OPEN' | 'ACKNOWLEDGMENT' | 'JOINING' | 'COMPLETED'>('LOADING');
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [hasAcknowledged, setHasAcknowledged] = useState(false);
    const [aiMonitoringConsent, setAiMonitoringConsent] = useState(false);

    // WebRTC Refs
    const localVideoRef = useRef<HTMLDivElement>(null);
    const remoteVideoRef = useRef<HTMLDivElement>(null);
    const roomRef = useRef<TwilioVideo.Room | null>(null);

    // Load Session Details & Join Twilio Room
    // Fetch explicit Session data first
    useEffect(() => {
        let mounted = true;

        const fetchSessionDetails = async () => {
            try {
                if (!id) return;
                const res = await api.get(`/sessions/${id}`);
                if (mounted) {
                    setSessionDetails(res.data);

                    // Force complete if already marked
                    if (res.data.status === 'COMPLETED' || res.data.status === 'NO_SHOW') {
                        setJoinState('COMPLETED');
                        setIsLoading(false);
                        return;
                    }

                    // Evaluate window: opens 15 minutes before scheduledAt
                    const scheduledAtTime = new Date(res.data.scheduledAt).getTime();
                    const openTime = scheduledAtTime - 15 * 60 * 1000;
                    const now = Date.now();

                    if (now >= openTime) {
                        setJoinState('ACKNOWLEDGMENT');
                    } else {
                        setJoinState('WAITING');
                        setTimeRemaining(Math.max(0, openTime - now));
                    }
                }
            } catch (err: any) {
                if (mounted) {
                    toast.error(err.response?.data?.message || 'Failed to fetch session details');
                    navigate('/dashboard');
                }
            }
        };

        fetchSessionDetails();

        // 1-second interval to update waiting time
        const interval = setInterval(() => {
            setJoinState(curr => {
                if (curr === 'WAITING' && sessionDetails) {
                    const openTime = new Date(sessionDetails.scheduledAt).getTime() - 15 * 60 * 1000;
                    const now = Date.now();
                    if (now >= openTime) return 'ACKNOWLEDGMENT';
                    setTimeRemaining(Math.max(0, openTime - now));
                }
                return curr;
            });
        }, 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [id, navigate, isConnected, joinState]);

    // Listen for AI Report completions remotely
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleTranscriptionReady = (data: { sessionId: string }) => {
            if (data.sessionId === id) {
                toast.success('AI Session Report is ready!', { duration: 5000, icon: '✨' });
                setReportRefreshTrigger(prev => prev + 1);
                // Optionally auto-open the sidebar to the report tab if they are still around
                setIsSidebarOpen(true);
                setSidebarTab('report');
            }
        };

        socket.on('session:transcription_ready', handleTranscriptionReady);
        return () => {
            socket.off('session:transcription_ready', handleTranscriptionReady);
        };
    }, [id]);

    // Role detection & feature gating
    const roleInSession = user?.id === sessionDetails?.clientId ? 'CLIENT' : (user?.id === sessionDetails?.therapistId ? 'THERAPIST' : 'UNKNOWN');
    const isMonitoringEnabled = aiMonitoringConsent && import.meta.env.VITE_SESSION_ATTENTION_MONITORING_ENABLED !== 'false';

    // Hook up attention monitor
    useAttentionMonitor({
        sessionId: id || '',
        room: roomRef.current,
        role: roleInSession,
        enabled: isMonitoringEnabled && !!roomRef.current
    });

    useEffect(() => {
        if (!id || !user || joinState !== 'JOINING') return;

        let isUnmounting = false;

        const initTwilioVideo = async () => {
            if (!id || !user) return;

            try {
                // 1. Get Twilio Access Token from our backend
                const response = await api.post(`/sessions/${id}/twilio-token`);
                const { token, aiMonitoringConsent: consentFromServer } = response.data;
                setAiMonitoringConsent(!!consentFromServer);

                if (isUnmounting) return;

                let room: TwilioVideo.Room;
                try {
                    // Try to connect with both video and audio
                    room = await TwilioVideo.connect(token, {
                        video: { width: 1280, height: 720 },
                        audio: true,
                        name: id // Room name is the session ID
                    });
                } catch (err: any) {
                    // If video fails (e.g. camera in use by phone link), fallback to audio-only
                    if (err.message && (err.message.includes('video source') || err.message.includes('Permission'))) {
                        console.warn("Video connection failed, falling back to audio-only:", err.message);
                        toast.error("Camera unavailable. Joining with audio only.", { duration: 5000 });

                        room = await TwilioVideo.connect(token, {
                            video: false,
                            audio: true,
                            name: id
                        });
                        setIsVideoOff(true);
                    } else {
                        throw err;
                    }
                }

                if (isUnmounting) {
                    room.disconnect();
                    return;
                }

                roomRef.current = room;
                setIsLoading(false);
                setIsConnected(room.participants.size > 0);

                // Ensure the session is marked IN_PROGRESS as a fallback if the webhook is delayed
                api.post(`/sessions/${id}/start`).catch(err => {
                    console.warn("Manual start fallback failed or session already started", err);
                });

                // Helper to attach a remote track
                const attachTrack = (track: TwilioVideo.AudioTrack | TwilioVideo.VideoTrack) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.appendChild(track.attach());
                        setIsConnected(true);
                    }
                };

                // Helper to detach a remote track
                const detachTrack = (track: TwilioVideo.AudioTrack | TwilioVideo.VideoTrack) => {
                    track.detach().forEach((element) => element.remove());
                    // If no one else is in the room, update status
                    if (room.participants.size === 0) {
                        setIsConnected(false);
                    }
                };

                // 4. Attach tracks from participants already in the room
                room.participants.forEach((participant) => {
                    // Handle ALREADY subscribed tracks
                    participant.tracks.forEach((publication) => {
                        if (publication.isSubscribed && publication.track) {
                            attachTrack(publication.track as TwilioVideo.AudioTrack | TwilioVideo.VideoTrack);
                        }
                    });

                    // Listen for this participant adding new tracks later
                    participant.on('trackSubscribed', (track) => {
                        attachTrack(track as TwilioVideo.AudioTrack | TwilioVideo.VideoTrack);
                    });

                    participant.on('trackUnsubscribed', (track) => {
                        detachTrack(track as TwilioVideo.AudioTrack | TwilioVideo.VideoTrack);
                    });

                    participant.on('trackEnabled', (track) => {
                        if (track.kind === 'video' && remoteVideoRef.current) {
                            remoteVideoRef.current.querySelectorAll('video').forEach(v => v.style.opacity = '1');
                        }
                    });

                    participant.on('trackDisabled', (track) => {
                        if (track.kind === 'video' && remoteVideoRef.current) {
                            remoteVideoRef.current.querySelectorAll('video').forEach(v => v.style.opacity = '0');
                        }
                    });
                });

                // 5. Listen for new participants joining
                room.on('participantConnected', (participant) => {
                    toast(`${participant.identity.split('::')[1] || 'Participant'} joined the room`);
                    setIsConnected(true);

                    participant.on('trackSubscribed', (track) => {
                        attachTrack(track as TwilioVideo.AudioTrack | TwilioVideo.VideoTrack);
                    });

                    participant.on('trackUnsubscribed', (track) => {
                        detachTrack(track as TwilioVideo.AudioTrack | TwilioVideo.VideoTrack);
                    });

                    participant.on('trackEnabled', (track) => {
                        if (track.kind === 'video' && remoteVideoRef.current) {
                            remoteVideoRef.current.querySelectorAll('video').forEach(v => v.style.opacity = '1');
                        }
                    });

                    participant.on('trackDisabled', (track) => {
                        if (track.kind === 'video' && remoteVideoRef.current) {
                            remoteVideoRef.current.querySelectorAll('video').forEach(v => {
                                if (v.parentElement !== localVideoRef.current) {
                                    v.style.opacity = '0';
                                }
                            });
                        }
                    });
                });

                // 6. Listen for participants leaving
                room.on('participantDisconnected', (participant) => {
                    toast(`${participant.identity.split('::')[1] || 'Participant'} left the room`);
                    participant.tracks.forEach((publication) => {
                        if (publication.track) {
                            detachTrack(publication.track as TwilioVideo.AudioTrack | TwilioVideo.VideoTrack);
                        }
                    });
                    if (room.participants.size === 0) {
                        setIsConnected(false);
                    }
                });

                // Handle network disconnection and reconnects
                room.on('reconnecting', (error) => {
                    console.log('Reconnecting your connection!', error?.message);
                    toast.loading('Connection lost. Reconnecting...', { id: 'reconnect-toast' });
                });

                room.on('reconnected', () => {
                    toast.success('Reconnected successfully!', { id: 'reconnect-toast' });
                });

                room.on('disconnected', (_disconnectedRoom, error) => {
                    toast.dismiss('reconnect-toast');
                    if (error) {
                        console.error('Disconnected due to error:', error);
                        if (error.code === 53118 || error.code === 20104) {
                            toast.error('Session has expired or ended.');
                            navigate('/dashboard');
                        } else {
                            toast.error('Connection lost permanently. Please refresh to rejoin if within the session window.');
                        }
                    }
                    if (localVideoRef.current) localVideoRef.current.innerHTML = '';
                    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = '';
                    setIsConnected(false);
                    roomRef.current = null; // Important: stops the attention monitor hook
                });

            } catch (err: any) {
                console.error('Failed to join Twilio room:', err);

                // Detailed error messaging for permissions
                if (err.message?.includes('Permission denied')) {
                    toast.error('Browser denied camera/microphone access. Please check your permissions.');
                } else if (err.response?.data?.message) {
                    toast.error(err.response.data.message); // e.g. "Session room is not yet open"
                    navigate('/dashboard');
                } else {
                    toast.error(`Could not connect: ${err.message || 'Unknown error'}`);
                }

                if (!isUnmounting) {
                    setIsLoading(false);
                }
            }
        };

        initTwilioVideo();

        return () => {
            isUnmounting = true;
            if (roomRef.current) {
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        };
    }, [id, user, joinState]);

    // Timeout warning if waiting for > 5 mins -> Only if JOINING (they passed acknowledgment)
    useEffect(() => {
        if (!isLoading && !isConnected && joinState === 'JOINING') {
            const timeout = setTimeout(() => {
                toast("The other participant hasn't joined yet. You can continue waiting, or leave and follow up with them.", {
                    duration: 8000,
                    icon: '⏳'
                });
            }, 5 * 60 * 1000); // 5 minutes

            return () => clearTimeout(timeout);
        }
    }, [isLoading, isConnected, joinState]);

    // Attach local video after DOM mounts (when isLoading changes to false)
    useEffect(() => {
        if (!isLoading && roomRef.current && localVideoRef.current) {
            localVideoRef.current.innerHTML = '';
            roomRef.current.localParticipant.tracks.forEach((publication) => {
                if (publication.track && publication.track.kind === 'video') {
                    const track = publication.track as TwilioVideo.LocalVideoTrack;
                    const videoEl = track.attach();
                    videoEl.style.width = '100%';
                    videoEl.style.height = '100%';
                    videoEl.style.objectFit = 'cover';
                    videoEl.style.transform = 'scaleX(-1)'; // Mirror so it feels natural
                    videoEl.style.display = 'block';
                    localVideoRef.current?.appendChild(videoEl);
                }
            });
        }
    }, [isLoading]);

    // Handlers
    const toggleMute = () => {
        if (roomRef.current?.localParticipant) {
            if (isMuted) {
                roomRef.current.localParticipant.audioTracks.forEach(publication => {
                    publication.track?.enable();
                });
            } else {
                roomRef.current.localParticipant.audioTracks.forEach(publication => {
                    publication.track?.disable();
                });
            }
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (roomRef.current?.localParticipant) {
            if (isVideoOff) {
                roomRef.current.localParticipant.videoTracks.forEach(publication => {
                    publication.track?.enable();
                });
            } else {
                roomRef.current.localParticipant.videoTracks.forEach(publication => {
                    publication.track?.disable();
                });
            }
            setIsVideoOff(!isVideoOff);
        }
    };

    const handleLeave = async () => {
        if (id) {
            try {
                await api.post(`/sessions/${id}/end`);
            } catch (error) {
                console.error("Fallback /end failed:", error);
            }
        }

        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }
        navigate('/dashboard'); // or redirect back to appointments list
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

    if (isLoading && joinState === 'JOINING') {
        return (
            <div className="session-room-loading">
                <Loader2 className="animate-spin" size={48} />
                <p>Preparing secure session environment...</p>
            </div>
        );
    }

    if (joinState === 'COMPLETED') {
        return (
            <div className="session-room-loading" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
                <CheckCircle size={64} style={{ color: 'var(--primary-color)' }} />
                <h2>Session Completed</h2>
                <p>This session has ended and is permanently closed.</p>
                <div style={{ marginTop: '2rem' }}>
                    <button className="btn btn-submit" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
                </div>
            </div>
        );
    }

    if (joinState === 'WAITING' && sessionDetails) {
        const minsLeft = Math.ceil(timeRemaining / 60000);
        return (
            <div className="session-room-loading" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
                <Clock size={48} style={{ color: 'var(--primary-color)' }} />
                <h2>Waiting Room</h2>
                <p>Your session is scheduled for <strong>{new Date(sessionDetails.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>.</p>
                <p>The secure room will open 15 minutes prior. Please wait...</p>
                <div style={{ marginTop: '2rem', padding: '1rem 2rem', background: '#e0f2fe', borderRadius: '8px', color: '#0369a1', fontWeight: 600 }}>
                    Opening in approx. {minsLeft} minute{minsLeft !== 1 ? 's' : ''}
                </div>
            </div>
        );
    }

    if (joinState === 'ACKNOWLEDGMENT') {
        return (
            <div className="session-room-loading">
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
                            onChange={(e) => setHasAcknowledged(e.target.checked)}
                        />
                        <span>I understand and agree</span>
                    </label>

                    <button
                        className="btn btn-submit"
                        disabled={!hasAcknowledged}
                        onClick={() => setJoinState('JOINING')}
                        style={{ width: '100%', marginTop: '1.5rem', opacity: hasAcknowledged ? 1 : 0.6 }}
                    >
                        Join Session
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/dashboard')}
                        style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

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
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                Scheduled {new Date(sessionDetails.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' '}–{' '}
                                {new Date(new Date(sessionDetails.scheduledAt).getTime() + (sessionDetails.durationMins * 60000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        onClick={handleLeave}
                        title="End Session"
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
                                    <span className="participant-role">{user?.role?.replace('_', ' ').toLowerCase()}</span>
                                </div>
                            </div>
                            {roomRef.current && Array.from(roomRef.current.participants.values()).map(p => {
                                const parts = p.identity.split('::');
                                const name = parts.length >= 2 ? parts[1] : 'Other Participant';
                                const role = parts.length >= 3 ? parts[2].replace('_', ' ').toLowerCase() : 'connected';
                                const initials = name.charAt(0).toUpperCase();

                                return (
                                    <div key={p.sid} className="participant-item">
                                        <div className="participant-avatar" style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' }}>{initials}</div>
                                        <div className="participant-info">
                                            <span className="participant-name">{name}</span>
                                            <span className="participant-role">{role}</span>
                                        </div>
                                    </div>
                                );
                            })}
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
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
}
