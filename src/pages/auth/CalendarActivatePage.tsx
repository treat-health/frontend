import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import logoImage from '../../assets/logo.png';
import { useAuthStore } from '../../stores/authStore';
import type { ApiResponse } from '../../lib/api';
import './InvitePage.css';

interface ActivateResponse {
    user: any;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}

/**
 * CalendarActivatePage - Public page for clients imported via Google Calendar to activate their accounts and set a password.
 */
export default function CalendarActivatePage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { setUser } = useAuthStore();

    const [status, setStatus] = useState<'loading' | 'missing' | 'form' | 'invalid' | 'already_used' | 'expired'>('loading');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus('missing');
        } else {
            setStatus('form');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        // Validate password complexity to match backend passwordRegex
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            toast.error('Password must contain uppercase, lowercase, number, and special character');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post<ApiResponse<ActivateResponse>>('/auth/activate-calendar-import', {
                token,
                password,
            });

            if (response.data.success && response.data.data) {
                const { user, tokens } = response.data.data;
                setUser(user, tokens);
                toast.success('Account activated! Welcome to Treat Health.');
                navigate('/dashboard');
            } else {
                throw new Error(response.data.message || 'Failed to activate account');
            }
        } catch (err: any) {
            const errorCode = err.response?.data?.code;
            const statusCode = err.response?.status;

            if (statusCode === 401 || errorCode === 'INVALID_TOKEN') {
                setStatus('invalid');
            } else if (statusCode === 410 && errorCode === 'TOKEN_ALREADY_USED') {
                setStatus('already_used');
            } else if (statusCode === 410 && errorCode === 'TOKEN_EXPIRED') {
                setStatus('expired');
            } else {
                const message = err.response?.data?.message || err.message || 'Failed to activate account';
                toast.error(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading State
    if (status === 'loading') {
        return (
            <div className="invite-page">
                <div className="invite-card">
                    <div className="invite-loading">
                        <div className="spinner" />
                        <p>Verifying your activation link…</p>
                    </div>
                </div>
            </div>
        );
    }

    // Token Missing State
    if (status === 'missing') {
        return (
            <div className="invite-page">
                <div className="invite-card">
                    <div className="invite-error">
                        <div className="error-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M15 9l-6 6" />
                                <path d="M9 9l6 6" />
                            </svg>
                        </div>
                        <h2>Invalid Activation Link</h2>
                        <p>Invalid activation link</p>
                        <Link to="/login" className="btn btn-primary">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Token Invalid State
    if (status === 'invalid') {
        return (
            <div className="invite-page">
                <div className="invite-card">
                    <div className="invite-error">
                        <div className="error-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M15 9l-6 6" />
                                <path d="M9 9l6 6" />
                            </svg>
                        </div>
                        <h2>Invalid Link</h2>
                        <p>Activation link not found</p>
                        <Link to="/login" className="btn btn-primary">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Already Used State
    if (status === 'already_used') {
        return (
            <div className="invite-page">
                <div className="invite-card">
                    <div className="invite-info">
                        <div className="info-icon success">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h2>Already Activated</h2>
                        <p>Account already activated</p>
                        <Link to="/login" className="btn btn-primary">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Expired State
    if (status === 'expired') {
        return (
            <div className="invite-page">
                <div className="invite-card">
                    <div className="invite-info">
                        <div className="info-icon warning">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <h2>Activation Link Expired</h2>
                        <p>This link has expired (links are valid for 7 days). Please contact your care coordinator for a new one.</p>
                        <Link to="/login" className="btn btn-secondary">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Valid - Show Password Form
    return (
        <div className="invite-page">
            <div className="invite-card">
                <div className="invite-header">
                    <div className="brand">
                        <div className="brand-icon">
                            <img src={logoImage} alt="Treat Health logo" className="brand-icon-image" />
                        </div>
                        <span>Treat Health</span>
                    </div>
                </div>

                <div className="invite-body">
                    <h1>Activate Account</h1>
                    <p className="invite-subtitle">
                        Enter a strong password to activate the account associated with this link.
                    </p>

                    <form onSubmit={handleSubmit} className="invite-form">
                        <div className="form-group">
                            <label htmlFor="activate-password">New Password</label>
                            <div className="password-input">
                                <input
                                    id="activate-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your new password"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <span className="input-hint">Must contain uppercase, lowercase, number, and special character</span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="activate-confirm-password">Confirm Password</label>
                            <input
                                id="activate-confirm-password"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="spinner spinner-small" />
                                    Activating account...
                                </>
                            ) : (
                                'Activate Account'
                            )}
                        </button>
                    </form>
                </div>

                <div className="invite-footer">
                    <p>Already set your password? <Link to="/login">Log in</Link></p>
                </div>
            </div>
        </div>
    );
}
