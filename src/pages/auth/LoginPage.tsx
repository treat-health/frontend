import { useState, useRef, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Heart, Shield, Users, Clock, Smartphone, ArrowLeft, Loader2, QrCode, Copy, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/common/BrandLogo';
import mfaService from '../../services/mfa.service';

/**
 * Login Page Component — supports email/password + optional MFA step
 */
export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login, verifyEmailOtp, resendEmailOtp, verifyMfa, clearMfa, mfaPending, mfaSetupPending, mfaToken, emailOtpPending, isLoading, error, clearError } = useAuthStore();

    // Step 1 state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2 (MFA Verify) state
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

    // Step 2b (Email OTP resend) state
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining

    // Step 3 (MFA Setup) state
    const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; manualCode: string } | null>(null);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [isEnabling, setIsEnabling] = useState(false);

    useEffect(() => {
        if (mfaPending || emailOtpPending) {
            setTimeout(() => digitRefs.current[0]?.focus(), 50);
        }
        if (mfaSetupPending && mfaToken && !setupData && !isSettingUp) {
            setIsSettingUp(true);
            mfaService.setup(mfaToken)
                .then(data => setSetupData(data))
                .catch(err => toast.error(err.response?.data?.message || 'Failed to start MFA setup'))
                .finally(() => setIsSettingUp(false));
        }
    }, [mfaPending, emailOtpPending, mfaSetupPending, mfaToken, setupData, isSettingUp]);

    // Resend cooldown countdown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const handleLoginSubmit = async (e: FormEvent) => {
        e.preventDefault();
        clearError();
        try {
            await login({ email, password });
            // If no MFA/OTP challenge, login() sets isAuthenticated and we navigate
            const state = useAuthStore.getState();
            if (!state.mfaPending && !state.emailOtpPending && !state.mfaSetupPending) {
                toast.success('Welcome back!');
                const returnTo = searchParams.get('returnTo');
                const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
                navigate(safeReturnTo);
            }
        } catch (err: any) {
            toast.error(err.message || 'Login failed');
        }
    };

    const handleDigitChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);
        if (digit && index < 5) digitRefs.current[index + 1]?.focus();
        if (digit && index === 5) {
            const code = next.join('');
            if (code.length === 6) {
                emailOtpPending ? submitEmailOtpCode(code) : submitMfaCode(code);
            }
        }
    };

    const handleDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            digitRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter') {
            const code = digits.join('');
            if (code.length === 6) {
                emailOtpPending ? submitEmailOtpCode(code) : submitMfaCode(code);
            }
        }
    };

    const handleDigitPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const next = [...digits];
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        const focusIndex = Math.min(pasted.length, 5);
        digitRefs.current[focusIndex]?.focus();
        if (pasted.length === 6) {
            emailOtpPending ? submitEmailOtpCode(pasted) : submitMfaCode(pasted);
        }
    };

    const submitEmailOtpCode = async (code: string) => {
        clearError();
        try {
            const mfaSetupRecommended = await verifyEmailOtp(code);
            const state = useAuthStore.getState();
            if (state.isAuthenticated) {
                const returnTo = searchParams.get('returnTo');
                navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard');
                if (mfaSetupRecommended) {
                    // Clickable nudge — takes user to security settings
                    setTimeout(() => {
                        toast(
                            (t) => (
                                <span
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        navigate('/settings?tab=security');
                                    }}
                                >
                                    🔐 <span><strong>Set up your Authenticator App</strong> for stronger security. <u>Go to Settings →</u></span>
                                </span>
                            ),
                            { duration: 10000, style: { maxWidth: 420 } }
                        );
                    }, 600);
                } else {
                    toast.success('Welcome back!');
                }
            }
            // if mfaPending, component re-renders to TOTP challenge automatically
        } catch (err: any) {
            toast.error(err.message || 'Invalid code');
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => digitRefs.current[0]?.focus(), 50);
        }
    };

    const handleResendEmailOtp = async () => {
        if (isResending || resendCooldown > 0) return;
        setIsResending(true);
        try {
            await resendEmailOtp();
            setResendCooldown(60); // 60-second cooldown before next resend
            toast.success('A new code has been sent to your email.');
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => digitRefs.current[0]?.focus(), 50);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to resend code. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    const submitMfaCode = async (code: string) => {
        clearError();
        try {
            await verifyMfa(code);
            toast.success('Welcome back!');
            const returnTo = searchParams.get('returnTo');
            const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
            navigate(safeReturnTo);
        } catch (err: any) {
            toast.error(err.message || 'Invalid code');
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => digitRefs.current[0]?.focus(), 50);
        }
    };

    const handleBackToLogin = () => {
        clearMfa();
        setDigits(['', '', '', '', '', '']);
        setSetupData(null);
    };

    const handleCopyCode = async () => {
        if (!setupData?.manualCode) return;
        await navigator.clipboard.writeText(setupData.manualCode);
        toast.success('Code copied to clipboard!');
    };

    const submitMfaSetupCode = async (code: string) => {
        if (!mfaToken) return;
        setIsEnabling(true);
        try {
            await mfaService.enable(code, mfaToken);
            toast.success('MFA Setup complete!');
            // Now immediately verify to log in
            await submitMfaCode(code);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Invalid code. Please try again.');
            setDigits(['', '', '', '', '', '']);
            setTimeout(() => digitRefs.current[0]?.focus(), 50);
        } finally {
            setIsEnabling(false);
        }
    };

    /* ── Shared sidebar ── */
    const Sidebar = (
        <div className="auth-sidebar">
            <div className="auth-sidebar-content">
                <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <BrandLogo variant="light" size="xl" className="mb-lg" />
                </Link>
                <p>
                    Empowering your journey to mental wellness with compassionate,
                    personalized care from licensed therapists.
                </p>
                <div className="features-list">
                    <div className="feature-item">
                        <div className="feature-icon"><Heart size={20} /></div>
                        <span>Personalized treatment plans</span>
                    </div>
                    <div className="feature-item">
                        <div className="feature-icon"><Shield size={20} /></div>
                        <span>HIPAA-compliant &amp; secure</span>
                    </div>
                    <div className="feature-item">
                        <div className="feature-icon"><Users size={20} /></div>
                        <span>Licensed therapists</span>
                    </div>
                    <div className="feature-item">
                        <div className="feature-icon"><Clock size={20} /></div>
                        <span>Flexible scheduling</span>
                    </div>
                </div>
            </div>
        </div>
    );

    /* ── Email OTP Step ── */
    if (emailOtpPending) {
        return (
            <div className="auth-layout">
                {Sidebar}
                <div className="auth-main">
                    <div className="auth-mobile-banner">
                        <BrandLogo variant="light" size="md" />
                    </div>

                    <div className="auth-form-container">
                        <div className="auth-header">
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: 'var(--primary-50)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--primary-color)',
                                }}>
                                    <Mail size={26} />
                                </div>
                            </div>
                            <h2>Check your email</h2>
                            <p>We sent a 6-digit verification code to <strong>{email}</strong>. Enter it below to continue.</p>
                        </div>

                        {error && (
                            <div style={{
                                padding: 'var(--spacing-md)', background: 'rgba(229,62,62,0.1)',
                                borderRadius: 'var(--radius-lg)', color: 'var(--error-500)',
                                fontSize: '0.875rem', textAlign: 'center', marginBottom: '1rem',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* 6-digit input row */}
                        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginBottom: '1.75rem' }}>
                            {digits.map((digit, i) => (
                                <input
                                    key={i}
                                    id={`email-otp-digit-${i}`}
                                    ref={(el) => { digitRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleDigitChange(i, e.target.value)}
                                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                                    onPaste={i === 0 ? handleDigitPaste : undefined}
                                    autoComplete="one-time-code"
                                    style={{
                                        width: '3rem', height: '3.5rem', textAlign: 'center',
                                        fontSize: '1.5rem', fontWeight: 700,
                                        border: `2px solid ${digit ? 'var(--primary-color)' : 'var(--gray-300)'}`,
                                        borderRadius: 'var(--radius-lg)',
                                        background: 'var(--bg-surface)', color: 'var(--gray-900)',
                                        outline: 'none', transition: 'border-color 0.15s',
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary btn-lg w-full"
                            disabled={isLoading || digits.join('').length < 6}
                            onClick={() => submitEmailOtpCode(digits.join(''))}
                        >
                            {isLoading ? (
                                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /><span>Verifying...</span></>
                            ) : 'Verify Code'}
                        </button>

                        {/* Resend */}
                        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Didn't receive it? </span>
                            <button
                                type="button"
                                onClick={handleResendEmailOtp}
                                disabled={isResending || resendCooldown > 0}
                                style={{
                                    background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                                    color: resendCooldown > 0 ? 'var(--gray-400)' : 'var(--primary-color)',
                                    fontSize: '0.875rem', fontWeight: 500, display: 'inline-flex',
                                    alignItems: 'center', gap: '0.25rem',
                                }}
                            >
                                {isResending
                                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                                    : resendCooldown > 0
                                        ? `Resend in ${resendCooldown}s`
                                        : <><RefreshCw size={13} /> Resend code</>}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleBackToLogin}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.375rem',
                                margin: '1rem auto 0', background: 'none', border: 'none',
                                color: 'var(--gray-500)', fontSize: '0.875rem', cursor: 'pointer',
                            }}
                        >
                            <ArrowLeft size={14} /> Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── MFA Setup Step ── */
    if (mfaSetupPending) {
        return (
            <div className="auth-layout">
                {Sidebar}
                <div className="auth-main">
                    <div className="auth-mobile-banner">
                        <BrandLogo variant="light" size="md" />
                    </div>

                    <div className="auth-form-container" style={{ maxWidth: 440 }}>
                        <div className="auth-header">
                            <h2>Action Required</h2>
                            <p>Your administrator requires you to set up Two-Factor Authentication before you can sign in.</p>
                        </div>

                        {!setupData ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-color)' }} />
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{
                                    padding: '0.75rem 1rem', background: 'var(--primary-50)', borderRadius: 'var(--radius-lg)',
                                    color: 'var(--primary-700, #1d4ed8)', fontSize: '0.875rem',
                                    borderLeft: '3px solid var(--primary-color)',
                                }}>
                                    <strong>Step 1:</strong> Scan the QR code below with your Authenticator App. <br />
                                    <strong>Step 2:</strong> Enter the 6-digit code to activate MFA and sign in.
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ padding: '1rem', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-200)', display: 'inline-block' }}>
                                        <img src={setupData.qrCodeDataUrl} alt="MFA QR Code" style={{ width: 180, height: 180, display: 'block' }} />
                                    </div>
                                    <div style={{ width: '100%' }}>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginBottom: '0.375rem', textAlign: 'center' }}>
                                            Can't scan? Enter this key manually:
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
                                            <QrCode size={15} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                                            <code style={{ fontSize: '0.8125rem', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all', color: 'var(--gray-800)' }}>{setupData.manualCode}</code>
                                            <button type="button" onClick={handleCopyCode} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}><Copy size={14} /></button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--gray-900)', marginBottom: '0.75rem', textAlign: 'center' }}>Enter the 6-digit code to confirm</div>
                                    <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
                                        {digits.map((digit, i) => (
                                            <input
                                                key={i} id={`mfa-setup-digit-${i}`} ref={(el) => { digitRefs.current[i] = el; }}
                                                type="text" inputMode="numeric" maxLength={1} value={digit}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(-1);
                                                    const next = [...digits]; next[i] = val; setDigits(next);
                                                    if (val && i < 5) digitRefs.current[i + 1]?.focus();
                                                    if (val && i === 5 && next.join('').length === 6) submitMfaSetupCode(next.join(''));
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Backspace' && !digits[i] && i > 0) digitRefs.current[i - 1]?.focus();
                                                    if (e.key === 'Enter' && digits.join('').length === 6) submitMfaSetupCode(digits.join(''));
                                                }}
                                                onPaste={(e) => {
                                                    e.preventDefault();
                                                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                                                    if (!pasted) return;
                                                    const next = [...digits];
                                                    pasted.split('').forEach((ch, idx) => { next[idx] = ch; });
                                                    setDigits(next);
                                                    const focusIndex = Math.min(pasted.length, 5);
                                                    digitRefs.current[focusIndex]?.focus();
                                                    if (pasted.length === 6) submitMfaSetupCode(pasted);
                                                }}
                                                autoComplete="off"
                                                style={{ width: '2.75rem', height: '3.25rem', textAlign: 'center', fontSize: '1.375rem', fontWeight: 700, border: `2px solid ${digit ? 'var(--primary-color)' : 'var(--gray-300)'}`, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', color: 'var(--gray-900)', outline: 'none' }}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="button" className="btn btn-primary btn-lg w-full"
                                        disabled={isEnabling || digits.join('').length < 6}
                                        onClick={() => submitMfaSetupCode(digits.join(''))}
                                    >
                                        {isEnabling ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Activating...</> : <><CheckCircle2 size={16} /> Activate & Sign In</>}
                                    </button>
                                </div>
                            </div>
                        )}
                        <button type="button" onClick={handleBackToLogin} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: '1.25rem auto 0', background: 'none', border: 'none', color: 'var(--gray-500)', fontSize: '0.875rem', cursor: 'pointer' }}>
                            <ArrowLeft size={14} /> Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── MFA Challenge Step ── */
    if (mfaPending) {
        return (
            <div className="auth-layout">
                {Sidebar}
                <div className="auth-main">
                    <div className="auth-mobile-banner">
                        <BrandLogo variant="light" size="md" />
                    </div>

                    <div className="auth-form-container">
                        <div className="auth-header">
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: 'var(--primary-50)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--primary-color)',
                                }}>
                                    <Smartphone size={26} />
                                </div>
                            </div>
                            <h2>Two-Factor Authentication</h2>
                            <p>Enter the 6-digit code from your Authenticator App</p>
                        </div>

                        {error && (
                            <div style={{
                                padding: 'var(--spacing-md)', background: 'rgba(229,62,62,0.1)',
                                borderRadius: 'var(--radius-lg)', color: 'var(--error-500)',
                                fontSize: '0.875rem', textAlign: 'center', marginBottom: '1rem',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* 6-digit input row */}
                        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginBottom: '1.75rem' }}>
                            {digits.map((digit, i) => (
                                <input
                                    key={i}
                                    id={`mfa-digit-${i}`}
                                    ref={(el) => { digitRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleDigitChange(i, e.target.value)}
                                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                                    onPaste={i === 0 ? handleDigitPaste : undefined}
                                    autoComplete="one-time-code"
                                    style={{
                                        width: '3rem', height: '3.5rem', textAlign: 'center',
                                        fontSize: '1.5rem', fontWeight: 700,
                                        border: `2px solid ${digit ? 'var(--primary-color)' : 'var(--gray-300)'}`,
                                        borderRadius: 'var(--radius-lg)',
                                        background: 'var(--bg-surface)', color: 'var(--gray-900)',
                                        outline: 'none', transition: 'border-color 0.15s',
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary btn-lg w-full"
                            disabled={isLoading || digits.join('').length < 6}
                            onClick={() => submitMfaCode(digits.join(''))}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Verifying...</span>
                                </>
                            ) : 'Verify Code'}
                        </button>

                        <button
                            type="button"
                            onClick={handleBackToLogin}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.375rem',
                                margin: '1rem auto 0', background: 'none', border: 'none',
                                color: 'var(--gray-500)', fontSize: '0.875rem', cursor: 'pointer',
                            }}
                        >
                            <ArrowLeft size={14} /> Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Normal Login Step ── */
    return (
        <div className="auth-layout">
            {Sidebar}
            <div className="auth-main">
                <div className="auth-mobile-banner">
                    <BrandLogo variant="light" size="md" />
                </div>

                <div className="auth-form-container">
                    <div className="auth-header">
                        <h2>Welcome back</h2>
                        <p>Sign in to continue your wellness journey</p>
                    </div>

                    <form className="auth-form" onSubmit={handleLoginSubmit}>
                        {error && (
                            <div className="auth-error" style={{
                                padding: 'var(--spacing-md)', background: 'rgba(229, 62, 62, 0.1)',
                                borderRadius: 'var(--radius-lg)', color: 'var(--error-500)',
                                fontSize: '0.875rem', textAlign: 'center'
                            }}>
                                {error}
                            </div>
                        )}

                        <div className="input-group">
                            <label className="input-label" htmlFor="email">Email address</label>
                            <div className="input-with-icon">
                                <Mail size={18} className="input-icon" />
                                <input
                                    id="email" type="email" className="input-field"
                                    placeholder="you@example.com" value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="flex justify-between items-center">
                                <label className="input-label" htmlFor="password">Password</label>
                                <Link to="/forgot-password" style={{ fontSize: '0.8125rem' }}>Forgot password?</Link>
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
                                    required autoComplete="current-password"
                                />
                                <button
                                    type="button" className="input-icon-right"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1} style={{ background: 'none', border: 'none' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isLoading}>
                            {isLoading ? (
                                <><span className="spinner" /><span>Signing in...</span></>
                            ) : 'Sign in'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <span>Don't have an account? </span>
                        <span style={{ fontWeight: 500 }}>Contact your administrator</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
