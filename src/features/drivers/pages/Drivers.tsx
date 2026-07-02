import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useDrivers } from '../hooks/useDrivers';
import type { Driver } from '../hooks/useDrivers';

const activityIconClasses = (color: string): string => {
  switch (color) {
    case 'green':
      return 'bg-secondary-fixed text-on-secondary-fixed';
    case 'red':
      return 'bg-error-container/40 text-error';
    case 'purple':
      return 'bg-primary-fixed text-primary';
    default:
      return 'bg-surface-container-high text-on-surface-variant';
  }
};

const activityIconName = (icon: string): string => {
  switch (icon) {
    case 'check':
      return 'check_circle';
    case 'x':
      return 'cancel';
    case 'edit':
      return 'edit_square';
    default:
      return 'info';
  }
};

const Drivers: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const isRtl = i18n.language === 'ar';

  const {
    visibleDrivers,
    stats,
    activity,
    efficiency,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    isLoading,
    error,
    banDriver,
    unbanDriver,
  } = useDrivers();

  const handleToggleStatus = async (driver: Driver) => {
    if (driver.status === 'suspended') {
      await runAction({
        key: `status-${driver.id}`,
        action: () => unbanDriver(driver),
        successMessage: t('drivers.unban_success', { name: driver.name }),
        errorMessage: t('drivers.status_update_failed'),
      });
    } else {
      await runAction({
        key: `status-${driver.id}`,
        action: () => banDriver(driver, t('drivers.ban_reason_default')),
        successMessage: t('drivers.ban_success', { name: driver.name }),
        errorMessage: t('drivers.status_update_failed'),
      });
    }
  };

  const paginationStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const paginationEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      )}

      {/* Summary Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">group</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.total_drivers')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">
              {stats ? stats.total_drivers.toLocaleString() : '—'}
            </h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
            </div>
            <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-full">{t('dashboard.live')}</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.active_drivers')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">
              {stats ? stats.active_drivers.toLocaleString() : '—'}
            </h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center text-error">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.pending_verifications')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">
              {stats ? stats.pending_verifications.toLocaleString() : '—'}
            </h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.avg_rating')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">
              {stats ? stats.average_rating.toFixed(2) : '—'}
            </h2>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          <div className="flex bg-surface-container-low rounded-full p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-6 py-1.5 rounded-full text-sm font-bold shadow-sm ${statusFilter === 'all' ? 'bg-surface-container-lowest text-on-surface' : 'text-on-surface-variant hover:text-on-surface transition-colors'}`}
            >
              {t('users.all')}
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-6 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === 'verified' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('drivers.status_verified')}
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-6 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === 'pending' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('users.pending_review')}
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-6 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === 'suspended' ? 'bg-error text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('drivers.status_suspended')}
            </button>
          </div>
        </div>
      </section>

      {/* Data Table Section */}
      <section className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-separate border-spacing-y-0">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-xs font-bold tracking-wider">
                <th className="px-8 py-5 text-start">{t('drivers.table_driver')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_phone')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_vehicle')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_status')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_rating')}</th>
                <th className="px-8 py-5 ltr:text-right rtl:text-left">{t('drivers.table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-on-surface-variant font-medium">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : visibleDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-on-surface-variant font-medium">
                    {t('common.no_data')}
                  </td>
                </tr>
              ) : (
                visibleDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-surface-container/30 transition-colors group">
                    <td className="px-8 py-5 text-start">
                      <div className="flex items-center gap-3">
                        <img alt={driver.name} className="w-10 h-10 rounded-full object-cover" src={driver.avatar} />
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{driver.name}</span>
                          <span className="text-xs text-on-surface-variant">{driver.displayId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-on-surface-variant font-medium text-start ltr:font-mono">{driver.phone || '--'}</td>
                    <td className="px-6 py-5 text-start">
                      <span className="text-on-surface font-medium">{driver.vehicle}</span>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                          driver.status === 'verified'
                            ? 'bg-secondary-fixed text-on-secondary-container'
                            : driver.status === 'pending'
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {t(`drivers.status_${driver.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <div className={`flex items-center gap-1 ${driver.rating ? 'text-amber-500' : 'text-slate-400'}`}>
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: driver.rating ? "'FILL' 1" : "" }}>
                          {driver.rating ? 'star' : 'star_outline'}
                        </span>
                        <span className="font-bold">{driver.rating ?? '--'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-2">
                        <button
                          onClick={() => navigate(`/drivers/${driver.id}`)}
                          className="p-2 hover:bg-surface-container-high rounded-lg text-primary transition-colors"
                          title={t('drivers.view_profile')}
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        <button
                          onClick={() => void handleToggleStatus(driver)}
                          disabled={isBusy(`status-${driver.id}`)}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${driver.status === 'suspended' ? 'hover:bg-secondary/10 text-secondary' : 'hover:bg-error/10 text-error'}`}
                          title={driver.status === 'suspended' ? t('users.approve') : t('users.block')}
                        >
                          <span className="material-symbols-outlined">{driver.status === 'suspended' ? 'undo' : 'block'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-8 py-6 bg-surface-container-low/30 flex items-center justify-between border-t border-outline-variant/10">
          <p className="text-xs text-on-surface-variant font-medium">
            {t('drivers.pagination_info', { start: paginationStart, end: paginationEnd, total })}
          </p>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
            </button>
            <span className="text-xs font-bold text-on-surface px-2">
              {page} / {lastPage}
            </span>
            <button
              onClick={() => setPage(Math.min(lastPage, page + 1))}
              disabled={page >= lastPage}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Secondary Widget Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-lg font-bold mb-6 font-headline text-primary">{t('drivers.recent_activity')}</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t('common.no_data')}</p>
          ) : (
            <div className="space-y-6">
              {activity.slice(0, 6).map((item, index) => (
                <div key={`${item.user_id}-${item.occurred_at}-${index}`} className="flex gap-4 relative">
                  {index < Math.min(activity.length, 6) - 1 && (
                    <div className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-8 bottom-0 w-[2px] bg-outline-variant/20`}></div>
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 ${activityIconClasses(item.color)}`}>
                    <span className="material-symbols-outlined text-sm">{activityIconName(item.icon)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold">{item.message}</p>
                    <p className="text-xs text-on-surface-variant">{item.human_time} • {item.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verification Efficiency */}
        <div className="bg-primary p-8 rounded-2xl text-on-primary flex flex-col justify-between overflow-hidden relative shadow-lg shadow-primary/20">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-on-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2 font-headline">{t('drivers.efficiency_title')}</h3>
            <p className="text-sm opacity-80 mb-6">{t('drivers.efficiency_subtitle')}</p>
            <div className="text-4xl font-extrabold font-headline mb-4">
              {efficiency ? `${efficiency.current.efficiency_pct}%` : '—'}
            </div>
            <div className="w-full bg-on-primary/20 h-2 rounded-full mb-2">
              <div
                className="bg-secondary-fixed h-full rounded-full transition-all duration-1000"
                style={{ width: `${efficiency?.current.efficiency_pct ?? 0}%` }}
              ></div>
            </div>
            {efficiency && <p className="text-xs font-medium">{efficiency.comparison.text}</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Drivers;
