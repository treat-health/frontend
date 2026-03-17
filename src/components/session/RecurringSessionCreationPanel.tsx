import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import { adminSessionService, type AdminBulkScheduleType } from '../../services/admin-session.service';
import './RecurringSessionCreationPanel.css';

interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface Props {
    onSuccess: () => void;
}

const weekdayOptions = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
];

const defaultWeeklyDays = [1, 2, 3, 4, 5];

const toInputDate = (value: Date) => {
    const yyyy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(value.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getInitialDateRange = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
};

export default function RecurringSessionCreationPanel({ onSuccess }: Readonly<Props>) {
    const [clients, setClients] = useState<UserSummary[]>([]);
    const [therapists, setTherapists] = useState<UserSummary[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);
    const [clientPage, setClientPage] = useState(1);
    const [clientLimit, setClientLimit] = useState(20);
    const [clientTotalPages, setClientTotalPages] = useState(1);

    const initialRange = useMemo(getInitialDateRange, []);

    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [therapistId, setTherapistId] = useState('');
    const [scheduleType, setScheduleType] = useState<AdminBulkScheduleType>('MONTHLY');
    const [startTimeUTC, setStartTimeUTC] = useState('20:30');
    const [endTimeUTC, setEndTimeUTC] = useState('21:30');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>(defaultWeeklyDays);
    const [startDate, setStartDate] = useState(toInputDate(initialRange.start));
    const [endDate, setEndDate] = useState(toInputDate(initialRange.end));

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const loadTherapists = async () => {
            setIsLoadingTherapists(true);
            try {
                const therapistsRes = await api.get('/users/by-role/THERAPIST');
                setTherapists(therapistsRes.data?.data || []);
            } catch {
                setErrorMessage('Unable to load therapists. Please try again.');
            } finally {
                setIsLoadingTherapists(false);
            }
        };

        void loadTherapists();
    }, []);

    useEffect(() => {
        const loadClients = async () => {
            setIsLoadingClients(true);
            try {
                const clientsRes = await api.get('/users', {
                    params: {
                        role: 'CLIENT',
                        limit: clientLimit,
                        page: clientPage,
                        sortBy: 'firstName',
                        sortOrder: 'asc',
                    },
                });

                const users = clientsRes.data?.data?.users || [];
                const totalPages = clientsRes.data?.data?.pagination?.totalPages || 1;

                setClients(users);
                setClientTotalPages(totalPages);
            } catch {
                setErrorMessage('Unable to load clients. Please try again.');
            } finally {
                setIsLoadingClients(false);
            }
        };

        void loadClients();
    }, [clientPage, clientLimit]);

    const isLoadingLookups = isLoadingTherapists || (isLoadingClients && clients.length === 0);

    const toggleClient = (clientId: string) => {
        setSelectedClientIds((current) =>
            current.includes(clientId)
                ? current.filter((id) => id !== clientId)
                : [...current, clientId]
        );
    };

    const toggleWeekday = (dayValue: number) => {
        setDaysOfWeek((current) =>
            current.includes(dayValue)
                ? current.filter((value) => value !== dayValue)
                : [...current, dayValue].sort((a, b) => a - b)
        );
    };

    const validateForm = () => {
        if (selectedClientIds.length === 0) {
            return 'Please select at least one client.';
        }
        if (!therapistId) {
            return 'Please select a therapist.';
        }
        if (startTimeUTC >= endTimeUTC) {
            return 'End time must be later than start time.';
        }

        if (scheduleType === 'MONTHLY' && daysOfWeek.length === 0) {
            return 'Please select at least one weekday for monthly recurrence.';
        }

        if (scheduleType === 'WEEKLY') {
            if (!startDate || !endDate) {
                return 'Please provide start and end dates.';
            }
            if (new Date(startDate) > new Date(endDate)) {
                return 'Start date must be before or equal to end date.';
            }
        }

        return null;
    };

    const handleSubmit = async () => {
        setErrorMessage('');
        const validationError = validateForm();
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                clientIds: selectedClientIds,
                therapistId,
                scheduleType,
                startTimeUTC,
                endTimeUTC,
                ...(scheduleType === 'MONTHLY' ? { daysOfWeek } : {}),
                ...(scheduleType === 'WEEKLY' ? { startDate, endDate } : {}),
            };

            const result = await adminSessionService.bulkCreateSessions(payload);

            if (!result.success) {
                const topError = result.validationErrors?.[0]?.message || 'Bulk scheduling failed.';
                setErrorMessage(topError);
                return;
            }

            toast.success('Sessions successfully scheduled');
            onSuccess();
        } catch (error: any) {
            const serverValidationError = error?.response?.data?.data?.validationErrors?.[0]?.message;
            const message = serverValidationError || error?.response?.data?.message || error?.message || 'Failed to schedule recurring sessions.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderClientList = () => {
        if (isLoadingClients) {
            return (
                <div className="recurring-client-loading">
                    <Loader2 size={16} className="spin" />
                    <span>Loading clients…</span>
                </div>
            );
        }

        if (clients.length === 0) {
            return (
                <div className="recurring-client-loading">
                    <span>No clients found.</span>
                </div>
            );
        }

        return clients.map((client) => (
            <label key={client.id} className="client-checkbox-row">
                <input
                    type="checkbox"
                    checked={selectedClientIds.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                />
                <span>
                    {client.firstName} {client.lastName}
                    <small>{client.email}</small>
                </span>
            </label>
        ));
    };

    return (
        <div className="recurring-panel">
            <div className="recurring-panel-header">
                <div>
                    <h2>Recurring Session Creation</h2>
                    <p>Create recurring sessions for multiple clients in one workflow.</p>
                </div>
                <div className="recurring-panel-badge">
                    <CalendarDays size={14} /> Enterprise Scheduling
                </div>
            </div>

            {isLoadingLookups ? (
                <div className="recurring-loading">
                    <Loader2 size={18} className="spin" />
                    <span>Loading clients and therapists…</span>
                </div>
            ) : (
                <div className="recurring-form-grid">
                    <div className="recurring-card">
                        <div className="recurring-client-header">
                            <h3>1) Client Multi-Select</h3>
                            <div className="recurring-client-limit-wrap">
                                <label htmlFor="recurring-client-limit">Limit</label>
                                <select
                                    id="recurring-client-limit"
                                    value={clientLimit}
                                    onChange={(e) => {
                                        setClientLimit(Number(e.target.value));
                                        setClientPage(1);
                                    }}
                                    className="recurring-client-limit"
                                >
                                    <option value={10}>10 / page</option>
                                    <option value={20}>20 / page</option>
                                    <option value={50}>50 / page</option>
                                </select>
                            </div>
                        </div>
                        <div className="client-list-grid">
                            {renderClientList()}
                        </div>
                        <div className="recurring-client-pagination">
                            <button
                                type="button"
                                disabled={clientPage === 1 || isLoadingClients}
                                onClick={() => setClientPage((value) => Math.max(1, value - 1))}
                            >
                                Prev
                            </button>
                            <span>{clientPage} / {clientTotalPages || 1}</span>
                            <button
                                type="button"
                                disabled={clientPage >= clientTotalPages || isLoadingClients}
                                onClick={() => setClientPage((value) => Math.min(clientTotalPages || 1, value + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    <div className="recurring-card">
                        <h3>2) Therapist & Schedule</h3>

                        <div className="form-group">
                            <label htmlFor="recurring-therapist">Therapist</label>
                            <select id="recurring-therapist" value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>
                                <option value="">Select therapist</option>
                                {therapists.map((therapist) => (
                                    <option key={therapist.id} value={therapist.id}>
                                        {therapist.firstName} {therapist.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="recurring-schedule-type">Schedule Type</label>
                            <select id="recurring-schedule-type" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as AdminBulkScheduleType)}>
                                <option value="WEEKLY">WEEKLY</option>
                                <option value="MONTHLY">MONTHLY</option>
                            </select>
                        </div>

                        <div className="time-row">
                            <div className="form-group">
                                <label htmlFor="recurring-start-time">Start Time (UTC)</label>
                                <input id="recurring-start-time" type="time" step={900} value={startTimeUTC} onChange={(e) => setStartTimeUTC(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="recurring-end-time">End Time (UTC)</label>
                                <input id="recurring-end-time" type="time" step={900} value={endTimeUTC} onChange={(e) => setEndTimeUTC(e.target.value)} />
                            </div>
                        </div>

                        {scheduleType === 'MONTHLY' && (
                            <fieldset className="form-group" style={{ border: 'none', margin: 0, padding: 0 }}>
                                <legend style={{ fontWeight: 500, marginBottom: 8 }}>Days of Week</legend>
                                <div className="weekday-chip-row">
                                    {weekdayOptions.map((day) => (
                                        <button
                                            type="button"
                                            key={day.value}
                                            className={`weekday-chip ${daysOfWeek.includes(day.value) ? 'active' : ''}`}
                                            onClick={() => toggleWeekday(day.value)}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        )}

                        {scheduleType === 'WEEKLY' && (
                            <div className="time-row">
                                <div className="form-group">
                                    <label htmlFor="recurring-start-date">Start Date</label>
                                    <input id="recurring-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="recurring-end-date">End Date</label>
                                    <input id="recurring-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="recurring-error">
                                <AlertCircle size={14} />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {!errorMessage && selectedClientIds.length > 0 && therapistId && (
                            <div className="recurring-success-hint">
                                <CheckCircle2 size={14} />
                                <span>{selectedClientIds.length} client(s) selected and ready to schedule.</span>
                            </div>
                        )}

                        <button className="btn btn-primary recurring-submit" onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 size={14} className="spin" /> Scheduling…</> : 'Create Recurring Sessions'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
