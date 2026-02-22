import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../lib/socket';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import './SessionRoom.css';

// ICE Servers for NAT Traversal
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

export default function SessionRoom() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    // Media State
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // WebRTC Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // Load Session Details
    useEffect(() => {
        const fetchSession = async () => {
            try {
                if (!id) return;
                // Currently just fetching standard session to ensure it exists and user has access
                const res = await api.get(`/sessions/${id}`);
                if (!res.data.data) throw new Error('Not found');
                setIsLoading(false);
            } catch (error) {
                console.error('Failed to load session:', error);
                toast.error('Session not found or access denied');
                navigate('/dashboard');
            }
        };
        fetchSession();
    }, [id, navigate]);

    // Initialize WebRTC
    useEffect(() => {
        if (!id || !user || isLoading) return;

        const socket = getSocket();
        if (!socket) {
            toast.error('Real-time connection not available.');
            return;
        }

        let isUnmounting = false;

        const initWebRTC = async () => {
            try {
                // 1. Get Local Media
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // 2. Setup RTCPeerConnection
                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerConnectionRef.current = pc;

                // Add local tracks to peer connection
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                // Handle incoming remote stream
                pc.ontrack = (event) => {
                    console.log('Received remote track', event.streams);
                    if (remoteVideoRef.current && event.streams[0]) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setIsConnected(true);
                    }
                };

                // Handle ICE candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('webrtc:ice-candidate', {
                            sessionId: id,
                            candidate: event.candidate
                        });
                    }
                };

                // 3. Setup Socket Listeners
                socket.on('webrtc:user-joined', async ({ userId: remoteUserId, socketId }) => {
                    console.log('User joined room, taking initiative to offer', remoteUserId);
                    // As the "existing" user, create an offer
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        socket.emit('webrtc:offer', {
                            sessionId: id,
                            offer,
                            targetSocketId: socketId
                        });
                    } catch (e) {
                        console.error('Error creating offer', e);
                    }
                });

                socket.on('webrtc:offer', async ({ offer, senderSocketId }) => {
                    console.log('Received offer');
                    if (isUnmounting) return;
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit('webrtc:answer', {
                            sessionId: id,
                            answer,
                            targetSocketId: senderSocketId
                        });
                    } catch (e) {
                        console.error('Error handling offer', e);
                    }
                });

                socket.on('webrtc:answer', async ({ answer }) => {
                    console.log('Received answer');
                    if (isUnmounting) return;
                    try {
                        if (pc.signalingState !== 'stable') {
                            await pc.setRemoteDescription(new RTCSessionDescription(answer));
                        }
                    } catch (e) {
                        console.error('Error handling answer', e);
                    }
                });

                socket.on('webrtc:ice-candidate', async ({ candidate }) => {
                    if (isUnmounting) return;
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('Error adding ice candidate', e);
                    }
                });

                socket.on('webrtc:user-left', () => {
                    toast('The other participant left the room.');
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = null;
                    }
                    setIsConnected(false);
                });

                // 4. Join the signaling room
                socket.emit('webrtc:join', id);

            } catch (error) {
                console.error('Error starting WebRTC:', error);
                toast.error('Could not access camera or microphone.');
            }
        };

        initWebRTC();

        return () => {
            isUnmounting = true;
            socket.emit('webrtc:leave', id);
            socket.off('webrtc:user-joined');
            socket.off('webrtc:offer');
            socket.off('webrtc:answer');
            socket.off('webrtc:ice-candidate');
            socket.off('webrtc:user-left');

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [id, user, isLoading]);

    // Handlers
    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    const handleLeave = () => {
        navigate('/dashboard'); // or redirect back to appointments list
    };

    if (isLoading) {
        return (
            <div className="session-room-loading">
                <Loader2 className="animate-spin" size={48} />
                <p>Preparing secure session environment...</p>
            </div>
        );
    }

    return (
        <div className="session-room-container">
            <header className="session-room-header">
                <div className="session-info">
                    <h2>Therapy Session</h2>
                    <span className="session-status">
                        <span className={`status-dot ${isConnected ? 'connected' : 'waiting'}`}></span>
                        {isConnected ? 'Connected securely' : 'Waiting for others to join...'}
                    </span>
                </div>
                {/* AI / Transcription Status Banner would go here */}
                <div className="session-privacy-banner">
                    <span className="badge">End-to-End Encrypted (P2P)</span>
                </div>
            </header>

            <main className="session-room-main">
                <div className="video-grid">
                    {/* Remote Video (Main) */}
                    <div className="video-wrapper remote-video-wrapper">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="remote-video"
                        />
                        {!isConnected && (
                            <div className="video-placeholder">
                                <Users size={48} />
                                <p>Waiting for participant...</p>
                            </div>
                        )}
                    </div>

                    {/* Local Video (PIP) */}
                    <div className="video-wrapper local-video-wrapper">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`local-video ${isVideoOff ? 'hidden' : ''}`}
                        />
                        {isVideoOff && (
                            <div className="local-video-placeholder">
                                <VideoOff size={24} />
                            </div>
                        )}
                        <span className="local-label">You</span>
                    </div>
                </div>
            </main>

            <footer className="session-room-controls">
                <div className="control-group">
                    <button
                        className={`control-btn ${isMuted ? 'danger' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                        {isMuted ? <MicOff /> : <Mic />}
                    </button>

                    <button
                        className={`control-btn ${isVideoOff ? 'danger' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                    >
                        {isVideoOff ? <VideoOff /> : <Video />}
                    </button>
                </div>

                <div className="control-group">
                    <button
                        className="control-btn leave-btn"
                        onClick={handleLeave}
                        title="Leave Session"
                    >
                        <PhoneOff />
                    </button>
                </div>
            </footer>
        </div>
    );
}
