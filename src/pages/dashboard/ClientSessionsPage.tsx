import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, CalendarDays, Users, Video, Clock, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { connectSocket, getSocket } from '../../lib/socket';
import SessionReportPanel from '../../components/session/SessionReportPanel';
import './ClientSessionsPage.css';

interface CalendarSession {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    type: string;
    isGroupSession?: boolean;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
    participants?: Array<{ id: string; firstName: string; lastName: string; email: string }>;
    notes?: string;
}

interface TherapistSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

type CalendarData = Record<string, CalendarSession[]>;

interface SessionCompletedEvent {
    sessionId: string;
    status: 'COMPLETED';
}

const createUtcDate = (year: number, monthIndex: number, day: number) => new Date(Date.UTC(year, monthIndex, day));

const isGroupCalendarSession = (session: CalendarSession) => session.isGroupSession || session.type === 'GROUP_THERAPY';

const getSessionParticipants = (session: CalendarSession) => {
    if (session.participants && session.participants.length > 0) {
        return session.participants;
    }

    return session.client ? [session.client] : [];
};

const formatParticipantNames = (participants: Array<{ firstName: string; lastName: string }>) => {
    const names = participants
        .map((participant) => `${participant.firstName} ${participant.lastName}`.trim())
        .filter(Boolean);

    if (names.length === 0) return 'Participants will appear here';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
};

export default function ClientSessionsPage() {
    const [currentMonth, setCurrentMonth] = useState(() => createUtcDate(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);

    // Therapist sidebar
    const [therapists, setTherapists] = useState<TherapistSummary[]>([]);
    const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
    const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);

    // Popover
    const [popoverDate, setPopoverDate] = useState<Date | null>(null);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

    // AI Report Modal
    const [reportSessionId, setReportSessionId] = useState<string | null>(null);

    const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const monthKey = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    // ── Fetch therapists ──
    useEffect(() => {
        (async () => {
            setIsLoadingTherapists(true);
            try {
                const res = await api.get('/sessions/my-therapists');
                setTherapists(res.data || []);
            } catch {
                setTherapists([]);
            } finally {
                setIsLoadingTherapists(false);
            }
        })();
    }, []);

    // ── Fetch calendar data ──
    const fetchCalendar = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: any = { month: monthKey };
            if (selectedTherapistId) params.therapistId = selectedTherapistId;
            // clientId is auto-set by backend for CLIENT role
            const res = await api.get('/sessions/calendar', { params });
            setCalendarData(res.data || {});
        } catch {
            setCalendarData({});
        } finally {
            setIsLoading(false);
        }
    }, [monthKey, selectedTherapistId]);

    useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

    useEffect(() => {
        const socket = getSocket() ?? connectSocket();
        if (!socket) return;

        const applySessionCompletion = (data: SessionCompletedEvent) => {
            setCalendarData((current) => {
                let changed = false;
                const nextEntries = Object.entries(current).map(([dateKey, sessions]) => {
                    const nextSessions = sessions.map((session) => {
                        if (session.id !== data.sessionId || session.status === 'COMPLETED') {
                            return session;
                        }

                        changed = true;
                        return { ...session, status: 'COMPLETED' };
                    });

                    return [dateKey, nextSessions] as const;
                });

                return changed ? Object.fromEntries(nextEntries) : current;
            });

            void fetchCalendar();
        };

        socket.on('session:completed', applySessionCompletion);

        return () => {
            socket.off('session:completed', applySessionCompletion);
        };
    }, [fetchCalendar]);

    // ── Build calendar grid ──
    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth();
    const firstDay = createUtcDate(year, month, 1).getUTCDay();
    const daysInMonth = createUtcDate(year, month + 1, 0).getUTCDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
    while (calendarDays.length % 7 !== 0) calendarDays.push(null);

    // ── Helpers ──
    const getDateKey = (day: number) =>
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const getStatusClass = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'completed') return 'completed';
        if (s === 'cancelled' || s === 'no_show') return 'cancelled';
        return 'scheduled';
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const hours = d.getUTCHours();
        const minutes = d.getUTCMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm} (UTC)`;
    };

    const formatDateTimeUtc = (iso: string) => new Date(iso).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
    });

    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

    const getInitials = (first: string, last: string) =>
        `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

    // ── Popover ──
    const handleDayClick = (day: number, e: React.MouseEvent) => {
        const dateKey = getDateKey(day);
        const sessions = calendarData[dateKey] || [];
        if (sessions.length === 0) return; // Only open if there are sessions

        const date = createUtcDate(year, month, day);
        if (popoverDate && popoverDate.getUTCDate() === day && popoverDate.getUTCMonth() === month) {
            setPopoverDate(null);
            return;
        }

        const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const popoverW = 340;
        const popoverH = 420;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let top = cellRect.bottom + 4;
        let left = cellRect.left;
        if (left + popoverW > viewportW - 16) left = viewportW - popoverW - 16;
        if (left < 16) left = 16;
        if (top + popoverH > viewportH - 16) top = cellRect.top - popoverH - 4;
        if (top < 16) top = 16;

        setPopoverPos({ top, left });
        setPopoverDate(date);
    };

    return (
        <div className="client-sessions-layout">
            {/* ── Therapist Sidebar ── */}
            <aside className="therapist-sidebar">
                <div className="therapist-sidebar-header">
                    <h4>My Therapists</h4>
                </div>
                <div className="therapist-list">
                    {isLoadingTherapists ? (
                        <div className="therapist-sidebar-empty">
                            <Loader2 size={20} className="client-spin" />
                            <span>Loading...</span>
                        </div>
                    ) : therapists.length === 0 ? (
                        <div className="therapist-sidebar-empty">
                            <Users size={20} />
                            <span>No therapists yet</span>
                        </div>
                    ) : (
                        <>
                            {/* All therapists option */}
                            <div
                                className={`therapist-item all-item ${selectedTherapistId === null ? 'active' : ''}`}
                                onClick={() => setSelectedTherapistId(null)}
                            >
                                <div className="therapist-avatar">
                                    <Users size={14} />
                                </div>
                                <span className="therapist-name">All Therapists</span>
                            </div>

                            {therapists.map(t => (
                                <div
                                    key={t.id}
                                    className={`therapist-item ${selectedTherapistId === t.id ? 'active' : ''}`}
                                    onClick={() => setSelectedTherapistId(t.id)}
                                >
                                    <div className="therapist-avatar">
                                        {getInitials(t.firstName, t.lastName)}
                                    </div>
                                    <span className="therapist-name">{t.firstName} {t.lastName}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </aside>

            {/* ── Calendar Area ── */}
            <div className="client-calendar-area">
                {/* Header */}
                <div className="client-calendar-header">
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(createUtcDate(year, month - 1, 1))}>
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="client-calendar-title">{monthLabel}</h3>
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(createUtcDate(year, month + 1, 1))}>
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Legend */}
                <div className="calendar-legend">
                    <div className="legend-item">
                        <span className="legend-dot scheduled" />
                        Scheduled
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot completed" />
                        Completed
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot cancelled" />
                        Cancelled
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="client-calendar-loading">
                        <Loader2 size={28} className="client-spin" />
                    </div>
                )}

                {/* Grid */}
                <div className="client-calendar-grid">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="client-day-header">{d}</div>
                    ))}

                    {calendarDays.map((day, idx) => {
                        if (day === null) return <div key={idx} className="client-day empty" />;

                        const dateKey = getDateKey(day);
                        const sessions = calendarData[dateKey] || [];
                        const isToday = dateKey === todayStr;
                        const isSelected = popoverDate?.getUTCDate() === day && popoverDate?.getUTCMonth() === month;

                        return (
                            <div
                                key={idx}
                                className={`client-day ${isToday ? 'today' : ''} ${sessions.length > 0 ? 'has-sessions' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={(e) => handleDayClick(day, e)}
                            >
                                <span className="client-day-number">{day}</span>
                                {sessions.length > 0 && (
                                    <>
                                        <div className="client-day-dots">
                                            {sessions.slice(0, 4).map((s, i) => (
                                                <span key={i} className={`client-session-dot ${getStatusClass(s.status)}`} />
                                            ))}
                                            {sessions.length > 4 && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                                                    +{sessions.length - 4}
                                                </span>
                                            )}
                                        </div>
                                        {sessions.length > 0 && (
                                            <span className="client-count-badge">{sessions.length}</span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Popover */}
                {popoverDate && (() => {
                    const dateKey = getDateKey(popoverDate.getUTCDate());
                    const sessions = calendarData[dateKey] || [];
                    return (
                        <div className="client-popover" style={{ top: popoverPos.top, left: popoverPos.left }}>
                            <div className="client-popover-header">
                                <h4>{popoverDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</h4>
                                <button className="client-popover-close" onClick={() => setPopoverDate(null)}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="client-popover-sessions">
                                {sessions.length === 0 ? (
                                    <div className="client-popover-empty">No sessions on this day</div>
                                ) : (
                                    <>
                                        <div className="client-popover-section-title">
                                            <CalendarDays size={12} />
                                            Sessions ({sessions.length})
                                        </div>
                                        {sessions.map(s => (
                                            <div key={s.id} className="client-popover-session" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                                {(() => {
                                                    const isGroup = isGroupCalendarSession(s);
                                                    const participants = getSessionParticipants(s);
                                                    const participantSummary = formatParticipantNames(participants);

                                                    return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span className={`client-popover-dot ${getStatusClass(s.status)}`} />
                                                    <div className="client-popover-info">
                                                        <span className="client-popover-time">
                                                            {formatTime(s.startTime)} – {formatTime(s.endTime)}
                                                        </span>
                                                        <span className="client-popover-meta">
                                                            {formatDateTimeUtc(s.startTime)}
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 999,
                                                                    background: isGroup ? 'var(--primary-50)' : 'var(--gray-100)',
                                                                    color: isGroup ? 'var(--primary-700)' : 'var(--gray-700)',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 700,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.04em',
                                                                }}
                                                            >
                                                                <Users size={11} /> {isGroup ? 'Group Session' : '1:1 Session'}
                                                            </span>
                                                            <span className="client-popover-meta" style={{ margin: 0 }}>
                                                                {s.type.replace(/_/g, ' ')} • {s.therapist.firstName} {s.therapist.lastName}
                                                            </span>
                                                        </div>
                                                        <span className="client-popover-meta" style={{ marginTop: 6 }}>
                                                            {isGroup ? `${participants.length} participants` : 'Assigned participant'} • {participantSummary}
                                                        </span>
                                                        {participants.length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                                {participants.map((participant) => (
                                                                    <span
                                                                        key={participant.id}
                                                                        style={{
                                                                            padding: '4px 8px',
                                                                            borderRadius: 999,
                                                                            background: 'var(--gray-100)',
                                                                            color: 'var(--gray-700)',
                                                                            fontSize: '0.72rem',
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {participant.firstName} {participant.lastName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {(s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && (
                                                            <Link
                                                                to={`/sessions/${s.id}/room`}
                                                                className="client-popover-zoom"
                                                                title="Join Video Session"
                                                            >
                                                                <Video size={12} />
                                                                {s.status === 'IN_PROGRESS' ? 'Rejoin Session' : 'Join Session'}
                                                            </Link>
                                                        )}
                                                        {s.status === 'COMPLETED' && (
                                                            <button
                                                                onClick={() => setReportSessionId(s.id)}
                                                                className="client-popover-zoom"
                                                                style={{ background: 'var(--blue-50)', color: 'var(--blue-600)', border: 'none', cursor: 'pointer', marginTop: 4, width: 'fit-content' }}
                                                            >
                                                                <Sparkles size={12} />
                                                                View AI Report
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className={`client-popover-badge ${getStatusClass(s.status)}`}>
                                                        {s.status.toLowerCase().replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                    );
                                                })()}

                                                {s.status === 'SCHEDULED' && (() => {
                                                    const now = new Date();
                                                    const st = new Date(s.startTime);
                                                    const is24hSent = now > new Date(st.getTime() - 24 * 60 * 60 * 1000);
                                                    const is1hSent = now > new Date(st.getTime() - 60 * 60 * 1000);
                                                    return (
                                                        <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '6px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock size={10} />
                                                                24h: <span style={{ color: is24hSent ? 'var(--green-600)' : 'inherit' }}>{is24hSent ? 'Sent' : 'Queued'}</span>
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock size={10} />
                                                                1h: <span style={{ color: is1hSent ? 'var(--green-600)' : 'inherit' }}>{is1hSent ? 'Sent' : 'Queued'}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* AI Report Modal */}
            {reportSessionId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '90%', maxWidth: '800px', height: '85vh', background: 'white', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <SessionReportPanel sessionId={reportSessionId} onClose={() => setReportSessionId(null)} />
                    </div>
                </div>
            )}
        </div>
    );
}
