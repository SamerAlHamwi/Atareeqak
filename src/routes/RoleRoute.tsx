import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../app/context/useAuth';
import { canAccess } from '../app/roles';
import type { AppSection } from '../app/roles';
import NoPermissionPanel from '../features/shared/components/NoPermissionPanel';

interface RoleRouteProps {
  section: AppSection;
}

/**
 * Guards a protected section by staff role, mirroring the backend middleware.
 * Renders a friendly "no permission" screen instead of letting the page
 * fire requests that would come back as raw 403s.
 */
const RoleRoute: React.FC<RoleRouteProps> = ({ section }) => {
  const { role } = useAuth();

  if (canAccess(role, section)) {
    return <Outlet />;
  }

  return <NoPermissionPanel />;
};

export default RoleRoute;
