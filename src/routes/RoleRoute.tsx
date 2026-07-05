import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../app/context/useAuth';
import { canAccess, defaultRouteForRole } from '../app/roles';
import type { AppSection } from '../app/roles';

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
  const { t } = useTranslation();

  if (canAccess(role, section)) {
    return <Outlet />;
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-error">
        <span className="material-symbols-outlined text-3xl">lock</span>
      </div>
      <h2 className="text-2xl font-extrabold font-headline text-primary">
        {t('common.no_permission')}
      </h2>
      <p className="text-on-surface-variant text-sm max-w-md">{t('common.no_permission_hint')}</p>
      <Link
        to={defaultRouteForRole(role)}
        className="mt-2 bg-primary text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-primary/90 transition-colors"
      >
        {t('common.back_home')}
      </Link>
    </div>
  );
};

export default RoleRoute;
