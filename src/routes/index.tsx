import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import AuthLayout from '../components/layout/AuthLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { useAuth } from '../app/context/useAuth';
import { defaultRouteForRole } from '../app/roles';
import { SECTION_ROUTES } from './sectionRoutes';
import PageLoader from '../features/shared/components/PageLoader';

const Login = lazy(() => import('../features/auth/pages/Login'));

const RouteFallback: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <PageLoader size="lg" />
  </div>
);

/**
 * `/` has no content of its own — it only exists to send a logged-in employee
 * to the first section their role can actually see. There used to be a
 * marketing-splash Home page here; it rendered to admins who never see it
 * (they already land on `/dashboard`) and dead-ended a `support_agent` whose
 * only button pointed at a page they cannot open.
 */
const RoleHome: React.FC = () => {
  const { role } = useAuth();
  return <Navigate to={defaultRouteForRole(role)} replace />;
};

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
              <Route path="/" element={<RoleHome />} />

              {SECTION_ROUTES.map(({ section, path, Component, detail }) => (
                <Route key={section} element={<RoleRoute section={section} />}>
                  <Route path={path} element={<Component />} />
                  {detail && <Route path={detail.path} element={<detail.Component />} />}
                </Route>
              ))}
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
