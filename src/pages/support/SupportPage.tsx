import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Send } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { issueApi } from '../../services/issue.service';
import { IssueCategoryEnum } from '../../types/issue.types';
import type { IssueCategory, CreateIssueInput, IssueMetadata, Issue } from '../../types/issue.types';
import toast from 'react-hot-toast';
import './SupportPage.css';

const CATEGORY_LABELS: Record<string, string> = {
    TECHNICAL: 'Technical Issue',
    SESSION: 'Video / Session Problem',
    BILLING: 'Billing',
    ACCOUNT: 'Account Management',
    OTHER: 'Other',
};

function getStatusBadgeClass(status: string): string {
    switch (status) {
        case 'RESOLVED':
        case 'CLOSED': return 'badge-success';
        case 'IN_PROGRESS': return 'badge-primary';
        case 'BLOCKED': return 'badge-danger';
        case 'OPEN': return 'badge-error';
        default: return 'badge-warning';
    }
}

export default function SupportPage() {
    const location = useLocation();

    // Report form state
    const [title, setTitle] = useState(`Issue on ${location.pathname}`);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<IssueCategory>(IssueCategoryEnum.TECHNICAL);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Issues list state
    const [issues, setIssues] = useState<Issue[]>([]);
    const [isLoadingIssues, setIsLoadingIssues] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadIssues(1);
    }, []);

    const loadIssues = async (page: number) => {
        setIsLoadingIssues(true);
        try {
            const result = await issueApi.listIssues({ page, limit: 8, sortOrder: 'desc', sortBy: 'createdAt' });
            if (result.success && result.data) {
                setIssues(result.data.issues);
                setTotalPages(result.data.pagination.totalPages);
                setCurrentPage(result.data.pagination.page);
            }
        } catch (error) {
            console.error('Failed to load issues', error);
        } finally {
            setIsLoadingIssues(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            toast.error('Title and description are required.');
            return;
        }
        setIsSubmitting(true);
        const metadata: IssueMetadata = {
            route: location.pathname,
            userAgent: navigator.userAgent,
        };
        const input: CreateIssueInput = { title, description, category, metadata };
        try {
            await issueApi.createIssue(input);
            setSubmitSuccess(true);
            toast.success('Issue reported successfully!');
            await loadIssues(1);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to report issue. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReportAnother = () => {
        setSubmitSuccess(false);
        setTitle('');
        setDescription('');
        setCategory(IssueCategoryEnum.TECHNICAL);
    };

    return (
        <div className="page-content">
            <div>
                <h2 style={{ margin: 0 }}>Support</h2>
                <p className="support-page-subtitle">Report a problem or check the status of your previous requests.</p>
            </div>

            <div className="support-grid">
                {/* Report Issue */}
                <div className="card support-report-card">
                    <h3 className="support-card-title">Report an Issue</h3>
                    <p className="support-card-subtitle">Describe what went wrong and our team will look into it.</p>

                    {submitSuccess ? (
                        <div className="support-success-state">
                            <CheckCircle size={44} className="support-success-icon" />
                            <h4>Issue Submitted</h4>
                            <p>Our team has been notified and will review your issue shortly.</p>
                            <button className="btn btn-primary" onClick={handleReportAnother}>
                                Report Another Issue
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="support-form">
                            <div className="form-group">
                                <label htmlFor="support-category">Category</label>
                                <select
                                    id="support-category"
                                    className="form-control"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                                >
                                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="support-title">Summary</label>
                                <input
                                    id="support-title"
                                    type="text"
                                    className="form-control"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Brief description of the issue"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="support-description">Details</label>
                                <textarea
                                    id="support-description"
                                    className="form-control"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Please provide as much detail as possible..."
                                    rows={5}
                                    required
                                />
                                <small className="text-muted support-form-note">
                                    Your current page and browser details are captured automatically.
                                </small>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary support-submit-btn"
                                disabled={isSubmitting}
                            >
                                <Send size={16} />
                                {isSubmitting ? 'Submitting...' : 'Submit Issue'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Past Issues */}
                <div className="card support-issues-card">
                    <div className="support-issues-header">
                        <div>
                            <h3 className="support-card-title">My Submitted Issues</h3>
                            <p className="support-card-subtitle">Track the status of issues you've reported.</p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => { void loadIssues(currentPage); }}
                            disabled={isLoadingIssues}
                        >
                            Refresh
                        </button>
                    </div>

                    {isLoadingIssues && <p className="support-loading">Loading issues...</p>}
                    {!isLoadingIssues && issues.length === 0 && (
                        <div className="support-empty-state">
                            <CheckCircle size={40} className="support-empty-icon" />
                            <p>No issues reported yet.</p>
                        </div>
                    )}
                    {!isLoadingIssues && issues.length > 0 && (
                        <>
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Summary</th>
                                            <th>Category</th>
                                            <th>Status</th>
                                            <th>Reported</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issues.map((issue) => (
                                            <tr key={issue.id}>
                                                <td style={{ fontWeight: 500 }}>{issue.title}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{issue.category.toLowerCase()}</td>
                                                <td>
                                                    <span className={`badge ${getStatusBadgeClass(issue.status)}`}>
                                                        {issue.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <Clock size={14} className="text-muted" />
                                                        {new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div className="support-pagination">
                                    <button
                                        className="btn btn-sm btn-outline"
                                        disabled={currentPage === 1 || isLoadingIssues}
                                        onClick={() => { void loadIssues(currentPage - 1); }}
                                    >
                                        Previous
                                    </button>
                                    <span className="support-page-info">Page {currentPage} of {totalPages}</span>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        disabled={currentPage === totalPages || isLoadingIssues}
                                        onClick={() => { void loadIssues(currentPage + 1); }}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
