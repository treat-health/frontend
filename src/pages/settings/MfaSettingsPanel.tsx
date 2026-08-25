import { useState, useEffect } from 'react';
import { Smartphone, ShieldCheck, ShieldOff, QrCode, Loader2, CheckCircle2, Copy, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import mfaService from '../../services/mfa.service';

/**
 * MfaSettingsPanel
 * Shown in the Security tab of SettingsPage for every role.
 * Handles: loading status, initiating setup (QR + manual code), confirming with 6-digit code, disabling.
 */
export default function MfaSettingsPanel() {
    const [isMfaEnabled, setIsMfaEnabled] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);

    // Setup flow
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState<string | null>(null);
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDisabling, setIsDisabling] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        setIsLoadingStatus(true);
        try {
            const data = await mfaService.getStatus();
            setIsMfaEnabled(data.isMfaEnabled);
        } catch {
            // silently fail — not critical
        } finally {
            setIsLoadingStatus(false);
        }
    };

    const handleStartSetup = async () => {
        setIsSettingUp(true);
        try {
            const data = await mfaService.setup();
            setQrCodeDataUrl(data.qrCodeDataUrl);
            setManualCode(data.manualCode);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to start MFA setup');
            setIsSettingUp(false);
        }
    };

    const handleDigitChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);
        if (digit && index < 5) {
            const el = document.getElementById(`mfa-settings-digit-${index + 1}`) as HTMLInputElement | null;
            el?.focus();
        }
    };

    const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            const el = document.getElementById(`mfa-settings-digit-${index - 1}`) as HTMLInputElement | null;
            el?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const next = [...digits];
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        const focusIndex = Math.min(pasted.length, 5);
        const el = document.getElementById(`mfa-settings-digit-${focusIndex}`) as HTMLInputElement | null;
        el?.focus();
    };

    const handleConfirmEnable = async () => {
        const code = digits.join('');
        if (code.length < 6) {
            toast.error('Please enter the complete 6-digit code');
            return;
        }
        setIsSubmitting(true);
        try {
            await mfaService.enable(code);
            setIsMfaEnabled(true);
            setIsSettingUp(false);
            setQrCodeDataUrl(null);
            setManualCode(null);
            setDigits(['', '', '', '', '', '']);
            toast.success('MFA enabled successfully! Your account is now more secure.');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Invalid code. Please try again.');
            setDigits(['', '', '', '', '', '']);
            const el = document.getElementById('mfa-settings-digit-0') as HTMLInputElement | null;
            el?.focus();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDisable = async () => {
        if (!window.confirm('Are you sure you want to disable MFA? Your account will be less secure.')) return;
        setIsDisabling(true);
        try {
            await mfaService.disable();
            setIsMfaEnabled(false);
            toast.success('MFA has been disabled.');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to disable MFA');
        } finally {
            setIsDisabling(false);
        }
    };

    const handleCopyCode = async () => {
        if (!manualCode) return;
        await navigator.clipboard.writeText(manualCode);
        toast.success('Code copied to clipboard!');
    };

    const handleCancelSetup = () => {
        setIsSettingUp(false);
        setQrCodeDataUrl(null);
        setManualCode(null);
        setDigits(['', '', '', '', '', '']);
    };

    /* ── Loading state ── */
    if (isLoadingStatus) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-500)', padding: '1.5rem 0' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Loading MFA status...</span>
            </div>
        );
    }

    /* ── MFA already enabled ── */
    if (isMfaEnabled && !isSettingUp) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '1rem',
                padding: '1.25rem', border: '1px solid var(--success-200, #bbf7d0)',
                borderRadius: 'var(--radius-lg)', background: 'var(--success-50, #f0fdf4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'var(--success-100, #dcfce7)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--success-600, #16a34a)',
                    }}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                            Authenticator App enabled
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: 2 }}>
                            Your account is protected with two-factor authentication
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        <span style={{
                            background: 'var(--success-100, #dcfce7)', color: 'var(--success-700, #15803d)',
                            borderRadius: 9999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
                        }}>Active</span>
                    </div>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={handleDisable}
                    disabled={isDisabling}
                    style={{ alignSelf: 'flex-start', color: 'var(--error-600)', borderColor: 'var(--error-200)' }}
                >
                    {isDisabling ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={15} />}
                    {isDisabling ? 'Disabling...' : 'Disable MFA'}
                </button>
            </div>
        );
    }

    const renderHelpGuide = () => (
        <div style={{
            marginTop: '0.75rem',
            border: '1px solid var(--primary-200, #bfdbfe)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface, #ffffff)',
            overflow: 'hidden',
        }}>
            <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'var(--primary-50, #eff6ff)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--primary-800, #1e40af)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    textAlign: 'left',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HelpCircle size={17} style={{ color: 'var(--primary-color)' }} />
                    <span>Need help? What is an Authenticator App & how to install one</span>
                </div>
                {showHelp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showHelp && (
                <div style={{ padding: '1rem 1.25rem', fontSize: '0.84rem', color: 'var(--gray-700)', lineHeight: 1.55 }}>
                    <p style={{ margin: '0 0 0.75rem 0' }}>
                        An <strong>Authenticator App</strong> is a free mobile app on your phone (like Google Authenticator or Microsoft Authenticator). It generates a temporary 6-digit code every 30 seconds to ensure only you can access your private health information.
                    </p>

                    <div style={{ fontWeight: 600, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>
                        1. Recommended Authenticator Apps (Free to download):
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                            <strong style={{ color: 'var(--gray-900)', display: 'block', fontSize: '0.8125rem' }}>Google Authenticator</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', gap: 8, marginTop: 4 }}>
                                <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>iOS App Store <ExternalLink size={10} /></a>
                                <span>•</span>
                                <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>Google Play <ExternalLink size={10} /></a>
                            </div>
                        </div>

                        <div style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                            <strong style={{ color: 'var(--gray-900)', display: 'block', fontSize: '0.8125rem' }}>Microsoft Authenticator</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', gap: 8, marginTop: 4 }}>
                                <a href="https://apps.apple.com/app/microsoft-authenticator/id983155283" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>iOS App Store <ExternalLink size={10} /></a>
                                <span>•</span>
                                <a href="https://play.google.com/store/apps/details?id=com.azure.authenticator" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>Google Play <ExternalLink size={10} /></a>
                            </div>
                        </div>

                        <div style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                            <strong style={{ color: 'var(--gray-900)', display: 'block', fontSize: '0.8125rem' }}>Twilio Authy / Apple Passwords</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 4 }}>
                                Built into iPhone (Settings &gt; Passwords) or download Authy from app stores.
                            </div>
                        </div>
                    </div>

                    <div style={{ fontWeight: 600, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>
                        2. Easy Step-by-Step Instructions:
                    </div>
                    <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <li><strong>Install an app:</strong> Open your phone's App Store (iPhone) or Google Play Store (Android) and search for <em>Google Authenticator</em> or <em>Microsoft Authenticator</em>.</li>
                        <li><strong>Add a new account:</strong> Open the app on your phone and tap the <strong>"+" (Plus)</strong> button or select "Add Account".</li>
                        <li><strong>Scan the QR code:</strong> Select "Scan a QR code" in your app, then point your phone camera at the QR code pattern displayed on this web page.</li>
                        <li><strong>Enter the 6-digit code:</strong> Your authenticator app will display a temporary 6-digit number. Type that number into the boxes on this page and click <strong>Activate MFA</strong>.</li>
                    </ol>
                </div>
            )}
        </div>
    );

    /* ── Setup flow: QR code + 6-digit confirm ── */
    if (isSettingUp && qrCodeDataUrl) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Step indicator */}
                <div style={{
                    padding: '0.75rem 1rem', background: 'var(--primary-50)', borderRadius: 'var(--radius-lg)',
                    color: 'var(--primary-700, #1d4ed8)', fontSize: '0.875rem',
                    borderLeft: '3px solid var(--primary-color)',
                }}>
                    <strong>Step 1:</strong> Scan the QR code below with Google Authenticator, Authy, or any TOTP app. <br />
                    <strong>Step 2:</strong> Enter the 6-digit code the app shows to confirm and activate MFA.
                </div>

                {/* QR code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '1rem', background: '#fff', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--gray-200)', display: 'inline-block',
                    }}>
                        <img
                            src={qrCodeDataUrl}
                            alt="MFA QR Code"
                            style={{ width: 180, height: 180, display: 'block' }}
                        />
                    </div>

                    {/* Manual entry fallback */}
                    {manualCode && (
                        <div style={{ width: '100%' }}>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginBottom: '0.375rem' }}>
                                Can't scan? Enter this key manually in your app:
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'var(--gray-100)', border: '1px solid var(--gray-200)',
                                borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem',
                            }}>
                                <QrCode size={15} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                                <code style={{ fontSize: '0.8125rem', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all', color: 'var(--gray-800)' }}>
                                    {manualCode}
                                </code>
                                <button
                                    type="button"
                                    onClick={handleCopyCode}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', padding: 2 }}
                                    title="Copy to clipboard"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 6-digit confirm */}
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--gray-900)', marginBottom: '0.75rem' }}>
                        Enter the 6-digit code to confirm
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        {digits.map((digit, i) => (
                            <input
                                key={i}
                                id={`mfa-settings-digit-${i}`}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleDigitChange(i, e.target.value)}
                                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                style={{
                                    width: '2.75rem', height: '3.25rem', textAlign: 'center',
                                    fontSize: '1.375rem', fontWeight: 700,
                                    border: `2px solid ${digit ? 'var(--primary-color)' : 'var(--gray-300)'}`,
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--bg-surface)', color: 'var(--gray-900)',
                                    outline: 'none', transition: 'border-color 0.15s',
                                }}
                            />
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={isSubmitting || digits.join('').length < 6}
                            onClick={handleConfirmEnable}
                        >
                            {isSubmitting ? (
                                <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</>
                            ) : (
                                <><CheckCircle2 size={15} /> Activate MFA</>
                            )}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={handleCancelSetup}>
                            Cancel
                        </button>
                    </div>
                </div>

                {renderHelpGuide()}
            </div>
        );
    }

    /* ── Default: not enabled, not setting up ── */
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '1rem',
            padding: '1.25rem', border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-lg)', background: 'var(--gray-50)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--gray-100)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'var(--gray-400)',
                }}>
                    <Smartphone size={20} />
                </div>
                <div>
                    <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>Authenticator App</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: 2 }}>
                        Not enabled — add an extra layer of security to your account
                    </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                        background: 'var(--gray-200)', color: 'var(--gray-600)',
                        borderRadius: 9999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600,
                    }}>Inactive</span>
                </div>
            </div>
            <button
                type="button"
                className="btn btn-secondary"
                onClick={handleStartSetup}
                style={{ alignSelf: 'flex-start' }}
            >
                <Smartphone size={15} />
                Enable Authenticator App
            </button>

            {renderHelpGuide()}
        </div>
    );
}
