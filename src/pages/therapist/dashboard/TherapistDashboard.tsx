import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { schedulingService } from '../../../services/scheduling.service';
import type { Appointment } from '../../../services/scheduling.service';
import { Calendar, CheckCircle, XCircle, Clock, Video, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import './TherapistDashboard.css';

const ROOM_OPEN_EARLY_MINUTES = 15;
const ROOM_REJOIN_GRACE_MINUTES = 0;

function parseSessionDate(value: string) {
    const trimmedValue = value.trim();

    if (/z$/i.test(trimmedValue) || /[+-]\d{2}:\d{2}$/.test(trimmedValue)) {
        return new Date(trimmedValue);
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmedValue)) {
        return new Date(trimmedValue.replace(' ', 'T') + 'Z');
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmedValue)) {
        return new Date(`${trimmedValue}Z`);
    }

    return new Date(trimmedValue);
}

function getJoinAvailability(appointment: Appointment, nowMs = Date.now()) {
    const terminalStates = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (terminalStates.includes(appointment.status)) {
        return { canJoin: false, reason: 'Session is closed' };
    }

    const startMs = parseSessionDate(appointment.scheduledAt).getTime();
    const endMs = startMs + appointment.durationMins * 60 * 1000;
    const joinOpensMs = startMs - ROOM_OPEN_EARLY_MINUTES * 60 * 1000;
    const joinClosesMs = endMs + ROOM_REJOIN_GRACE_MINUTES * 60 * 1000;

    if (nowMs < joinOpensMs) {
        return {
            canJoin: false,
            reason: `Opens at ${new Date(joinOpensMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        };
    }

    if (nowMs > joinClosesMs) {
        return { canJoin: false, reason: 'Session window closed' };
    }

    return { canJoin: true, reason: '' };
}

export default function TherapistDashboard() {
    const { user } = useAuthStore();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [notes, setNotes] = useState('');
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

    useEffect(() => {
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        try {
            setIsLoading(true);
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);

            const schedule = await schedulingService.getTherapistSchedule(
                today.toISOString(),
                nextWeek.toISOString()
            );

            // Sort by date
            const sortedSchedule = [...schedule];
            sortedSchedule.sort((a: Appointment, b: Appointment) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            setAppointments(sortedSchedule);
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
            toast.error('Failed to load schedule');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteClick = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setNotes('');
        setIsCompleteModalOpen(true);
    };

    const handleMarkNoShow = async (id: string) => {
        if (!globalThis.confirm('Are you sure you want to mark this session as a No-Show?')) return;

        try {
            await schedulingService.markNoShow(id);
            toast.success('Session marked as No-Show');
            fetchSchedule();
        } catch (error) {
            console.error('Failed to mark no-show:', error);
            toast.error('Failed to update session');
        }
    };

    const submitCompletion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAppointment) return;

        try {
            await schedulingService.completeSession(selectedAppointment.id, notes);
            toast.success('Session completed successfully');
            setIsCompleteModalOpen(false);
            fetchSchedule();
        } catch (error) {
            console.error('Failed to complete session:', error);
            toast.error('Failed to complete session');
        }
    };

    const formatDateTimeLocal = (iso: string) => {
        return parseSessionDate(iso).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        });
    };

    const formatDateTimeUtc = (iso: string) => {
        return parseSessionDate(iso).toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
            timeZoneName: 'short',
        });
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return 'status-scheduled';
            case 'COMPLETED': return 'status-completed';
            case 'CANCELLED': return 'status-cancelled';
            default: return 'status-default';
        }
    };

    let appointmentContent: ReactNode;
    if (isLoading) {
        appointmentContent = <div className="empty-state">Loading schedule...</div>;
    } else if (appointments.length === 0) {
        appointmentContent = (
            <div className="empty-state">
                <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                <p>No appointments scheduled for the next 7 days.</p>
            </div>
        );
    } else {
        appointmentContent = appointments.map((apt) => {
            const joinAvailability = getJoinAvailability(apt);
            return (
                <div key={apt.id} className="appointment-item">
                    <div className="appointment-content">
                        {/* Info */}
                        <div className="appointment-info">
                            <div className="status-row">
                                <span className={`status-badge ${getStatusClass(apt.status)}`}>
                                    {apt.status}
                                </span>
                                <span className="duration-badge">
                                    <Clock size={14} />
                                    {apt.durationMins} mins
                                </span>
                            </div>
                            <h3 className="client-name">
                                {apt.client.firstName} {apt.client.lastName}
                            </h3>
                            <div className="session-details">
                                <span>{formatDateTimeLocal(apt.scheduledAt)}</span>
                                <span className="dot-separator">•</span>
                                <span className="session-utc">{formatDateTimeUtc(apt.scheduledAt)}</span>
                                <span className="dot-separator">•</span>
                                <span>{apt.type.replaceAll('_', ' ')}</span>
                            </div>
                            {apt.notes && (
                                <div className="notes-preview">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                                        <FileText size={14} /> Notes:
                                    </div>
                                    {apt.notes}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="appointment-actions">
                            {(apt.status === 'SCHEDULED' || apt.status === 'IN_PROGRESS') && (
                                <>
                                    {joinAvailability.canJoin ? (
                                        <Link
                                            to={`/sessions/${apt.id}/room`}
                                            className="btn-zoom"
                                            title="Join Video Session"
                                        >
                                            <Video size={20} />
                                            Join Session
                                        </Link>
                                    ) : (
                                        <span className="btn-zoom btn-zoom-disabled" title={joinAvailability.reason}>
                                            <Video size={20} />
                                            {joinAvailability.reason}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleCompleteClick(apt)}
                                        className="btn-primary-action btn-icon"
                                    >
                                        <CheckCircle size={16} />
                                        Complete
                                    </button>
                                    <button
                                        onClick={() => handleMarkNoShow(apt.id)}
                                        className="btn-danger-outline btn-icon"
                                    >
                                        <XCircle size={16} />
                                        No Show
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );
        });
    }

    return (
        <div className="therapist-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <h1 className="dashboard-title">Therapist Dashboard</h1>
                <p className="dashboard-subtitle">Welcome back, Dr. {user?.lastName}</p>
            </div>

            {/* Schedule Section */}
            <div className="schedule-card">
                <div className="schedule-header">
                    <h2 className="schedule-title">
                        <Calendar className="text-primary" size={20} />
                        Upcoming Schedule
                    </h2>
                    <button onClick={fetchSchedule} className="refresh-btn">
                        Refresh
                    </button>
                </div>

                <div className="appointment-list">
                    {appointmentContent}
                </div>
            </div>

            {/* Complete Session Modal */}
            {isCompleteModalOpen && selectedAppointment && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 className="modal-title">Complete Session</h3>
                        <p className="modal-subtitle">
                            Add session notes for {selectedAppointment.client.firstName} {selectedAppointment.client.lastName}.
                            These notes are private to clinical staff.
                        </p>

                        <form onSubmit={submitCompletion}>
                            <div className="form-group-modal">
                                <label htmlFor="session-notes" className="form-label-modal">
                                    Session Notes (SOAP Format Recommended)
                                </label>
                                <textarea
                                    id="session-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="notes-textarea"
                                    placeholder="Subjective: ...&#10;Objective: ...&#10;Assessment: ...&#10;Plan: ..."
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setIsCompleteModalOpen(false)}
                                    className="btn-cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-confirm"
                                >
                                    <CheckCircle size={16} />
                                    Save & Complete
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
