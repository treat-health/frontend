import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/common/BrandLogo';
import api from '../../lib/api';
import type { ApiResponse } from '../../lib/api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await api.post<ApiResponse<null>>('/invite/forgot-password', { email });
            toast.success(response.data.message || 'If an account exists, a reset password email is on the way.');
            setIsSubmitted(true);
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message || 'Unable to request a password reset right now.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-layout">
            <div className="auth-sidebar">
                <div className="auth-sidebar-content">
                    <Link to="/login" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <BrandLogo variant="light" size="xl" className="mb-lg" />
                    </Link>
                    <p>
                        Securely reset your password and get back to your care journey.
                    </p>

                    <div className="features-list">
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Shield size={20} />
                            </div>
                            <span>Secure reset links with expiration</span>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <CheckCircle2 size={20} />
                            </div>
                            <span>Password reset works for both staff and clients</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="auth-main">
                <div className="auth-mobile-banner">
                    <BrandLogo variant="light" size="md" />
                </div>

                <div className="auth-form-container">
                    <div className="auth-header">
                        <h2>Forgot your password?</h2>
                        <p>Enter your email and we’ll send you a secure reset password link.</p>
                    </div>

                    {isSubmitted ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            background: 'rgba(56, 161, 105, 0.08)',
                            border: '1px solid rgba(56, 161, 105, 0.18)',
                            color: 'var(--gray-700)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#2f855a' }}>
                                <CheckCircle2 size={22} />
                                <strong>Reset password email sent</strong>
                            </div>
                            <p style={{ margin: 0, lineHeight: 1.6 }}>
                                If an account exists for <strong>{email}</strong>, you’ll receive a reset password link shortly.
                            </p>
                            <Link to="/login" className="btn btn-primary btn-lg w-full" style={{ textAlign: 'center', justifyContent: 'center' }}>
                                Back to login
                            </Link>
                        </div>
                    ) : (
                        <form className="auth-form" onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label className="input-label" htmlFor="forgot-password-email">
                                    Email address
                                </label>
                                <div className="input-with-icon">
                                    <Mail size={18} className="input-icon" />
                                    <input
                                        id="forgot-password-email"
                                        type="email"
                                        className="input-field"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg w-full"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Sending reset password email...' : 'Send reset password email'}
                            </button>

                            <Link
                                to="/login"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    color: 'var(--gray-600)',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                }}
                            >
                                <ArrowLeft size={16} />
                                Back to login
                            </Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}