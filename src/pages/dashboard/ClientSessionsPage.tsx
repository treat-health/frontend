import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, CalendarDays, Users, Video, Clock } from 'lucide-react';
import api from '../../lib/api';
import { connectSocket, getSocket } from '../../lib/socket';
import './ClientSessionsPage.css';

interface CalendarSession {
    id: string;
    title?: string | null;
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

const updateCompletedSessions = (current: CalendarData, sessionId: string): CalendarData => {
    let changed = false;

    const nextEntries = Object.entries(current).map(([dateKey, sessions]) => {
        const nextSessions = sessions.map((session) => {
            if (session.id !== sessionId || session.status === 'COMPLETED') {
                return session;
            }

            changed = true;
            return { ...session, status: 'COMPLETED' };
        });

        return [dateKey, nextSessions] as const;
    });

    return changed ? Object.fromEntries(nextEntries) : current;
};

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

const getSessionDisplayTitle = (session: Pick<CalendarSession, 'title' | 'type'>) =>
    session.title?.trim() || session.type.replaceAll('_', ' ');

const buildDayAriaLabel = (date: Date, sessionCount: number) => {
    const dateLabel = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });

    if (sessionCount === 0) {
        return `${dateLabel}. No sessions scheduled.`;
    }

    return `${dateLabel}. ${sessionCount} session${sessionCount === 1 ? '' : 's'} scheduled. Open sessions list.`;
};

export default function ClientSessionsPage() {
    const [currentMonth, setCurrentMonth] = useState(() => createUtcDate(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);

    // Therapist sidebar
    const [therapists, setTherapists] = useState<TherapistSummary[]>([]);
    const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
    const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);

    // Daily detail drawer
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
            setCalendarData((current) => updateCompletedSessions(current, data.sessionId));

            void fetchCalendar();
        };

        socket.on('session:completed', applySessionCompletion);

        return () => {
            socket.off('session:completed', applySessionCompletion);
        };
    }, [fetchCalendar]);

    useEffect(() => {
        if (!selectedDate) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            setSelectedDate(null);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedDate]);

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

    // ── Daily details drawer ──
    const handleDayClick = (day: number) => {
        const dateKey = getDateKey(day);
        const sessions = calendarData[dateKey] || [];
        if (sessions.length === 0) return; // Only open if there are sessions

        const date = createUtcDate(year, month, day);
        if (selectedDate && selectedDate.getUTCDate() === day && selectedDate.getUTCMonth() === month) {
            setSelectedDate(null);
            return;
        }

        setSelectedDate(date);
    };

    const selectedDateKey = selectedDate
        ? getDateKey(selectedDate.getUTCDate())
        : null;

    const selectedDateSessions = selectedDateKey
        ? [...(calendarData[selectedDateKey] || [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        : [];

    let therapistSidebarContent: React.ReactNode;
    if (isLoadingTherapists) {
        therapistSidebarContent = (
            <div className="therapist-sidebar-empty">
                <Loader2 size={20} className="client-spin" />
                <span>Loading...</span>
            </div>
        );
    } else if (therapists.length === 0) {
        therapistSidebarContent = (
            <div className="therapist-sidebar-empty">
                <Users size={20} />
                <span>No therapists yet</span>
            </div>
        );
    } else {
        therapistSidebarContent = (
            <>
                <button
                    type="button"
                    className={`therapist-item all-item ${selectedTherapistId === null ? 'active' : ''}`}
                    onClick={() => setSelectedTherapistId(null)}
                    aria-pressed={selectedTherapistId === null}
                >
                    <div className="therapist-avatar">
                        <Users size={14} />
                    </div>
                    <span className="therapist-name">All Therapists</span>
                </button>

                {therapists.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`therapist-item ${selectedTherapistId === t.id ? 'active' : ''}`}
                        onClick={() => setSelectedTherapistId(t.id)}
                        aria-pressed={selectedTherapistId === t.id}
                    >
                        <div className="therapist-avatar">
                            {getInitials(t.firstName, t.lastName)}
                        </div>
                        <span className="therapist-name">{t.firstName} {t.lastName}</span>
                    </button>
                ))}
            </>
        );
    }

    return (
        <div className="client-sessions-layout">
            {/* ── Therapist Sidebar ── */}
            <aside className="therapist-sidebar">
                <div className="therapist-sidebar-header">
                    <h4>My Therapists</h4>
                </div>
                <div className="therapist-list">
                    {therapistSidebarContent}
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
                        <span>Scheduled</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot completed" />
                        <span>Completed</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot cancelled" />
                        <span>Cancelled</span>
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
                        if (day === null) return <div key={`empty-${year}-${month}-${idx}`} className="client-day empty" />;

                        const dateKey = getDateKey(day);
                        const sessions = calendarData[dateKey] || [];
                        const isToday = dateKey === todayStr;
                        const isSelected = selectedDate?.getUTCDate() === day && selectedDate?.getUTCMonth() === month;
                        const date = createUtcDate(year, month, day);
                        const isInteractiveDay = sessions.length > 0;

                        return (
                            <button
                                type="button"
                                key={dateKey}
                                className={`client-day ${isToday ? 'today' : ''} ${sessions.length > 0 ? 'has-sessions' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleDayClick(day)}
                                disabled={!isInteractiveDay}
                                aria-pressed={isSelected}
                                aria-label={buildDayAriaLabel(date, sessions.length)}
                            >
                                <span className="client-day-number">{day}</span>
                                {sessions.length > 0 && (
                                    <>
                                        <div className="client-day-dots">
                                            {sessions.slice(0, 4).map((s, i) => (
                                                <span key={`${s.id}-${i}`} className={`client-session-dot ${getStatusClass(s.status)}`} />
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
                            </button>
                        );
                    })}
                </div>

                {selectedDate && (
                    <div className="client-agenda-overlay">
                        <button
                            type="button"
                            className="client-agenda-backdrop"
                            onClick={() => setSelectedDate(null)}
                            aria-label="Close session details"
                        />
                        <section className="client-agenda-drawer animate-slide-in-right" aria-label="Session details for selected day">
                            <div className="client-agenda-header">
                                <div>
                                    <h2>Session Details</h2>
                                    <p>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
                                </div>
                                <button className="client-agenda-close btn-icon" onClick={() => setSelectedDate(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="client-agenda-body">
                                <div className="client-agenda-section-title">
                                    <CalendarDays size={14} />
                                    Sessions ({selectedDateSessions.length})
                                </div>

                                <div className="client-agenda-list">
                                    {selectedDateSessions.map((s) => {
                                        const isGroup = isGroupCalendarSession(s);
                                        const participants = getSessionParticipants(s);
                                        const participantSummary = formatParticipantNames(participants);
                                        const visibleParticipants = participants.slice(0, 3);
                                        const extraParticipants = Math.max(participants.length - visibleParticipants.length, 0);

                                        return (
                                            <article key={s.id} className="client-agenda-card">
                                                <div className="client-agenda-card-time">
                                                    <Clock size={14} />
                                                    <span>{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                                                </div>

                                                <div className="client-agenda-card-top">
                                                    <div className="client-agenda-card-title-wrap">
                                                        <h3 className="client-agenda-card-title">{getSessionDisplayTitle(s)}</h3>
                                                        <p className="client-agenda-card-meta">
                                                            {s.type.replaceAll('_', ' ')} • {s.therapist.firstName} {s.therapist.lastName}
                                                        </p>
                                                    </div>
                                                    <span className={`client-agenda-status ${getStatusClass(s.status)}`}>
                                                        {s.status.toLowerCase().replaceAll('_', ' ')}
                                                    </span>
                                                </div>

                                                <div className="client-agenda-card-tags">
                                                    <span className={`client-agenda-tag ${isGroup ? 'group' : 'individual'}`}>
                                                        <Users size={12} />
                                                        {isGroup ? 'Group Session' : '1:1 Session'}
                                                    </span>
                                                    <span className="client-agenda-card-meta subtle">{formatDateTimeUtc(s.startTime)}</span>
                                                </div>

                                                <p className="client-agenda-summary">
                                                    {isGroup ? `${participants.length} participants` : 'Assigned participant'} • {participantSummary}
                                                </p>

                                                {visibleParticipants.length > 0 && (
                                                    <div className="client-agenda-participants">
                                                        {visibleParticipants.map((participant) => (
                                                            <span key={participant.id} className="client-agenda-participant-chip">
                                                                {participant.firstName} {participant.lastName}
                                                            </span>
                                                        ))}
                                                        {extraParticipants > 0 && (
                                                            <span className="client-agenda-participant-chip muted">+{extraParticipants} more</span>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="client-agenda-actions">
                                                    {(s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && (
                                                        <Link
                                                            to={`/sessions/${s.id}/room`}
                                                            className="client-agenda-action primary"
                                                            title="Join Video Session"
                                                        >
                                                            <Video size={14} />
                                                            {s.status === 'IN_PROGRESS' ? 'Rejoin Session' : 'Join Session'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
