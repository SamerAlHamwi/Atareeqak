import React from 'react';
import { useTranslation } from 'react-i18next';

export const MonitoringSidebar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <aside className="col-span-12 xl:col-span-4 space-y-8">
      {/* Live Statistics Card */}
      <div className="bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/5">
        <h4 className="font-headline font-bold text-lg mb-6 text-primary">
          {t('trips.route_monitoring')}
        </h4>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">دمشق - حلب</span>
              <span className="text-xs font-bold text-secondary">{t('trips.congestion.very_high')}</span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[85%]"></div>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2">
              {t('trips.current_trips', { count: 12 })} | {t('trips.current_passengers', { count: 48 })}
            </p>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">حمص - طرطوس</span>
              <span className="text-xs font-bold text-on-surface-variant">
                {t('trips.congestion.medium')}
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary-container w-[45%]"></div>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-2">
              {t('trips.current_trips', { count: 5 })} | {t('trips.current_passengers', { count: 18 })}
            </p>
          </div>
        </div>
      </div>

      {/* Real-time Event Feed */}
      <div className="bg-white/40 border border-outline-variant/20 p-8 rounded-[2rem] glass">
        <h4 className="font-headline font-bold text-lg mb-6 text-primary">
          {t('trips.recent_activity')}
        </h4>
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-secondary shrink-0">
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </div>
            <div>
              <p className="text-sm font-bold">{t('trips.trip_completed', { id: '#TR-8690' })}</p>
              <p className="text-xs text-on-surface-variant">
                {t('trips.arrival_notification', {
                  name: 'سامر',
                  dest: 'حلب',
                  time: t('trips.minutes_ago', { count: 4 }),
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
              <span className="material-symbols-outlined text-lg">warning</span>
            </div>
            <div>
              <p className="text-sm font-bold">{t('trips.trip_delay', { id: '#TR-8921' })}</p>
              <p className="text-xs text-on-surface-variant">
                {t('trips.traffic_congestion', { location: 'مدخل حلب' })}
              </p>
            </div>
          </div>
        </div>
        <button className="w-full mt-8 py-3 text-sm font-bold text-primary border-t border-outline-variant/10 hover:bg-surface-container transition-colors rounded-b-xl">
          {t('trips.view_all_activity')}
        </button>
      </div>

      {/* Driver Performance Shortcut */}
      <div className="bg-gradient-to-br from-tertiary-container to-tertiary p-8 rounded-[2rem] text-on-tertiary shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <h4 className="font-headline font-bold text-lg">{t('trips.top_drivers')}</h4>
          <span className="material-symbols-outlined opacity-50">star</span>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center text-[10px] font-bold">
                1
              </div>
              <span className="text-sm font-medium">خالد الأحمد</span>
            </div>
            <div className="flex items-center gap-1 text-secondary-fixed">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              <span className="text-xs font-bold">4.9</span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold">
                2
              </div>
              <span className="text-sm font-medium">سارة منصور</span>
            </div>
            <div className="flex items-center gap-1 text-secondary-fixed">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              <span className="text-xs font-bold">4.8</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
