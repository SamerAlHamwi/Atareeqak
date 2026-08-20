import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, FileDown, UserPlus } from 'lucide-react';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import { reportsApi } from '../../reports/api/reportsApi';
import { useDashboard } from '../hooks/useDashboard';
import { StatCards, SideStats } from '../components/StatCards';
import { GrowthChart } from '../components/GrowthChart';
import { CityDistributionCard } from '../components/CityDistributionCard';
import { RecentActivityTable } from '../components/RecentActivityTable';

const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();

  const {
    stats,
    growth,
    chartPoints,
    chartMax,
    months,
    setMonths,
    newUsersDelta,
    completedTripsDelta,
    cityRows,
    activityRows,
    isLoading,
    isGrowthLoading,
    error,
    isForbidden,
    lastUpdated,
    refetch,
  } = useDashboard();

  const handleExport = () =>
    runAction({
      key: 'dashboard-export',
      action: async () => {
        const blob = await reportsApi.exportReportToPdf();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      },
      successMessage: t('dashboard.export_success'),
      errorMessage: t('dashboard.export_failed'),
    });

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through — `services/api.ts` deliberately
  // passes 403 through untouched so this renders the same panel instead of a
  // generic ErrorBanner that implies a Retry would help.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  return (
    <div className="space-y-10 pb-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-primary tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-on-surface-variant font-bold text-sm">{t('dashboard.welcome_back')}</p>
          {lastUpdated && (
            // The endpoint is server-cached for 5 minutes, so a refresh can
            // legitimately return identical figures — say so rather than
            // letting it look broken.
            <p className="text-on-surface-variant/70 font-bold text-xs pt-1">
              {t('dashboard.last_updated', {
                time: lastUpdated.toLocaleTimeString(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
              {' · '}
              {t('dashboard.cache_note')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-surface-container-lowest border border-outline-variant/40 text-on-surface rounded-[1.25rem] font-black text-sm shadow-sm hover:bg-surface-container-low transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            {t('dashboard.refresh')}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isBusy('dashboard-export')}
            className="flex items-center gap-2 px-6 py-3 bg-surface-container-lowest border border-outline-variant/40 text-on-surface rounded-[1.25rem] font-black text-sm shadow-sm hover:bg-surface-container-low transition-all disabled:opacity-50"
          >
            <FileDown size={18} />
            {isBusy('dashboard-export') ? t('common.loading') : t('dashboard.export_data')}
          </button>

          <Link
            to="/staff"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-[1.25rem] font-black text-sm shadow-lg hover:opacity-90 transition-all"
          >
            <UserPlus size={18} />
            {t('dashboard.add_employee')}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-9 space-y-8">
          {isLoading && !stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 rounded-[2rem] bg-surface-container-low animate-pulse"
                />
              ))}
            </div>
          ) : stats ? (
            <StatCards
              stats={stats}
              newUsersDelta={newUsersDelta}
              completedTripsDelta={completedTripsDelta}
            />
          ) : null}

          <GrowthChart
            data={chartPoints}
            chartMax={chartMax}
            months={months}
            onMonthsChange={setMonths}
            isLoading={isGrowthLoading || (isLoading && growth.length === 0)}
          />
        </div>

        <div className="col-span-12 lg:col-span-3 space-y-8">
          {isLoading && !stats ? (
            <div className="grid grid-cols-1 gap-6">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 rounded-[2rem] bg-surface-container-low animate-pulse"
                />
              ))}
            </div>
          ) : stats ? (
            <SideStats stats={stats} />
          ) : null}

          <CityDistributionCard cities={cityRows} />
        </div>

        <RecentActivityTable rows={activityRows} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default Dashboard;
