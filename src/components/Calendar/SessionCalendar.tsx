import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, X, AlertCircle, Loader2, CalendarDays, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import './SessionCalendar.css';

interface SessionCalendarProps {
    clientId: string | null;
    therapistId: string | null;
    onSessionCreated?: () => void;
}

interface CalendarSession {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    type: string;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
    notes?: string;
}

interface AvailableUser {
    id: string;
    firstName: string;
    lastName: string;
}

type CalendarData = Record<string, CalendarSession[]>;

export default function SessionCalendar({ clientId, therapistId, onSessionCreated }: SessionCalendarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarData, setCalendarData] = useState<CalendarData>({});
    const [isLoading, setIsLoading] = useState(false);

    // Popover state
    const [popoverDate, setPopoverDate] = useState<Date | null>(null);
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

    // Form state
    const [formTime, setFormTime] = useState('09:00');
    const [formDuration, setFormDuration] = useState(50);
    const [formType, setFormType] = useState('INDIVIDUAL');
    const [formNotes, setFormNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Dynamic availability state
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
    const [selectedAvailableUserId, setSelectedAvailableUserId] = useState('');
    const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
    const [availabilityError, setAvailabilityError] = useState('');
    // Case 3: pair validation
    const [pairValid, setPairValid] = useState<boolean | null>(null);
    const [pairReason, setPairReason] = useState('');

    const isInteractive = !!(clientId || therapistId);
    const hasBothSelected = !!(clientId && therapistId);

    // ── Month label ──
    const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

    // ── Fetch calendar data ──
    const fetchCalendar = useCallback(async () => {
        setIsLoading(true);
        try {
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
    }, [monthKey, clientId, therapistId]);

    useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

    // ── Fetch availability when time/duration changes ──
    const fetchAvailability = useCallback(async (date: string, time: string, duration: number) => {
        if (!isInteractive) return;

        // Case 3: both selected → pair validation
        if (hasBothSelected) {
            setIsLoadingAvailability(true);
            setPairValid(null);
            setPairReason('');
            try {
                const res = await api.get('/sessions/availability', {
                    params: { date, time, duration, clientId, therapistId }
                });
                setPairValid(res.data.isAvailable);
                setPairReason(res.data.reason || '');
            } catch (err: any) {
                setPairValid(false);
                setPairReason(err?.response?.data?.message || 'Availability check failed');
            } finally {
                setIsLoadingAvailability(false);
            }
            return;
        }

        // Case 1 or 2: fetch available users
        setIsLoadingAvailability(true);
        setAvailableUsers([]);
        setSelectedAvailableUserId('');
        setAvailabilityError('');
        try {
            const params: any = { date, time, duration };
            if (clientId) params.clientId = clientId;
            if (therapistId) params.therapistId = therapistId;
            const res = await api.get('/sessions/availability', { params });
            const users = res.data.availableTherapists || res.data.availableClients || [];
            setAvailableUsers(users);
            if (users.length === 0) {
                setAvailabilityError(clientId ? 'No available therapists at this time' : 'No available clients at this time');
            }
        } catch (err: any) {
            setAvailabilityError(err?.response?.data?.message || 'Failed to load availability');
        } finally {
            setIsLoadingAvailability(false);
        }
    }, [clientId, therapistId, isInteractive, hasBothSelected]);

    // Trigger availability fetch when popover opens and when time/duration change
    useEffect(() => {
        if (!popoverDate || !isInteractive) return;
        const isPast = popoverDate < new Date(new Date().toDateString());
        if (isPast) return;

        const dateStr = `${popoverDate.getFullYear()}-${String(popoverDate.getMonth() + 1).padStart(2, '0')}-${String(popoverDate.getDate()).padStart(2, '0')}`;
        fetchAvailability(dateStr, formTime, formDuration);
    }, [popoverDate, formTime, formDuration, fetchAvailability, isInteractive]);

    // ── Build calendar days ──
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
    while (calendarDays.length % 7 !== 0) calendarDays.push(null);

    // ── Popover positioning ──
    const handleDayClick = (day: number, e: React.MouseEvent) => {
        const cell = e.currentTarget as HTMLElement;
        const date = new Date(year, month, day);

        if (popoverDate && popoverDate.getDate() === day && popoverDate.getMonth() === month) {
            closePopover();
            return;
        }

        const cellRect = cell.getBoundingClientRect();
        const popoverWidth = 360;
        const popoverHeight = 480;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let top = cellRect.bottom + 4;
        let left = cellRect.left;
        if (left + popoverWidth > viewportW - 16) left = viewportW - popoverWidth - 16;
        if (left < 16) left = 16;
        if (top + popoverHeight > viewportH - 16) top = cellRect.top - popoverHeight - 4;
        if (top < 16) top = 16;

        // Reset form state
        setFormTime('09:00');
        setFormDuration(50);
        setFormType('INDIVIDUAL');
        setFormNotes('');
        setFormError('');
        setAvailableUsers([]);
        setSelectedAvailableUserId('');
        setAvailabilityError('');
        setPairValid(null);
        setPairReason('');

        setPopoverPos({ top, left });
        setPopoverDate(date);
    };

    const closePopover = () => {
        setPopoverDate(null);
        setFormError('');
        setAvailableUsers([]);
        setSelectedAvailableUserId('');
        setAvailabilityError('');
        setPairValid(null);
        setPairReason('');
    };

    // ── Submit session ──
    const handleAddSession = async () => {
        if (!popoverDate) return;
        setIsSubmitting(true);
        setFormError('');

        // Determine actual clientId and therapistId for this session
        let finalClientId = clientId || '';
        let finalTherapistId = therapistId || '';

        if (!hasBothSelected) {
            if (clientId && !therapistId) {
                finalTherapistId = selectedAvailableUserId;
            } else if (therapistId && !clientId) {
                finalClientId = selectedAvailableUserId;
            }
        }

        if (!finalClientId || !finalTherapistId) {
            setFormError('Please select both a client and therapist.');
            setIsSubmitting(false);
            return;
        }

        const dateStr = `${popoverDate.getFullYear()}-${String(popoverDate.getMonth() + 1).padStart(2, '0')}-${String(popoverDate.getDate()).padStart(2, '0')}`;
        const startTimeISO = `${dateStr}T${formTime}:00Z`;

        try {
            await api.post('/sessions/schedule', {
                clientId: finalClientId,
                therapistId: finalTherapistId,
                startTime: startTimeISO,
                type: formType,
                notes: formNotes || undefined,
            });

            // Optimistic update — add a dot immediately
            const dateKey = dateStr;
            setCalendarData(prev => {
                const copy = { ...prev };
                if (!copy[dateKey]) copy[dateKey] = [];
                copy[dateKey] = [...copy[dateKey], {
                    id: `temp-${Date.now()}`,
                    status: 'SCHEDULED',
                    startTime: startTimeISO,
                    endTime: startTimeISO,
                    durationMins: formDuration,
                    type: formType,
                    client: { id: finalClientId, firstName: '', lastName: '', email: '' },
                    therapist: { id: finalTherapistId, firstName: '', lastName: '', email: '' },
                }];
                return copy;
            });

            toast.success('Session scheduled!');
            closePopover();
            onSessionCreated?.();
            // Background refetch
            setTimeout(() => fetchCalendar(), 500);
        } catch (err: any) {
            setFormError(err?.response?.data?.message || 'Failed to schedule session.');
        } finally {
            setIsSubmitting(false);
        }
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

    const formatTimeStr = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const canSubmit = (() => {
        if (isSubmitting) return false;
        if (hasBothSelected) return pairValid === true;
        return !!selectedAvailableUserId;
    })();

    // ── Render ──
    return (
        <div className="session-calendar-container" ref={containerRef}>
            <div className="calendar-main">
                {/* Header */}
                <div className="calendar-header">
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="calendar-month-title">{monthLabel}</h3>
                    <button className="calendar-nav-btn" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
                        <ChevronRight size={18} />
                    </button>
                </div>

                {!isInteractive && (
                    <div className="calendar-readonly-notice">
                        <AlertCircle size={16} />
                        <span>Select a client or therapist to schedule sessions</span>
                    </div>
                )}

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
                        const date = new Date(year, month, day);
                        const isPast = date < new Date(new Date().toDateString());
                        const isSelected = popoverDate?.getDate() === day && popoverDate?.getMonth() === month;

                        return (
                            <div
                                key={idx}
                                className={`calendar-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${sessions.length > 0 ? 'has-sessions' : ''} ${!isInteractive ? 'readonly' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={(e) => isInteractive ? handleDayClick(day, e) : undefined}
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

                {/* Popover */}
                {popoverDate && (
                    <div
                        className="calendar-popover"
                        style={{ top: popoverPos.top, left: popoverPos.left }}
                    >
                        <div className="popover-header">
                            <h4>
                                {popoverDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </h4>
                            <button className="popover-close-btn" onClick={closePopover}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Existing sessions */}
                        {(() => {
                            const dateKey = getDateKey(popoverDate.getDate());
                            const sessions = calendarData[dateKey] || [];
                            if (sessions.length === 0) return null;
                            return (
                                <div className="popover-existing">
                                    <div className="popover-section-title">
                                        <CalendarDays size={12} />
                                        Existing Sessions ({sessions.length})
                                    </div>
                                    {sessions.map(s => (
                                        <div key={s.id} className="popover-session-item">
                                            <span className={`popover-session-dot ${getStatusClass(s.status)}`} />
                                            <div className="popover-session-info">
                                                <span className="popover-session-time">
                                                    {formatTimeStr(s.startTime)} – {formatTimeStr(s.endTime)}
                                                </span>
                                                <span className="popover-session-type">
                                                    {s.type.replace(/_/g, ' ')} • {s.client.firstName} {s.client.lastName}
                                                </span>
                                            </div>
                                            <span className={`popover-status ${getStatusClass(s.status)}`}>
                                                {s.status.toLowerCase().replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Form or notices */}
                        {(() => {
                            const isPast = popoverDate < new Date(new Date().toDateString());

                            if (isPast) {
                                return (
                                    <div className="popover-readonly past">
                                        <AlertCircle size={14} />
                                        <span>Cannot schedule sessions on past dates</span>
                                    </div>
                                );
                            }

                            if (!isInteractive) {
                                return (
                                    <div className="popover-readonly">
                                        <AlertCircle size={14} />
                                        <span>Select a client & therapist to schedule</span>
                                    </div>
                                );
                            }

                            return (
                                <div className="popover-form">
                                    <div className="popover-section-title">
                                        <Plus size={12} />
                                        Schedule New Session
                                    </div>

                                    {/* Time */}
                                    <div className="popover-form-row">
                                        <label>Time</label>
                                        <select value={formTime} onChange={e => setFormTime(e.target.value)}>
                                            {Array.from({ length: 40 }, (_, i) => {
                                                const totalMins = 7 * 60 + i * 15;
                                                const h = Math.floor(totalMins / 60);
                                                const m = totalMins % 60;
                                                const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                                return <option key={v} value={v}>{label}</option>;
                                            })}
                                        </select>
                                    </div>

                                    {/* Duration */}
                                    <div className="popover-form-row">
                                        <label>Duration</label>
                                        <select value={formDuration} onChange={e => setFormDuration(parseInt(e.target.value))}>
                                            <option value={30}>30 min</option>
                                            <option value={50}>50 min</option>
                                            <option value={60}>60 min</option>
                                            <option value={90}>90 min</option>
                                        </select>
                                    </div>

                                    {/* Dynamic user selection — Case 1 or 2 */}
                                    {!hasBothSelected && (
                                        <div className="popover-form-row">
                                            <label>{clientId ? 'Available Therapists' : 'Available Clients'}</label>
                                            {isLoadingAvailability ? (
                                                <div className="availability-loading">
                                                    <Loader2 size={14} className="spin" />
                                                    <span>Checking availability…</span>
                                                </div>
                                            ) : availabilityError && availableUsers.length === 0 ? (
                                                <div className="availability-empty">
                                                    <AlertCircle size={14} />
                                                    <span>{availabilityError}</span>
                                                </div>
                                            ) : (
                                                <select
                                                    value={selectedAvailableUserId}
                                                    onChange={e => setSelectedAvailableUserId(e.target.value)}
                                                >
                                                    <option value="">
                                                        {availableUsers.length > 0
                                                            ? `Select ${clientId ? 'therapist' : 'client'} (${availableUsers.length} available)`
                                                            : 'No options available'}
                                                    </option>
                                                    {availableUsers.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.firstName} {u.lastName}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}

                                    {/* Case 3: pair validation indicator */}
                                    {hasBothSelected && (
                                        <div className="popover-form-row">
                                            {isLoadingAvailability ? (
                                                <div className="availability-loading">
                                                    <Loader2 size={14} className="spin" />
                                                    <span>Verifying availability…</span>
                                                </div>
                                            ) : pairValid === true ? (
                                                <div className="availability-valid">
                                                    <CheckCircle2 size={14} />
                                                    <span>Both available at this time</span>
                                                </div>
                                            ) : pairValid === false ? (
                                                <div className="availability-invalid">
                                                    <AlertCircle size={14} />
                                                    <span>{pairReason || 'Not available at this time'}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* Type */}
                                    <div className="popover-form-row">
                                        <label>Session Type</label>
                                        <select value={formType} onChange={e => setFormType(e.target.value)}>
                                            <option value="INDIVIDUAL">Individual</option>
                                            <option value="GROUP">Group</option>
                                            <option value="FAMILY">Family</option>
                                            <option value="ASSESSMENT">Assessment</option>
                                            <option value="FOLLOW_UP">Follow-up</option>
                                        </select>
                                    </div>

                                    {/* Notes */}
                                    <div className="popover-form-row">
                                        <label>Notes (optional)</label>
                                        <textarea
                                            value={formNotes}
                                            onChange={e => setFormNotes(e.target.value)}
                                            placeholder="Session notes..."
                                            rows={2}
                                        />
                                    </div>

                                    {formError && (
                                        <div className="popover-error">
                                            <AlertCircle size={14} />
                                            <span>{formError}</span>
                                        </div>
                                    )}

                                    <button
                                        className="popover-add-btn"
                                        onClick={handleAddSession}
                                        disabled={!canSubmit}
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 size={16} className="spin" /> Scheduling…</>
                                        ) : (
                                            <><Plus size={16} /> Add Session</>
                                        )}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
