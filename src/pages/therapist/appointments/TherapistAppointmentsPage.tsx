import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, CalendarDays, Users, Video, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../../lib/api';
import { connectSocket, getSocket } from '../../../lib/socket';
import { schedulingService } from '../../../services/scheduling.service';
import './TherapistAppointmentsPage.css';
import '../../dashboard/ClientSessionsPage.css'; // Reuse calendar grid base styles

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

interface ClientSummary {
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

    if (names.length === 0) return 'participants';
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

export default function TherapistAppointmentsPage() {
    const [currentMonth, setCurrentMonth] = useState(() => createUtcDate(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);

    // Client sidebar
    const [clients, setClients] = useState<ClientSummary[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    // Popover
    const [popoverDate, setPopoverDate] = useState<Date | null>(null);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

    // Complete modal
    const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
    const [completingAudienceLabel, setCompletingAudienceLabel] = useState('');
    const [completingIsGroup, setCompletingIsGroup] = useState(false);
    const [completionNotes, setCompletionNotes] = useState('');

    const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const monthKey = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    // ── Fetch clients ──
    useEffect(() => {
        (async () => {
            setIsLoadingClients(true);
            try {
                const res = await api.get('/sessions/my-clients');
                setClients(res.data || []);
            } catch {
                setClients([]);
            } finally {
                setIsLoadingClients(false);
            }
        })();
    }, []);

    // ── Fetch calendar data ──
    const fetchCalendar = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: any = { month: monthKey };
            if (selectedClientId) params.clientId = selectedClientId;
            const res = await api.get('/sessions/calendar', { params });
            setCalendarData(res.data || {});
        } catch {
            setCalendarData({});
        } finally {
            setIsLoading(false);
        }
    }, [monthKey, selectedClientId]);

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

            if (completingSessionId === data.sessionId) {
                setCompletingSessionId(null);
                setPopoverDate(null);
            }

            void fetchCalendar();
        };

        socket.on('session:completed', applySessionCompletion);

        return () => {
            socket.off('session:completed', applySessionCompletion);
        };
    }, [completingSessionId, fetchCalendar]);

    useEffect(() => {
        if (!popoverDate && !completingSessionId) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            if (completingSessionId) {
                setCompletingSessionId(null);
                return;
            }

            setPopoverDate(null);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [popoverDate, completingSessionId]);

    // ── Actions ──
    const handleCompleteClick = (session: CalendarSession) => {
        const participants = getSessionParticipants(session);
        const isGroup = isGroupCalendarSession(session);
        setCompletingSessionId(session.id);
        setCompletingAudienceLabel(formatParticipantNames(participants));
        setCompletingIsGroup(isGroup);
        setCompletionNotes('');
    };

    const submitCompletion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!completingSessionId) return;
        try {
            await schedulingService.completeSession(completingSessionId, completionNotes);
            toast.success('Session completed');
            setCompletingSessionId(null);
            setPopoverDate(null);
            fetchCalendar();
        } catch {
            toast.error('Failed to complete session');
        }
    };

    const handleMarkNoShow = async (id: string) => {
        if (!globalThis.confirm('Mark this session as No-Show?')) return;
        try {
            await schedulingService.markNoShow(id);
            toast.success('Marked as No-Show');
            setPopoverDate(null);
            fetchCalendar();
        } catch {
            toast.error('Failed to mark no-show');
        }
    };

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
        if (sessions.length === 0) return;

        const date = createUtcDate(year, month, day);
        if (popoverDate && popoverDate.getUTCDate() === day && popoverDate.getUTCMonth() === month) {
            setPopoverDate(null);
            return;
        }

        const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const popoverW = 380;
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

    let clientSidebarContent: React.ReactNode;
    if (isLoadingClients) {
        clientSidebarContent = (
            <div className="client-sidebar-empty">
                <Loader2 size={20} className="client-spin" />
                <span>Loading...</span>
            </div>
        );
    } else if (clients.length === 0) {
        clientSidebarContent = (
            <div className="client-sidebar-empty">
                <Users size={20} />
                <span>No clients yet</span>
            </div>
        );
    } else {
        clientSidebarContent = (
            <>
                <button
                    type="button"
                    className={`client-item all-item ${selectedClientId === null ? 'active' : ''}`}
                    onClick={() => setSelectedClientId(null)}
                    aria-pressed={selectedClientId === null}
                >
                    <div className="client-avatar">
                        <Users size={14} />
                    </div>
                    <span className="client-item-name">All Clients</span>
                </button>

                {clients.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        className={`client-item ${selectedClientId === c.id ? 'active' : ''}`}
                        onClick={() => setSelectedClientId(c.id)}
                        aria-pressed={selectedClientId === c.id}
                    >
                        <div className="client-avatar">
                            {getInitials(c.firstName, c.lastName)}
                        </div>
                        <span className="client-item-name">{c.firstName} {c.lastName}</span>
                    </button>
                ))}
            </>
        );
    }

    return (
        <div className="therapist-appointments-layout">
            {/* ── Client Sidebar ── */}
            <aside className="client-sidebar">
                <div className="client-sidebar-header">
                    <h4>My Clients</h4>
                </div>
                <div className="client-list">
                    {clientSidebarContent}
                </div>
            </aside>

            {/* ── Calendar Area ── */}
            <div className="therapist-calendar-area">
                <div className="therapist-calendar-header">
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(createUtcDate(year, month - 1, 1))}>
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="therapist-calendar-title">{monthLabel}</h3>
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(createUtcDate(year, month + 1, 1))}>
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Legend */}
                <div className="calendar-legend">
                    <div className="legend-item"><span className="legend-dot scheduled" /><span>Scheduled</span></div>
                    <div className="legend-item"><span className="legend-dot completed" /><span>Completed</span></div>
                    <div className="legend-item"><span className="legend-dot cancelled" /><span>Cancelled</span></div>
                </div>

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
                        const isSelected = popoverDate?.getUTCDate() === day && popoverDate?.getUTCMonth() === month;
                        const date = createUtcDate(year, month, day);
                        const isInteractiveDay = sessions.length > 0;

                        return (
                            <button
                                type="button"
                                key={dateKey}
                                className={`client-day ${isToday ? 'today' : ''} ${sessions.length > 0 ? 'has-sessions' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={(e) => handleDayClick(day, e)}
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
                                        </div>
                                        <span className="client-count-badge">{sessions.length}</span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Popover */}
                {popoverDate && (() => {
                    const dateKey = getDateKey(popoverDate.getUTCDate());
                    const sessions = calendarData[dateKey] || [];
                    return (
                        <div className="client-popover" style={{ top: popoverPos.top, left: popoverPos.left, width: 380 }}>
                            <div className="client-popover-header">
                                <h4>{popoverDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</h4>
                                <button className="client-popover-close" onClick={() => setPopoverDate(null)}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="client-popover-sessions">
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
                                                <span className="client-popover-title">
                                                    {getSessionDisplayTitle(s)}
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
                                                        {s.type.replaceAll('_', ' ')}
                                                    </span>
                                                </div>
                                                <span className="client-popover-meta" style={{ marginTop: 6 }}>
                                                    {isGroup ? `${participants.length} participants` : 'Participant'} • {participantSummary}
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
                                            </div>
                                            <span className={`client-popover-badge ${getStatusClass(s.status)}`}>
                                                {s.status.toLowerCase().replaceAll('_', ' ')}
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

                                        {/* Action buttons for SCHEDULED sessions */}
                                        {(s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && (
                                            <div className="popover-action-row">
                                                <Link to={`/sessions/${s.id}/room`} className="client-popover-zoom" title="Join Video Session">
                                                    <Video size={12} /> {s.status === 'IN_PROGRESS' ? 'Rejoin Session' : 'Join Session'}
                                                </Link>
                                                <button className="popover-action-btn complete" onClick={() => handleCompleteClick(s)}>
                                                    <CheckCircle size={12} /> Complete
                                                </button>
                                                {s.status === 'SCHEDULED' && (
                                                    <button className="popover-action-btn no-show" onClick={() => handleMarkNoShow(s.id)}>
                                                        <XCircle size={12} /> No Show
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* ── Complete modal ── */}
            {completingSessionId && (
                <div className="complete-modal-overlay">
                    <button
                        type="button"
                        className="complete-modal-backdrop"
                        onClick={() => setCompletingSessionId(null)}
                        aria-label="Close complete session dialog"
                    />
                    <section className="complete-modal" aria-label="Complete session dialog">
                        <h3>Complete Session</h3>
                        <p>
                            {completingIsGroup
                                ? `Add group session notes for ${completingAudienceLabel}. Notes remain private to clinical staff.`
                                : `Add session notes for ${completingAudienceLabel}. Notes remain private to clinical staff.`}
                        </p>
                        <form onSubmit={submitCompletion}>
                            <textarea
                                value={completionNotes}
                                onChange={e => setCompletionNotes(e.target.value)}
                                placeholder={"Subjective: ...\nObjective: ...\nAssessment: ...\nPlan: ..."}
                                required
                            />
                            <div className="complete-modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setCompletingSessionId(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-save">
                                    <CheckCircle size={14} /> Save & Complete
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
