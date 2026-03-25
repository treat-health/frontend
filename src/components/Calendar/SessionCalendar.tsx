import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { connectSocket, getSocket } from '../../lib/socket';
import DailySessionAgenda from './DailySessionAgenda';
import './SessionCalendar.css';

interface SessionCalendarProps {
    clientId: string | null;
    therapistId: string | null;
    refreshSignal?: number;
    readonly?: boolean;
}

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

type CalendarData = Record<string, CalendarSession[]>;

interface SessionCompletedEvent {
    sessionId: string;
    status: 'COMPLETED';
}

const createUtcDate = (year: number, monthIndex: number, day: number) => new Date(Date.UTC(year, monthIndex, day));

const getUtcTodayStart = () => {
    const now = new Date();
    return createUtcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

export default function SessionCalendar({ clientId, therapistId, refreshSignal = 0, readonly = false }: Readonly<SessionCalendarProps>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [currentMonth, setCurrentMonth] = useState(() => createUtcDate(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);

    const [agendaDate, setAgendaDate] = useState<Date | null>(null);

    const isInteractive = !!(clientId || therapistId) && !readonly;

    // ── Month label ──
    const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const monthKey = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`;

    // ── Fetch calendar data ──
    const fetchCalendar = useCallback(async () => {
        setIsLoading(true);
        try {
            // Short-circuit fetch if no filter is applied in admin mode
            if (readonly && !clientId && !therapistId) {
                setCalendarData({});
                return;
            }

            const params: any = { month: monthKey };
            if (clientId) params.clientId = clientId;
            if (therapistId) params.therapistId = therapistId;
            const res = await api.get('/sessions/calendar', { params });
            setCalendarData(res.data || {});
        } catch {
            setCalendarData({});
        } finally {
            setIsLoading(false);
        }
    }, [monthKey, clientId, therapistId, refreshSignal]);

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


    // ── Build calendar days ──
    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth();
    const firstDay = createUtcDate(year, month, 1).getUTCDay();
    const daysInMonth = createUtcDate(year, month + 1, 0).getUTCDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
    while (calendarDays.length % 7 !== 0) calendarDays.push(null);

    // ── Popover positioning ──
    const handleDayClick = (day: number) => {
        if (readonly && !clientId && !therapistId) return;

        const date = createUtcDate(year, month, day);
        setAgendaDate(date);
    };


    // ── Helpers ──
    const getDateKey = (day: number) =>
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const getStatusClass = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'completed') return 'completed';
        if (s === 'cancelled' || s === 'no_show') return 'cancelled';
        return 'scheduled';
    };


    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;


    // ── Render ──
    return (
        <div className="session-calendar-container" ref={containerRef}>
            <div className="calendar-main">
                {/* Header */}
                <div className="calendar-header">
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(createUtcDate(year, month - 1, 1))}>
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="calendar-month-title">{monthLabel}</h3>
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(createUtcDate(year, month + 1, 1))}>
                        <ChevronRight size={18} />
                    </button>
                </div>



                {/* Loading */}
                {isLoading && (
                    <div className="calendar-loading-overlay">
                        <Loader2 size={28} className="spin" />
                    </div>
                )}

                {/* Grid */}
                <div className="calendar-grid">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="calendar-day-header">{d}</div>
                    ))}

                    {calendarDays.map((day, idx) => {
                        if (day === null) return <div key={idx} className="calendar-day empty" />;

                        const dateKey = getDateKey(day);
                        const sessions = calendarData[dateKey] || [];
                        const isToday = dateKey === todayStr;
                        const date = createUtcDate(year, month, day);
                        const utcTodayStart = getUtcTodayStart();
                        const isPast = date.getTime() < utcTodayStart.getTime();
                        const isSelected = agendaDate?.getUTCDate() === day && agendaDate?.getUTCMonth() === month;

                        return (
                            <div
                                key={idx}
                                className={`calendar-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${sessions.length > 0 ? 'has-sessions' : ''} ${!isInteractive ? 'readonly' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleDayClick(day)}
                            >
                                <span className="day-number">{day}</span>
                                {sessions.length > 0 && (
                                    <>
                                        <div className="day-sessions-dots">
                                            {sessions.slice(0, 4).map((s, i) => (
                                                <span key={i} className={`session-dot ${getStatusClass(s.status)}`} />
                                            ))}
                                            {sessions.length > 4 && <span className="more-dots">+{sessions.length - 4}</span>}
                                        </div>
                                        {sessions.length > 0 && (
                                            <span className="session-count-badge">{sessions.length}</span>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>


                {/* Daily Agenda Drawer */}
                {agendaDate && (
                    <DailySessionAgenda 
                        date={agendaDate} 
                        sessions={calendarData[getDateKey(agendaDate.getUTCDate())] || []} 
                        onClose={() => setAgendaDate(null)} 
                    />
                )}
            </div>
        </div>
    );
}
