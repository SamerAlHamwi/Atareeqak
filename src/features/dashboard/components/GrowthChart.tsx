import React from 'react';
import { useTranslation } from 'react-i18next';
import { GROWTH_PERIODS } from '../hooks/useDashboard';
import type { DashboardChartPoint, GrowthMonths } from '../hooks/useDashboard';

interface GrowthChartProps {
  data: DashboardChartPoint[];
  /** Tallest value across both series; bar heights are a share of it. */
  chartMax: number;
  months: GrowthMonths;
  onMonthsChange: (months: GrowthMonths) => void;
  isLoading: boolean;
}

/** Percentage height for a bar, with a sliver kept for non-zero values. */
const barHeight = (value: number, max: number): string => {
  if (value <= 0) {
    return '0%';
  }
  return `${Math.max(2, (value / max) * 100)}%`;
};

export const GrowthChart: React.FC<GrowthChartProps> = ({
  data,
  chartMax,
  months,
  onMonthsChange,
  isLoading,
}) => {
  const { t } = useTranslation();
  const hasData = data.some((point) => point.newUsers > 0 || point.completedTrips > 0);

  return (
    <section className="bg-surface-container-lowest p-10 rounded-[2.5rem] shadow-sm border border-outline-variant/30">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-12">
        <div>
          <h3 className="text-2xl font-black text-primary">{t('dashboard.growth_chart_title')}</h3>
          <p className="text-sm text-on-surface-variant font-bold mt-1.5">
            {t('dashboard.growth_chart_subtitle', { count: months })}
          </p>
        </div>
        {/* Each option refetches GET /admin/dashboard/growth?months=N */}
        <div
          className="flex p-1 bg-surface-container-low rounded-xl"
          role="group"
          aria-label={t('dashboard.period_label')}
        >
          {GROWTH_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => onMonthsChange(period)}
              disabled={isLoading}
              aria-pressed={months === period}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-colors disabled:opacity-50 ${
                months === period
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t('dashboard.months_option', { count: period })}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-80 w-full flex items-end justify-between px-6 pb-6 animate-pulse">
          {Array.from({ length: months }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-5 flex-1">
              <div className="relative w-full flex justify-center items-end h-56 gap-2">
                <div className="w-4 bg-surface-container-high rounded-full h-1/3" />
                <div className="w-4 bg-surface-container-high rounded-full h-2/3" />
              </div>
              <div className="h-3 w-8 bg-surface-container-high rounded-full" />
            </div>
          ))}
        </div>
      ) : !hasData ? (
        <div className="h-80 w-full flex flex-col items-center justify-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-40">bar_chart</span>
          <p className="text-sm font-bold">{t('dashboard.growth_empty')}</p>
        </div>
      ) : (
        <div className="h-80 w-full flex items-end justify-between px-6 pb-6">
          {data.map((point) => (
            <div key={point.key} className="flex flex-col items-center gap-5 flex-1">
              <div className="relative w-full flex justify-center items-end h-56 gap-2">
                <div
                  className="w-4 bg-primary-fixed rounded-full transition-all"
                  style={{ height: barHeight(point.newUsers, chartMax) }}
                  title={`${point.fullLabel} — ${t('dashboard.legend_new_users')}: ${point.newUsers}`}
                />
                <div
                  className="w-4 bg-secondary rounded-full transition-all"
                  style={{ height: barHeight(point.completedTrips, chartMax) }}
                  title={`${point.fullLabel} — ${t('dashboard.legend_completed')}: ${point.completedTrips}`}
                />
              </div>
              <span className="text-xs font-black text-on-surface-variant">{point.monthLabel}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-12 mt-10 pt-10 border-t border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-secondary" />
          <span className="text-sm font-black text-on-surface-variant">
            {t('dashboard.legend_completed')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-primary-fixed" />
          <span className="text-sm font-black text-on-surface-variant">
            {t('dashboard.legend_new_users')}
          </span>
        </div>
        {chartMax > 1 && (
          <span className="text-xs font-bold text-on-surface-variant/70">
            {t('dashboard.chart_peak', { count: chartMax })}
          </span>
        )}
      </div>
    </section>
  );
};
