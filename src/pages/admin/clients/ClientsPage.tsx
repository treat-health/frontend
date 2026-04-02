import { Fragment, useState, useEffect } from 'react';
import { Search, Users, MapPin, Mail, Phone, Calendar, ChevronLeft, ChevronRight, Eye, UserPlus } from 'lucide-react';
import api from '../../../lib/api';
import type { ApiResponse } from '../../../lib/api';
import type { TreatmentStatus } from '../../../stores/authStore';
import './ClientsPage.css';
import AssignTherapistModal from './AssignTherapistModal';

interface Client {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    state: string | null;
    isActive: boolean;
    treatmentStatus?: TreatmentStatus;
    createdAt: string;
    lastLoginAt: string | null;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Admin Clients Page — View and manage all clients
 */
export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [treatmentStatusFilter, setTreatmentStatusFilter] = useState<TreatmentStatus | ''>('');
    const [expandedClient, setExpandedClient] = useState<string | null>(null);
    const [clientToAssign, setClientToAssign] = useState<Client | null>(null);

    const STATES = ['CA', 'TX', 'WA', 'TN'];
    const TREATMENT_STATUS_OPTIONS: Array<{ value: TreatmentStatus; label: string }> = [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'SUCCESSFUL_COMPLETION', label: 'Successful Completion' },
        { value: 'ACA', label: 'ACA' },
        { value: 'ADMINISTRATIVE_DISCHARGE', label: 'Administrative Discharge' },
        { value: 'TRANSFER_TO_HIGH_LEVEL_CARE', label: 'Transfer to High Level Care' },
        { value: 'REFER_TO_OUTSIDE_AGENCY', label: 'Refer to Outside Agency' },
    ];

    useEffect(() => {
        fetchClients();
    }, [pagination.page, searchQuery, stateFilter, statusFilter, treatmentStatusFilter]);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: '10',
                role: 'CLIENT',
                sortBy: 'createdAt',
                sortOrder: 'desc',
            });
            if (searchQuery) params.append('search', searchQuery);
            if (stateFilter) params.append('state', stateFilter);
            if (statusFilter) params.append('isActive', statusFilter);
            if (treatmentStatusFilter) params.append('treatmentStatus', treatmentStatusFilter);

            const response = await api.get<ApiResponse<{ users: Client[]; pagination: PaginationInfo }>>(
                `/users?${params.toString()}`
            );

            if (response.data.success && response.data.data) {
                setClients(response.data.data.users);
                setPagination(response.data.data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getInitials = (first: string, last: string) => {
        return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleAssignClick = (client: Client, e: React.MouseEvent) => {
        e.stopPropagation();
        setClientToAssign(client);
    };

    return (
        <div className="clients-page">
            {/* Header */}
            <div className="clients-header">
                <div className="clients-header-text">
                    <h1>Clients</h1>
                    <p className="clients-subtitle">
                        Manage and view all enrolled clients
                    </p>
                </div>
                <div className="clients-stats">
                    <div className="client-stat-pill">
                        <Users size={16} />
                        <span>{pagination.total} Total</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="clients-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
                <select
                    className="filter-select"
                    value={stateFilter}
                    onChange={(e) => {
                        setStateFilter(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                >
                    <option value="">All States</option>
                    {STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                >
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
                <select
                    className="filter-select"
                    value={treatmentStatusFilter}
                    onChange={(e) => {
                        setTreatmentStatusFilter(e.target.value as TreatmentStatus | '');
                        setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                >
                    <option value="">All Treatment Statuses</option>
                    {TREATMENT_STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                </select>
            </div>

            {(() => {
                if (isLoading) {
                    return (
                        <div className="clients-loading">
                            <div className="spinner" />
                            <p>Loading clients...</p>
                        </div>
                    );
                }

                if (clients.length === 0) {
                    const hasFilters = Boolean(searchQuery || stateFilter || statusFilter || treatmentStatusFilter);

                    return (
                        <div className="clients-empty">
                            <Users size={48} />
                            <h3>No Clients Found</h3>
                            <p>{hasFilters ? 'Try adjusting your filters' : 'No clients have been enrolled yet'}</p>
                        </div>
                    );
                }

                return (
                    <div className="clients-table-container">
                        <table className="clients-table">
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>State</th>
                                    <th>Phone</th>
                                    <th>Status</th>
                                    <th>Joined</th>
                                    <th>Last Active</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map((client) => (
                                    <Fragment key={client.id}>
                                        <tr
                                            className={expandedClient === client.id ? 'row-expanded' : ''}
                                            onClick={() => setExpandedClient(
                                                expandedClient === client.id ? null : client.id
                                            )}
                                        >
                                            <td>
                                                <div className="client-cell">
                                                    <div className="client-avatar">
                                                        {getInitials(client.firstName, client.lastName)}
                                                    </div>
                                                    <div className="client-info">
                                                        <span className="client-name">
                                                            {client.firstName} {client.lastName}
                                                        </span>
                                                        <span className="client-email">{client.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {client.state ? (
                                                    <span className="state-badge">
                                                        <MapPin size={12} />
                                                        {client.state}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                {client.phone ? (
                                                    <span className="phone-text">
                                                        <Phone size={12} />
                                                        {client.phone}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${client.isActive ? 'active' : 'inactive'}`}>
                                                    {client.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="text-muted">{formatDate(client.createdAt)}</td>
                                            <td className="text-muted">
                                                {client.lastLoginAt ? formatDate(client.lastLoginAt) : 'Never'}
                                            </td>
                                            <td>
                                                <button
                                                    className="expand-btn"
                                                    title="View Details"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedClient(
                                                            expandedClient === client.id ? null : client.id
                                                        );
                                                    }}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedClient === client.id && (
                                            <tr className="detail-row">
                                                <td colSpan={7}>
                                                    <div className="client-detail-panel">
                                                        <div className="detail-grid">
                                                            <div className="detail-item">
                                                                <Mail size={16} />
                                                                <div>
                                                                    <span className="detail-label">Email</span>
                                                                    <span className="detail-value">{client.email}</span>
                                                                </div>
                                                            </div>
                                                            <div className="detail-item">
                                                                <Phone size={16} />
                                                                <div>
                                                                    <span className="detail-label">Phone</span>
                                                                    <span className="detail-value">{client.phone || 'Not provided'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="detail-item">
                                                                <MapPin size={16} />
                                                                <div>
                                                                    <span className="detail-label">State</span>
                                                                    <span className="detail-value">{client.state || 'Not set'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="detail-item">
                                                                <Calendar size={16} />
                                                                <div>
                                                                    <span className="detail-label">Member Since</span>
                                                                    <span className="detail-value">{formatDate(client.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="detail-actions" style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', gridColumn: '1 / -1' }}>
                                                                <button
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={(e) => handleAssignClick(client, e)}
                                                                >
                                                                    <UserPlus size={16} style={{ marginRight: '0.5rem' }} />
                                                                    Manage Therapist Assignment
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>

                        {pagination.totalPages > 1 && (
                            <div className="clients-pagination">
                                <button
                                    className="pagination-btn"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                >
                                    <ChevronLeft size={16} /> Previous
                                </button>
                                <span className="pagination-info">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="pagination-btn"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                >
                                    Next <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Modal */}
            {clientToAssign && (
                <AssignTherapistModal
                    client={clientToAssign}
                    onClose={() => setClientToAssign(null)}
                    onSuccess={() => {
                        // Optionally refresh list if needed
                        fetchClients();
                    }}
                />
            )}
        </div>
    );
}
