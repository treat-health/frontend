import { useState, useEffect } from 'react';
import type { Appointment, CreateAppointmentDto, UserSummary } from '../../services/scheduling.service';
import { schedulingService } from '../../services/scheduling.service';
import { X, Calendar, Clock, User, UserCheck, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import './ScheduleSessionModal.css';

interface ScheduleSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (appointment: Appointment) => void;
}

const APPOINTMENT_TYPES = [
    { value: 'INDIVIDUAL_THERAPY', label: 'Individual Therapy' },
    { value: 'PSYCHIATRIC_EVAL', label: 'Psychiatric Evaluation' },
    { value: 'PSYCHIATRIC_FOLLOWUP', label: 'Psychiatric Follow-up' },
    { value: 'BPS_ASSESSMENT', label: 'BPS Assessment' },
    { value: 'INTAKE_CALL', label: 'Admissions Intake' },
];

export default function ScheduleSessionModal({ isOpen, onClose, onSuccess }: ScheduleSessionModalProps) {
    const [clients, setClients] = useState<UserSummary[]>([]);
    const [therapists, setTherapists] = useState<UserSummary[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // Form State
    const [clientId, setClientId] = useState('');
    const [therapistId, setTherapistId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(50);
    const [type, setType] = useState('INDIVIDUAL_THERAPY');
    const [notes, setNotes] = useState('');

    // Availability State
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
    const [availabilityValid, setAvailabilityValid] = useState<boolean | null>(null);
    const [availabilityReason, setAvailabilityReason] = useState('');

    // Fetch users on mount (or when open)
    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setShowSuccess(false);
            setError(null);
            setAvailabilityValid(null);
        }
    }, [isOpen]);

    // Check availability on debounced fields
    useEffect(() => {
        if (!isOpen || !clientId || !therapistId || !date || !time) {
            setAvailabilityValid(null);
            return;
        }

        const checkAvailability = async () => {
            setIsCheckingAvailability(true);
            setAvailabilityValid(null);
            try {
                const res = await api.get('/sessions/availability', {
                    params: { date, time, duration, clientId, therapistId }
                });
                setAvailabilityValid(res.data.isAvailable);
                setAvailabilityReason(res.data.reason || '');
            } catch (err: any) {
                setAvailabilityValid(false);
                setAvailabilityReason(err?.response?.data?.message || 'Availability check failed');
            } finally {
                setIsCheckingAvailability(false);
            }
        };

        const timeoutId = setTimeout(() => {
            checkAvailability();
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [isOpen, clientId, therapistId, date, time, duration]);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            const [clientList, therapistList] = await Promise.all([
                schedulingService.getUsersByRole('CLIENT'),
                schedulingService.getUsersByRole('THERAPIST'),
            ]);
            setClients(clientList || []);
            setTherapists(therapistList || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load users');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!clientId || !therapistId || !date || !time) {
            setError('Please fill in all required fields');
            return;
        }

        if (availabilityValid === false) {
            setError(availabilityReason || 'Selected time is not available');
            return;
        }

        try {
            setIsSubmitting(true);
            // Construct ISO string
            const scheduledAt = new Date(`${date}T${time}`).toISOString();

            const dto: CreateAppointmentDto = {
                clientId,
                therapistId,
                scheduledAt,
                durationMins: Number(duration),
                type,
                notes,
            };

            const appointment = await schedulingService.createAppointment(dto);

            if (onSuccess) onSuccess(appointment);
            setShowSuccess(true);

            // Close after 2 seconds
            setTimeout(() => {
                onClose();
                resetForm();
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to schedule appointment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setClientId('');
        setTherapistId('');
        setDate('');
        setTime('');
        setDuration(50);
        setType('INDIVIDUAL_THERAPY');
        setNotes('');
        setShowSuccess(false);
        setAvailabilityValid(null);
        setAvailabilityReason('');
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '1000px', maxWidth: '95vw' }}>

                {/* Header */}
                <div className="modal-header" style={{ padding: '0.5rem 1.5rem 0.25rem', alignItems: 'flex-end' }}>
                    <div>
                        <h2 className="modal-title" style={{ lineHeight: '1.2' }}>Schedule New Session</h2>
                        <p className="modal-subtitle" style={{ marginTop: '0' }}>Create an appointment for a client</p>
                    </div>
                    <button onClick={onClose} className="close-button">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body" style={{ padding: '0.5rem 1.5rem' }}>
                    {error && (
                        <div className="error-banner">
                            <AlertCircle size={20} />
                            <div>{error}</div>
                        </div>
                    )}

                    {showSuccess ? (
                        <div className="success-state">
                            <div className="success-icon">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="modal-title">Session Scheduled!</h3>
                            <p className="modal-subtitle">Redirecting...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="form-grid">

                            {/* Row 1: Users */}
                            <div className="form-grid form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Client</label>
                                    <div className="input-wrapper">
                                        <User className="input-icon" size={18} />
                                        <select
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            className={`form-input with-icon ${!clientId ? 'text-gray-500' : ''}`}
                                            required
                                        >
                                            <option value="">Select Client</option>
                                            {clients.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.firstName} {user.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Therapist</label>
                                    <div className="input-wrapper">
                                        <UserCheck className="input-icon" size={18} />
                                        <select
                                            value={therapistId}
                                            onChange={(e) => setTherapistId(e.target.value)}
                                            className={`form-input with-icon ${!therapistId ? 'text-gray-500' : ''}`}
                                            required
                                        >
                                            <option value="">Select Therapist</option>
                                            {therapists.map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.firstName} {user.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Date & Time */}
                            <div className="form-grid form-grid-3">
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <div className="input-wrapper">
                                        <Calendar className="input-icon" size={18} />
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="form-input with-icon"
                                            required
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time</label>
                                    <div className="input-wrapper">
                                        <Clock className="input-icon" size={18} />
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="form-input with-icon"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Duration (mins)</label>
                                    <div className="input-wrapper">
                                        <Clock className="input-icon" size={18} />
                                        <input
                                            type="number"
                                            value={duration}
                                            onChange={(e) => setDuration(Number(e.target.value))}
                                            className="form-input with-icon"
                                            required
                                            min={15}
                                            max={180}
                                            step={5}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Type & Notes */}
                            <div className="form-group">
                                <label className="form-label">Session Type</label>
                                <div className="input-wrapper">
                                    <FileText className="input-icon" size={18} />
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="form-input with-icon"
                                    >
                                        {APPOINTMENT_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Internal Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="form-input"
                                    style={{ minHeight: '100px' }}
                                    placeholder="Add any internal notes about this session..."
                                />
                            </div>

                            {/* Availability Status Indicator */}
                            {(clientId && therapistId && date && time) && (
                                <div style={{
                                    padding: '12px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginTop: '8px',
                                    backgroundColor: isCheckingAvailability ? 'var(--gray-50)' : (availabilityValid ? '#ecfdf5' : '#fef2f2'),
                                    color: isCheckingAvailability ? 'var(--gray-600)' : (availabilityValid ? '#065f46' : '#991b1b'),
                                    border: `1px solid ${isCheckingAvailability ? 'var(--gray-200)' : (availabilityValid ? '#a7f3d0' : '#fecaca')}`
                                }}>
                                    {isCheckingAvailability ? (
                                        <><Loader2 size={16} className="spin" /> Checking availability...</>
                                    ) : availabilityValid ? (
                                        <><CheckCircle size={16} /> Slot is available</>
                                    ) : (
                                        <><AlertCircle size={16} /> {availabilityReason || 'Not available'}</>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="btn btn-cancel"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-submit"
                                    disabled={isSubmitting || isLoadingUsers}
                                >
                                    {isSubmitting ? 'Scheduling...' : isLoadingUsers ? 'Loading...' : 'Create Session'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
