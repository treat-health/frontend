import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import LandingPage from './pages/landing/LandingPage';
import QuestionnairePage from './pages/questionnaire/QuestionnairePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import MessagesPage from './pages/messages/MessagesPage';
import Layout from './components/layout/Layout';

/**
 * Protected Route Component
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
function PublicRoute({ children }: { children: React.ReactNode }) {
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
                {/* Landing Page */}
                <Route
                    path="/"
                    element={
                        <PublicRoute>
                            <LandingPage />
                        </PublicRoute>
                    }
                />

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

                {/* Protected Routes */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardPage />
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

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}




