import {
    BarChart2,
    FileText,
    Users,
    Clock,
    TrendingUp,
    Calendar,
    ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ReportsPage.css';

interface ReportCategory {
    icon: React.ElementType;
    title: string;
    description: string;
    color: string;
    comingSoon: boolean;
    route?: string;
}

const REPORT_CATEGORIES: ReportCategory[] = [
    {
        icon: FileText,
        title: 'Session Reports',
        description: 'AI-generated transcripts, clinical summaries, key discussion points, and sentiment analysis for every completed session.',
        color: '#5a7c7d',
        comingSoon: false,
        route: '/reports/sessions',
    },
    {
        icon: Users,
        title: 'Client Progress',
        description: 'Track client outcomes, treatment goals, and individual progress over time.',
        color: '#6366f1',
        comingSoon: true,
    },
    {
        icon: Clock,
        title: 'Attendance & Compliance',
        description: 'Session attendance rates, no-shows, cancellations, and compliance tracking.',
        color: '#f59e0b',
        comingSoon: true,
    },
    {
        icon: TrendingUp,
        title: 'Platform Analytics',
        description: 'User activity, engagement metrics, and overall platform usage statistics.',
        color: '#10b981',
        comingSoon: true,
    },
    {
        icon: Calendar,
        title: 'Scheduling Summary',
        description: 'Therapist utilization, appointment volume, and peak hours analysis.',
        color: '#3b82f6',
        comingSoon: true,
    },
];

export default function ReportsPage() {
    const navigate = useNavigate();

    return (
        <div className="reports-page">
            {/* Header */}
            <div className="reports-header">
                <div className="reports-header-text">
                    <h1>Reports</h1>
                    <p className="reports-subtitle">
                        Analytics, session records, and platform insights
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="reports-banner">
                <BarChart2 size={20} />
                <div>
                    <strong>Session Reports are live!</strong>
                    <p>
                        AI-generated session transcripts and clinical summaries are now available.
                        Additional reports are being built.
                    </p>
                </div>
            </div>

            {/* Report Cards Grid */}
            <div className="reports-grid">
                {REPORT_CATEGORIES.map((category) => {
                    const isLive = !category.comingSoon && !!category.route;
                    const cardContent = (
                        <>
                            <div className="report-card-header">
                                <div
                                    className="report-icon"
                                    style={{ backgroundColor: `${category.color}15`, color: category.color }}
                                >
                                    <category.icon size={24} />
                                </div>
                                {category.comingSoon && (
                                    <span className="coming-soon-badge">Coming Soon</span>
                                )}
                                {isLive && (
                                    <span className="live-badge">Live</span>
                                )}
                            </div>
                            <h3 className="report-card-title">{category.title}</h3>
                            <p className="report-card-desc">{category.description}</p>
                            <div className="report-card-footer">
                                {isLive ? (
                                    <div className="report-card-cta" style={{ color: category.color }}>
                                        View Reports <ArrowRight size={14} />
                                    </div>
                                ) : (
                                    <>
                                        <div className="report-placeholder-bar">
                                            <div className="placeholder-fill" style={{ width: '0%' }} />
                                        </div>
                                        <span className="report-status">Not available yet</span>
                                    </>
                                )}
                            </div>
                        </>
                    );

                    return isLive ? (
                        <button
                            key={category.title}
                            type="button"
                            className="report-card report-card-live report-card-btn"
                            onClick={() => navigate(category.route!)}
                            aria-label={`Open ${category.title}`}
                        >
                            {cardContent}
                        </button>
                    ) : (
                        <div key={category.title} className="report-card">
                            {cardContent}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
