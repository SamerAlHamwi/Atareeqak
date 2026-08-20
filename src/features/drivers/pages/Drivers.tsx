import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Radio,
  ClipboardList,
  Star,
  Search,
  Eye,
  Undo2,
  Ban,
  CheckCircle2,
  XCircle,
  PencilLine,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import Avatar from '../../shared/components/Avatar';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import FilterTabs from '../../shared/components/FilterTabs';
import type { FilterTabItem } from '../../shared/components/FilterTabs';
import PerPageSelect from '../../shared/components/PerPageSelect';
import TablePagination from '../../shared/components/TablePagination';
import TableSkeleton from '../../shared/components/TableSkeleton';
import {
  useDrivers,
  isBannedDriver,
  DRIVER_FILTERS,
  DRIVERS_PER_PAGE_OPTIONS,
  EFFICIENCY_PERIODS,
} from '../hooks/useDrivers';
import type { Driver, DriverStatusFilter } from '../hooks/useDrivers';

const statusBadgeClasses = (status: Driver['status']): string => {
  switch (status) {
    case 'verified':
      return 'bg-secondary-fixed text-on-secondary-container';
    case 'pending':
      return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    case 'banned':
    case 'rejected':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-surface-container-high text-on-surface-variant';
  }
};

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

const activityIconComponent = (icon: string): LucideIcon => {
  switch (icon) {
    case 'check':
      return CheckCircle2;
    case 'x':
      return XCircle;
    case 'edit':
      return PencilLine;
    default:
      return Info;
  }
};

const Drivers: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [banTarget, setBanTarget] = React.useState<Driver | null>(null);
  const isRtl = i18n.language === 'ar';

  const {
    drivers,
    counts,
    stats,
    activity,
    efficiency,
    efficiencyDelta,
    efficiencyPeriod,
    setEfficiencyPeriod,
    isEfficiencyLoading,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    perPage,
    setPerPage,
    lastPage,
    total,
    isLoading,
    error,
    isForbidden,
    refetch,
    banDriver,
    unbanDriver,
  } = useDrivers();

  const filterItems = useMemo<FilterTabItem<DriverStatusFilter>[]>(
    () =>
      DRIVER_FILTERS.map((filter) => ({
        value: filter,
        label: t(`drivers.filter_${filter}`),
        count: counts ? counts[filter] : undefined,
      })),
    [counts, t]
  );

  const handleToggleStatus = async (driver: Driver) => {
    if (isBannedDriver(driver)) {
      await runAction({
        key: `status-${driver.id}`,
        action: () => unbanDriver(driver),
        successMessage: t('drivers.unban_success', { name: driver.name }),
        errorMessage: t('drivers.status_update_failed'),
      });
    } else {
      setBanTarget(driver);
    }
  };

  const handleConfirmBan = async ({ reason, banType, expiresAt }: ConfirmActionPayload) => {
    if (!banTarget) return;
    const driver = banTarget;
    await runAction({
      key: `status-${driver.id}`,
      action: () =>
        banDriver(driver, {
          reason,
          type: banType ?? 'permanent',
          ...(expiresAt ? { expires_at: expiresAt } : {}),
        }),
      successMessage: t('drivers.ban_success', { name: driver.name }),
      errorMessage: t('drivers.status_update_failed'),
    });
    // Close either way — success and error feedback both show in the page banner
    setBanTarget(null);
  };

  const rangeInfo = (): string => {
    if (total === 0) return '';
    const from = (page - 1) * perPage + 1;
    const to = Math.min(page * perPage, total);
    // `count` drives the Arabic plural category, so it must be the total.
    return t('common.showing_range', { from, to, count: total });
  };

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through — `services/api.ts` deliberately
  // passes 403 through untouched so this renders the same panel instead of a
  // generic ErrorBanner that implies a Retry would help.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && <ErrorBanner onRetry={() => void refetch()} />}

      {/* Summary Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users size={24} />
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.total_drivers')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">
              {stats ? stats.total_drivers.toLocaleString() : '—'}
            </h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <Radio size={24} />
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

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center text-error">
              <ClipboardList size={24} />
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.pending_verifications')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">
              {stats ? stats.pending_verifications.toLocaleString() : '—'}
            </h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Star size={24} fill="currentColor" />
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
          <FilterTabs
            items={filterItems}
            active={statusFilter}
            onChange={setStatusFilter}
            disabled={isLoading}
            aria-label={t('drivers.filter')}
          />
          <PerPageSelect
            value={perPage}
            options={DRIVERS_PER_PAGE_OPTIONS}
            onChange={setPerPage}
            disabled={isLoading}
          />
        </div>
        <div className="relative w-full md:max-w-xs">
          <span className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-on-surface-variant`}>
            <Search size={18} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`block w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-surface-container-lowest border border-outline-variant rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
            placeholder={t('drivers.search_placeholder')}
            type="text"
          />
        </div>
      </section>

      {/* Data Table Section */}
      <section className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant">
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
                <TableSkeleton rows={6} cols={6} firstColAvatar />
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-on-surface-variant font-medium">
                    {search ? t('drivers.no_results', { term: search }) : t('common.no_data')}
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-surface-container/30 transition-colors group">
                    <td className="px-8 py-5 text-start">
                      <div className="flex items-center gap-3">
                        <Avatar name={driver.name} photo={driver.photo} size="sm" />
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          data-testid={isBannedDriver(driver) ? `driver-banned-${driver.id}` : undefined}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold ${statusBadgeClasses(driver.status)}`}
                        >
                          {t(`drivers.status_${driver.status}`)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <div className={`flex items-center gap-1 ${driver.rating ? 'text-amber-500' : 'text-on-surface-variant/50'}`}>
                        <Star size={18} fill={driver.rating ? 'currentColor' : 'none'} />
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
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={() => void handleToggleStatus(driver)}
                          disabled={isBusy(`status-${driver.id}`)}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${isBannedDriver(driver) ? 'hover:bg-secondary/10 text-secondary' : 'hover:bg-error/10 text-error'}`}
                          title={isBannedDriver(driver) ? t('drivers.unban_action') : t('drivers.ban_action')}
                        >
                          {isBannedDriver(driver) ? <Undo2 size={20} /> : <Ban size={20} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
          info={rangeInfo()}
          isLoading={isLoading}
        />
      </section>

      {/* Ban confirmation modal (reason + permanent/temporary + expiry) */}
      <ConfirmActionModal
        open={!!banTarget}
        title={t('drivers.ban_modal_title', { name: banTarget?.name ?? '' })}
        description={t('drivers.ban_modal_description')}
        confirmLabel={t('drivers.ban_confirm')}
        showBanOptions
        isBusy={banTarget ? isBusy(`status-${banTarget.id}`) : false}
        onConfirm={handleConfirmBan}
        onClose={() => setBanTarget(null)}
      />

      {/* Secondary Widget Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant shadow-sm">
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
                    {(() => {
                      const ActivityIcon = activityIconComponent(item.icon);
                      return <ActivityIcon size={16} />;
                    })()}
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

        {/* Verification Efficiency — its own endpoint, refetched per period */}
        <div className="bg-primary p-8 rounded-2xl text-on-primary flex flex-col justify-between overflow-hidden relative shadow-lg shadow-primary/20">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-on-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2 font-headline">{t('drivers.efficiency_title')}</h3>
            <p className="text-sm opacity-80 mb-4">{t('drivers.efficiency_subtitle')}</p>

            {/* period switch → GET /admin/drivers/verification-efficiency?period= */}
            <div
              role="tablist"
              aria-label={t('drivers.efficiency_period_label')}
              className="flex p-1 bg-on-primary/10 rounded-xl mb-6 w-fit"
            >
              {EFFICIENCY_PERIODS.map((period) => (
                <button
                  key={period}
                  role="tab"
                  aria-selected={period === efficiencyPeriod}
                  data-testid={`efficiency-period-${period}`}
                  disabled={isEfficiencyLoading}
                  onClick={() => void setEfficiencyPeriod(period)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                    period === efficiencyPeriod
                      ? 'bg-on-primary text-primary'
                      : 'text-on-primary/70 hover:text-on-primary'
                  }`}
                >
                  {t(`drivers.efficiency_period_${period}`)}
                </button>
              ))}
            </div>

            <div className="text-4xl font-extrabold font-headline mb-4" data-testid="efficiency-pct">
              {efficiency ? `${efficiency.current.efficiency_pct}%` : '—'}
            </div>
            <div className="w-full bg-on-primary/20 h-2 rounded-full mb-3">
              <div
                className="bg-secondary-fixed h-full rounded-full transition-all duration-1000"
                style={{ width: `${efficiency?.current.efficiency_pct ?? 0}%` }}
              ></div>
            </div>

            {efficiency && (
              <div className="space-y-1">
                <p className="text-xs opacity-80" data-testid="efficiency-processed">
                  {t('drivers.efficiency_processed', {
                    processed: efficiency.current.processed,
                    count: efficiency.current.total_incoming,
                  })}
                </p>
                {efficiency.current.pending > 0 && (
                  <p className="text-xs opacity-80">
                    {t('drivers.efficiency_pending', { count: efficiency.current.pending })}
                  </p>
                )}
                {/*
                  Built from `comparison.delta` rather than the payload's
                  `comparison.text`, which the backend renders in English only.
                */}
                {efficiencyDelta && (
                  <p className="text-xs font-medium" data-testid="efficiency-delta">
                    {t(`drivers.efficiency_delta_${efficiencyDelta.direction}`, {
                      count: efficiencyDelta.points,
                      period: t(`drivers.efficiency_previous_${efficiencyPeriod}`),
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Drivers;
