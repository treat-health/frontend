import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
    User,
    Lock,
    Bell,
    Save,
    PlusCircle,
    Eye,
    EyeOff,
    CheckCircle,
    Shield,
    Clock,
    Loader2,
    Settings,
    Trash2,
    Calendar,
    type LucideIcon,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { User as AuthUser } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import api from '../../lib/api';
import type { ApiResponse } from '../../lib/api';
import {
    type AvailabilityTemplateDay,
    type LocalAvailabilityWindow,
    buildAvailabilityPreview,
    buildUtcAvailabilityPayloadFromLocalSchedule,
    deriveTimezoneFromState,
    getBrowserTimezone,
    mapUtcAvailabilityTemplateToLocalSchedule,
} from './availabilityTimezoneUtils';
import GoogleCalendarIntegrationPanel from './GoogleCalendarIntegrationPanel';
import MfaSettingsPanel from './MfaSettingsPanel';
import mfaService from '../../services/mfa.service';
import './SettingsPage.css';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'availability' | 'integrations' | 'system';

function isSettingsTab(value: string | null): value is SettingsTab {
    return value === 'profile'
        || value === 'security'
        || value === 'notifications'
        || value === 'availability'
        || value === 'integrations'
        || value === 'system';
}

type AvailabilityWindow = LocalAvailabilityWindow;

type DayAvailability = AvailabilityTemplateDay;

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

const buildWindow = (seed: string, startTime = '09:00', endTime = '17:00', id?: string): AvailabilityWindow => ({
    id,
    localId: seed,
    startTime,
    endTime,
});

const buildEmptySchedule = (): DayAvailability[] => DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    windows: [],
}));

const getAvailabilitySummary = (windows: AvailabilityWindow[]) => {
    if (windows.length === 0) return 'Unavailable';
    return `${windows.length} available window${windows.length > 1 ? 's' : ''}`;
};

const updateScheduleDay = (
    schedule: DayAvailability[],
    dayIndex: number,
    updater: (day: DayAvailability) => DayAvailability
) => schedule.map((day, index) => (index === dayIndex ? updater(day) : day));

const updateWindowFieldInSchedule = (
    schedule: DayAvailability[],
    dayIndex: number,
    windowId: string,
    field: keyof AvailabilityWindow,
    value: string
) => updateScheduleDay(schedule, dayIndex, (day) => ({
    ...day,
    windows: day.windows.map((window) => {
        if (window.localId !== windowId) return window;
        return { ...window, [field]: value };
    }),
}));

const removeWindowFromSchedule = (
    schedule: DayAvailability[],
    dayIndex: number,
    windowId: string
) => updateScheduleDay(schedule, dayIndex, (day) => ({
    ...day,
    windows: day.windows.filter((window) => window.localId !== windowId),
}));

const formatRoleLabel = (role: string) =>
    role.replaceAll('_', ' ').toLowerCase().replaceAll(/\b\w/g, (char) => char.toUpperCase());

const GOOGLE_INTEGRATION_ROLES = new Set(['THERAPIST', 'PROGRAM_DIRECTOR', 'PSYCHIATRIC_PROVIDER', 'ADMIN']);

type SettingsTabConfig = {
    id: SettingsTab;
    label: string;
    icon: LucideIcon;
};

const createSettingsTab = (id: SettingsTab, label: string, icon: LucideIcon): SettingsTabConfig => ({
    id,
    label,
    icon,
});

function useSettingsTabSync(
    searchParams: URLSearchParams,
    tabs: SettingsTabConfig[],
    activeTab: SettingsTab,
    setActiveTab: (tab: SettingsTab) => void,
) {
    useEffect(() => {
        const requestedTab = searchParams.get('tab');
        const allowedTabIds = new Set(tabs.map((tab) => tab.id));

        if (requestedTab && isSettingsTab(requestedTab) && allowedTabIds.has(requestedTab)) {
            if (requestedTab !== activeTab) {
                setActiveTab(requestedTab);
            }
            return;
        }

        if (!allowedTabIds.has(activeTab)) {
            setActiveTab('profile');
        }
    }, [searchParams, tabs, activeTab, setActiveTab]);
}

function useGoogleCalendarQueryNotifications(searchParams: URLSearchParams, setSearchParams: ReturnType<typeof useSearchParams>[1]) {
    useEffect(() => {
        const connected = searchParams.get('googleConnected');
        const syncError = searchParams.get('googleSyncError');

        if (connected === 'true') {
            toast.success('Google Calendar connected successfully');
        }

        if (syncError) {
            toast.error(`Google Calendar connection failed: ${syncError}`);
        }

        if (connected || syncError) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('googleConnected');
            nextParams.delete('googleSyncError');
            setSearchParams(nextParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);
}

function AvailabilitySettingsSection({
    user,
    therapistStateTimezone,
    browserTimezone,
    schedule,
    isLoadingAvailability,
    isSavingAvailability,
    getAvailabilitySummary,
    handleAddWindow,
    handleWindowChange,
    handleRemoveWindow,
    handleSaveAvailability,
}: Readonly<{
    user: AuthUser | null;
    therapistStateTimezone: string;
    browserTimezone: string;
    schedule: DayAvailability[];
    isLoadingAvailability: boolean;
    isSavingAvailability: boolean;
    getAvailabilitySummary: (windows: AvailabilityWindow[]) => string;
    handleAddWindow: (dayIndex: number) => void;
    handleWindowChange: (dayIndex: number, windowId: string, field: keyof AvailabilityWindow, value: string) => void;
    handleRemoveWindow: (dayIndex: number, windowId: string) => void;
    handleSaveAvailability: () => Promise<void>;
}>) {
    if (user?.role !== 'THERAPIST') {
        return null;
    }

    return (
        <div className="settings-section">
            <div className="section-header" style={{ paddingBottom: '0.5rem' }}>
                <h2>Availability Schedule</h2>
                <p>Set your weekly recurring working hours in your therapist state timezone. Browser local time and stored UTC are shown as previews.</p>
            </div>

            <div className="settings-form" style={{ paddingTop: '0.1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--primary-50)', color: 'var(--primary-color)', fontWeight: 600, fontSize: 12 }}>
                        Therapist state: {user?.state || 'Not set'}
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: 12 }}>
                        Scheduling timezone: {therapistStateTimezone}
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: 12 }}>
                        Browser timezone: {browserTimezone}
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: 12 }}>
                        Storage timezone: UTC
                    </div>
                </div>

                <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 13, lineHeight: 1.5 }}>
                    Availability is edited using your therapist state timezone. The backend still stores the saved windows in UTC. If you later change states, the displayed schedule will follow the new state timezone mapping.
                </div>

                {isLoadingAvailability ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '2rem', justifyContent: 'center', color: 'var(--gray-500)' }}>
                        <Loader2 size={16} className="spin" />
                        <span>Loading your schedule...</span>
                    </div>
                ) : (
                    <div className="availability-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {schedule.map((day, index) => (
                            <div key={day.dayOfWeek} style={{ display: 'grid', gap: '1rem', padding: '1rem', border: `1px solid ${day.windows.length > 0 ? 'var(--secondary-color)' : 'var(--gray-200)'}`, borderRadius: '8px', backgroundColor: day.windows.length > 0 ? 'var(--bg-surface)' : 'var(--gray-50)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                    <div>
                                        <span style={{ fontWeight: 600, fontSize: '14px', color: day.windows.length > 0 ? 'var(--gray-900)' : 'var(--gray-500)' }}>
                                            {day.dayOfWeek.charAt(0) + day.dayOfWeek.slice(1).toLowerCase()}
                                        </span>
                                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gray-500)' }}>
                                            {getAvailabilitySummary(day.windows)}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => handleAddWindow(index)}
                                        style={{ padding: '8px 12px', fontSize: 13 }}
                                    >
                                        <PlusCircle size={16} style={{ marginRight: 6 }} />
                                        Add Window
                                    </button>
                                </div>

                                {day.windows.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '0.25rem 0 0.5rem' }}>
                                        No working hours configured for this day yet.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        {day.windows.map((window, windowIndex) => (
                                            <div key={window.localId} style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--gray-200)', borderRadius: 8, background: 'var(--gray-50)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) auto minmax(120px, 1fr) auto', gap: 10, alignItems: 'center' }}>
                                                    <input
                                                        type="time"
                                                        value={window.startTime}
                                                        onChange={(e) => handleWindowChange(index, window.localId, 'startTime', e.target.value)}
                                                        style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--gray-900)' }}
                                                        aria-label={`${day.dayOfWeek} window ${windowIndex + 1} start time`}
                                                    />
                                                    <span style={{ color: 'var(--gray-500)', fontWeight: 500, fontSize: '14px', textAlign: 'center' }}>to</span>
                                                    <input
                                                        type="time"
                                                        value={window.endTime}
                                                        onChange={(e) => handleWindowChange(index, window.localId, 'endTime', e.target.value)}
                                                        style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--gray-900)' }}
                                                        aria-label={`${day.dayOfWeek} window ${windowIndex + 1} end time`}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        onClick={() => handleRemoveWindow(index, window.localId)}
                                                        style={{ color: 'var(--error-500)' }}
                                                        aria-label={`Remove ${day.dayOfWeek} window ${windowIndex + 1}`}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--gray-600)' }}>
                                                    <div>
                                                        <strong style={{ color: 'var(--gray-800)' }}>State time ({therapistStateTimezone})</strong>: {day.dayOfWeek.charAt(0) + day.dayOfWeek.slice(1).toLowerCase()} • {window.startTime} – {window.endTime}
                                                    </div>
                                                    {(() => {
                                                        const browserPreview = buildAvailabilityPreview(day.dayOfWeek as any, window, therapistStateTimezone, browserTimezone);
                                                        const utcPreview = buildAvailabilityPreview(day.dayOfWeek as any, window, therapistStateTimezone, 'UTC');

                                                        return (
                                                            <>
                                                                <div>
                                                                    <strong style={{ color: 'var(--gray-800)' }}>Browser local</strong>: {browserPreview ? `${browserPreview.dayLabel} • ${browserPreview.rangeLabel} (${browserPreview.abbreviation})` : 'Unavailable'}
                                                                </div>
                                                                <div>
                                                                    <strong style={{ color: 'var(--gray-800)' }}>Stored UTC</strong>: {utcPreview ? `${utcPreview.dayLabel} • ${utcPreview.rangeLabel} (${utcPreview.abbreviation})` : 'Unavailable'}
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="form-actions" style={{ marginTop: '2rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveAvailability}
                        disabled={isSavingAvailability || isLoadingAvailability}
                    >
                        {isSavingAvailability ? (
                            <Loader2 size={16} className="spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {isSavingAvailability ? 'Saving...' : 'Save Availability'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SystemSettingsSection({
    isLoadingSys,
    sysSettings,
    setSysSettings,
    isSavingSys,
    handleSaveSystemSettings,
}: Readonly<{
    isLoadingSys: boolean;
    sysSettings: Record<string, string>;
    setSysSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    isSavingSys: boolean;
    handleSaveSystemSettings: () => Promise<void>;
}>) {
    return (
        <div className="settings-section">
            <div className="section-header">
                <h2>System Settings</h2>
                <p>Configure application-wide defaults</p>
            </div>

            {isLoadingSys ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 size={24} className="spin" />
                </div>
            ) : (
                <div className="settings-form">
                    <div className="form-group">
                        <label htmlFor="settings-reminder-first">First Reminder (minutes before session)</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0 0 0.5rem' }}>
                            Common values: 60 = 1 hour, 120 = 2 hours, 30 = 30 min
                        </p>
                        <input
                            id="settings-reminder-first"
                            type="number"
                            min={5}
                            max={1440}
                            value={sysSettings['reminder_minutes_first'] || '60'}
                            onChange={(e) => setSysSettings(prev => ({ ...prev, reminder_minutes_first: e.target.value }))}
                            style={{ maxWidth: '200px' }}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="settings-reminder-second">Second Reminder (minutes before session)</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0 0 0.5rem' }}>
                            Common values: 1440 = 24 hours, 720 = 12 hours
                        </p>
                        <input
                            id="settings-reminder-second"
                            type="number"
                            min={5}
                            max={2880}
                            value={sysSettings['reminder_minutes_second'] || '1440'}
                            onChange={(e) => setSysSettings(prev => ({ ...prev, reminder_minutes_second: e.target.value }))}
                            style={{ maxWidth: '200px' }}
                        />
                    </div>

                    <div className="form-actions">
                        <button className="btn btn-primary" onClick={handleSaveSystemSettings} disabled={isSavingSys}>
                            {isSavingSys ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {isSavingSys ? 'Saving...' : 'Save System Settings'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const visuallyHiddenStyle = {
    position: 'absolute' as const,
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden' as const,
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap' as const,
    border: 0,
};

const getProfileValidationError = (firstName: string, lastName: string) => {
    if (!firstName.trim() || !lastName.trim()) {
        return 'First name and last name are required';
    }

    return null;
};

const getPasswordValidationError = (currentPassword: string, newPassword: string, confirmPassword: string) => {
    if (!currentPassword || !newPassword || !confirmPassword) {
        return 'All password fields are required';
    }

    if (newPassword.length < 8) {
        return 'New password must be at least 8 characters';
    }

    if (newPassword !== confirmPassword) {
        return 'New passwords do not match';
    }

    return null;
};

const validateAvailabilityTemplate = (schedule: DayAvailability[]) => {
    for (const day of schedule) {
        const sorted = [...day.windows].sort((left, right) => left.startTime.localeCompare(right.startTime));

        for (let index = 0; index < sorted.length; index += 1) {
            const current = sorted[index];

            if (current.startTime >= current.endTime) {
                return `${day.dayOfWeek} has a window where the end time must be after the start time.`;
            }

            if (index > 0 && current.startTime < sorted[index - 1].endTime) {
                return `${day.dayOfWeek} has overlapping availability windows.`;
            }
        }
    }

    return null;
};

const ALL_ROLES = [
    { id: 'THERAPIST', label: 'Therapist' },
    { id: 'CLIENT', label: 'Client' },
    { id: 'ADMIN', label: 'Admin' },
    { id: 'ADMISSIONS_REP', label: 'Admissions Rep' },
    { id: 'CARE_COORDINATOR', label: 'Care Coordinator' },
    { id: 'PROGRAM_DIRECTOR', label: 'Program Director' },
    { id: 'INSURANCE_TEAM', label: 'Insurance Team' },
    { id: 'PSYCHIATRIC_PROVIDER', label: 'Psychiatric Provider' },
] as const;

function AdminMfaRoleToggles() {
    const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<string | null>(null);

    useEffect(() => {
        mfaService.getAdminSettings()
            .then((data) => setRequiredRoles(data.requiredRoles))
            .catch(() => toast.error('Failed to load MFA role settings'))
            .finally(() => setIsLoading(false));
    }, []);

    const handleToggle = async (roleId: string, enabled: boolean) => {
        setIsSaving(roleId);
        const next = enabled
            ? [...requiredRoles, roleId]
            : requiredRoles.filter((r) => r !== roleId);
        try {
            const result = await mfaService.setAdminSettings(next);
            setRequiredRoles(result.requiredRoles);
            toast.success(`MFA ${enabled ? 'required' : 'optional'} for ${ALL_ROLES.find(r => r.id === roleId)?.label ?? roleId}`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save MFA settings');
        } finally {
            setIsSaving(null);
        }
    };

    return (
        <div className="settings-section" style={{ marginTop: '2rem' }}>
            <div className="section-header">
                <h2>MFA Role Requirements</h2>
                <p>Toggle which roles must use Multi-Factor Authentication to log in</p>
            </div>
            {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem', color: 'var(--gray-500)' }}>
                    <Loader2 size={16} className="spin" />
                    <span>Loading MFA settings...</span>
                </div>
            ) : (
                <div className="settings-form">
                    {ALL_ROLES.map((role) => {
                        const isEnabled = requiredRoles.includes(role.id);
                        const saving = isSaving === role.id;
                        return (
                            <div key={role.id} className="notif-item" style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                                <div className="notif-info">
                                    <span className="notif-title">{role.label}</span>
                                    <span className="notif-desc">
                                        {isEnabled ? 'MFA is required for this role' : 'MFA is optional for this role'}
                                    </span>
                                </div>
                                {saving ? (
                                    <Loader2 size={18} className="spin" style={{ color: 'var(--primary-color)' }} />
                                ) : (
                                    <label className="toggle-switch">
                                        <span style={visuallyHiddenStyle}>
                                            {isEnabled ? 'Disable' : 'Enable'} MFA requirement for {role.label}
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={(e) => handleToggle(role.id, e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                    </label>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/**
 * Settings Page — Profile, Security, and Notification Preferences
 * Shared across all roles
 */
export default function SettingsPage() {
    const { user, checkAuth } = useAuthStore();
    const { pushRegistered, requestPushPermission } = useNotificationStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
        const requestedTab = searchParams.get('tab');
        return isSettingsTab(requestedTab) ? requestedTab : 'profile';
    });

    // Availability state
    const [schedule, setSchedule] = useState<DayAvailability[]>(buildEmptySchedule);
    const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
    const [isSavingAvailability, setIsSavingAvailability] = useState(false);

    // Profile state
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [state, setState] = useState(user?.state || '');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // System settings state (admin only)
    const [sysSettings, setSysSettings] = useState<Record<string, string>>({});
    const [isLoadingSys, setIsLoadingSys] = useState(false);
    const [isSavingSys, setIsSavingSys] = useState(false);

    const therapistStateTimezone = useMemo(
        () => deriveTimezoneFromState(user?.state ?? state) || 'UTC',
        [user?.state, state],
    );
    const browserTimezone = useMemo(() => getBrowserTimezone(), []);
    const canAccessGoogleIntegration = Boolean(user?.role && GOOGLE_INTEGRATION_ROLES.has(user.role));

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setPhone(user.phone || '');
            setState(user.state || '');
        }
    }, [user]);

    // Fetch system settings when admin selects the System tab
    useEffect(() => {
        if (activeTab === 'system' && user?.role === 'ADMIN') {
            fetchSystemSettings();
        }
    }, [activeTab]);

    const fetchSystemSettings = async () => {
        setIsLoadingSys(true);
        try {
            const res = await api.get('/settings');
            const map: Record<string, string> = {};
            for (const s of res.data.data) map[s.key] = s.value;
            setSysSettings(map);
        } catch (err) {
            console.error('Failed to load system settings', err);
            toast.error('Failed to load system settings');
        } finally {
            setIsLoadingSys(false);
        }
    };

    const handleSaveSystemSettings = async () => {
        setIsSavingSys(true);
        try {
            const settings = Object.entries(sysSettings).map(([key, value]) => ({ key, value }));
            await api.put('/settings', { settings });
            toast.success('System settings saved!');
        } catch (err) {
            console.error('Failed to save system settings', err);
            toast.error('Failed to save system settings');
        } finally {
            setIsSavingSys(false);
        }
    };

    useEffect(() => {
        const fetchAvailability = async () => {
            if (user?.role === 'THERAPIST' && activeTab === 'availability') {
                setIsLoadingAvailability(true);
                try {
                    const res = await api.get('/scheduling/availability/template');
                    const days: Array<{ dayOfWeek: string; windows?: Array<{ id?: string; startTime: string; endTime: string }> }> = res.data.data || [];
                    setSchedule(mapUtcAvailabilityTemplateToLocalSchedule(days, therapistStateTimezone));
                } catch (error) {
                    console.error('Failed to load availability', error);
                    toast.error('Failed to load availability');
                } finally {
                    setIsLoadingAvailability(false);
                }
            }
        };
        fetchAvailability();
    }, [user, activeTab, therapistStateTimezone]);

    const handleWindowChange = (dayIndex: number, windowId: string, field: keyof AvailabilityWindow, value: string) => {
        setSchedule((current) => updateWindowFieldInSchedule(current, dayIndex, windowId, field, value));
    };

    const handleAddWindow = (dayIndex: number) => {
        const dayKey = schedule[dayIndex]?.dayOfWeek ?? `day-${dayIndex}`;
        setSchedule((current) => current.map((day, index) => index === dayIndex
            ? {
                ...day,
                windows: [...day.windows, buildWindow(`${dayKey}-${Date.now()}-${day.windows.length}`)],
            }
            : day));
    };

    const handleRemoveWindow = (dayIndex: number, windowId: string) => {
        setSchedule((current) => removeWindowFromSchedule(current, dayIndex, windowId));
    };

    const handleSaveAvailability = async () => {
        const validationError = validateAvailabilityTemplate(schedule);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsSavingAvailability(true);
        try {
            await api.put('/scheduling/availability/template', buildUtcAvailabilityPayloadFromLocalSchedule(schedule, therapistStateTimezone));

            toast.success('Availability schedule updated successfully!');

            // refetch to get new IDs
            const res = await api.get('/scheduling/availability/template');
            const days: Array<{ dayOfWeek: string; windows?: Array<{ id?: string; startTime: string; endTime: string }> }> = res.data.data || [];

            setSchedule(mapUtcAvailabilityTemplateToLocalSchedule(days, therapistStateTimezone));

        } catch (error) {
            console.error('Failed to save availability', error);
            toast.error('Failed to save availability');
        } finally {
            setIsSavingAvailability(false);
        }
    };

    const handleSaveProfile = async () => {
        const validationError = getProfileValidationError(firstName, lastName);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsSavingProfile(true);
        try {
            const response = await api.patch<ApiResponse>('/users/profile', {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim() || null,
                state: state.trim() || null,
            });

            if (response.data.success) {
                toast.success('Profile updated!');
                // Refresh auth store to reflect changes
                await checkAuth();
            } else {
                toast.error(response.data.message || 'Failed to update profile');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        const validationError = getPasswordValidationError(currentPassword, newPassword, confirmPassword);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsChangingPassword(true);
        try {
            const response = await api.post<ApiResponse>('/auth/change-password', {
                currentPassword,
                newPassword,
            });

            if (response.data.success) {
                toast.success('Password changed successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast.error(response.data.message || 'Failed to change password');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const TABS = useMemo<SettingsTabConfig[]>(() => [
        createSettingsTab('profile', 'Profile', User),
        createSettingsTab('security', 'Security', Lock),
        createSettingsTab('notifications', 'Notifications', Bell),
        ...(user?.role === 'THERAPIST' ? [createSettingsTab('availability', 'Availability', Clock)] : []),
        ...(canAccessGoogleIntegration ? [createSettingsTab('integrations', 'Integrations', Calendar)] : []),
        ...(user?.role === 'ADMIN' ? [createSettingsTab('system', 'System', Settings)] : []),
    ], [canAccessGoogleIntegration, user?.role]);

    useSettingsTabSync(searchParams, TABS, activeTab, setActiveTab);
    useGoogleCalendarQueryNotifications(searchParams, setSearchParams);

    const handleTabChange = (tab: SettingsTab) => {
        setActiveTab(tab);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', tab);
        nextParams.delete('googleConnected');
        nextParams.delete('googleSyncError');
        setSearchParams(nextParams, { replace: true });
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <h1>Settings</h1>
                <p className="settings-subtitle">Manage your account preferences</p>
            </div>

            <div className="settings-layout">
                {/* Sidebar Tabs */}
                <div className="settings-tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                        >
                            <tab.icon size={18} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="settings-content">
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="settings-section">
                            <div className="section-header">
                                <h2>Profile Information</h2>
                                <p>Update your personal details</p>
                            </div>

                            {/* User Card */}
                            <div className="profile-card">
                                <div className="profile-avatar-lg">
                                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                                </div>
                                <div className="profile-meta">
                                    <span className="profile-name">{user?.firstName} {user?.lastName}</span>
                                    <span className="profile-email">{user?.email}</span>
                                    <span className="profile-role-badge">
                                        <Shield size={12} />
                                        {formatRoleLabel(user?.role || '')}
                                    </span>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="settings-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="settings-first-name">First Name</label>
                                        <input
                                            id="settings-first-name"
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="First Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="settings-last-name">Last Name</label>
                                        <input
                                            id="settings-last-name"
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Last Name"
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="settings-phone">Phone</label>
                                        <input
                                            id="settings-phone"
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="(555) 123-4567"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="settings-state">State</label>
                                        <select id="settings-state" value={state} onChange={(e) => setState(e.target.value)}>
                                            <option value="">Select State</option>
                                            <option value="CA">California</option>
                                            <option value="TX">Texas</option>
                                            <option value="WA">Washington</option>
                                            <option value="TN">Tennessee</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="settings-email">Email</label>
                                    <input
                                        id="settings-email"
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="input-disabled"
                                    />
                                    <span className="field-hint">Email cannot be changed</span>
                                </div>

                                <div className="form-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSaveProfile}
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? (
                                            <div className="spinner spinner-small" />
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <>
                            <div className="settings-section">
                                <div className="section-header">
                                    <h2>Password</h2>
                                    <p>Change your account password</p>
                                </div>

                                <div className="settings-form">
                                    <div className="form-group">
                                        <label htmlFor="settings-current-password">Current Password</label>
                                        <div className="password-input">
                                            <input
                                                id="settings-current-password"
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Enter current password"
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            >
                                                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="settings-new-password">New Password</label>
                                        <div className="password-input">
                                            <input
                                                id="settings-new-password"
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter new password (Min. 8 characters, incl. uppercase, lowercase, number & symbol)"
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                            >
                                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="settings-confirm-password">Confirm New Password</label>
                                        <div className="password-input">
                                            <input
                                                id="settings-confirm-password"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                            />
                                            {confirmPassword && newPassword === confirmPassword && (
                                                <CheckCircle size={16} className="password-match" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleChangePassword}
                                            disabled={isChangingPassword}
                                        >
                                            {isChangingPassword ? (
                                                <div className="spinner spinner-small" />
                                            ) : (
                                                <Lock size={16} />
                                            )}
                                            {isChangingPassword ? 'Changing...' : 'Change Password'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section" style={{ marginTop: '1rem' }}>
                                <div className="section-header">
                                    <h2>Two-Factor Authentication (MFA)</h2>
                                    <p>Use an Authenticator App to generate time-based codes for extra security.</p>
                                </div>
                                <div className="settings-form">
                                    <MfaSettingsPanel />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="settings-section">
                            <div className="section-header">
                                <h2>Notification Preferences</h2>
                                <p>Control how and when you receive notifications</p>
                            </div>

                            <div className="notification-groups">
                                <div className="notification-group">
                                    <div className="notif-group-header">
                                        <h3>Email Notifications</h3>
                                    </div>
                                    <div className="notif-item">
                                        <div className="notif-info">
                                            <span className="notif-title">Session Confirmations</span>
                                            <span className="notif-desc">
                                                Receive email when a session is scheduled
                                            </span>
                                        </div>
                                        <label className="toggle-switch">
                                            <span style={visuallyHiddenStyle}>Toggle session confirmation emails</span>
                                            <input type="checkbox" defaultChecked />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                    <div className="notif-item">
                                        <div className="notif-info">
                                            <span className="notif-title">Session Reminders</span>
                                            <span className="notif-desc">
                                                Get reminded before upcoming sessions
                                            </span>
                                        </div>
                                        <label className="toggle-switch">
                                            <span style={visuallyHiddenStyle}>Toggle session reminder emails</span>
                                            <input type="checkbox" defaultChecked />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                    <div className="notif-item">
                                        <div className="notif-info">
                                            <span className="notif-title">Cancellation Alerts</span>
                                            <span className="notif-desc">
                                                Receive email when a session is cancelled
                                            </span>
                                        </div>
                                        <label className="toggle-switch">
                                            <span style={visuallyHiddenStyle}>Toggle cancellation alert emails</span>
                                            <input type="checkbox" defaultChecked />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>

                                <div className="notification-group">
                                    <div className="notif-group-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3>Push Notifications</h3>
                                        {(!pushRegistered || Notification.permission !== 'granted') && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '4px 12px', fontSize: '13px' }}
                                                onClick={requestPushPermission}
                                            >
                                                Enable Push Notifications
                                            </button>
                                        )}
                                    </div>
                                    <div className="notif-item">
                                        <div className="notif-info">
                                            <span className="notif-title">Session Starting Soon</span>
                                            <span className="notif-desc">
                                                Alert when session is about to begin
                                            </span>
                                        </div>
                                        <label className="toggle-switch">
                                            <span style={visuallyHiddenStyle}>Toggle push notifications for sessions starting soon</span>
                                            <input type="checkbox" defaultChecked />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                    <div className="notif-item">
                                        <div className="notif-info">
                                            <span className="notif-title">New Messages</span>
                                            <span className="notif-desc">
                                                Notify when you receive a new message
                                            </span>
                                        </div>
                                        <label className="toggle-switch">
                                            <span style={visuallyHiddenStyle}>Toggle push notifications for new messages</span>
                                            <input type="checkbox" defaultChecked />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Availability Tab (Therapists Only) */}
                    {activeTab === 'availability' && (
                        <AvailabilitySettingsSection
                            user={user}
                            therapistStateTimezone={therapistStateTimezone}
                            browserTimezone={browserTimezone}
                            schedule={schedule}
                            isLoadingAvailability={isLoadingAvailability}
                            isSavingAvailability={isSavingAvailability}
                            getAvailabilitySummary={getAvailabilitySummary}
                            handleAddWindow={handleAddWindow}
                            handleWindowChange={handleWindowChange}
                            handleRemoveWindow={handleRemoveWindow}
                            handleSaveAvailability={handleSaveAvailability}
                        />
                    )}

                    {/* Integrations Tab */}
                    {activeTab === 'integrations' && canAccessGoogleIntegration && (
                        <div className="settings-section">
                            <div className="section-header">
                                <h2>Integrations</h2>
                                <p>Connect external calendars and automation tools</p>
                            </div>

                            <div className="settings-form settings-integrations-form">
                                <GoogleCalendarIntegrationPanel />
                            </div>
                        </div>
                    )}

                    {/* System Tab (Admin Only) */}
                    {activeTab === 'system' && user?.role === 'ADMIN' && (
                        <>
                            <SystemSettingsSection
                                isLoadingSys={isLoadingSys}
                                sysSettings={sysSettings}
                                setSysSettings={setSysSettings}
                                isSavingSys={isSavingSys}
                                handleSaveSystemSettings={handleSaveSystemSettings}
                            />
                            <AdminMfaRoleToggles />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
