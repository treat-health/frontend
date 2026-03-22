import { useEffect, useState } from 'react';
import { issueApi } from '../../services/issue.service';
import type { Issue } from '../../types/issue.types';
import { Clock, CheckCircle } from 'lucide-react';

export default function MyIssues() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadIssues();
    }, []);

    const loadIssues = async () => {
        setIsLoading(true);
        try {
            const result = await issueApi.listIssues();
            if (result.success && result.data?.issues) {
                setIssues(result.data.issues);
            }
        } catch (error) {
            console.error('Failed to load issues', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'RESOLVED':
            case 'CLOSED':
                return 'badge-success';
            case 'IN_PROGRESS':
                return 'badge-primary';
            case 'BLOCKED':
                return 'badge-danger';
            default:
                return 'badge-warning';
        }
    };

    if (isLoading) {
        return <div className="page-container"><p>Loading issues...</p></div>;
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Support Issues</h1>
                    <p className="page-subtitle">Track the status of issues you've reported</p>
                </div>
            </div>

            {issues.length === 0 ? (
                <div className="empty-state">
                    <CheckCircle size={48} className="text-success" style={{ marginBottom: '1rem' }} />
                    <h3>No Issues Found</h3>
                    <p className="text-muted">You haven't reported any issues yet.</p>
                </div>
            ) : (
                <div className="card">
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th>Date Reported</th>
                                    <th>Last Updated</th>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Clock size={16} className="text-muted" />
                                                <span>{new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        </td>
                                        <td>{new Date(issue.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
