import { Filter, Calendar as CalendarIcon, User as UserIcon, X, List as ListIcon, Sparkles } from 'lucide-react';
import SessionCalendar from '../../../../components/Calendar/SessionCalendar';
import type { Session } from '../types';

interface Props {
    viewMode: 'list' | 'calendar';
    startDate: string;
    endDate: string;
    selectedUserId: string | null;
    selectedClientId: string | null;
    selectedTherapistId: string | null;
    sessions: Session[];
    isLoadingSessions: boolean;
    page: number;
    totalPages: number;
    calendarRefreshSignal: number;
    onViewModeChange: (next: 'list' | 'calendar') => void;
    onDateChange: (type: 'start' | 'end', value: string) => void;
    onClearUser: () => void;
    onPageChange: (next: number) => void;
    onSessionCreated: () => void;
    onOpenReport: (sessionId: string) => void;
    formatDateTime: (iso: string) => string;
    formatDateOnlyUtc: (iso: string) => string;
    getStatusBadgeClass: (status: string) => string;
}

export default function SessionViewPanel({
    viewMode,
    startDate,
    endDate,
    selectedUserId,
    selectedClientId,
    selectedTherapistId,
    sessions,
    isLoadingSessions,
    page,
    totalPages,
    calendarRefreshSignal,
    onViewModeChange,
    onDateChange,
    onClearUser,
    onPageChange,
    onSessionCreated,
    onOpenReport,
    formatDateTime,
    formatDateOnlyUtc,
    getStatusBadgeClass,
}: Readonly<Props>) {
    const renderListContent = () => {
        if (isLoadingSessions) {
            return (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading sessions...</p>
                </div>
            );
        }

        if (sessions.length === 0) {
            return (
                <div className="empty-state">
                    <Filter size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                    <h3>No sessions found</h3>
                    <p>Select a user or adjust date filters to see results</p>
                </div>
            );
        }

        return (
            <table className="admin-table sticky-header">
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>Therapist</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map((session) => (
                        <tr key={session.id}>
                            <td>
                                <div style={{ fontWeight: 500 }}>{formatDateTime(session.scheduledAt)}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{formatDateOnlyUtc(session.scheduledAt)} • {session.durationMins} mins</div>
                            </td>
                            <td>
                                <div>{session.therapist.firstName} {session.therapist.lastName}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{session.therapist.email}</div>
                            </td>
                            <td>
                                <div>{session.client.firstName} {session.client.lastName}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{session.client.email}</div>
                            </td>
                            <td>
                                <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: 'var(--gray-50)', color: 'var(--gray-700)' }}>
                                    {session.type.replaceAll('_', ' ')}
                                </span>
                            </td>
                            <td>
                                <span className={`status-badge ${getStatusBadgeClass(session.status)}`}>
                                    {session.status}
                                </span>
                            </td>
                            <td>
                                {session.status === 'COMPLETED' ? (
                                    <button
                                        type="button"
                                        onClick={() => onOpenReport(session.id)}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--blue-50)', color: 'var(--blue-600)', border: 'none' }}
                                    >
                                        <Sparkles size={12} /> Report
                                    </button>
                                ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>N/A</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="session-list-content">
            <div className="session-header-filters">
                <div className="view-toggle" style={{ display: 'flex', background: 'var(--gray-50)', padding: '4px', borderRadius: '8px', marginRight: '16px' }}>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('list')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: viewMode === 'list' ? 'var(--bg-surface)' : 'transparent',
                            boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                            color: viewMode === 'list' ? 'var(--gray-900)' : 'var(--gray-500)',
                            fontWeight: 500, fontSize: '13px'
                        }}
                    >
                        <ListIcon size={14} /> List
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('calendar')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: viewMode === 'calendar' ? 'var(--bg-surface)' : 'transparent',
                            boxShadow: viewMode === 'calendar' ? 'var(--shadow-sm)' : 'none',
                            color: viewMode === 'calendar' ? 'var(--gray-900)' : 'var(--gray-500)',
                            fontWeight: 500, fontSize: '13px'
                        }}
                    >
                        <CalendarIcon size={14} /> Calendar
                    </button>
                </div>

                {viewMode === 'list' && (
                    <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarIcon size={16} color="#64748b" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onDateChange('start', e.target.value)}
                            className="filter-date-input"
                            style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}
                        />
                        <span style={{ color: '#94a3b8' }}>to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onDateChange('end', e.target.value)}
                            className="filter-date-input"
                            style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}
                        />
                    </div>
                )}

                {selectedUserId && (
                    <div className="active-filter-badge" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 500 }}>
                        <UserIcon size={14} />
                        <span>Filtered by user</span>
                        <button type="button" onClick={onClearUser} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--primary-600)' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {viewMode === 'list' ? (
                <>
                    <div className="admin-table-container sessions-table-wrapper" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
                        {renderListContent()}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination" style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                            <button
                                type="button"
                                className="pagination-btn"
                                disabled={page === 1}
                                onClick={() => onPageChange(page - 1)}
                            >
                                Previous
                            </button>
                            <span className="pagination-info">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                type="button"
                                className="pagination-btn"
                                disabled={page === totalPages}
                                onClick={() => onPageChange(page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ flex: 1, overflow: 'visible', position: 'relative' }}>
                    <SessionCalendar
                        clientId={selectedClientId}
                        therapistId={selectedTherapistId}
                        onSessionCreated={onSessionCreated}
                        refreshSignal={calendarRefreshSignal}
                    />
                </div>
            )}
        </div>
    );
}
