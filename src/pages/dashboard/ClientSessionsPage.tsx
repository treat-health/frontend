import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, CalendarDays, Users, Video, Clock } from 'lucide-react';
import api from '../../lib/api';
import './ClientSessionsPage.css';

interface CalendarSession {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    type: string;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
    zoomJoinUrl?: string;
    notes?: string;
}

interface TherapistSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

type CalendarData = Record<string, CalendarSession[]>;

export default function ClientSessionsPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);

    // Therapist sidebar
    const [therapists, setTherapists] = useState<TherapistSummary[]>([]);
    const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
    const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);

    // Popover
    const [popoverDate, setPopoverDate] = useState<Date | null>(null);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

    const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

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

    // ── Build calendar grid ──
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

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

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const getInitials = (first: string, last: string) =>
        `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

    // ── Popover ──
    const handleDayClick = (day: number, e: React.MouseEvent) => {
        const dateKey = getDateKey(day);
        const sessions = calendarData[dateKey] || [];
        if (sessions.length === 0) return; // Only open if there are sessions

        const date = new Date(year, month, day);
        if (popoverDate && popoverDate.getDate() === day && popoverDate.getMonth() === month) {
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
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="client-calendar-title">{monthLabel}</h3>
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
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
                        const isSelected = popoverDate?.getDate() === day && popoverDate?.getMonth() === month;

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
                    const dateKey = getDateKey(popoverDate.getDate());
                    const sessions = calendarData[dateKey] || [];
                    return (
                        <div className="client-popover" style={{ top: popoverPos.top, left: popoverPos.left }}>
                            <div className="client-popover-header">
                                <h4>{popoverDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span className={`client-popover-dot ${getStatusClass(s.status)}`} />
                                                    <div className="client-popover-info">
                                                        <span className="client-popover-time">
                                                            {formatTime(s.startTime)} – {formatTime(s.endTime)}
                                                        </span>
                                                        <span className="client-popover-meta">
                                                            {s.type.replace(/_/g, ' ')} • {s.therapist.firstName} {s.therapist.lastName}
                                                        </span>
                                                        {s.zoomJoinUrl && (
                                                            <Link
                                                                to={`/sessions/${s.id}/room`}
                                                                className="client-popover-zoom"
                                                                title="Join Video Session"
                                                            >
                                                                <Video size={12} />
                                                                Join Session
                                                            </Link>
                                                        )}
                                                    </div>
                                                    <span className={`client-popover-badge ${getStatusClass(s.status)}`}>
                                                        {s.status.toLowerCase().replace(/_/g, ' ')}
                                                    </span>
                                                </div>

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
        </div>
    );
}
