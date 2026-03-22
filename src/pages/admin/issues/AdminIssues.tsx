import { useEffect, useState } from 'react';
import { issueApi } from '../../../services/issue.service';
import type { Issue, ListIssuesQuery } from '../../../types/issue.types';
import { IssueStatusEnum, IssueCategoryEnum } from '../../../types/issue.types';
import { Clock, MessageSquare, RefreshCw, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminIssueDrawer from './AdminIssueDrawer';
import '../../../styles/admin.css';

export default function AdminIssues() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState<ListIssuesQuery>({
        page: 1,
        limit: 20,
        sortOrder: 'desc',
        sortBy: 'createdAt',
    });
    
    // Quick View state
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

    useEffect(() => {
        loadIssues();
    }, [filters]);

    const loadIssues = async () => {
        setIsLoading(true);
        try {
            const result = await issueApi.listIssues(filters);
            if (result.success && result.data?.issues) {
                setIssues(result.data.issues);
            }
        } catch (error) {
            toast.error('Failed to load issues');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFilterChange = (key: keyof ListIssuesQuery, value: any) => {
        setFilters((prev: ListIssuesQuery) => ({ ...prev, [key]: value, page: 1 })); // Reset to page 1 on filter
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

    const getPriorityIcon = (priority: string) => {
        if (priority === 'HIGH') return <span title="High Priority" style={{color: 'var(--danger-color)'}}>🔴</span>;
        if (priority === 'MEDIUM') return <span title="Medium Priority" style={{color: 'var(--warning-color)'}}>🟡</span>;
        return <span title="Low Priority" style={{color: 'var(--success-color)'}}>🟢</span>;
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <h1>Issue Management</h1>
                    <p className="admin-subtitle">Track, assign, and resolve user reported issues</p>
                </div>
                <button className="btn btn-primary" onClick={loadIssues} disabled={isLoading}>
                    <RefreshCw size={18} style={{ marginRight: '0.5rem', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            <div className="admin-filters">
                <div className="search-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input 
                        type="text" 
                        placeholder="Search issues..." 
                        value={filters.search || ''}
                        onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
                    />
                </div>
                <select 
                    className="filter-select"
                    value={filters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                >
                    <option value="">All Statuses</option>
                    {(Object.values(IssueStatusEnum) as string[]).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>

                <select 
                    className="filter-select"
                    value={filters.category || ''}
                    onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                >
                    <option value="">All Categories</option>
                    {(Object.values(IssueCategoryEnum) as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="admin-table-container">
                {isLoading && issues.length === 0 ? (
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading issues...</p>
                    </div>
                ) : issues.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <h3>No issues found</h3>
                        <p>No issues match your current filters.</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Pri</th>
                                <th>Issue</th>
                                <th>Reporter</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issues.map((issue) => (
                                <tr key={issue.id}>
                                    <td style={{ textAlign: 'center' }}>
                                        {getPriorityIcon(issue.priority)}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{issue.title}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            {issue.category} • {issue._count?.comments || 0} <MessageSquare size={12} style={{display: 'inline', verticalAlign: 'middle'}}/>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="user-cell" style={{ gap: '0.5rem' }}>
                                            <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                                                {issue.createdBy?.firstName?.[0]}{issue.createdBy?.lastName?.[0]}
                                            </div>
                                            <div className="user-info">
                                                <span className="user-name">{issue.createdBy?.firstName} {issue.createdBy?.lastName}</span>
                                                <span className="user-email" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{issue.createdBy?.role}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusBadgeClass(issue.status) === 'badge-success' ? 'status-active' : getStatusBadgeClass(issue.status) === 'badge-primary' ? 'status-active' : 'status-inactive'}`} style={{ backgroundColor: `var(--${getStatusBadgeClass(issue.status).replace('badge-', '')}-color)`, color: '#fff', border: 'none' }}>
                                            {issue.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                            <Clock size={16} className="text-muted" />
                                            <span>{new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button 
                                                className="action-btn"
                                                title="View Issue Details"
                                                onClick={() => setSelectedIssueId(issue.id)}
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            {/* Quick View Drawer */}
            <AdminIssueDrawer
                issueId={selectedIssueId}
                onClose={() => setSelectedIssueId(null)}
                onIssueUpdated={loadIssues}
            />
        </div>
    );
}
