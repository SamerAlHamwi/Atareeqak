import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import AuthLayout from '../components/layout/AuthLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

// Route-level code splitting: each page becomes its own chunk so the initial
// bundle only carries the shell (layouts, router, auth context).
const Login = lazy(() => import('../features/auth/pages/Login'));
const Dashboard = lazy(() => import('../features/dashboard/pages/Dashboard'));
const Home = lazy(() => import('../features/home/pages/Home'));
const Users = lazy(() => import('../features/users/pages/Users'));
const UserDetails = lazy(() => import('../features/users/pages/UserDetails'));
const Drivers = lazy(() => import('../features/drivers/pages/Drivers'));
const DriverDetails = lazy(() => import('../features/drivers/pages/DriverDetails'));
const Trips = lazy(() => import('../features/trips/pages/Trips'));
const Reports = lazy(() => import('../features/reports/pages/Reports'));
const Support = lazy(() => import('../features/support/pages/Support'));
const Settings = lazy(() => import('../features/settings/pages/Settings'));
const Staff = lazy(() => import('../features/staff/pages/Staff'));
const Verifications = lazy(() => import('../features/verification/pages/Verifications'));
const Reviews = lazy(() => import('../features/reviews/pages/Reviews'));

const RouteFallback: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div
      className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"
      role="status"
      aria-label="Loading"
    />
  </div>
);

const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            {/* Employees are created by the system admin — no self-registration */}
            <Route path="/register" element={<Navigate to="/login" replace />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />

              {/* admin + system_admin (backed by /admin/* endpoints) */}
              <Route element={<RoleRoute section="dashboard" />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>
              <Route element={<RoleRoute section="passengers" />}>
                <Route path="/passengers" element={<Users />} />
                <Route path="/passengers/:userId" element={<UserDetails />} />
              </Route>
              <Route element={<RoleRoute section="drivers" />}>
                <Route path="/drivers" element={<Drivers />} />
                <Route path="/drivers/:driverId" element={<DriverDetails />} />
              </Route>
              <Route element={<RoleRoute section="trips" />}>
                <Route path="/trips" element={<Trips />} />
              </Route>
              <Route element={<RoleRoute section="verifications" />}>
                <Route path="/verifications" element={<Verifications />} />
              </Route>

              {/* system_admin only */}
              <Route element={<RoleRoute section="staff" />}>
                <Route path="/staff" element={<Staff />} />
              </Route>
              <Route element={<RoleRoute section="reports" />}>
                <Route path="/reports" element={<Reports />} />
              </Route>

              {/* any staff role */}
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/support" element={<Support />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
