import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, CalendarDays, Users, Video, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../../lib/api';
import { schedulingService } from '../../../services/scheduling.service';
import './TherapistAppointmentsPage.css';
import '../../dashboard/ClientSessionsPage.css'; // Reuse calendar grid base styles

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

interface ClientSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

type CalendarData = Record<string, CalendarSession[]>;

export default function TherapistAppointmentsPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
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
    const [completingClientName, setCompletingClientName] = useState('');
    const [completionNotes, setCompletionNotes] = useState('');

    const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

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

    // ── Actions ──
    const handleCompleteClick = (session: CalendarSession) => {
        setCompletingSessionId(session.id);
        setCompletingClientName(`${session.client.firstName} ${session.client.lastName}`);
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
        if (!window.confirm('Mark this session as No-Show?')) return;
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
        if (sessions.length === 0) return;

        const date = new Date(year, month, day);
        if (popoverDate && popoverDate.getDate() === day && popoverDate.getMonth() === month) {
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

    return (
        <div className="therapist-appointments-layout">
            {/* ── Client Sidebar ── */}
            <aside className="client-sidebar">
                <div className="client-sidebar-header">
                    <h4>My Clients</h4>
                </div>
                <div className="client-list">
                    {isLoadingClients ? (
                        <div className="client-sidebar-empty">
                            <Loader2 size={20} className="client-spin" />
                            <span>Loading...</span>
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="client-sidebar-empty">
                            <Users size={20} />
                            <span>No clients yet</span>
                        </div>
                    ) : (
                        <>
                            <div
                                className={`client-item all-item ${selectedClientId === null ? 'active' : ''}`}
                                onClick={() => setSelectedClientId(null)}
                            >
                                <div className="client-avatar">
                                    <Users size={14} />
                                </div>
                                <span className="client-item-name">All Clients</span>
                            </div>

                            {clients.map(c => (
                                <div
                                    key={c.id}
                                    className={`client-item ${selectedClientId === c.id ? 'active' : ''}`}
                                    onClick={() => setSelectedClientId(c.id)}
                                >
                                    <div className="client-avatar">
                                        {getInitials(c.firstName, c.lastName)}
                                    </div>
                                    <span className="client-item-name">{c.firstName} {c.lastName}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </aside>

            {/* ── Calendar Area ── */}
            <div className="therapist-calendar-area">
                <div className="therapist-calendar-header">
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="therapist-calendar-title">{monthLabel}</h3>
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Legend */}
                <div className="calendar-legend">
                    <div className="legend-item"><span className="legend-dot scheduled" /> Scheduled</div>
                    <div className="legend-item"><span className="legend-dot completed" /> Completed</div>
                    <div className="legend-item"><span className="legend-dot cancelled" /> Cancelled</div>
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
                                        </div>
                                        <span className="client-count-badge">{sessions.length}</span>
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
                        <div className="client-popover" style={{ top: popoverPos.top, left: popoverPos.left, width: 380 }}>
                            <div className="client-popover-header">
                                <h4>{popoverDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className={`client-popover-dot ${getStatusClass(s.status)}`} />
                                            <div className="client-popover-info">
                                                <span className="client-popover-time">
                                                    {formatTime(s.startTime)} – {formatTime(s.endTime)}
                                                </span>
                                                <span className="client-popover-meta">
                                                    {s.client.firstName} {s.client.lastName} • {s.type.replace(/_/g, ' ')}
                                                </span>
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

                                        {/* Action buttons for SCHEDULED sessions */}
                                        {s.status === 'SCHEDULED' && (
                                            <div className="popover-action-row">
                                                {s.zoomJoinUrl && (
                                                    <Link to={`/sessions/${s.id}/room`} className="client-popover-zoom" title="Join Video Session">
                                                        <Video size={12} /> Join Session
                                                    </Link>
                                                )}
                                                <button className="popover-action-btn complete" onClick={() => handleCompleteClick(s)}>
                                                    <CheckCircle size={12} /> Complete
                                                </button>
                                                <button className="popover-action-btn no-show" onClick={() => handleMarkNoShow(s.id)}>
                                                    <XCircle size={12} /> No Show
                                                </button>
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
                <div className="complete-modal-overlay" onClick={() => setCompletingSessionId(null)}>
                    <div className="complete-modal" onClick={e => e.stopPropagation()}>
                        <h3>Complete Session</h3>
                        <p>Add session notes for {completingClientName}. Notes are private to clinical staff.</p>
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
                    </div>
                </div>
            )}
        </div>
    );
}
