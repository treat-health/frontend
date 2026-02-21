import { useState, useEffect } from 'react';
import { X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';
import type { ApiResponse } from '../../../lib/api';
import toast from 'react-hot-toast';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface AssignTherapistModalProps {
    client: {
        id: string;
        firstName: string;
        lastName: string;
    };
    onClose: () => void;
    onSuccess: () => void;
}

export default function AssignTherapistModal({ client, onClose, onSuccess }: AssignTherapistModalProps) {
    const [therapists, setTherapists] = useState<User[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 12, total: 0, totalPages: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
    const [currentTherapist, setCurrentTherapist] = useState<User | null>(null);

    // Fetch current assignment only once on mount
    useEffect(() => {
        fetchCurrentAssignment();
    }, []);

    // Fetch therapists with debounce on search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTherapists();
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [pagination.page, searchQuery]);

    const fetchTherapists = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: '12', // 12 fits well in a 3-column / 4-column grid
                role: 'THERAPIST',
                sortBy: 'firstName',
                sortOrder: 'asc'
            });
            if (searchQuery) {
                params.append('search', searchQuery);
            }

            const response = await api.get<ApiResponse<{ users: User[], pagination: PaginationInfo }>>(`/users?${params.toString()}`);
            if (response.data.success && response.data.data) {
                setTherapists(response.data.data.users);

                // Keep existing limits/pages but update total
                setPagination({
                    ...response.data.data.pagination,
                    limit: 12
                });
            }
        } catch (error) {
            console.error('Failed to fetch therapists', error);
            // toast.error('Failed to load therapists');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCurrentAssignment = async () => {
        try {
            const response = await api.get<ApiResponse<any>>(`/assignments/my-therapist?clientId=${client.id}`);
            if (response.data.success && response.data.data) {
                setCurrentTherapist(response.data.data);
                setSelectedTherapistId(response.data.data.id);
            }
        } catch (error) {
            // Ignore error if no assignment exists
        }
    };

    const handleAssign = async () => {
        if (!selectedTherapistId) return;

        setIsSubmitting(true);
        try {
            await api.post('/assignments', {
                therapistId: selectedTherapistId,
                clientId: client.id,
            });

            toast.success('Therapist assigned successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to assign therapist', error);
            toast.error(error.response?.data?.message || 'Failed to assign therapist');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveAssignment = async () => {
        if (!currentTherapist) return;

        if (!confirm('Are you sure you want to remove the current therapist?')) return;

        setIsSubmitting(true);
        try {
            await api.delete('/assignments', {
                data: {
                    therapistId: currentTherapist.id,
                    clientId: client.id,
                },
            });
            toast.success('Assignment removed');
            setCurrentTherapist(null);
            setSelectedTherapistId(null);
            onSuccess();
        } catch (error) {
            toast.error('Failed to remove assignment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
                <div className="modal-header">
                    <h3>Assign Therapist</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose} disabled={isSubmitting}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p style={{ marginBottom: '1rem', color: 'var(--gray-600)' }}>
                        Assigning a therapist for <strong>{client.firstName} {client.lastName}</strong>.
                    </p>

                    {currentTherapist && (
                        <div style={{
                            background: 'var(--primary-50)',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--primary-700)', marginBottom: '0.25rem' }}>
                                    CURRENTLY ASSIGNED
                                </div>
                                <div style={{ fontWeight: '600', color: 'var(--primary-900)' }}>
                                    {currentTherapist.firstName} {currentTherapist.lastName}
                                </div>
                            </div>
                            <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={handleRemoveAssignment}
                                disabled={isSubmitting}
                            >
                                Remove
                            </button>
                        </div>
                    )}

                    <div className="search-box" style={{ marginBottom: '1rem' }}>
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search therapists by name or email (searches server)..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '1rem',
                        minHeight: '200px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        padding: '4px' // Prevent box-shadow cut-off
                    }}>
                        {isLoading ? (
                            <div className="p-4 text-center col-span-full" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <div className="spinner spinner-dark" />
                            </div>
                        ) : therapists.length === 0 ? (
                            <div className="p-4 text-center text-muted col-span-full" style={{ gridColumn: '1 / -1' }}>
                                {searchQuery ? 'No therapists found matching your search.' : 'No therapists available.'}
                            </div>
                        ) : (
                            therapists.map((t) => (
                                <div
                                    key={t.id}
                                    style={{
                                        border: selectedTherapistId === t.id ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '1rem',
                                        cursor: 'pointer',
                                        background: selectedTherapistId === t.id ? 'var(--primary-50)' : 'white',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        textAlign: 'center',
                                        position: 'relative'
                                    }}
                                    onClick={() => setSelectedTherapistId(t.id)}
                                    onMouseEnter={(e) => {
                                        if (selectedTherapistId !== t.id) {
                                            e.currentTarget.style.borderColor = 'var(--gray-300)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedTherapistId !== t.id) {
                                            e.currentTarget.style.borderColor = 'var(--gray-200)';
                                            e.currentTarget.style.transform = 'none';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }
                                    }}
                                >
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        background: 'var(--primary-100)',
                                        color: 'var(--primary-600)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                        fontWeight: '600',
                                        marginBottom: '0.75rem'
                                    }}>
                                        {t.firstName.charAt(0)}{t.lastName.charAt(0)}
                                    </div>
                                    <div style={{ fontWeight: '600', color: 'var(--gray-900)', marginBottom: '0.25rem' }}>
                                        {t.firstName} {t.lastName}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)', wordBreak: 'break-all' }}>
                                        {t.email}
                                    </div>

                                    {selectedTherapistId === t.id && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            width: '20px',
                                            height: '20px',
                                            background: 'var(--primary-500)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white'
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {!isLoading && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '1rem',
                            marginTop: '1.5rem'
                        }}>
                            <button
                                className="btn btn-outline-primary btn-sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                className="btn btn-outline-primary btn-sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleAssign}
                        disabled={isSubmitting || !selectedTherapistId || selectedTherapistId === currentTherapist?.id}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
}
