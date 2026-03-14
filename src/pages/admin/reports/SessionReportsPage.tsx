import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    Sparkles,
    Search,
    Calendar as CalendarIcon,
    X,
    Filter,
} from 'lucide-react';
import api from '../../../lib/api';
import SessionReportPanel from '../../../components/session/SessionReportPanel';
import '../../../styles/admin.css';
import './SessionReportsPage.css';

interface Session {
    id: string;
    scheduledAt: string;
    durationMins: number;
    status: string;
    type: string;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
}

const SESSION_STATUSES = ['ALL', 'COMPLETED', 'SCHEDULED', 'CANCELLED', 'NO_SHOW'] as const;
type StatusFilter = (typeof SESSION_STATUSES)[number];

const STATUS_BADGE: Record<string, string> = {
    COMPLETED: 'badge-completed',
    SCHEDULED: 'badge-scheduled',
    CONFIRMED: 'badge-scheduled',
    CANCELLED: 'badge-cancelled',
    NO_SHOW: 'badge-cancelled',
    IN_PROGRESS: 'badge-inprogress',
};

export default function SessionReportsPage() {
    const navigate = useNavigate();

    // Data state
    const [sessions, setSessions] = useState<Session[]>([]);
    const [totalSessions, setTotalSessions] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Filter state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('COMPLETED');
    const [page, setPage] = useState(1);
    const LIMIT = 50;

    // Modal state
    const [reportSessionId, setReportSessionId] = useState<string | null>(null);

    // Debounce search so we don't fire on every keystroke
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(value);
            setPage(1);
        }, 300);
    };

    const fetchSessions = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, string | number> = {
                limit: LIMIT,
                offset: (page - 1) * LIMIT,
            };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await api.get<any>('/sessions', { params });
            setSessions(response.data.sessions ?? []);
            setTotalSessions(response.data.total ?? 0);
        } catch {
            toast.error('Failed to load sessions');
        } finally {
            setIsLoading(false);
        }
    }, [page, startDate, endDate]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Client-side filter by status + search (pagination is server-side for date/limit)
    const filteredSessions = sessions.filter((s) => {
        const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
        if (!matchesStatus) return false;
        if (!debouncedSearch) return true;
        const q = debouncedSearch.toLowerCase();
        const clientName = `${s.client.firstName} ${s.client.lastName}`.toLowerCase();
        const therapistName = `${s.therapist.firstName} ${s.therapist.lastName}`.toLowerCase();
        return (
            clientName.includes(q) ||
            therapistName.includes(q) ||
            s.client.email.toLowerCase().includes(q) ||
            s.therapist.email.toLowerCase().includes(q)
        );
    });

    const totalPages = Math.ceil(totalSessions / LIMIT);

    const formatDateTime = (iso: string) =>
        new Date(iso).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

    const clearDateFilters = () => {
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading sessions…</p>
                </div>
            );
        }
        if (filteredSessions.length === 0) {
            return (
                <div className="empty-state">
                    <Filter size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                    <h3>No sessions found</h3>
                    <p>
                        {statusFilter === 'COMPLETED'
                            ? 'No completed sessions match your filters. Only completed sessions have AI reports.'
                            : 'Try adjusting your filters or search term.'}
                    </p>
                </div>
            );
        }
        return (
            <table className="admin-table sticky-header">
                <thead>
                    <tr>
                        <th>Date &amp; Time</th>
                        <th>Client</th>
                        <th>Therapist</th>
                        <th>Duration</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>AI Report</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredSessions.map((session) => (
                        <tr key={session.id}>
                            <td>
                                <span className="srp-datetime">
                                    {formatDateTime(session.scheduledAt)}
                                </span>
                            </td>
                            <td>
                                <div className="srp-user-name">
                                    {session.client.firstName} {session.client.lastName}
                                </div>
                                <div className="srp-user-email">{session.client.email}</div>
                            </td>
                            <td>
                                <div className="srp-user-name">
                                    {session.therapist.firstName} {session.therapist.lastName}
                                </div>
                                <div className="srp-user-email">{session.therapist.email}</div>
                            </td>
                            <td className="srp-duration">{session.durationMins} min</td>
                            <td>
                                <span className="srp-type-badge">
                                    {session.type.replaceAll('_', ' ')}
                                </span>
                            </td>
                            <td>
                                <span className={`srp-status-badge ${STATUS_BADGE[session.status] ?? ''}`}>
                                    {session.status.replaceAll('_', ' ')}
                                </span>
                            </td>
                            <td>
                                {session.status === 'COMPLETED' ? (
                                    <button
                                        onClick={() => setReportSessionId(session.id)}
                                        className="srp-report-btn"
                                        aria-label={`View AI report for session on ${formatDateTime(session.scheduledAt)}`}
                                    >
                                        <Sparkles size={12} />
                                        View Report
                                    </button>
                                ) : (
                                    <span className="srp-na">—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="srp-page admin-page-full">
            {/* ── Page Header ── */}
            <div className="admin-header nomargin srp-header">
                <div>
                    <button
                        onClick={() => navigate('/reports')}
                        className="srp-back-btn"
                        aria-label="Back to Reports"
                    >
                        <ArrowLeft size={14} />
                        Back to Reports
                    </button>
                    <h1>Session Reports</h1>
                    <p className="admin-subtitle">
                        AI-generated transcripts and clinical summaries for completed sessions
                    </p>
                </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="srp-filters">
                {/* Search */}
                <div className="srp-search">
                    <Search size={14} color="#64748b" />
                    <input
                        type="text"
                        placeholder="Search client or therapist…"
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="srp-search-input"
                        aria-label="Search sessions"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => handleSearchChange('')}
                            className="srp-clear-btn"
                            aria-label="Clear search"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Status Pills */}
                <div className="srp-status-pills" aria-label="Filter by status">
                    {SESSION_STATUSES.map((s) => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`srp-pill ${statusFilter === s ? 'srp-pill-active' : ''}`}
                            aria-pressed={statusFilter === s}
                        >
                            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase().replaceAll('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Date Range */}
                <div className="srp-date-range">
                    <CalendarIcon size={14} color="#64748b" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        className="srp-date-input"
                        aria-label="Start date"
                    />
                    <span className="srp-date-sep">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        className="srp-date-input"
                        aria-label="End date"
                    />
                    {(startDate || endDate) && (
                        <button onClick={clearDateFilters} className="srp-clear-btn" aria-label="Clear dates">
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Result count */}
                <span className="srp-result-count">
                    {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                </span>
            </div>

            {/* -- Table -- */}
            <div className="admin-table-container srp-table-container">
                {renderContent()}
            </div>
            {/* -- Pagination -- */}
            {totalPages > 1 && (
                <div className="pagination srp-pagination">
                    <button
                        className="pagination-btn"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                    >
                        Previous
                    </button>
                    <span className="pagination-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="pagination-btn"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* -- AI Report Modal -- */}
            {reportSessionId && (
                <div className="srp-modal-overlay">
                    {/* Invisible backdrop button for click-to-dismiss */}
                    <button
                        className="srp-modal-backdrop-btn"
                        onClick={() => setReportSessionId(null)}
                        aria-label="Close report"
                        tabIndex={-1}
                    />
                    <dialog
                        className="srp-modal-panel"
                        open
                        aria-label="AI Session Report"
                    >
                        <SessionReportPanel
                            sessionId={reportSessionId}
                            onClose={() => setReportSessionId(null)}
                        />
                    </dialog>
                </div>
            )}
        </div>
    );
}
