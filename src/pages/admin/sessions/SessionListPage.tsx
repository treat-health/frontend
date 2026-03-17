import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Calendar as CalendarIcon, Repeat } from 'lucide-react';
import api from '../../../lib/api';
import { connectSocket, getSocket } from '../../../lib/socket';
import type { ApiResponse } from '../../../lib/api';
import SessionReportPanel from '../../../components/session/SessionReportPanel';
import RecurringSessionCreationPanel from '../../../components/session/RecurringSessionCreationPanel';
import UserFilterSidebar from './components/UserFilterSidebar';
import SessionViewPanel from './components/SessionViewPanel';
import type { Session, UserSummary, SessionCompletedEvent } from './types';
import './SessionListPage.css';
import '../../../styles/admin.css';

const applySessionCompletedEvent = (current: Session[], data: SessionCompletedEvent): Session[] => {
    let changed = false;
    const updated = current.map((session) => {
        if (session.id !== data.sessionId || session.status === 'COMPLETED') {
            return session;
        }

        changed = true;
        return { ...session, status: 'COMPLETED' };
    });

    return changed ? updated : current;
};

export default function SessionListPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Layout State
    const [activeTab, setActiveTab] = useState<'clients' | 'therapists'>('clients');
    const [section, setSection] = useState<'calendar' | 'recurring'>('calendar');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [calendarRefreshSignal, setCalendarRefreshSignal] = useState(0);

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

    useEffect(() => {
        const socket = getSocket() ?? connectSocket();
        if (!socket) return;

        const applySessionCompletion = (data: SessionCompletedEvent) => {
            setSessions((current) => applySessionCompletedEvent(current, data));

            void fetchSessions();
        };

        socket.on('session:completed', applySessionCompletion);

        return () => {
            socket.off('session:completed', applySessionCompletion);
        };
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

    // Formatters — always display in UTC so admins see the same time regardless of browser timezone
    const formatDateTime = (iso: string) => {
        const d = new Date(iso);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const hours = d.getUTCHours();
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        return `${month}/${day}/${year}, ${String(h12).padStart(2, '0')}:${minutes} ${ampm} UTC`;
    };

    const formatDateOnlyUtc = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
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

    const handleRecurringSuccess = () => {
        setSection('calendar');
        setViewMode('calendar');
        setCalendarRefreshSignal((value) => value + 1);
        void fetchSessions();
    };

    return (
        <div className="admin-page-full">
            <div className="admin-header nomargin" style={{ paddingLeft: '20px', paddingTop: '20px' }}>
                <div>
                    <h1>Session Management</h1>
                    <p className="admin-subtitle">
                        {section === 'calendar'
                            ? 'View and manage all schedules'
                            : 'Create recurring session schedules for multiple clients'}
                    </p>
                </div>
                <button className="btn btn-secondary" style={{ marginRight: '20px' }} onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    updateParams({ startDate: null, endDate: null, clientId: null, therapistId: null });
                }}>
                    Reset Filters
                </button>
            </div>

            <div className="session-page-layout">
                <aside className="session-section-sidebar">
                    <button
                        className={`session-section-btn ${section === 'calendar' ? 'active' : ''}`}
                        onClick={() => setSection('calendar')}
                    >
                        <CalendarIcon size={15} />
                        <span>Calendar</span>
                    </button>
                    <button
                        className={`session-section-btn ${section === 'recurring' ? 'active' : ''}`}
                        onClick={() => setSection('recurring')}
                    >
                        <Repeat size={15} />
                        <span>Recurring Session Creation</span>
                    </button>
                </aside>

                {section === 'calendar' ? (
                    <>
                        <UserFilterSidebar
                            activeTab={activeTab}
                            searchTerm={searchTerm}
                            userLimit={userLimit}
                            users={users}
                            selectedUserId={selectedUserId}
                            isLoadingUsers={isLoadingUsers}
                            userPage={userPage}
                            userTotalPages={userTotalPages}
                            onActiveTabChange={(next) => {
                                setActiveTab(next);
                                setSearchTerm('');
                            }}
                            onSearchTermChange={setSearchTerm}
                            onUserLimitChange={setUserLimit}
                            onUserSelect={handleUserSelect}
                            onUserPageChange={setUserPage}
                        />

                        <SessionViewPanel
                            viewMode={viewMode}
                            startDate={startDate}
                            endDate={endDate}
                            selectedUserId={selectedUserId}
                            selectedClientId={selectedClientId}
                            selectedTherapistId={selectedTherapistId}
                            sessions={sessions}
                            isLoadingSessions={isLoadingSessions}
                            page={page}
                            totalPages={totalPages}
                            calendarRefreshSignal={calendarRefreshSignal}
                            onViewModeChange={setViewMode}
                            onDateChange={handleDateChange}
                            onClearUser={handleClearUser}
                            onPageChange={setPage}
                            onSessionCreated={() => void fetchSessions()}
                            onOpenReport={setReportSessionId}
                            formatDateTime={formatDateTime}
                            formatDateOnlyUtc={formatDateOnlyUtc}
                            getStatusBadgeClass={getStatusBadgeClass}
                        />
                    </>
                ) : (
                    <div className="session-list-content recurring-only-content">
                        <RecurringSessionCreationPanel onSuccess={handleRecurringSuccess} />
                    </div>
                )}
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
