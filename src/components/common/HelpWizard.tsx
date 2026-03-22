import { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { issueApi } from '../../services/issue.service';
import { IssueCategoryEnum } from '../../types/issue.types';
import type { IssueCategory, CreateIssueInput, IssueMetadata } from '../../types/issue.types';
import toast from 'react-hot-toast';
import { Clock } from 'lucide-react';
import type { Issue } from '../../types/issue.types';

export interface HelpWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HelpWizard({ isOpen, onClose }: HelpWizardProps) {
    const location = useLocation();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<IssueCategory>(IssueCategoryEnum.TECHNICAL);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<'report' | 'past'>('report');

    // Past issues state
    const [pastIssues, setPastIssues] = useState<Issue[]>([]);
    const [isLoadingPast, setIsLoadingPast] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadPastIssues = async (page: number) => {
        setIsLoadingPast(true);
        try {
            const result = await issueApi.listIssues({ page, limit: 5, sortOrder: 'desc', sortBy: 'createdAt' });
            if (result.success && result.data) {
                setPastIssues(result.data.issues);
                setTotalPages(result.data.pagination.totalPages);
                setCurrentPage(result.data.pagination.page);
            }
        } catch (error) {
            toast.error('Failed to load past issues');
        } finally {
            setIsLoadingPast(false);
        }
    };

    // Load past issues when tab changes
    useEffect(() => {
        if (isOpen && activeTab === 'past') {
            loadPastIssues(1);
        }
    }, [isOpen, activeTab]);

    // Auto-suggest title based on location
    useEffect(() => {
        if (isOpen && !title) {
            setTitle(`Issue on ${location.pathname}`);
        }
    }, [isOpen, location.pathname, title]);

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setIsSuccess(false);
                setTitle('');
                setDescription('');
                setCategory(IssueCategoryEnum.TECHNICAL);
                setActiveTab('report');
                setCurrentPage(1);
            }, 300);
        }
    }, [isOpen]);

    if (!isOpen) return null;

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
            platform: navigator.platform,
        };

        const input: CreateIssueInput = {
            title,
            description,
            category,
            metadata,
        };

        try {
            await issueApi.createIssue(input);
            setIsSuccess(true);
            toast.success('Issue reported successfully!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to report issue. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewMyIssues = () => {
        setIsSuccess(false);
        setActiveTab('past');
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'RESOLVED':
            case 'CLOSED': return 'badge-success';
            case 'IN_PROGRESS': return 'badge-primary';
            case 'BLOCKED': return 'badge-danger';
            case 'OPEN': return 'badge-error';
            default: return 'badge-warning';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header" style={{ paddingBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Help & Support</h3>
                        <button className="btn btn-icon btn-ghost" onClick={onClose} style={{ marginTop: '-0.5rem', marginRight: '-0.5rem' }}>
                            <X size={20} />
                        </button>
                    </div>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', width: '100%' }}>
                        <button 
                            style={{ background: 'none', border: 'none', padding: '0.75rem 0', fontWeight: activeTab === 'report' ? 600 : 400, color: activeTab === 'report' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'report' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', outline: 'none' }}
                            onClick={() => setActiveTab('report')}
                        >
                            Report Issue
                        </button>
                        <button 
                            style={{ background: 'none', border: 'none', padding: '0.75rem 0', fontWeight: activeTab === 'past' ? 600 : 400, color: activeTab === 'past' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'past' ? '2px solid var(--primary-color)' : '2px solid transparent', cursor: 'pointer', outline: 'none' }}
                            onClick={() => setActiveTab('past')}
                        >
                            Past Issues
                        </button>
                    </div>
                </div>
                
                <div className="modal-body" style={{ minHeight: '350px' }}>
                    {activeTab === 'report' ? (
                        isSuccess ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <CheckCircle size={48} style={{ color: 'var(--success-color)', margin: '0 auto 1rem' }} />
                            <h4>Issue Submitted</h4>
                            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                                Our team has been notified and will review your issue shortly.
                            </p>
                            <button className="btn btn-primary" onClick={handleViewMyIssues} style={{ width: '100%' }}>
                                View My Issues
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="category">Category</label>
                                <select 
                                    id="category"
                                    className="form-control"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                                >
                                    <option value={IssueCategoryEnum.TECHNICAL}>Technical Issue</option>
                                    <option value={IssueCategoryEnum.SESSION}>Video / Session Problem</option>
                                    <option value={IssueCategoryEnum.BILLING}>Billing</option>
                                    <option value={IssueCategoryEnum.ACCOUNT}>Account Management</option>
                                    <option value={IssueCategoryEnum.OTHER}>Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="title">Summary / Subject</label>
                                <input
                                    id="title"
                                    type="text"
                                    className="form-control"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Brief description of the issue"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Details</label>
                                <textarea
                                    id="description"
                                    className="form-control"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Please provide as much detail as possible..."
                                    rows={5}
                                    required
                                />
                                <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                    System automatically captures your current page and browser details for debugging.
                                </small>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Issue'}
                                </button>
                            </div>
                        </form>
                    ) ) : (
                        <div>
                            {isLoadingPast ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading past issues...</div>
                            ) : pastIssues.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    You have no previously reported issues.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {pastIssues.map(issue => (
                                        <div key={issue.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{issue.title}</h4>
                                                <span className={`badge ${getStatusBadgeClass(issue.status)}`} style={{ fontSize: '0.7rem' }}>
                                                    {issue.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {issue.description.length > 80 ? issue.description.substring(0, 80) + '...' : issue.description}
                                            </p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <div style={{ textTransform: 'capitalize' }}>{issue.category.toLowerCase()}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Clock size={12} /> {new Date(issue.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                                            <button 
                                                className="btn btn-sm btn-outline" 
                                                disabled={currentPage === 1 || isLoadingPast}
                                                onClick={() => loadPastIssues(currentPage - 1)}
                                            >
                                                Prev
                                            </button>
                                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button 
                                                className="btn btn-sm btn-outline" 
                                                disabled={currentPage === totalPages || isLoadingPast}
                                                onClick={() => loadPastIssues(currentPage + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
