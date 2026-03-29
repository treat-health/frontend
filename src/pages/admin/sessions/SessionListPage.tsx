import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
// Removed unused lucide-react imports
import api from '../../../lib/api';
import type { ApiResponse } from '../../../lib/api';
import SessionReportPanel from '../../../components/session/SessionReportPanel';
import UnifiedSessionWizard from './wizard/UnifiedSessionWizard';
import UserFilterSidebar from './components/UserFilterSidebar';
import SessionViewPanel from './components/SessionViewPanel';
import type { UserSummary } from './types';
import './SessionListPage.css';
import '../../../styles/admin.css';

export default function SessionListPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const shouldAutoOpenWizard = searchParams.get('create') === '1';

    // Layout State
    const [activeTab, setActiveTab] = useState<'clients' | 'therapists'>('clients');
    const [searchTerm, setSearchTerm] = useState('');

    const [calendarRefreshSignal, setCalendarRefreshSignal] = useState(0);

    // Data State
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // User Pagination State
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [userLimit, setUserLimit] = useState(20);

    // Filter State

    // AI Report Modal
    const [reportSessionId, setReportSessionId] = useState<string | null>(null);

    // Wizard State
    const [isWizardOpen, setIsWizardOpen] = useState(false);

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

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);


    // Reset user page when tab or search changes
    useEffect(() => {
        setUserPage(1);
    }, [activeTab, searchTerm, userLimit]);

    useEffect(() => {
        if (shouldAutoOpenWizard) {
            setIsWizardOpen(true);
        }
    }, [shouldAutoOpenWizard]);

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
    };

    const closeWizard = () => {
        setIsWizardOpen(false);
        if (shouldAutoOpenWizard) {
            updateParams({ create: null });
        }
    };

    const handleUserSelect = (user: UserSummary) => {
        if (activeTab === 'clients') {
            updateParams({ clientId: user.id, therapistId: null });
        } else {
            updateParams({ therapistId: user.id, clientId: null });
        }
    };

    const handleWizardSuccess = () => {
        closeWizard();
        setCalendarRefreshSignal((value) => value + 1);
    };

    return (
        <div className="admin-page-full">
            <div className="admin-header nomargin" style={{ paddingLeft: '20px', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Session Management</h1>
                    <p className="admin-subtitle">View and manage all session schedules</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginRight: '20px' }}>
                    <button className="btn btn-secondary" onClick={() => {
                        updateParams({ clientId: null, therapistId: null });
                    }}>
                        Reset Filters
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsWizardOpen(true)}>
                        Create Session
                    </button>
                </div>
            </div>

            <div className="session-page-layout">
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
                    selectedClientId={selectedClientId}
                    selectedTherapistId={selectedTherapistId}
                    calendarRefreshSignal={calendarRefreshSignal}
                />
            </div>

            {/* AI Report Modal */}
            {reportSessionId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '90%', maxWidth: '800px', height: '85vh', background: 'white', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <SessionReportPanel sessionId={reportSessionId} onClose={() => setReportSessionId(null)} />
                    </div>
                </div>
            )}

            {isWizardOpen && (
                <UnifiedSessionWizard
                    onClose={closeWizard}
                    onSuccess={handleWizardSuccess}
                />
            )}
        </div>
    );
}
