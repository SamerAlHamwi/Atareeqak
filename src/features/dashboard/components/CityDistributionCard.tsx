import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardCityRow } from '../hooks/useDashboard';

interface CityDistributionCardProps {
  cities: DashboardCityRow[];
}

/**
 * Top cities by registered users, from GET /admin/dashboard (city_distribution).
 * Names arrive in both Arabic and English; the hook picks the active language.
 */
export const CityDistributionCard: React.FC<CityDistributionCardProps> = ({ cities }) => {
  const { t } = useTranslation();

  return (
    <section className="bg-surface-container-lowest p-10 rounded-[2.5rem] shadow-sm border border-outline-variant/30 h-full">
      <h3 className="text-xl font-black text-primary mb-10">{t('dashboard.city_distribution')}</h3>

      {cities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-40">location_off</span>
          <p className="text-sm font-bold text-center">{t('dashboard.cities_empty')}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {cities.map((city, index) => (
            <div key={city.name} className="space-y-4">
              <div className="flex justify-between items-baseline gap-3 text-sm font-black">
                <span className="text-on-surface truncate">{city.name}</span>
                <span className="text-on-surface-variant shrink-0">
                  {t('dashboard.city_count', { count: city.count })} · {city.percentage}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    index % 2 === 0 ? 'bg-primary' : 'bg-secondary'
                  }`}
                  style={{ width: `${Math.min(100, city.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
