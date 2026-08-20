import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAuth } from '../../../app/context/useAuth';
import { defaultRouteForRole } from '../../../app/roles';

/**
 * `RoleRoute` renders this before a page's own request ever fires, for the
 * common case: the sidebar already hid the section, but a typed URL would
 * otherwise route the user in.
 *
 * Pages render it themselves for the less common case: a role change lands
 * *mid-session*, `RoleRoute` already let the page mount, and its data fetch
 * now comes back `403`. `services/api.ts` deliberately passes 403 through
 * untouched (no redirect, no refresh) so the page can show this instead of a
 * generic `ErrorBanner` — a role-gate rejection is not a network failure and
 * a Retry button would just 403 again.
 */
const NoPermissionPanel: React.FC = () => {
  const { role } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center text-error">
        <Lock size={28} />
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

export default NoPermissionPanel;
