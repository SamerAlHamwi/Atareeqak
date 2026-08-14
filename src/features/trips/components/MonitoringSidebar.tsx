import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTripMonitoring } from '../hooks/useTripMonitoring';
import PageLoader from '../../shared/components/PageLoader';

const eventIcon = (status: string): { icon: string; classes: string } => {
  switch (status) {
    case 'completed':
      return { icon: 'check_circle', classes: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
    case 'cancelled':
      return { icon: 'warning', classes: 'bg-error-container text-on-error-container' };
    default:
      return { icon: 'directions_car', classes: 'bg-primary-fixed text-on-primary-fixed-variant' };
  }
};

export const MonitoringSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { popularRoutes, topDrivers, recentEvents, isLoading, error } = useTripMonitoring();

  return (
    <aside className="col-span-12 xl:col-span-4 space-y-8">
      {/* Live Statistics Card */}
      <div className="bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/5">
        <h4 className="font-headline font-bold text-lg mb-6 text-primary">
          {t('trips.route_monitoring')}
        </h4>
        {isLoading ? (
          <PageLoader size="sm" />
        ) : error ? (
          <p className="text-sm text-error">{t('common.load_failed')}</p>
        ) : popularRoutes.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t('common.no_data')}</p>
        ) : (
          <div className="space-y-6">
            {popularRoutes.map((route) => (
              <div key={route.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{route.label}</span>
                  <span
                    className={`text-xs font-bold ${
                      route.demandLevelKey === 'very_high' || route.demandLevelKey === 'high'
                        ? 'text-secondary'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {t(`trips.congestion.${route.demandLevelKey}`)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      route.demandLevelKey === 'very_high' || route.demandLevelKey === 'high'
                        ? 'bg-secondary'
                        : 'bg-primary-container'
                    }`}
                    style={{ width: `${Math.min(100, route.demandPercentage)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-2">
                  {t('trips.current_trips', { count: route.tripCount })} |{' '}
                  {t('trips.current_passengers', { count: route.totalPassengers })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-time Event Feed */}
      <div className="bg-white/40 border border-outline-variant/20 p-8 rounded-[2rem] glass">
        <h4 className="font-headline font-bold text-lg mb-6 text-primary">
          {t('trips.recent_activity')}
        </h4>
        {isLoading ? (
          <PageLoader size="sm" />
        ) : recentEvents.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t('common.no_data')}</p>
        ) : (
          <div className="space-y-6">
            {recentEvents.map((event) => {
              const { icon, classes } = eventIcon(event.status);
              return (
                <div key={event.id} className="flex gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${classes}`}
                  >
                    <span className="material-symbols-outlined text-lg">{icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{event.route}</p>
                    <p className="text-xs text-on-surface-variant">
                      {event.driver} • {event.timeLabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Driver Performance Shortcut */}
      <div className="bg-gradient-to-br from-tertiary-container to-tertiary p-8 rounded-[2rem] text-on-tertiary shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <h4 className="font-headline font-bold text-lg">{t('trips.top_drivers')}</h4>
          <span className="material-symbols-outlined opacity-50">star</span>
        </div>
        {isLoading ? (
          <PageLoader size="sm" labelClassName="text-on-tertiary opacity-80" />
        ) : topDrivers.length === 0 ? (
          <p className="text-sm opacity-80">{t('common.no_data')}</p>
        ) : (
          <div className="space-y-4">
            {topDrivers.map((driver) => (
              <div
                key={driver.rank}
                className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      driver.rank === 1
                        ? 'bg-secondary-fixed text-on-secondary-fixed'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {driver.rank}
                  </div>
                  <span className="text-sm font-medium">{driver.name}</span>
                </div>
                <div className="flex items-center gap-1 text-secondary-fixed">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="text-xs font-bold">{driver.rating}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
