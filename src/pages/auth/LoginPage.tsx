import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Heart, Shield, Users, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

/**
 * Login Page Component
 */
export default function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        clearError();

        try {
            await login({ email, password });
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (err: any) {
            toast.error(err.message || 'Login failed');
        }
    };

    return (
        <div className="auth-layout">
            {/* Left Sidebar */}
            <div className="auth-sidebar">
                <div className="auth-sidebar-content">
                    {/* Logo - Clickable */}
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <svg
                            className="auth-sidebar-logo"
                            viewBox="0 0 80 80"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle cx="40" cy="40" r="38" stroke="white" strokeWidth="2" fill="rgba(255,255,255,0.1)" />
                            <path
                                d="M40 20C40 20 25 30 25 42C25 50.284 31.716 57 40 57C48.284 57 55 50.284 55 42C55 30 40 20 40 20Z"
                                fill="white"
                            />
                            <path
                                d="M40 24C40 24 29 32 29 42C29 48.075 33.925 53 40 53C46.075 53 51 48.075 51 42C51 32 40 24 40 24Z"
                                fill="rgba(102, 126, 234, 0.8)"
                            />
                            <circle cx="40" cy="40" r="6" fill="white" />
                            <path
                                d="M37 40H43M40 37V43"
                                stroke="rgba(102, 126, 234, 0.9)"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>

                        <h1 style={{ color: 'white' }}>Treat Health</h1>
                    </Link>
                    <p>
                        Empowering your journey to mental wellness with compassionate,
                        personalized care from licensed therapists.
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
                <div className="auth-form-container">
                    <div className="auth-header">
                        <h2>Welcome back</h2>
                        <p>Sign in to continue your wellness journey</p>
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

                        {/* Email Field */}
                        <div className="input-group">
                            <label className="input-label" htmlFor="email">
                                Email address
                            </label>
                            <div className="input-with-icon">
                                <Mail size={18} className="input-icon" />
                                <input
                                    id="email"
                                    type="email"
                                    className="input-field"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="input-group">
                            <div className="flex justify-between items-center">
                                <label className="input-label" htmlFor="password">
                                    Password
                                </label>
                                <Link to="/forgot-password" style={{ fontSize: '0.8125rem' }}>
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="input-with-icon">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="input-field"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
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

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        Don't have an account?{' '}
                        <Link to="/register">Create one now</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
