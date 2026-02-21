import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, MapPin, Briefcase, Heart, Shield, Users, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/common/BrandLogo';

/**
 * Register Page Component
 */
export default function RegisterPage() {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: 'CLIENT' as UserRole,
        state: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState(1);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        clearError();

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (formData.password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        try {
            await register({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone || undefined,
                role: formData.role,
                state: formData.state || undefined,
            });
            toast.success('Account created successfully!');
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.message || 'Registration failed');
        }
    };

    const nextStep = () => {
        if (step === 1) {
            if (!formData.firstName || !formData.lastName) {
                toast.error('Please fill in your name');
                return;
            }
        }
        setStep(step + 1);
    };

    const prevStep = () => setStep(step - 1);

    return (
        <div className="auth-layout">
            {/* Left Sidebar */}
            <div className="auth-sidebar">
                <div className="auth-sidebar-content">

                    {/* Logo - Clickable */}
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <BrandLogo variant="light" size="xl" className="mb-lg" />
                    </Link>
                    <p>
                        Start your journey to better mental health with personalized
                        care from our licensed professionals.
                    </p>

                    {/* Features */}
                    <div className="features-list">
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Heart size={20} />
                            </div>
                            <span>Personalized treatment plans</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Shield size={20} />
                            </div>
                            <span>HIPAA-compliant & secure</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Users size={20} />
                            </div>
                            <span>Licensed therapists</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Clock size={20} />
                            </div>
                            <span>Flexible scheduling</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Main Content */}
            <div className="auth-main">
                {/* Mobile Logo Banner - visible only when sidebar is hidden */}
                <div className="auth-mobile-banner">
                    <BrandLogo variant="light" size="md" />
                </div>

                <div className="auth-form-container">
                    <div className="auth-header">
                        <h2>Create your account</h2>
                        <p>Step {step} of 2</p>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        height: '4px',
                        background: 'var(--gray-200)',
                        borderRadius: 'var(--radius-full)',
                        marginBottom: 'var(--spacing-xl)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${step * 50}%`,
                            height: '100%',
                            background: 'var(--gradient-primary)',
                            transition: 'width var(--transition-normal)'
                        }} />
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        {/* Error Message */}
                        {error && (
                            <div className="auth-error" style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(229, 62, 62, 0.1)',
                                borderRadius: 'var(--radius-lg)',
                                color: 'var(--error-500)',
                                fontSize: '0.875rem',
                                textAlign: 'center'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Step 1: Personal Info */}
                        {step === 1 && (
                            <>
                                {/* Name Fields */}
                                <div className="flex gap-md">
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label className="input-label" htmlFor="firstName">
                                            First name
                                        </label>
                                        <div className="input-with-icon">
                                            <User size={18} className="input-icon" />
                                            <input
                                                id="firstName"
                                                name="firstName"
                                                type="text"
                                                className="input-field"
                                                placeholder="John"
                                                value={formData.firstName}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label className="input-label" htmlFor="lastName">
                                            Last name
                                        </label>
                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            className="input-field"
                                            placeholder="Doe"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Phone */}
                                <div className="input-group">
                                    <label className="input-label" htmlFor="phone">
                                        Phone number (optional)
                                    </label>
                                    <div className="input-with-icon">
                                        <Phone size={18} className="input-icon" />
                                        <input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            className="input-field"
                                            placeholder="+1 (555) 000-0000"
                                            value={formData.phone}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                {/* Role & State */}
                                <div className="flex gap-md">
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label className="input-label" htmlFor="role">
                                            I am a
                                        </label>
                                        <div className="input-with-icon">
                                            <Briefcase size={18} className="input-icon" />
                                            <select
                                                id="role"
                                                name="role"
                                                className="input-field"
                                                value={formData.role}
                                                onChange={handleChange}
                                                style={{ paddingLeft: '2.75rem' }}
                                            >
                                                <option value="CLIENT">Client</option>
                                                <option value="THERAPIST">Therapist</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label className="input-label" htmlFor="state">
                                            State
                                        </label>
                                        <div className="input-with-icon">
                                            <MapPin size={18} className="input-icon" />
                                            <select
                                                id="state"
                                                name="state"
                                                className="input-field"
                                                value={formData.state}
                                                onChange={handleChange}
                                                style={{ paddingLeft: '2.75rem' }}
                                            >
                                                <option value="">Select state</option>
                                                <option value="CA">California</option>
                                                <option value="TX">Texas</option>
                                                <option value="WA">Washington</option>
                                                <option value="TN">Tennessee</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary btn-lg w-full"
                                    onClick={nextStep}
                                >
                                    Continue
                                </button>
                            </>
                        )}

                        {/* Step 2: Account Info */}
                        {step === 2 && (
                            <>
                                {/* Email */}
                                <div className="input-group">
                                    <label className="input-label" htmlFor="email">
                                        Email address
                                    </label>
                                    <div className="input-with-icon">
                                        <Mail size={18} className="input-icon" />
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            className="input-field"
                                            placeholder="you@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="input-group">
                                    <label className="input-label" htmlFor="password">
                                        Password
                                    </label>
                                    <div className="input-with-icon">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            className="input-field"
                                            placeholder="At least 8 characters"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="input-icon-right"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex={-1}
                                            style={{ background: 'none', border: 'none' }}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div className="input-group">
                                    <label className="input-label" htmlFor="confirmPassword">
                                        Confirm password
                                    </label>
                                    <div className="input-with-icon">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            className="input-field"
                                            placeholder="Confirm your password"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            required
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-md">
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-lg"
                                        onClick={prevStep}
                                        style={{ flex: '0 0 auto' }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-lg"
                                        disabled={isLoading}
                                        style={{ flex: 1 }}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="spinner" />
                                                Creating account...
                                            </>
                                        ) : (
                                            'Create account'
                                        )}
                                    </button>
                                </div>

                                {/* Terms */}
                                <p style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--gray-500)',
                                    textAlign: 'center'
                                }}>
                                    By creating an account, you agree to our{' '}
                                    <Link to="/terms">Terms of Service</Link> and{' '}
                                    <Link to="/privacy">Privacy Policy</Link>.
                                </p>
                            </>
                        )}
                    </form>

                    <div className="auth-footer">
                        Already have an account?{' '}
                        <Link to="/login">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
