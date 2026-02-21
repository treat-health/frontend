import { useAuthStore } from '../stores/authStore';
import AdminDashboard from './admin/dashboard/AdminDashboard';
import DashboardPage from './dashboard/DashboardPage';
import TherapistDashboard from './therapist/dashboard/TherapistDashboard';

/**
 * Role-based Dashboard Selector
 * Renders the appropriate dashboard based on user role
 */
export default function RoleBasedDashboard() {
    const { user } = useAuthStore();

    // Admin and Program Director get the admin dashboard
    if (user?.role === 'ADMIN' || user?.role === 'PROGRAM_DIRECTOR') {
        return <AdminDashboard />;
    }

    // Therapist Dashboard
    if (user?.role === 'THERAPIST') {
        return <TherapistDashboard />;
    }

    // For now, all other roles get the default dashboard (Client)
    return <DashboardPage />;
}
