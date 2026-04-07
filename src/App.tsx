import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import QuestionnairePage from './pages/questionnaire/QuestionnairePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import InvitePage from './pages/auth/InvitePage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import RoleBasedDashboard from './pages/RoleBasedDashboard';
import MessagesPage from './pages/messages/MessagesPage';
import UsersPage from './pages/admin/UsersPage';
import SessionListPage from './pages/admin/sessions/SessionListPage';
import ClientSessionsPage from './pages/dashboard/ClientSessionsPage';
import TherapistAppointmentsPage from './pages/therapist/appointments/TherapistAppointmentsPage';
import TherapistClientsPage from './pages/therapist/clients/TherapistClientsPage';
import ClientsPage from './pages/admin/clients/ClientsPage';
import ReportsPage from './pages/admin/reports/ReportsPage';
import SessionReportsPage from './pages/admin/reports/SessionReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import SessionRoom from './pages/session/SessionRoom';
import NotificationsPage from './pages/notifications/NotificationsPage';
import Layout from './components/layout/Layout';
import MyIssues from './pages/issues/MyIssues';
import AdminIssues from './pages/admin/issues/AdminIssues';
import ProgramFeedbackPage from './pages/feedback/ProgramFeedbackPage';
import AdminProgramFeedbackPage from './pages/admin/feedback/AdminProgramFeedbackPage';

/**
 * Protected Route Component
 */
function ProtectedRoute({ children }: Readonly<{ children: React.ReactNode }>) {
    const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--gray-50)'
            }}>
                <div className="spinner spinner-dark" style={{ width: '40px', height: '40px' }} />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Layout>{children}</Layout>;
}

/**
 * Public Route (redirect if authenticated)
 */
function PublicRoute({ children }: Readonly<{ children: React.ReactNode }>) {
    const { isAuthenticated } = useAuthStore();

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}

/**
 * Main App Component
 */
export default function App() {

    return (
        <BrowserRouter>
            {/* Toast Notifications */}
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#333',
                        color: '#fff',
                        borderRadius: '12px',
                        padding: '12px 16px',
                    },
                    success: {
                        iconTheme: {
                            primary: '#38a169',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#e53e3e',
                            secondary: '#fff',
                        },
                    },
                }}
            />

            <Routes>
                {/* Redirect root to login (landing page handled by separate project) */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* Questionnaire / Get Started */}
                <Route
                    path="/get-started"
                    element={
                        <PublicRoute>
                            <QuestionnairePage />
                        </PublicRoute>
                    }
                />

                {/* Auth Routes */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <LoginPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <RegisterPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/forgot-password"
                    element={
                        <PublicRoute>
                            <ForgotPasswordPage />
                        </PublicRoute>
                    }
                />

                {/* Protected Routes */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <RoleBasedDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/messages"
                    element={
                        <ProtectedRoute>
                            <MessagesPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/appointments"
                    element={
                        <ProtectedRoute>
                            <ClientSessionsPage />
                        </ProtectedRoute>
                    }
                />

                {/* Session Room Route */}
                <Route
                    path="/sessions/:id/room"
                    element={
                        <ProtectedRoute>
                            <SessionRoom />
                        </ProtectedRoute>
                    }
                />

                {/* Therapist Routes */}
                <Route
                    path="/therapist/appointments"
                    element={
                        <ProtectedRoute>
                            <TherapistAppointmentsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/therapist/clients"
                    element={
                        <ProtectedRoute>
                            <TherapistClientsPage />
                        </ProtectedRoute>
                    }
                />

                {/* Admin Routes */}
                <Route
                    path="/admin/users"
                    element={
                        <ProtectedRoute>
                            <UsersPage />
                        </ProtectedRoute>
                    }
                />
                
                {/* Admin Issues */}
                <Route
                    path="/admin/issues"
                    element={
                        <ProtectedRoute>
                            <AdminIssues />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/sessions"
                    element={
                        <ProtectedRoute>
                            <SessionListPage />
                        </ProtectedRoute>
                    }
                />

                {/* Admin Clients Route */}
                <Route
                    path="/clients"
                    element={
                        <ProtectedRoute>
                            <ClientsPage />
                        </ProtectedRoute>
                    }
                />

                {/* Reports Routes */}
                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute>
                            <ReportsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports/sessions"
                    element={
                        <ProtectedRoute>
                            <SessionReportsPage />
                        </ProtectedRoute>
                    }
                />

                {/* Settings Route (all roles) */}
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <SettingsPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/notifications"
                    element={
                        <ProtectedRoute>
                            <NotificationsPage />
                        </ProtectedRoute>
                    }
                />
                
                {/* My Issues Route */}
                <Route
                    path="/issues"
                    element={
                        <ProtectedRoute>
                            <MyIssues />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/feedback"
                    element={
                        <ProtectedRoute>
                            <ProgramFeedbackPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/feedback"
                    element={
                        <ProtectedRoute>
                            <AdminProgramFeedbackPage />
                        </ProtectedRoute>
                    }
                />

                <Route path="/feedback/invite/:token" element={<ProgramFeedbackPage />} />

                {/* Public Invite Accept Route */}
                <Route path="/invite/:token" element={<InvitePage />} />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}




