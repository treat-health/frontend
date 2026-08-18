import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import logoImage from '../../assets/logo.png';
import type { ApiResponse } from '../../lib/api';
import type { User } from '../../stores/authStore';
import './InvitePage.css';

interface InviteValidation {
    valid: boolean;
    expired: boolean;
    alreadyAccepted: boolean;
    user?: {
        email: string;
        firstName: string;
        lastName: string;
        emailVerified?: boolean;
    };
    expiresAt?: string;
}

export default function ActivateAccountPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
    const returnTo = useMemo(() => searchParams.get('returnTo')?.trim() || '', [searchParams]);
    const safeReturnTo = useMemo(
        () => (returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/appointments'),
        [returnTo]
    );
    const encodedSafeReturnTo = useMemo(() => encodeURIComponent(safeReturnTo), [safeReturnTo]);
    const loginHref = `/login?returnTo=${encodedSafeReturnTo}`;
    const requestActivationHref = `/activate-account/request?returnTo=${encodedSafeReturnTo}`;

    const [isValidating, setIsValidating] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validation, setValidation] = useState<InviteValidation | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError('Missing activation token');
                setIsValidating(false);
                return;
            }

            try {
                const response = await api.get<ApiResponse<InviteValidation>>(`/invite/${token}`);
                if (response.data.success && response.data.data) {
                    setValidation(response.data.data);
                } else {
                    setError(response.data.message || 'Invalid activation link');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to validate activation link');
            } finally {
                setIsValidating(false);
            }
        };

        validateToken();
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

        setIsSubmitting(true);
        try {
            const response = await api.post<ApiResponse<User>>('/auth/activate/verify', {
                token,
                password,
                confirmPassword,
            });

            if (response.data.success) {
                toast.success('Account activated! You can now log in.');
                navigate(loginHref);
            } else {
                throw new Error(response.data.message || 'Failed to activate account');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || 'Failed to activate account');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isValidating) {
        return (
            <div className="invite-page">
                <div className="invite-card">
                    <div className="invite-loading">
                        <div className="spinner" />
                        <p>Validating your activation link...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !validation) {
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
                        <p>{error || 'This activation link is not valid.'}</p>
                        <Link to={requestActivationHref} className="btn btn-secondary">
                            Request new activation email
                        </Link>
                        <Link to={loginHref} className="btn btn-primary">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (validation.alreadyAccepted) {
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
                        <p>This account is already activated. You can log in with your email and password.</p>
                        <Link to={loginHref} className="btn btn-primary">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (validation.expired) {
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
                        <p>This activation link has expired. Please contact support or your provider for a new link.</p>
                        <Link to={requestActivationHref} className="btn btn-primary">
                            Request new activation email
                        </Link>
                        <Link to={loginHref} className="btn btn-secondary">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                    <h1>Activate your account</h1>
                    <p className="invite-subtitle">
                        Welcome to Treat Health, {validation.user?.firstName}. Set your password to continue.
                    </p>

                    <form onSubmit={handleSubmit} className="invite-form">
                        <div className="form-group">
                            <label htmlFor="activate-email">Email</label>
                            <input
                                id="activate-email"
                                type="email"
                                value={validation.user?.email || ''}
                                disabled
                                className="input-disabled"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="activate-password">Password</label>
                            <div className="password-input">
                                <input
                                    id="activate-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Create a password"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
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
                            <span className="input-hint">Must be at least 8 characters and include uppercase, lowercase, a number, and a special character.</span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="activate-confirm-password">Confirm password</label>
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
                                'Activate account'
                            )}
                        </button>
                    </form>
                </div>

                <div className="invite-footer">
                    <p>Already activated? <Link to={loginHref}>Log in</Link></p>
                </div>
            </div>
        </div>
    );
}