import {
    BarChart2,
    FileText,
    Users,
    Clock,
    TrendingUp,
    Calendar,
    Lock,
} from 'lucide-react';
import './ReportsPage.css';

interface ReportCategory {
    icon: React.ElementType;
    title: string;
    description: string;
    color: string;
    comingSoon: boolean;
}

const REPORT_CATEGORIES: ReportCategory[] = [
    {
        icon: FileText,
        title: 'Session Reports',
        description: 'Meeting minutes, session notes, key discussion points, and therapist observations.',
        color: '#5a7c7d',
        comingSoon: true,
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

/**
 * Reports Page — Scaffolded report categories for future implementation
 */
export default function ReportsPage() {
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
                <div className="reports-header-badge">
                    <Lock size={14} />
                    <span>Coming Soon</span>
                </div>
            </div>

            {/* Info Banner */}
            <div className="reports-banner">
                <BarChart2 size={20} />
                <div>
                    <strong>Reports are being built!</strong>
                    <p>
                        We're working on comprehensive reporting features including session minutes,
                        key discussion points, client progress tracking, and more.
                    </p>
                </div>
            </div>

            {/* Report Cards Grid */}
            <div className="reports-grid">
                {REPORT_CATEGORIES.map((category) => (
                    <div key={category.title} className="report-card">
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
                        </div>
                        <h3 className="report-card-title">{category.title}</h3>
                        <p className="report-card-desc">{category.description}</p>
                        <div className="report-card-footer">
                            <div className="report-placeholder-bar">
                                <div className="placeholder-fill" style={{ width: '0%' }} />
                            </div>
                            <span className="report-status">Not available yet</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
