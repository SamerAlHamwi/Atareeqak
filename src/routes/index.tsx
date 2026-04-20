import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import AuthLayout from '../components/layout/AuthLayout';
import ProtectedRoute from './ProtectedRoute';

import Login from '../features/auth/pages/Login';
import Register from '../features/auth/pages/Register';
import Dashboard from '../features/dashboard/pages/Dashboard';
import Home from '../features/home/pages/Home';
import Users from '../features/users/pages/Users';
import Drivers from '../features/drivers/pages/Drivers';
import Trips from '../features/trips/pages/Trips';
import Reports from '../features/reports/pages/Reports';
import Support from '../features/support/pages/Support';
import Settings from '../features/settings/pages/Settings';
import Staff from '../features/staff/pages/Staff';

const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/passengers" element={<Users />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/support" element={<Support />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
