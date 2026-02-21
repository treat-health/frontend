import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';
import type { CreateUserInput, InviteInfo } from '../../stores/userStore';
import '../../styles/admin.css';

const ROLES: { value: UserRole; label: string }[] = [
    { value: 'CLIENT', label: 'Client' },
    { value: 'THERAPIST', label: 'Therapist' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'CASE_MANAGER', label: 'Case Manager' },
    { value: 'ADMISSIONS_REP', label: 'Admissions Rep' },
    { value: 'CARE_COORDINATOR', label: 'Care Coordinator' },
    { value: 'PROGRAM_DIRECTOR', label: 'Program Director' },
    { value: 'INSURANCE_TEAM', label: 'Insurance Team' },
];

const STATES = ['CA', 'TX', 'WA', 'TN'];

/**
 * Admin Users Page
 */
export default function UsersPage() {
    const {
        users,
        pagination,
        isLoading,
        fetchUsers,
        createUser,
        toggleUserStatus,
        deleteUser,
        resendInvite,
        resetCredentials,
        lastInvite,
        clearLastInvite,
    } = useUserStore();

    const { user: currentUser } = useAuthStore();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
    const [currentPage, setCurrentPage] = useState(1);

    // Filter out current user from the list
    const filteredUsers = useMemo(() =>
        users.filter(user => user.id !== currentUser?.id),
        [users, currentUser?.id]
    );

    // Fetch users on mount and when filters change
    useEffect(() => {
        fetchUsers({
            page: currentPage,
            limit: 10,
            search: searchQuery || undefined,
            role: roleFilter || undefined,
        });
    }, [fetchUsers, currentPage, searchQuery, roleFilter]);

    // Show invite modal when lastInvite changes
    useEffect(() => {
        if (lastInvite) {
            setShowInviteModal(true);
        }
    }, [lastInvite]);

    const handleCreateUser = async (data: CreateUserInput) => {
        try {
            await createUser(data);
            setShowCreateModal(false);
            toast.success('User created successfully!');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleToggleStatus = async (userId: string) => {
        try {
            const user = await toggleUserStatus(userId);
            toast.success(`User ${user.isActive ? 'activated' : 'deactivated'}`);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await deleteUser(userId);
            toast.success('User deleted successfully');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleResendInvite = async (userId: string) => {
        try {
            await resendInvite(userId);
            toast.success('Invite resent successfully!');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleResetCredentials = async (userId: string) => {
        if (!confirm('This will reset the user\'s password. They will need to set a new one via the invite link. Continue?')) return;
        try {
            await resetCredentials(userId);
            toast.success('Credentials reset successfully!');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <h1>User Management</h1>
                    <p className="admin-subtitle">Manage users, send invites, and reset credentials</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div className="admin-filters">
                <div className="search-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                    className="filter-select"
                >
                    <option value="">All Roles</option>
                    {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                            {role.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Users Table */}
            <div className="admin-table-container">
                {isLoading && filteredUsers.length === 0 ? (
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading users...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <h3>No users found</h3>
                        <p>Get started by creating your first user</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>State</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar">
                                                {user.firstName[0]}{user.lastName[0]}
                                            </div>
                                            <div className="user-info">
                                                <span className="user-name">{user.firstName} {user.lastName}</span>
                                                <span className="user-email">{user.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`role-badge role-${user.role.toLowerCase()}`}>
                                            {ROLES.find((r) => r.value === user.role)?.label || user.role}
                                        </span>
                                    </td>
                                    <td>{user.state || '—'}</td>
                                    <td>
                                        <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                                            {user.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="action-btn"
                                                title="Resend Invite"
                                                onClick={() => handleResendInvite(user.id)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M22 2L11 13" />
                                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                                </svg>
                                            </button>
                                            <button
                                                className="action-btn"
                                                title="Reset Credentials"
                                                onClick={() => handleResetCredentials(user.id)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                            </button>
                                            <button
                                                className={`action-btn ${user.isActive ? '' : 'action-activate'}`}
                                                title={user.isActive ? 'Deactivate' : 'Activate'}
                                                onClick={() => handleToggleStatus(user.id)}
                                            >
                                                {user.isActive ? (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <path d="M15 9l-6 6" />
                                                        <path d="M9 9l6 6" />
                                                    </svg>
                                                ) : (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                className="action-btn action-delete"
                                                title="Delete User"
                                                onClick={() => handleDeleteUser(user.id)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                    >
                        Previous
                    </button>
                    <span className="pagination-info">
                        Page {currentPage} of {pagination.totalPages}
                    </span>
                    <button
                        className="pagination-btn"
                        disabled={currentPage === pagination.totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <CreateUserModal
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateUser}
                    isLoading={isLoading}
                />
            )}

            {/* Invite Link Modal */}
            {showInviteModal && lastInvite && (
                <InviteLinkModal
                    invite={lastInvite}
                    onClose={() => {
                        setShowInviteModal(false);
                        clearLastInvite();
                    }}
                    onCopy={copyToClipboard}
                />
            )}
        </div>
    );
}

/**
 * Create User Modal
 */
function CreateUserModal({
    onClose,
    onSubmit,
    isLoading,
}: {
    onClose: () => void;
    onSubmit: (data: CreateUserInput) => Promise<void>;
    isLoading: boolean;
}) {
    const [formData, setFormData] = useState<CreateUserInput>({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: 'CLIENT',
        state: '',
        sendInvite: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New User</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18" />
                            <path d="M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>First Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Email *</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+1234567890"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Role *</label>
                                <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                >
                                    {ROLES.map((role) => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>State</label>
                                <select
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                >
                                    <option value="">Select State</option>
                                    {STATES.map((state) => (
                                        <option key={state} value={state}>
                                            {state}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.sendInvite}
                                    onChange={(e) => setFormData({ ...formData, sendInvite: e.target.checked })}
                                />
                                <span>Send invite link (user will set their own password)</span>
                            </label>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Invite Link Modal
 */
function InviteLinkModal({
    invite,
    onClose,
    onCopy,
}: {
    invite: InviteInfo;
    onClose: () => void;
    onCopy: (text: string) => void;
}) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-invite" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="invite-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 2L11 13" />
                            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                    </div>
                    <h2>Invite Link Generated!</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18" />
                            <path d="M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="modal-body">
                    <p className="invite-description">
                        Share this link with the user. They can use it to set their password and activate their account.
                    </p>
                    <div className="invite-link-box">
                        <input type="text" readOnly value={invite.inviteLink} />
                        <button className="btn btn-primary" onClick={() => onCopy(invite.inviteLink)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                        </button>
                    </div>
                    <p className="invite-expiry">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Expires: {new Date(invite.expiresAt).toLocaleString()}
                    </p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
