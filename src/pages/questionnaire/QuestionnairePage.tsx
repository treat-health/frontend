import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User,
    Users,
    Baby,
    ChevronRight,
    ChevronLeft,
    Check,
    Info,
    Heart,
    Brain,
    Frown,
    AlertCircle,
    Moon,
    Zap,
    MessageSquare,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import '../../styles/questionnaire.css';
import BrandLogo from '../../components/common/BrandLogo';

// Question step definitions
const TOTAL_STEPS = 6;

interface QuestionnaireData {
    therapyType: string;
    ageRange: string;
    gender: string;
    concerns: string[];
    previousTherapy: string;
    therapistPreference: string;
}

/**
 * Get Started / Questionnaire Page
 */
export default function QuestionnairePage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [answers, setAnswers] = useState<QuestionnaireData>({
        therapyType: '',
        ageRange: '',
        gender: '',
        concerns: [],
        previousTherapy: '',
        therapistPreference: '',
    });

    // Move to next step
    const nextStep = () => {
        if (currentStep < TOTAL_STEPS) {
            setCurrentStep(currentStep + 1);
        } else {
            // Navigate to registration with data
            navigate('/register', { state: { questionnaireData: answers } });
        }
    };

    // Move to previous step
    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Check if current step is complete
    const isStepComplete = () => {
        switch (currentStep) {
            case 1:
                return answers.therapyType !== '';
            case 2:
                return answers.ageRange !== '';
            case 3:
                return answers.gender !== '';
            case 4:
                return answers.concerns.length > 0;
            case 5:
                return answers.previousTherapy !== '';
            case 6:
                return answers.therapistPreference !== '';
            default:
                return false;
        }
    };

    // Toggle concern selection
    const toggleConcern = (concern: string) => {
        setAnswers((prev) => ({
            ...prev,
            concerns: prev.concerns.includes(concern)
                ? prev.concerns.filter((c) => c !== concern)
                : [...prev.concerns, concern],
        }));
    };

    // Render progress bar
    const renderProgress = () => (
        <div className="progress-container">
            <div className="progress-steps">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div
                        key={i}
                        className={`progress-step ${i + 1 < currentStep
                            ? 'completed'
                            : i + 1 === currentStep
                                ? 'current'
                                : ''
                            }`}
                    />
                ))}
            </div>
        </div>
    );

    // Step 1: Therapy Type
    const renderTherapyType = () => (
        <div className="question-card">
            <h3 className="question-title">What type of therapy are you looking for?</h3>
            <div className="option-grid">
                <div
                    className={`option-card ${answers.therapyType === 'individual' ? 'selected' : ''}`}
                    onClick={() => setAnswers({ ...answers, therapyType: 'individual' })}
                >
                    <div className="option-icon">
                        <User size={24} />
                    </div>
                    <div className="option-content">
                        <div className="option-title">Individual (for myself)</div>
                        <div className="option-description">
                            One-on-one therapy sessions focused on your personal needs
                        </div>
                    </div>
                    <div className="option-check">
                        {answers.therapyType === 'individual' && <Check size={16} />}
                    </div>
                </div>

                <div
                    className={`option-card ${answers.therapyType === 'couples' ? 'selected' : ''}`}
                    onClick={() => setAnswers({ ...answers, therapyType: 'couples' })}
                >
                    <div className="option-icon">
                        <Users size={24} />
                    </div>
                    <div className="option-content">
                        <div className="option-title">Couples (for myself and my partner)</div>
                        <div className="option-description">
                            Relationship counseling for you and your significant other
                        </div>
                    </div>
                    <div className="option-check">
                        {answers.therapyType === 'couples' && <Check size={16} />}
                    </div>
                </div>

                <div
                    className={`option-card ${answers.therapyType === 'teen' ? 'selected' : ''}`}
                    onClick={() => setAnswers({ ...answers, therapyType: 'teen' })}
                >
                    <div className="option-icon">
                        <Baby size={24} />
                    </div>
                    <div className="option-content">
                        <div className="option-title">Teen (for my child)</div>
                        <div className="option-description">
                            Therapy for teenagers aged 13-17 with parental consent
                        </div>
                    </div>
                    <div className="option-check">
                        {answers.therapyType === 'teen' && <Check size={16} />}
                    </div>
                </div>
            </div>

            <div className="info-box">
                <div className="info-box-icon">
                    <Info size={16} />
                </div>
                <div className="info-box-text">
                    Let's walk through the process of finding the best therapist for you!
                    We'll start off with some basic questions.
                </div>
            </div>
        </div>
    );

    // Step 2: Age Range
    const renderAgeRange = () => (
        <div className="question-card">
            <h3 className="question-title">What is your age?</h3>
            <div className="option-grid">
                {[
                    { value: '18-24', label: '18-24 years old' },
                    { value: '25-34', label: '25-34 years old' },
                    { value: '35-44', label: '35-44 years old' },
                    { value: '45-54', label: '45-54 years old' },
                    { value: '55-64', label: '55-64 years old' },
                    { value: '65+', label: '65 years or older' },
                ].map((option) => (
                    <div
                        key={option.value}
                        className={`option-card ${answers.ageRange === option.value ? 'selected' : ''}`}
                        onClick={() => setAnswers({ ...answers, ageRange: option.value })}
                    >
                        <div className="option-content">
                            <div className="option-title">{option.label}</div>
                        </div>
                        <div className="option-check">
                            {answers.ageRange === option.value && <Check size={16} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // Step 3: Gender
    const renderGender = () => (
        <div className="question-card">
            <h3 className="question-title">What is your gender identity?</h3>
            <div className="option-grid">
                {[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'nonbinary', label: 'Non-binary' },
                    { value: 'other', label: 'Other / Prefer not to say' },
                ].map((option) => (
                    <div
                        key={option.value}
                        className={`option-card ${answers.gender === option.value ? 'selected' : ''}`}
                        onClick={() => setAnswers({ ...answers, gender: option.value })}
                    >
                        <div className="option-content">
                            <div className="option-title">{option.label}</div>
                        </div>
                        <div className="option-check">
                            {answers.gender === option.value && <Check size={16} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // Step 4: Concerns
    const concerns = [
        { value: 'depression', label: 'Depression', icon: Frown },
        { value: 'anxiety', label: 'Anxiety', icon: AlertCircle },
        { value: 'stress', label: 'Stress', icon: Zap },
        { value: 'relationships', label: 'Relationships', icon: Heart },
        { value: 'sleep', label: 'Sleep Issues', icon: Moon },
        { value: 'trauma', label: 'Trauma / PTSD', icon: Brain },
        { value: 'self-esteem', label: 'Self-esteem', icon: ShieldCheck },
        { value: 'other', label: 'Other', icon: MessageSquare },
    ];

    const renderConcerns = () => (
        <div className="question-card">
            <h3 className="question-title">What are you hoping to get help with?</h3>
            <p style={{ color: 'var(--gray-500)', marginBottom: 'var(--spacing-lg)' }}>
                Select all that apply
            </p>
            <div className="multi-option-grid">
                {concerns.map((concern) => (
                    <div
                        key={concern.value}
                        className={`multi-option-card ${answers.concerns.includes(concern.value) ? 'selected' : ''
                            }`}
                        onClick={() => toggleConcern(concern.value)}
                    >
                        <div className="multi-option-icon">
                            <concern.icon size={20} />
                        </div>
                        <div className="multi-option-label">{concern.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    // Step 5: Previous Therapy
    const renderPreviousTherapy = () => (
        <div className="question-card">
            <h3 className="question-title">Have you been in therapy before?</h3>
            <div className="option-grid">
                {[
                    { value: 'never', label: 'No, this will be my first time' },
                    { value: 'past', label: 'Yes, but not currently' },
                    { value: 'current', label: "Yes, I'm currently in therapy" },
                ].map((option) => (
                    <div
                        key={option.value}
                        className={`option-card ${answers.previousTherapy === option.value ? 'selected' : ''}`}
                        onClick={() => setAnswers({ ...answers, previousTherapy: option.value })}
                    >
                        <div className="option-content">
                            <div className="option-title">{option.label}</div>
                        </div>
                        <div className="option-check">
                            {answers.previousTherapy === option.value && <Check size={16} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    // Step 6: Therapist Preference
    const renderTherapistPreference = () => (
        <div className="question-card">
            <h3 className="question-title">Do you have a preference for your therapist?</h3>
            <div className="option-grid">
                {[
                    { value: 'no-preference', label: 'No preference' },
                    { value: 'male', label: 'I prefer a male therapist' },
                    { value: 'female', label: 'I prefer a female therapist' },
                ].map((option) => (
                    <div
                        key={option.value}
                        className={`option-card ${answers.therapistPreference === option.value ? 'selected' : ''
                            }`}
                        onClick={() => setAnswers({ ...answers, therapistPreference: option.value })}
                    >
                        <div className="option-content">
                            <div className="option-title">{option.label}</div>
                        </div>
                        <div className="option-check">
                            {answers.therapistPreference === option.value && <Check size={16} />}
                        </div>
                    </div>
                ))}
            </div>

            <div className="info-box">
                <div className="info-box-icon">
                    <Sparkles size={16} />
                </div>
                <div className="info-box-text">
                    Great news! Based on your answers, we have therapists available who can help you.
                    Let's create your account to get matched.
                </div>
            </div>
        </div>
    );

    // Render current step
    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return renderTherapyType();
            case 2:
                return renderAgeRange();
            case 3:
                return renderGender();
            case 4:
                return renderConcerns();
            case 5:
                return renderPreviousTherapy();
            case 6:
                return renderTherapistPreference();
            default:
                return null;
        }
    };

    return (
        <div className="questionnaire-page">
            {/* Header */}
            <header className="questionnaire-header">

                <Link to="/" className="questionnaire-logo">
                    <BrandLogo size="sm" />
                </Link>
                <Link to="/login" className="btn btn-ghost">Login</Link>
            </header>

            {/* Progress Bar */}
            {renderProgress()}

            {/* Content */}
            <div className="questionnaire-content">
                <h1 className="questionnaire-title">
                    Help us match you to the <span>right therapist</span>
                </h1>
                <p className="questionnaire-subtitle">
                    It's important to have a therapist who you can establish a personal connection with.
                    The following questions are designed to help match you to a licensed therapist based
                    on your needs and personal preferences.
                </p>

                {/* Question */}
                {renderCurrentStep()}

                {/* Navigation */}
                <div className="questionnaire-nav">
                    {currentStep > 1 ? (
                        <button className="btn btn-secondary" onClick={prevStep}>
                            <ChevronLeft size={18} />
                            Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <span className="step-indicator">
                        Step {currentStep} of {TOTAL_STEPS}
                    </span>

                    <button
                        className="btn btn-primary"
                        onClick={nextStep}
                        disabled={!isStepComplete()}
                    >
                        {currentStep === TOTAL_STEPS ? 'Create Account' : 'Continue'}
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
