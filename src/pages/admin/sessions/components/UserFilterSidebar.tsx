import { Search, X, ChevronDown } from 'lucide-react';
import type { UserSummary } from '../types';

interface Props {
    activeTab: 'clients' | 'therapists';
    searchTerm: string;
    userLimit: number;
    users: UserSummary[];
    selectedUserId: string | null;
    isLoadingUsers: boolean;
    userPage: number;
    userTotalPages: number;
    onActiveTabChange: (next: 'clients' | 'therapists') => void;
    onSearchTermChange: (value: string) => void;
    onUserLimitChange: (value: number) => void;
    onUserSelect: (user: UserSummary) => void;
    onUserPageChange: (nextPage: number) => void;
}

export default function UserFilterSidebar({
    activeTab,
    searchTerm,
    userLimit,
    users,
    selectedUserId,
    isLoadingUsers,
    userPage,
    userTotalPages,
    onActiveTabChange,
    onSearchTermChange,
    onUserLimitChange,
    onUserSelect,
    onUserPageChange,
}: Readonly<Props>) {
    const renderUserList = () => {
        if (isLoadingUsers) {
            return <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading...</div>;
        }

        if (users.length === 0) {
            return <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No users found</div>;
        }

        return users.map((user) => (
            <button
                type="button"
                key={user.id}
                className={`user-list-item ${selectedUserId === user.id ? 'selected' : ''}`}
                onClick={() => onUserSelect(user)}
            >
                <div className="user-list-avatar">
                    {user.firstName[0]}{user.lastName[0]}
                </div>
                <div className="user-list-info">
                    <div className="user-list-name">{user.firstName} {user.lastName}</div>
                    <div className="user-list-email">{user.email}</div>
                </div>
            </button>
        ));
    };

    return (
        <div className="session-list-sidebar">
            <div className="session-list-tabs">
                <button
                    className={`session-list-tab ${activeTab === 'clients' ? 'active' : ''}`}
                    onClick={() => onActiveTabChange('clients')}
                >
                    Clients
                </button>
                <button
                    className={`session-list-tab ${activeTab === 'therapists' ? 'active' : ''}`}
                    onClick={() => onActiveTabChange('therapists')}
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
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }}
                    />
                    {searchTerm && (
                        <button type="button" onClick={() => onSearchTermChange('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <X size={14} color="#94a3b8" />
                        </button>
                    )}
                </div>
            </div>

            <div className="limit-selection-area">
                <div className="limit-select-wrapper">
                    <select
                        value={userLimit}
                        onChange={(e) => onUserLimitChange(Number(e.target.value))}
                        className="limit-select"
                    >
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={50}>50 / page</option>
                    </select>
                    <ChevronDown className="limit-select-icon" size={12} />
                </div>
            </div>

            <div className="user-list">{renderUserList()}</div>

            <div className="sidebar-pagination" style={{ padding: '10px', display: 'flex', justifyContent: 'center', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                    type="button"
                    disabled={userPage === 1}
                    onClick={() => onUserPageChange(userPage - 1)}
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'var(--bg-surface)', color: 'var(--gray-600)', cursor: userPage === 1 ? 'not-allowed' : 'pointer', opacity: userPage === 1 ? 0.5 : 1 }}
                >
                    Prev
                </button>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                    {userPage} / {userTotalPages || 1}
                </span>
                <button
                    type="button"
                    disabled={userPage >= userTotalPages}
                    onClick={() => onUserPageChange(userPage + 1)}
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--gray-200)', background: 'var(--bg-surface)', color: 'var(--gray-600)', cursor: userPage >= userTotalPages ? 'not-allowed' : 'pointer', opacity: userPage >= userTotalPages ? 0.5 : 1 }}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
