import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    User,
    Lock,
    Bell,
    Save,
    Eye,
    EyeOff,
    CheckCircle,
    Shield,
    Clock,
    Loader2
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import api from '../../lib/api';
import type { ApiResponse } from '../../lib/api';
import './SettingsPage.css';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'availability';

/**
 * Settings Page — Profile, Security, and Notification Preferences
 * Shared across all roles
 */
export default function SettingsPage() {
    const { user, checkAuth } = useAuthStore();
    const { pushRegistered, requestPushPermission } = useNotificationStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

    // Availability state
    const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    type DayAvailability = {
        dayOfWeek: string;
        isActive: boolean;
        startTime: string;
        endTime: string;
        id?: string;
    };
    const [schedule, setSchedule] = useState<DayAvailability[]>(
        DAYS.map(d => ({ dayOfWeek: d, isActive: false, startTime: '09:00', endTime: '17:00' }))
    );
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

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setPhone(user.phone || '');
            setState(user.state || '');
        }
    }, [user]);

    useEffect(() => {
        const fetchAvailability = async () => {
            if (user?.role === 'THERAPIST' && activeTab === 'availability') {
                setIsLoadingAvailability(true);
                try {
                    const res = await api.get('/scheduling/availability');
                    const slots: any[] = res.data.data || [];

                    const newSchedule = DAYS.map(day => {
                        const existingSlot = slots.find(s => s.dayOfWeek === day);
                        if (existingSlot) {
                            return {
                                dayOfWeek: day,
                                isActive: true,
                                startTime: existingSlot.startTime,
                                endTime: existingSlot.endTime,
                                id: existingSlot.id
                            };
                        }
                        return { dayOfWeek: day, isActive: false, startTime: '09:00', endTime: '17:00' };
                    });
                    setSchedule(newSchedule);
                } catch (error) {
                    toast.error('Failed to load availability');
                } finally {
                    setIsLoadingAvailability(false);
                }
            }
        };
        fetchAvailability();
    }, [user, activeTab]);

    const handleScheduleChange = (dayIndex: number, field: keyof DayAvailability, value: any) => {
        const updated = [...schedule];
        updated[dayIndex] = { ...updated[dayIndex], [field]: value };
        setSchedule(updated);
    };

    const handleSaveAvailability = async () => {
        setIsSavingAvailability(true);
        try {
            const promises = schedule.map(async (daySlot) => {
                if (daySlot.isActive) {
                    if (daySlot.id) {
                        return api.patch(`/scheduling/availability/${daySlot.id}`, {
                            startTime: daySlot.startTime,
                            endTime: daySlot.endTime,
                        });
                    } else {
                        return api.post('/scheduling/availability', {
                            dayOfWeek: daySlot.dayOfWeek,
                            startTime: daySlot.startTime,
                            endTime: daySlot.endTime,
                            isRecurring: true,
                        });
                    }
                } else {
                    if (daySlot.id) {
                        return api.delete(`/scheduling/availability/${daySlot.id}`);
                    }
                }
                return Promise.resolve();
            });

            await Promise.all(promises);
            toast.success('Availability schedule updated successfully!');

            // refetch to get new IDs
            const res = await api.get('/scheduling/availability');
            const slots: any[] = res.data.data || [];

            const newSchedule = DAYS.map(day => {
                const existingSlot = slots.find(s => s.dayOfWeek === day);
                if (existingSlot) {
                    return {
                        dayOfWeek: day,
                        isActive: true,
                        startTime: existingSlot.startTime,
                        endTime: existingSlot.endTime,
                        id: existingSlot.id
                    };
                }
                return { dayOfWeek: day, isActive: false, startTime: '09:00', endTime: '17:00' };
            });
            setSchedule(newSchedule);

        } catch (error) {
            toast.error('Failed to save availability');
        } finally {
            setIsSavingAvailability(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            toast.error('First name and last name are required');
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
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('All password fields are required');
            return;
        }
        if (newPassword.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
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

    const formatRole = (role: string) =>
        role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        ...(user?.role === 'THERAPIST' ? [{ id: 'availability' as SettingsTab, label: 'Availability', icon: Clock }] : []),
    ];

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
                            onClick={() => setActiveTab(tab.id)}
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
                                        {formatRole(user?.role || '')}
                                    </span>
                                </div>
                            </div>

                            {/* Form */}
                            <div className="settings-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>First Name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="First Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Last Name"
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="(555) 123-4567"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>State</label>
                                        <select value={state} onChange={(e) => setState(e.target.value)}>
                                            <option value="">Select State</option>
                                            <option value="CA">California</option>
                                            <option value="TX">Texas</option>
                                            <option value="WA">Washington</option>
                                            <option value="TN">Tennessee</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
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
                        <div className="settings-section">
                            <div className="section-header">
                                <h2>Security</h2>
                                <p>Manage your password and account security</p>
                            </div>

                            <div className="settings-form">
                                <div className="form-group">
                                    <label>Current Password</label>
                                    <div className="password-input">
                                        <input
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
                                    <label>New Password</label>
                                    <div className="password-input">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password (min 8 characters)"
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
                                    <label>Confirm New Password</label>
                                    <div className="password-input">
                                        <input
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
                                            <input type="checkbox" defaultChecked />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Availability Tab (Therapists Only) */}
                    {activeTab === 'availability' && user?.role === 'THERAPIST' && (
                        <div className="settings-section">
                            <div className="section-header" style={{ paddingBottom: '0.5rem' }}>
                                <h2>Availability Schedule</h2>
                                <p>Set your weekly recurring working hours</p>
                            </div>

                            <div className="settings-form" style={{ paddingTop: '0.1rem' }}>
                                {isLoadingAvailability ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '2rem', justifyContent: 'center', color: 'var(--gray-500)' }}>
                                        <Loader2 size={16} className="spin" />
                                        <span>Loading your schedule...</span>
                                    </div>
                                ) : (
                                    <div className="availability-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {schedule.map((day, index) => (
                                            <div key={day.dayOfWeek} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', border: `1px solid ${day.isActive ? 'var(--secondary-color)' : 'var(--gray-200)'}`, borderRadius: '8px', backgroundColor: day.isActive ? 'var(--bg-surface)' : 'var(--gray-50)' }}>
                                                <div style={{ width: '120px' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '14px', color: day.isActive ? 'var(--gray-900)' : 'var(--gray-500)' }}>
                                                        {day.dayOfWeek.charAt(0) + day.dayOfWeek.slice(1).toLowerCase()}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, opacity: day.isActive ? 1 : 0.5, pointerEvents: day.isActive ? 'auto' : 'none' }}>
                                                    <input
                                                        type="time"
                                                        value={day.startTime}
                                                        onChange={(e) => handleScheduleChange(index, 'startTime', e.target.value)}
                                                        style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--gray-900)' }}
                                                    />
                                                    <span style={{ color: 'var(--gray-500)', fontWeight: 500, fontSize: '14px' }}>to</span>
                                                    <input
                                                        type="time"
                                                        value={day.endTime}
                                                        onChange={(e) => handleScheduleChange(index, 'endTime', e.target.value)}
                                                        style={{ padding: '8px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--gray-900)' }}
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    <label className="toggle-switch">
                                                        <input
                                                            type="checkbox"
                                                            checked={day.isActive}
                                                            onChange={(e) => handleScheduleChange(index, 'isActive', e.target.checked)}
                                                        />
                                                        <span className="toggle-slider" />
                                                    </label>
                                                </div>
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
                    )}
                </div>
            </div>
        </div>
    );
}
