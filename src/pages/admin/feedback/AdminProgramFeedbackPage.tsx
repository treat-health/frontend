import { useEffect, useMemo, useState } from 'react';
import { Eye, MessageSquare, RefreshCw, Search, Sparkles, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { programFeedbackApi } from '../../../services/programFeedback.service';
import type {
    ProgramFeedbackItem,
    ProgramFeedbackListQuery,
    ProgramFeedbackStatus,
    UpdateProgramFeedbackInput,
} from '../../../types/programFeedback.types';
import { ProgramFeedbackStatusEnum } from '../../../types/programFeedback.types';
import '../../../styles/admin.css';
import './AdminProgramFeedbackPage.css';

const FEEDBACK_STATUSES = Object.values(ProgramFeedbackStatusEnum);

const formatStatus = (value: string) => value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const formatDate = (value: string) => new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

function RatingPill({ label, value }: Readonly<{ label: string; value: number | null }>) {
    return (
        <div className="apf-rating-pill">
            <span>{label}</span>
            <strong><Star size={12} fill="currentColor" /> {value ?? '—'}/5</strong>
        </div>
    );
}

export default function AdminProgramFeedbackPage() {
    const [feedback, setFeedback] = useState<ProgramFeedbackItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
    const [selectedFeedback, setSelectedFeedback] = useState<ProgramFeedbackItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<ProgramFeedbackListQuery>({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
    });
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [summary, setSummary] = useState({ averageOverallRating: 0, averageSupportRating: 0, pendingCount: 0 });
    const [reviewForm, setReviewForm] = useState<UpdateProgramFeedbackInput>({ status: ProgramFeedbackStatusEnum.NEW, adminNotes: '' });

    const loadFeedback = async () => {
        setIsLoading(true);
        try {
            const result = await programFeedbackApi.listFeedback(filters);
            setFeedback(result.data.feedback);
            setPagination(result.data.pagination);
            setSummary(result.data.summary);
        } catch (error) {
            console.error('Failed to load feedback', error);
            toast.error('Failed to load program feedback');
        } finally {
            setIsLoading(false);
        }
    };

    const loadFeedbackDetails = async (id: string) => {
        try {
            const result = await programFeedbackApi.getFeedbackById(id);
            setSelectedFeedback(result.data);
            setReviewForm({
                status: result.data.status,
                adminNotes: result.data.adminNotes || '',
            });
        } catch (error) {
            console.error('Failed to load feedback detail', error);
            toast.error('Failed to load feedback details');
        }
    };

    useEffect(() => {
        void loadFeedback();
    }, [filters]);

    useEffect(() => {
        if (!selectedFeedbackId) {
            setSelectedFeedback(null);
            return;
        }
        void loadFeedbackDetails(selectedFeedbackId);
    }, [selectedFeedbackId]);

    const handleSearchSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFilters((current) => ({ ...current, search: search || undefined, page: 1 }));
    };

    const handleSaveReview = async () => {
        if (!selectedFeedback) return;
        setIsSaving(true);
        try {
            await programFeedbackApi.updateFeedback(selectedFeedback.id, reviewForm);
            toast.success('Feedback review updated');
            await Promise.all([loadFeedback(), loadFeedbackDetails(selectedFeedback.id)]);
        } catch (error) {
            console.error('Failed to update feedback', error);
            toast.error('Failed to update feedback review');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResendInvitation = async (feedbackId: string) => {
        try {
            await programFeedbackApi.resendInvitation(feedbackId);
            toast.success('Feedback invitation resent');
            await Promise.all([
                loadFeedback(),
                selectedFeedbackId === feedbackId ? loadFeedbackDetails(feedbackId) : Promise.resolve(),
            ]);
        } catch (error: any) {
            console.error('Failed to resend feedback invitation', error);
            toast.error(error.response?.data?.message || 'Failed to resend feedback invitation');
        }
    };

    const emptyMessage = useMemo(() => {
        if (filters.search || filters.status || filters.minOverallRating) {
            return 'No feedback matches your current filters.';
        }
        return 'No client feedback has been submitted yet.';
    }, [filters]);

    let feedbackTableContent: React.ReactNode;
    if (isLoading && feedback.length === 0) {
        feedbackTableContent = (
            <div className="loading-state">
                <div className="spinner" />
                <p>Loading feedback...</p>
            </div>
        );
    } else if (feedback.length === 0) {
        feedbackTableContent = (
            <div className="empty-state">
                <Sparkles size={48} />
                <h3>No feedback found</h3>
                <p>{emptyMessage}</p>
            </div>
        );
    } else {
        feedbackTableContent = (
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Ratings</th>
                        <th>Improvement Suggestion</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {feedback.map((item) => (
                        <tr key={item.id}>
                            <td>
                                <div className="user-cell" style={{ gap: '0.5rem' }}>
                                    <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
                                        {item.submittedBy?.firstName?.[0]}{item.submittedBy?.lastName?.[0]}
                                    </div>
                                    <div className="user-info">
                                        <span className="user-name">{item.submittedBy?.firstName} {item.submittedBy?.lastName}</span>
                                        <span className="user-email">{item.submittedBy?.email}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div className="apf-table-ratings">
                                    <RatingPill label="Overall" value={item.overallExperienceRating} />
                                    <RatingPill label="Support" value={item.supportRating} />
                                </div>
                            </td>
                            <td>
                                <div className="apf-suggestion-cell">{item.improvementSuggestion || 'Invitation pending submission'}</div>
                            </td>
                            <td>
                                <span className={`feedback-status-badge status-${item.status.toLowerCase()}`}>
                                    {formatStatus(item.status)}
                                </span>
                            </td>
                            <td>{formatDate(item.createdAt)}</td>
                            <td>
                                <div className="action-buttons">
                                    {!item.submittedAt && (
                                        <button className="action-btn" title="Resend invitation" onClick={() => handleResendInvitation(item.id)}>
                                            <RefreshCw size={16} />
                                        </button>
                                    )}
                                    <button className="action-btn" title="Review feedback" onClick={() => setSelectedFeedbackId(item.id)}>
                                        <Eye size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="admin-page apf-page">
            <div className="admin-header">
                <div>
                    <h1>Program Feedback</h1>
                    <p className="admin-subtitle">Review client-wide program feedback and follow up on improvement ideas.</p>
                </div>
                <button className="btn btn-primary" onClick={loadFeedback} disabled={isLoading}>
                    <RefreshCw size={18} style={{ marginRight: '0.5rem', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            <div className="apf-summary-grid">
                <div className="card apf-summary-card">
                    <span>Average overall experience</span>
                    <strong>{summary.averageOverallRating || 0}/5</strong>
                </div>
                <div className="card apf-summary-card">
                    <span>Average support rating</span>
                    <strong>{summary.averageSupportRating || 0}/5</strong>
                </div>
                <div className="card apf-summary-card accent">
                    <span>Pending review</span>
                    <strong>{summary.pendingCount}</strong>
                </div>
            </div>

            <div className="admin-filters">
                <form className="search-box apf-search-box" onSubmit={handleSearchSubmit}>
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search by client or feedback text..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </form>

                <select
                    className="filter-select"
                    value={filters.status || ''}
                    onChange={(event) => setFilters((current) => ({
                        ...current,
                        status: (event.target.value || undefined) as ProgramFeedbackStatus | undefined,
                        page: 1,
                    }))}
                >
                    <option value="">All statuses</option>
                    {FEEDBACK_STATUSES.map((status) => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                    ))}
                </select>

                <select
                    className="filter-select"
                    value={filters.minOverallRating || ''}
                    onChange={(event) => setFilters((current) => ({
                        ...current,
                        minOverallRating: event.target.value ? Number(event.target.value) : undefined,
                        page: 1,
                    }))}
                >
                    <option value="">All ratings</option>
                    {[5, 4, 3, 2, 1].map((rating) => (
                        <option key={rating} value={rating}>{rating}/5 and above</option>
                    ))}
                </select>
            </div>

            <div className="admin-table-container">
                {feedbackTableContent}
            </div>

            {pagination.totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        disabled={filters.page === 1}
                        onClick={() => setFilters((current) => ({ ...current, page: (current.page || 1) - 1 }))}
                    >
                        Previous
                    </button>
                    <span className="pagination-info">Page {pagination.page} of {pagination.totalPages}</span>
                    <button
                        className="pagination-btn"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setFilters((current) => ({ ...current, page: (current.page || 1) + 1 }))}
                    >
                        Next
                    </button>
                </div>
            )}

            {selectedFeedback && (() => {
                const isSubmittedFeedback = Boolean(selectedFeedback.submittedAt);
                const statusTimestamp = selectedFeedback.submittedAt || selectedFeedback.invitationSentAt || selectedFeedback.createdAt;

                return (
                <div className="modal-overlay">
                    <button
                        type="button"
                        className="apf-modal-backdrop"
                        onClick={() => setSelectedFeedbackId(null)}
                        aria-label="Close feedback review"
                    />
                    <dialog className="modal apf-modal" open aria-label="Feedback Review">
                        <div className="modal-header">
                            <div>
                                <h2>Feedback Review</h2>
                                <p className="admin-subtitle">
                                    Submitted by {selectedFeedback.submittedBy?.firstName} {selectedFeedback.submittedBy?.lastName}
                                </p>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedFeedbackId(null)}>×</button>
                        </div>
                        <div className="modal-body apf-modal-body">
                            <div className="apf-detail-grid">
                                <div className="apf-detail-card">
                                    <h4>Client summary</h4>
                                    <p><strong>Email:</strong> {selectedFeedback.submittedBy?.email}</p>
                                    <p><strong>{isSubmittedFeedback ? 'Submitted' : 'Invitation sent'}:</strong> {formatDate(statusTimestamp)}</p>
                                    {selectedFeedback.invitationExpiresAt && (
                                        <p><strong>Invitation expires:</strong> {formatDate(selectedFeedback.invitationExpiresAt)}</p>
                                    )}
                                    {selectedFeedback.reviewedAt && (
                                        <p><strong>Reviewed:</strong> {formatDate(selectedFeedback.reviewedAt)}</p>
                                    )}
                                </div>
                                <div className="apf-detail-card">
                                    <h4>Ratings</h4>
                                    {isSubmittedFeedback ? (
                                        <div className="apf-detail-ratings">
                                            <RatingPill label="Overall experience" value={selectedFeedback.overallExperienceRating} />
                                            <RatingPill label="Support felt" value={selectedFeedback.supportRating} />
                                        </div>
                                    ) : (
                                        <p>This invitation has not been submitted yet.</p>
                                    )}
                                </div>
                            </div>

                            {isSubmittedFeedback ? (
                                <>
                                    <div className="apf-response-card">
                                        <h4>Improvement suggestion</h4>
                                        <p>{selectedFeedback.improvementSuggestion}</p>
                                    </div>

                                    {selectedFeedback.additionalComments && (
                                        <div className="apf-response-card muted">
                                            <h4>Additional comments</h4>
                                            <p>{selectedFeedback.additionalComments}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="apf-response-card muted">
                                    <h4>Invitation status</h4>
                                    <p>This client has been invited to submit treatment completion feedback, but no response has been submitted yet.</p>
                                </div>
                            )}

                            {isSubmittedFeedback ? (
                                <div className="apf-review-form">
                                    <div className="form-group">
                                        <label htmlFor="feedback-status">Status</label>
                                        <select
                                            id="feedback-status"
                                            value={reviewForm.status || ProgramFeedbackStatusEnum.NEW}
                                            onChange={(event) => setReviewForm((current) => ({
                                                ...current,
                                                status: event.target.value as ProgramFeedbackStatus,
                                            }))}
                                        >
                                            {FEEDBACK_STATUSES.filter((status) => status !== ProgramFeedbackStatusEnum.INVITED).map((status) => (
                                                <option key={status} value={status}>{formatStatus(status)}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="feedback-admin-notes">Admin notes</label>
                                        <textarea
                                            id="feedback-admin-notes"
                                            value={reviewForm.adminNotes || ''}
                                            onChange={(event) => setReviewForm((current) => ({ ...current, adminNotes: event.target.value }))}
                                            placeholder="Capture follow-up notes, internal context, or actions taken."
                                            rows={6}
                                        />
                                    </div>

                                    <div className="apf-review-meta">
                                        <MessageSquare size={14} />
                                        <span>Use admin notes for internal review comments only.</span>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedFeedbackId(null)}>
                                Close
                            </button>
                            {isSubmittedFeedback ? (
                                <button className="btn btn-primary" onClick={handleSaveReview} disabled={isSaving}>
                                    {isSaving ? <span className="spinner" /> : null}
                                    {isSaving ? 'Saving…' : 'Save Review'}
                                </button>
                            ) : (
                                <button className="btn btn-primary" onClick={() => handleResendInvitation(selectedFeedback.id)}>
                                    Resend Invitation
                                </button>
                            )}
                        </div>
                    </dialog>
                </div>
                );
            })()}
        </div>
    );
}
