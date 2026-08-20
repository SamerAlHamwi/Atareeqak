import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, LogOut } from 'lucide-react';
import type { UserStatusResponse } from '../../users/api/usersApi';

interface BanStatusBannerProps {
  status: UserStatusResponse | null;
}

/**
 * Renders the account state returned by `GET /admin/users/{id}/status`.
 *
 * Shared by the driver and passenger details pages: `/admin/users/{id}/ban` is
 * one endpoint for both, and neither list payload reports ban state truthfully
 * (BUG-6 — verified live for `/admin/drivers` in Phase 4 and for `/admin/users`
 * in Phase 5), so this endpoint is the only source either page can trust.
 *
 * Three states, driven by `status_code`:
 *
 *   -1 banned      → red banner with reason, type and expiry
 *    0 logged_out  → neutral notice; this is where an **unban** lands, since the
 *                    backend forces a fresh login rather than restoring `active`
 *    1 active      → nothing to say, so nothing is rendered
 */
const BanStatusBanner: React.FC<BanStatusBannerProps> = ({ status }) => {
  const { t, i18n } = useTranslation();

  if (!status) {
    return null;
  }

  const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString(i18n.language, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  if (status.ban) {
    const { ban } = status;
    return (
      <div
        data-testid="ban-status-banner"
        className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl space-y-2"
      >
        <div className="flex items-center gap-2 font-bold">
          <Ban size={20} />
          <span>
            {ban.type === 'temporary'
              ? t('common.ban_banner_temporary')
              : t('common.ban_banner_permanent')}
          </span>
        </div>
        {ban.reason && (
          <p className="text-sm">
            <span className="font-bold">{t('common.ban_banner_reason')}: </span>
            {ban.reason}
          </p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-medium">
          {ban.banned_at && (
            <span>
              {t('common.ban_banner_since')}: {formatDate(ban.banned_at)}
            </span>
          )}
          {ban.expires_at && (
            <span data-testid="ban-expires-at">
              {t('common.ban_banner_expires')}: {formatDate(ban.expires_at)}
            </span>
          )}
          {/*
            `banned_by` is null for bans issued before the BUG-5 fix (it was
            always null: AdminBanController read `$request->user()?->id`,
            which is never populated under StaffJwtMiddleware). New bans
            resolve it via the acting Employee, so the row appears on its own
            once one exists — omitted rather than showing "Unknown" until then.
          */}
          {ban.banned_by && (
            <span>
              {t('common.ban_banner_by')}: {ban.banned_by.name}
            </span>
          )}
          {ban.is_expired && <span className="font-bold">{t('common.ban_banner_expired')}</span>}
        </div>
      </div>
    );
  }

  if (status.status_code === 0) {
    return (
      <div
        data-testid="ban-status-banner"
        className="bg-surface-container-high text-on-surface-variant px-6 py-4 rounded-2xl flex items-center gap-2 text-sm font-medium"
      >
        <LogOut size={20} />
        {t('common.status_banner_logged_out')}
      </div>
    );
  }

  return null;
};

export default BanStatusBanner;
