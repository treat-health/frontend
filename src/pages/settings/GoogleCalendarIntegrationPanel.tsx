import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Calendar, ExternalLink, Link2, Loader2, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { googleCalendarService, type GoogleCalendarConnectionStatus } from '../../services/google-calendar.service';

const GOOGLE_INTEGRATION_ROLES = new Set(['THERAPIST', 'PROGRAM_DIRECTOR', 'PSYCHIATRIC_PROVIDER', 'ADMIN']);

const formatDateTime = (value?: string | null) => {
    if (!value) return 'Not yet';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

function GoogleCalendarEmptyState() {
    return (
        <div className="google-integrations-empty">
            <div className="google-integrations-empty-icon">
                <ShieldCheck size={20} />
            </div>
            <div>
                <h3>Google Calendar integration</h3>
                <p>This integration is available to clinical staff only.</p>
            </div>
        </div>
    );
}

function GoogleCalendarStatusBadge({
    isConnected,
    disconnectedAt,
    label,
}: Readonly<{
    isConnected: boolean;
    disconnectedAt?: string | null;
    label: string;
}>) {
    let badgeClass = 'inactive';

    if (isConnected) {
        badgeClass = 'connected';
    } else if (disconnectedAt) {
        badgeClass = 'disconnected';
    }

    return <span className={`google-status-badge ${badgeClass}`}>{label}</span>;
}

function GoogleCalendarActionButtons({
    isConnected,
    isLoading,
    isConnecting,
    isSyncing,
    isDisconnecting,
    onConnect,
    onSync,
    onDisconnect,
    onRefresh,
}: Readonly<{
    isConnected: boolean;
    isLoading: boolean;
    isConnecting: boolean;
    isSyncing: boolean;
    isDisconnecting: boolean;
    onConnect: () => void;
    onSync: () => void;
    onDisconnect: () => void;
    onRefresh: () => void;
}>) {
    const connectButton = (
        <button className="btn btn-primary" onClick={onConnect} disabled={isConnecting || isLoading}>
            {isConnecting ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
            {isConnecting ? 'Redirecting...' : 'Connect Google'}
        </button>
    );

    const syncButton = (
        <button className="btn btn-secondary" onClick={onSync} disabled={isSyncing || isLoading}>
            {isSyncing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            {isSyncing ? 'Queuing...' : 'Sync Now'}
        </button>
    );

    const disconnectButton = (
        <button className="btn btn-secondary google-disconnect-button" onClick={onDisconnect} disabled={isDisconnecting || isLoading}>
            {isDisconnecting ? <Loader2 size={16} className="spin" /> : <Unlink size={16} />}
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
    );

    return (
        <div className="google-integration-actions">
            {isConnected ? (
                <>
                    {syncButton}
                    {disconnectButton}
                </>
            ) : (
                connectButton
            )}

            <button className="btn btn-ghost" onClick={onRefresh} disabled={isLoading}>
                {isLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                Refresh
            </button>
        </div>
    );
}

function GoogleCalendarDetails({ status }: Readonly<{ status: GoogleCalendarConnectionStatus | null }>) {
    return (
        <div className="google-integration-details">
            <div className="google-integration-card">
                <span className="google-integration-card-label">Connected account</span>
                <strong>{status?.googleAccountEmail || 'Not connected'}</strong>
            </div>
            <div className="google-integration-card">
                <span className="google-integration-card-label">Calendar ID</span>
                <strong className="google-mono-text">{status?.calendarId || '—'}</strong>
            </div>
            <div className="google-integration-card">
                <span className="google-integration-card-label">Last sync</span>
                <strong>{formatDateTime(status?.lastSyncedAt)}</strong>
            </div>
            <div className="google-integration-card">
                <span className="google-integration-card-label">Refresh token</span>
                <strong>{status?.hasRefreshToken ? 'Stored securely' : 'Not available'}</strong>
            </div>
        </div>
    );
}

function GoogleCalendarSyncControls({
    isVisible,
    lookaheadDays,
    setLookaheadDays,
}: Readonly<{
    isVisible: boolean;
    lookaheadDays: string;
    setLookaheadDays: (value: string) => void;
}>) {
    if (!isVisible) {
        return null;
    }

    return (
        <div className="google-integration-sync-controls">
            <div className="form-group google-lookahead-group">
                <label htmlFor="google-lookahead-days">Sync lookahead window</label>
                <input
                    id="google-lookahead-days"
                    type="number"
                    min={1}
                    max={365}
                    value={lookaheadDays}
                    onChange={(event) => setLookaheadDays(event.target.value)}
                />
                <span className="field-hint">
                    Fetch upcoming events from the next few days when you trigger a manual sync.
                </span>
            </div>
            <div className="google-integration-note">
                <ExternalLink size={16} />
                <span>
                    Sync jobs run asynchronously in the background, so the UI stays snappy even when a calendar is busy.
                </span>
            </div>
        </div>
    );
}

function GoogleCalendarSummary({
    isConnected,
    status,
    label,
    onConnect,
    onSync,
    onDisconnect,
    onRefresh,
    isLoading,
    isConnecting,
    isSyncing,
    isDisconnecting,
}: Readonly<{
    isConnected: boolean;
    status: GoogleCalendarConnectionStatus | null;
    label: string;
    onConnect: () => void;
    onSync: () => void;
    onDisconnect: () => void;
    onRefresh: () => void;
    isLoading: boolean;
    isConnecting: boolean;
    isSyncing: boolean;
    isDisconnecting: boolean;
}>) {
    return (
        <div className="google-integration-summary">
            <div className="google-integration-summary-main">
                <div className="google-integration-icon">
                    <Calendar size={18} />
                </div>
                <div>
                    <div className="google-integration-title-row">
                        <h3>Google Calendar</h3>
                        <GoogleCalendarStatusBadge
                            isConnected={isConnected}
                            disconnectedAt={status?.disconnectedAt}
                            label={label}
                        />
                    </div>
                    <p>
                        Connect a therapist or clinician Google account to import upcoming Meet sessions into Treat Health.
                    </p>
                </div>
            </div>

            <GoogleCalendarActionButtons
                isConnected={isConnected}
                isLoading={isLoading}
                isConnecting={isConnecting}
                isSyncing={isSyncing}
                isDisconnecting={isDisconnecting}
                onConnect={onConnect}
                onSync={onSync}
                onDisconnect={onDisconnect}
                onRefresh={onRefresh}
            />
        </div>
    );
}

export default function GoogleCalendarIntegrationPanel() {
    const { user } = useAuthStore();
    const canUseIntegration = Boolean(user?.role && GOOGLE_INTEGRATION_ROLES.has(user.role));

    const [status, setStatus] = useState<GoogleCalendarConnectionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [lookaheadDays, setLookaheadDays] = useState('30');
    const [error, setError] = useState<string | null>(null);

    const isConnected = Boolean(status?.connected && status.syncEnabled && !status.disconnectedAt);

    const statusLabel = useMemo(() => {
        if (!status) return 'Loading';
        if (isConnected) return 'Connected';
        if (status.disconnectedAt) return 'Disconnected';
        return 'Not connected';
    }, [isConnected, status]);

    const loadStatus = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const nextStatus = await googleCalendarService.getStatus();
            setStatus(nextStatus);
        } catch (loadError: any) {
            const message = loadError?.response?.data?.message || loadError?.message || 'Failed to load Google Calendar status';
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadStatus();
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);

        try {
            await googleCalendarService.startConnect('/settings/integrations');
        } catch (connectError: any) {
            const message = connectError?.response?.data?.message || connectError?.message || 'Failed to start Google Calendar connection';
            toast.error(message);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSync = async () => {
        const parsedLookahead = Number.parseInt(lookaheadDays, 10);

        if (Number.isNaN(parsedLookahead) || parsedLookahead < 1 || parsedLookahead > 365) {
            toast.error('Lookahead days must be between 1 and 365');
            return;
        }

        setIsSyncing(true);

        try {
            const result = await googleCalendarService.sync(parsedLookahead);
            const jobLabel = result.jobId ? ` (#${result.jobId})` : '';
            toast.success(`Google Calendar sync queued${jobLabel}`);
            await loadStatus();
        } catch (syncError: any) {
            const message = syncError?.response?.data?.message || syncError?.message || 'Failed to queue Google Calendar sync';
            toast.error(message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDisconnect = async () => {
        const confirmed = globalThis.confirm('Disconnect Google Calendar for this account? Future syncs will stop until you reconnect.');

        if (!confirmed) {
            return;
        }

        setIsDisconnecting(true);

        try {
            await googleCalendarService.disconnect();
            toast.success('Google Calendar disconnected');
            await loadStatus();
        } catch (disconnectError: any) {
            const message = disconnectError?.response?.data?.message || disconnectError?.message || 'Failed to disconnect Google Calendar';
            toast.error(message);
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (!canUseIntegration) {
        return <GoogleCalendarEmptyState />;
    }

    return (
        <div className="google-integration-panel">
            <GoogleCalendarSummary
                isConnected={isConnected}
                status={status}
                label={statusLabel}
                onConnect={handleConnect}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onRefresh={() => void loadStatus()}
                isLoading={isLoading}
                isConnecting={isConnecting}
                isSyncing={isSyncing}
                isDisconnecting={isDisconnecting}
            />

            {error && (
                <div className="google-integration-warning">
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <GoogleCalendarDetails status={status} />

            <GoogleCalendarSyncControls
                isVisible={isConnected}
                lookaheadDays={lookaheadDays}
                setLookaheadDays={setLookaheadDays}
            />
        </div>
    );
}
