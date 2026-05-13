import { useState } from 'react';
import {
    ArrowLeft,
    Bell,
    BookOpen,
    Calendar,
    ChevronRight,
    Clock,
    LifeBuoy,
    Lock,
    MessageSquare,
    Sparkles,
    Video,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import type { UserRole } from '../../../stores/authStore';
import FullPagePanel from '../../../components/common/FullPagePanel';
import {
    TUTORIAL_GUIDES,
    type TutorialGuide,
    type TutorialIllustrationType,
} from '../../../components/common/HelpWizard';
import './OnboardingGuideView.css';

/* ── Icon map ─────────────────────────────────────────────────────── */

const ILLUSTRATION_META: Record<
    TutorialIllustrationType,
    { icon: React.ElementType; color: string; bg: string }
> = {
    'join-session':  { icon: Video,          color: '#467174', bg: '#E6F4F5' },
    messages:        { icon: MessageSquare,  color: '#856644', bg: '#F5EDE3' },
    security:        { icon: Lock,           color: '#C0556E', bg: '#FDF0F3' },
    appointments:    { icon: Calendar,       color: '#C59D5F', bg: '#FAF3E8' },
    notifications:   { icon: Bell,           color: '#6366F1', bg: '#EEF2FF' },
    availability:    { icon: Clock,          color: '#0EA5E9', bg: '#E0F2FE' },
    support:         { icon: LifeBuoy,       color: '#16A34A', bg: '#DCFCE7' },
};

const STEP_COUNT_LABEL: Record<number, string> = {
    2: '2-step guide',
    3: '3-step guide',
    4: '4-step guide',
    5: '5-step guide',
};

function getTutorialRole(role?: UserRole): 'CLIENT' | 'THERAPIST' {
    return role === 'THERAPIST' ? 'THERAPIST' : 'CLIENT';
}

/* ── Tutorial card grid ───────────────────────────────────────────── */

function TutorialGrid({
    tutorials,
    onSelect,
}: Readonly<{ tutorials: TutorialGuide[]; onSelect: (g: TutorialGuide) => void }>) {
    return (
        <div className="ogv-grid-shell">
            <div className="ogv-grid-intro">
                <p className="ogv-grid-subtitle">
                    Choose a guide below to see step-by-step help for the tools you use most.
                </p>
            </div>
            <div className="ogv-tutorial-grid">
                {tutorials.map((guide) => {
                    const meta = ILLUSTRATION_META[guide.illustration];
                    const IconEl = meta.icon;
                    const stepLabel = STEP_COUNT_LABEL[guide.steps.length] ?? `${guide.steps.length}-step guide`;
                    return (
                        <button
                            key={guide.id}
                            type="button"
                            className="ogv-tutorial-card"
                            onClick={() => onSelect(guide)}
                        >
                            <div
                                className="ogv-card-icon-wrap"
                                style={{ background: meta.bg, color: meta.color }}
                            >
                                <IconEl size={26} />
                            </div>
                            <div className="ogv-card-body">
                                <div className="ogv-card-header">
                                    <h4 className="ogv-card-title">{guide.title}</h4>
                                    <ChevronRight size={16} className="ogv-card-arrow" />
                                </div>
                                <p className="ogv-card-summary">{guide.summary}</p>
                                <span className="ogv-step-pill">{stepLabel}</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Tutorial detail ──────────────────────────────────────────────── */

function TutorialDetail({
    guide,
    tutorialRole,
    onBack,
}: Readonly<{ guide: TutorialGuide; tutorialRole: 'CLIENT' | 'THERAPIST'; onBack: () => void }>) {
    const navigate = useNavigate();
    const meta = ILLUSTRATION_META[guide.illustration];
    const IconEl = meta.icon;

    return (
        <div className="ogv-detail">
            {/* breadcrumb */}
            <button type="button" className="ogv-back-btn" onClick={onBack}>
                <ArrowLeft size={15} />
                All Guides
            </button>

            {/* hero */}
            <div className="ogv-detail-hero">
                <div
                    className="ogv-detail-hero-icon"
                    style={{ background: meta.bg, color: meta.color }}
                >
                    <IconEl size={34} />
                </div>
                <div className="ogv-detail-hero-copy">
                    <span className="ogv-role-pill">
                        {tutorialRole === 'THERAPIST' ? 'Therapist guide' : 'Client guide'}
                    </span>
                    <h3 className="ogv-detail-title">{guide.title}</h3>
                    <p className="ogv-detail-desc">{guide.description}</p>
                </div>
            </div>

            {/* steps */}
            <div className="ogv-steps-label">Step-by-step</div>
            <ol className="ogv-steps-list">
                {guide.steps.map((step, i) => (
                    <li key={step.title} className="ogv-step-card">
                        <div className="ogv-step-num">{i + 1}</div>
                        <div className="ogv-step-copy">
                            <h5 className="ogv-step-title">{step.title}</h5>
                            <p className="ogv-step-desc">{step.description}</p>
                        </div>
                    </li>
                ))}
            </ol>

            {/* tips */}
            {guide.tips && guide.tips.length > 0 && (
                <div className="ogv-tips-box">
                    <div className="ogv-tips-heading">
                        <Sparkles size={14} />
                        Helpful tips
                    </div>
                    <ul className="ogv-tips-list">
                        {guide.tips.map((tip) => (
                            <li key={tip}>{tip}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* action */}
            <div className="ogv-detail-actions">
                <button type="button" className="btn btn-ghost" onClick={onBack}>
                    ← Back to guides
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(guide.route)}
                >
                    {guide.actionLabel}
                </button>
            </div>
        </div>
    );
}

/* ── Main view ────────────────────────────────────────────────────── */

interface OnboardingGuideViewProps {
    onClose: () => void;
    initialGuideId?: string;
}

export default function OnboardingGuideView({
    onClose,
    initialGuideId,
}: Readonly<OnboardingGuideViewProps>) {
    const { user } = useAuthStore();
    const tutorialRole = getTutorialRole(user?.role);
    const tutorials = TUTORIAL_GUIDES.filter((g) => g.role === tutorialRole);

    const [selected, setSelected] = useState<TutorialGuide | null>(() => {
        if (!initialGuideId) return null;
        return TUTORIAL_GUIDES.find((g) => g.id === initialGuideId) ?? null;
    });

    return (
        <FullPagePanel
            icon={BookOpen}
            iconColor="var(--secondary-700)"
            iconBg="var(--secondary-100)"
            title="Onboarding Guide"
            subtitle="Step-by-step guides for the portal"
            onClose={onClose}
        >
            {selected ? (
                <TutorialDetail
                    guide={selected}
                    tutorialRole={tutorialRole}
                    onBack={() => setSelected(null)}
                />
            ) : (
                <TutorialGrid tutorials={tutorials} onSelect={setSelected} />
            )}
        </FullPagePanel>
    );
}
