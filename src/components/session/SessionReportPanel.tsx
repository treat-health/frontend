import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Sparkles, ChevronDown, ChevronUp, FileText, CheckCircle, Clock } from 'lucide-react';
import { sessionReportService } from '../../services/sessionReport.service';
import type { SessionTranscript } from '../../services/sessionReport.service';
import './SessionReportPanel.css'; // We will create this next

interface SessionReportPanelProps {
    sessionId: string;
    onClose?: () => void;
    // Optional polling/refresh trigger
    refreshTrigger?: number;
}

function getSentimentColor(sentiment: SessionTranscript['sentiment']) {
    switch (sentiment) {
        case 'POSITIVE':
            return 'bg-success text-white';
        case 'NEGATIVE':
            return 'bg-danger text-white';
        case 'NEUTRAL':
            return 'bg-warning text-dark';
        default:
            return 'bg-gray-200 text-dark';
    }
}

export default function SessionReportPanel({ sessionId, onClose, refreshTrigger = 0 }: Readonly<SessionReportPanelProps>) {
    const [report, setReport] = useState<SessionTranscript | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);

    // Allow manual refresh if requested
    const [manualRefreshId, setManualRefreshId] = useState(0);

    const handleManualRefresh = () => {
        setManualRefreshId(prev => prev + 1);
    };

    const isPendingReportMessage = (value?: string | null) => {
        const normalized = (value || '').toLowerCase();
        return normalized.includes('report not available yet') || normalized.includes('still processing');
    };

    useEffect(() => {
        let mounted = true;
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await sessionReportService.getSessionReport(sessionId);
                if (mounted) {
                    setReport(data);
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err.message || "Failed to load report.");
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        if (sessionId) {
            fetchReport();
        }
        return () => { mounted = false; };
    }, [sessionId, refreshTrigger, manualRefreshId]);

    if (isLoading && !report) {
        return (
            <div className="report-panel loading-state">
                <div className="report-loading-shell" aria-live="polite" aria-busy="true">
                    <div className="report-loading-orbit">
                        <div className="report-loading-ring report-loading-ring-primary" />
                        <div className="report-loading-ring report-loading-ring-secondary" />
                        <div className="report-loading-core">
                            <Loader2 className="report-loading-icon text-primary" size={28} />
                        </div>
                    </div>

                    <div className="report-loading-copy">
                        <p className="report-loading-title">Loading AI Session Report...</p>
                        <p className="report-loading-subtitle">
                            Preparing transcript insights, session summary, and attention highlights.
                        </p>
                    </div>

                    <div className="report-loading-skeleton" aria-hidden="true">
                        <div className="report-loading-skeleton-line report-loading-skeleton-line-lg" />
                        <div className="report-loading-skeleton-line report-loading-skeleton-line-md" />
                        <div className="report-loading-skeleton-line report-loading-skeleton-line-sm" />
                    </div>
                </div>
            </div>
        );
    }

    if (error && !report) {
        if (isPendingReportMessage(error)) {
            return (
                <div className="report-panel pending-state">
                    <Clock size={32} className="text-warning" />
                    <p className="pending-title">AI report is not ready yet</p>
                    <p className="pending-copy">
                        The session finished, but the recording is still being prepared or processed. Please refresh in a moment.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleManualRefresh} className="btn-secondary" style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #e2e8f0', background: 'white' }}>
                            Refresh Status
                        </button>
                        {onClose && <button onClick={onClose} className="btn-close-report" style={{ padding: '6px 16px', borderRadius: '4px', background: 'none' }}>Close</button>}
                    </div>
                </div>
            );
        }

        return (
            <div className="report-panel error-state">
                <AlertCircle size={32} className="text-danger" />
                <p>{error}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleManualRefresh} className="btn-secondary" style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #e2e8f0', background: 'white' }}>
                        Refresh Status
                    </button>
                    {onClose && <button onClick={onClose} className="btn-close-report" style={{ padding: '6px 16px', borderRadius: '4px', background: 'none' }}>Close</button>}
                </div>
            </div>
        );
    }

    if (!report) return null;

    const sentimentColor = getSentimentColor(report.sentiment);

    const formatDuration = (seconds: number) => {
        if (!seconds || seconds <= 0) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="report-panel custom-scrollbar">
            <div className="report-header">
                <h3><Sparkles size={20} className="text-primary" /> AI Session Analysis</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="refresh-btn" onClick={handleManualRefresh} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Refresh
                    </button>
                    {onClose && <button className="close-btn" onClick={onClose}>&times;</button>}
                </div>
            </div>

            <div className="report-content">
                <div className="sentiment-badge-wrapper">
                    {report.sentiment ? (
                        <span className={`badge ${sentimentColor}`}>
                            Sentiment: {report.sentiment}
                        </span>
                    ) : (
                        <span className="badge bg-gray-200 text-dark" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>Sentiment: Unknown</span>
                    )}
                    <span className="analysis-time">
                        {report.generatedAt ? `Generated ${new Date(report.generatedAt).toLocaleString()}` : "Processing..."}
                    </span>
                </div>

                <div className="report-section summary-section">
                    <h4>Clinical Summary</h4>
                    <p>{report.summary || "No summary generated."}</p>
                </div>

                <div className="report-section key-points-section">
                    <h4>Key Points</h4>
                    {report.keyPoints && report.keyPoints.length > 0 ? (
                        <ul className="key-points-list">
                            {report.keyPoints.map((point, idx) => (
                                <li key={`${point}-${idx}`}><CheckCircle size={16} className="text-success" /> {point}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No key points identified.</p>
                    )}
                </div>

                {report.attentionMetrics && report.attentionMetrics.participants && (
                    <div className="report-section attention-section">
                        <h4>Attention Metrics</h4>
                        <div className="attention-grid">
                            {report.attentionMetrics.participants.map((participant) => (
                                <div key={`${participant.participantName}-${participant.role}`} className="attention-card">
                                    <h5>{participant.participantName}</h5>
                                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{participant.role}</p>
                                    <div className="attention-stats">
                                        <div className="stat-item">
                                            <span className="stat-label">Camera Off</span>
                                            <span className="stat-value">{formatDuration(participant.cameraOffSeconds)}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Mic Off</span>
                                            <span className="stat-value">{formatDuration(participant.micOffSeconds)}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Audio Inactive</span>
                                            <span className="stat-value text-warning">{formatDuration(participant.audioInactiveSeconds)}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Nudges</span>
                                            <span className="stat-value">{participant.nudgesCount}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {report.attentionMetrics.timeline && report.attentionMetrics.timeline.length > 0 && (
                            <div className="timeline-section" style={{ marginTop: '1.5rem' }}>
                                <button
                                    className="transcript-toggle-btn"
                                    onClick={() => setIsTimelineOpen(!isTimelineOpen)}
                                >
                                    <Clock size={18} />
                                    Event Timeline
                                    {isTimelineOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>

                                {isTimelineOpen && (
                                    <div className="transcript-body">
                                        <ul className="timeline-list">
                                            {report.attentionMetrics.timeline.map((event) => (
                                                <li key={`${event.timestamp}-${event.type}-${event.participantName}`} className="timeline-item">
                                                    <span className="timeline-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                                    <span className="timeline-user">{event.participantName}:</span>
                                                    <span className="timeline-type badge bg-gray-200">{event.type.replaceAll('_', ' ')}</span>
                                                    {event.reason && (
                                                        <span className="timeline-meta">({event.reason})</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="report-section transcript-section">
                    <button
                        className="transcript-toggle-btn"
                        onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
                    >
                        <FileText size={18} />
                        Full Session Transcript
                        {isTranscriptOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>

                    {isTranscriptOpen && (
                        <div className="transcript-body">
                            {report.text ? (
                                <div className="transcript-text">{report.text}</div>
                            ) : (
                                <p className="text-muted">Transcript text is unavailable.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
