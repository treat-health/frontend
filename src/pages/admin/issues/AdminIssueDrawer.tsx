import { useState, useEffect } from 'react';
import { X, MessageSquare, ShieldAlert, Send } from 'lucide-react';
import { issueApi } from '../../../services/issue.service';
import type { Issue } from '../../../types/issue.types';
import { IssueStatusEnum } from '../../../types/issue.types';
import toast from 'react-hot-toast';

export interface AdminIssueDrawerProps {
    issueId: string | null;
    onClose: () => void;
    onIssueUpdated: () => void;
}

export default function AdminIssueDrawer({ issueId, onClose, onIssueUpdated }: AdminIssueDrawerProps) {
    const [issue, setIssue] = useState<Issue | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [newComment, setNewComment] = useState('');
    const [isInternalComment, setIsInternalComment] = useState(false);
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [statusUpdate, setStatusUpdate] = useState<string>('');

    useEffect(() => {
        if (issueId) {
            loadIssueDetails();
        } else {
            setIssue(null);
        }
    }, [issueId]);

    const loadIssueDetails = async () => {
        setIsLoading(true);
        try {
            const result = await issueApi.getIssueById(issueId!);
            if (result.success && result.data) {
                setIssue(result.data);
                setStatusUpdate(result.data.status);
            }
        } catch (error) {
            toast.error('Failed to load issue details');
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        if (!issue || newStatus === issue.status) return;
        
        try {
            await issueApi.updateIssueStatus(issue.id, { status: newStatus as any });
            toast.success('Status updated');
            onIssueUpdated();
            loadIssueDetails(); // refresh details
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update status');
            setStatusUpdate(issue.status); // revert
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !issue) return;

        setIsAddingComment(true);
        try {
            await issueApi.addComment(issue.id, {
                message: newComment,
                isInternal: isInternalComment
            });
            toast.success('Comment added');
            setNewComment('');
            setIsInternalComment(false);
            loadIssueDetails(); // Refresh to get the new comment
        } catch (error) {
            toast.error('Failed to add comment');
        } finally {
            setIsAddingComment(false);
        }
    };

    if (!issueId) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-surface)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-5px 0 20px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Issue #{issue?.id.slice(0, 8)}</h2>
                        <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                            Reported by {issue?.createdBy?.firstName} {issue?.createdBy?.lastName}
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {isLoading && !issue ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>Loading details...</div>
                ) : issue ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                        
                        {/* Title & Description */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{issue.title}</h3>
                            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{issue.description}</p>
                        </div>

                        {/* Metadata & Status Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', backgroundColor: 'var(--gray-50)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                                <select 
                                    className="filter-select" 
                                    style={{ width: '100%' }}
                                    value={statusUpdate}
                                    onChange={(e) => {
                                        setStatusUpdate(e.target.value);
                                        handleUpdateStatus(e.target.value);
                                    }}
                                >
                                    {Object.values(IssueStatusEnum).map((s: string) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>Category</label>
                                <div style={{ textTransform: 'capitalize' }}>{issue.category.toLowerCase()}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>Captured Route</label>
                                <div style={{ fontSize: '0.875rem', wordBreak: 'break-all' }}>{issue.metadata?.route || 'N/A'}</div>
                            </div>
                        </div>

                        <hr style={{ borderColor: 'var(--gray-200)', margin: '2rem 0', opacity: 0.5 }} />

                        {/* Comments Section */}
                        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MessageSquare size={18} />
                            <h3 style={{ margin: 0 }}>Conversation & Notes</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            {issue.comments?.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No comments yet.
                                </div>
                            ) : (
                                issue.comments?.map(comment => (
                                    <div key={comment.id} style={{ 
                                        padding: '1rem', 
                                        borderRadius: '8px', 
                                        backgroundColor: comment.isInternal ? 'rgba(255, 193, 7, 0.1)' : 'var(--gray-50)',
                                        border: comment.isInternal ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid transparent'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <strong style={{ fontSize: '0.875rem' }}>{comment.author?.firstName} {comment.author?.lastName}</strong>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                            </span>
                                        </div>
                                        {comment.isInternal && (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--warning-color)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                                <ShieldAlert size={12} /> Internal Note
                                            </div>
                                        )}
                                        <p style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{comment.message}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Comment Form */}
                        <form onSubmit={handleAddComment} style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1.5rem' }}>
                            <div className="form-group">
                                <textarea 
                                    className="form-control" 
                                    rows={3} 
                                    placeholder="Type a reply or internal note..."
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={isInternalComment}
                                        onChange={e => setIsInternalComment(e.target.checked)}
                                    />
                                    <span>Internal Note (Hidden from user)</span>
                                </label>
                                <button type="submit" className="btn btn-primary btn-sm" disabled={isAddingComment || !newComment.trim()}>
                                    <Send size={16} style={{ marginRight: '0.5rem' }} />
                                    Send
                                </button>
                            </div>
                        </form>
                        
                    </div>
                ) : null}
            </div>
        </div>
    );
}
