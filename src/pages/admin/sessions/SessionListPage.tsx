import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Search, X, Filter, Calendar as CalendarIcon, User as UserIcon, ChevronDown, List as ListIcon, Sparkles } from 'lucide-react';
import api from '../../../lib/api';
import type { ApiResponse } from '../../../lib/api';
import SessionCalendar from '../../../components/Calendar/SessionCalendar';
import SessionReportPanel from '../../../components/session/SessionReportPanel';
import './SessionListPage.css';
import '../../../styles/admin.css';

interface Session {
    id: string;
    clientId: string;
    therapistId: string;
    scheduledAt: string;
    durationMins: number;
    status: string;
    type: string;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
}

interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

export default function SessionListPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Layout State
    const [activeTab, setActiveTab] = useState<'clients' | 'therapists'>('clients');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

    // Data State
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [totalSessions, setTotalSessions] = useState(0);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    // User Pagination State
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [userLimit, setUserLimit] = useState(20);

    // Filter State
    const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
    const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
    const [page, setPage] = useState(1);
    const limit = 20;

    // AI Report Modal
    const [reportSessionId, setReportSessionId] = useState<string | null>(null);

    // Derived Selection
    const selectedClientId = searchParams.get('clientId');
    const selectedTherapistId = searchParams.get('therapistId');
    const selectedUserId = selectedClientId || selectedTherapistId;
    // Fetch Users for Sidebar
    const fetchUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        try {
            const role = activeTab === 'clients' ? 'CLIENT' : 'THERAPIST';
            const params: any = {
                role,
                limit: userLimit,
                page: userPage,
                sortBy: 'firstName',
                sortOrder: 'asc'
            };
            if (searchTerm) params.search = searchTerm;

            const response = await api.get<ApiResponse<{ users: UserSummary[]; pagination?: { totalPages: number } }>>('/users', { params });
            if (response.data?.data?.users) {
                setUsers(response.data.data.users);
                if (response.data.data.pagination) {
                    setUserTotalPages(response.data.data.pagination.totalPages);
                }
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load user list');
        } finally {
            setIsLoadingUsers(false);
        }
    }, [activeTab, searchTerm, userPage, userLimit]);

    // Fetch Sessions
    const fetchSessions = useCallback(async () => {
        setIsLoadingSessions(true);
        try {
            const params: any = {
                limit,
                offset: (page - 1) * limit,
            };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (selectedClientId) params.clientId = selectedClientId;
            if (selectedTherapistId) params.therapistId = selectedTherapistId;

            const response = await api.get<any>('/sessions', { params });
            const data = response.data;
            setSessions(data.sessions || []);
            setTotalSessions(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
            toast.error('Failed to load sessions');
        } finally {
            setIsLoadingSessions(false);
        }
    }, [page, startDate, endDate, selectedClientId, selectedTherapistId]);

    // Initial and Dependency Effects
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Reset user page when tab or search changes
    useEffect(() => {
        setUserPage(1);
    }, [activeTab, searchTerm, userLimit]);

    // Update URL Params wrapper
    const updateParams = (updates: Record<string, string | null>) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === '') {
                newParams.delete(key);
            } else {
                newParams.set(key, value);
            }
        });
        setSearchParams(newParams);
        setPage(1); // Reset page on filter change
    };

    const handleUserSelect = (user: UserSummary) => {
        if (activeTab === 'clients') {
            updateParams({ clientId: user.id, therapistId: null });
        } else {
            updateParams({ therapistId: user.id, clientId: null });
        }
    };

    const handleClearUser = () => {
        updateParams({ clientId: null, therapistId: null });
    };

    const handleDateChange = (type: 'start' | 'end', value: string) => {
        if (type === 'start') setStartDate(value);
        else setEndDate(value);
        updateParams({ [type === 'start' ? 'startDate' : 'endDate']: value });
    };

    // Formatters
    const formatDateTime = (iso: string) => new Date(iso).toLocaleString();
    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return 'status-active';
            case 'CONFIRMED': return 'status-active';
            case 'COMPLETED': return 'status-active';
            case 'CANCELLED': return 'status-inactive';
            case 'NO_SHOW': return 'status-inactive';
            default: return '';
        }
    };

    const totalPages = Math.ceil(totalSessions / limit);

    return (
        <div className="admin-page-full">
            <div className="admin-header nomargin" style={{ paddingLeft: '20px', paddingTop: '20px' }}>
                <div>
                    <h1>Session Management</h1>
                    <p className="admin-subtitle">View and manage all schedules</p>
                </div>
                <button className="btn btn-secondary" style={{ marginRight: '20px' }} onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    handleClearUser();
                    updateParams({ startDate: null, endDate: null, clientId: null, therapistId: null });
                }}>
                    Reset Filters
                </button>
            </div>

            <div className="session-page-layout">
                {/* Sidebar: User List */}
                <div className="session-list-sidebar">
                    <div className="session-list-tabs">
                        <button
                            className={`session-list-tab ${activeTab === 'clients' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
                        >
                            Clients
                        </button>
                        <button
                            className={`session-list-tab ${activeTab === 'therapists' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('therapists'); setSearchTerm(''); }}
                        >
                            Therapists
                        </button>
                    </div>

                    <div className="session-list-search">
                        <div className="search-input-wrapper" style={{ display: 'flex', alignItems: 'center', background: 'var(--gray-50)', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <Search size={16} color="#64748b" style={{ marginRight: '8px' }} />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    <X size={14} color="#94a3b8" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="limit-selection-area">
                        <div className="limit-select-wrapper">
                            <select
                                value={userLimit}
                                onChange={(e) => setUserLimit(Number(e.target.value))}
                                className="limit-select"
                            >
                                <option value={10}>10 / page</option>
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                            </select>
                            <ChevronDown className="limit-select-icon" size={12} />
                        </div>
                    </div>

                    <div className="user-list">
                        {isLoadingUsers ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
                        ) : users.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No users found</div>
                        ) : (
                            <>
                                {users.map(user => (
                                    <div
                                        key={user.id}
                                        className={`user-list-item ${selectedUserId === user.id ? 'selected' : ''}`}
                                        onClick={() => handleUserSelect(user)}
                                    >
                                        <div className="user-list-avatar">
                                            {user.firstName[0]}{user.lastName[0]}
                                        </div>
                                        <div className="user-list-info">
                                            <div className="user-list-name">{user.firstName} {user.lastName}</div>
                                            <div className="user-list-email">{user.email}</div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Sidebar Pagination */}
                    <div className="sidebar-pagination" style={{ padding: '10px', display: 'flex', justifyContent: 'center', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
                        <button
                            disabled={userPage === 1}
                            onClick={() => setUserPage(p => p - 1)}
                            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'var(--bg-surface)', color: 'var(--gray-600)', cursor: userPage === 1 ? 'not-allowed' : 'pointer', opacity: userPage === 1 ? 0.5 : 1 }}
                        >
                            Prev
                        </button>
                        <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            {userPage} / {userTotalPages || 1}
                        </span>
                        <button
                            disabled={userPage >= userTotalPages}
                            onClick={() => setUserPage(p => p + 1)}
                            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'var(--bg-surface)', color: 'var(--gray-600)', cursor: userPage >= userTotalPages ? 'not-allowed' : 'pointer', opacity: userPage >= userTotalPages ? 0.5 : 1 }}
                        >
                            Next
                        </button>
                    </div>
                </div>

                {/* Main Content: Session Table or Calendar */}
                <div className="session-list-content">
                    {/* Header Filters & Toggle */}
                    <div className="session-header-filters">
                        <div className="view-toggle" style={{ display: 'flex', background: 'var(--gray-50)', padding: '4px', borderRadius: '8px', marginRight: '16px' }}>
                            <button
                                onClick={() => setViewMode('list')}
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
                                onClick={() => setViewMode('calendar')}
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
                                    onChange={(e) => handleDateChange('start', e.target.value)}
                                    className="filter-date-input"
                                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}
                                />
                                <span style={{ color: '#94a3b8' }}>to</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => handleDateChange('end', e.target.value)}
                                    className="filter-date-input"
                                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}
                                />
                            </div>
                        )}

                        {selectedUserId && (
                            <div className="active-filter-badge" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 500 }}>
                                <UserIcon size={14} />
                                <span>Filtered by user</span>
                                <button onClick={handleClearUser} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--primary-600)' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {viewMode === 'list' ? (
                        <>
                            <div className="admin-table-container sessions-table-wrapper" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
                                {isLoadingSessions ? (
                                    <div className="loading-state">
                                        <div className="spinner" />
                                        <p>Loading sessions...</p>
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="empty-state">
                                        <Filter size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                        <h3>No sessions found</h3>
                                        <p>Select a user or adjust date filters to see results</p>
                                    </div>
                                ) : (
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
                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{session.durationMins} mins</div>
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
                                                            {session.type.replace('_', ' ')}
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
                                                                onClick={() => setReportSessionId(session.id)}
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
                                )}
                            </div>

                            {/* Pagination - Only show in list mode */}
                            {totalPages > 1 && (
                                <div className="pagination" style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
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
                        </>
                    ) : (
                        <div style={{ flex: 1, overflow: 'visible', position: 'relative' }}>
                            <SessionCalendar
                                clientId={selectedClientId}
                                therapistId={selectedTherapistId}
                                onSessionCreated={() => fetchSessions()}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* AI Report Modal */}
            {reportSessionId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '90%', maxWidth: '800px', height: '85vh', background: 'white', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <SessionReportPanel sessionId={reportSessionId} onClose={() => setReportSessionId(null)} />
                    </div>
                </div>
            )}
        </div>
    );
}
