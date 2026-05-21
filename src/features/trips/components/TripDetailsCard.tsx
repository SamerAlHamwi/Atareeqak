import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip } from '../hooks/useTrips';

interface TripDetailsCardProps {
  trip: Trip | null;
  onContactDriver: () => void;
  isContacting: boolean;
}

export const TripDetailsCard: React.FC<TripDetailsCardProps> = ({
  trip,
  onContactDriver,
  isContacting,
}) => {
  const { t } = useTranslation();

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-primary-container text-on-primary-container p-8 rounded-[2rem] flex flex-col justify-between min-h-[280px] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div>
          <h3 className="font-headline text-2xl font-bold mb-2">{t('trips.active_trip_details')}</h3>
          <p className="text-primary-fixed-dim/80 text-sm">
            {t('trips.on_the_road', { from: trip?.from ?? '---', to: trip?.to ?? '---' })}
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">
              {t('trips.expected_time')}
            </p>
            <p className="text-lg font-bold">
              45 {t('trips.minutes_ago', { count: '' }).replace(/منذ\s*/, '')}
            </p>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">
              {t('trips.remaining_distance')}
            </p>
            <p className="text-lg font-bold">32 كم</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex -space-x-3 rtl:space-x-reverse">
            {[1, 2, 3].map((i) => (
              <img
                key={i}
                className="w-10 h-10 rounded-full border-2 border-primary-container object-cover"
                src={`https://i.pravatar.cc/100?u=passenger${i}`}
                alt="Passenger"
              />
            ))}
            <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold border-2 border-primary-container">
              +2
            </div>
          </div>
          <button
            onClick={onContactDriver}
            disabled={isContacting || !trip}
            className="bg-secondary text-on-secondary px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-50"
          >
            {t('trips.contact_driver')}
          </button>
        </div>
      </div>
      <div className="bg-surface-container-low rounded-[2rem] overflow-hidden min-h-[280px] shadow-md border border-outline-variant/10 group">
        <div className="relative w-full h-full min-h-[280px]">
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAW37uKeof3vFq5zp_d1XIvkt3pM-_wKF6DhFl_mJAAlZ0Ia18vBiB26v9tcMFJf9wHs35F18kiLisecwZaMXVmvhGQWt199kxckLStN87ojDaPLbOZpkhxUWinmjpXc2TSUo3m-er-WogDvlRLFFQt-DIwojglj1tHNN_mklIBR1dXQVaCWv1coUqUXQ5B0osPhEYLVRcNQKXfl6QSEZRnQWhNAgt_fj-0SzkLx25hbmh1nD2ycpWJX64YpgL853AkwXvXOILfnss"
            alt="Map"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 right-6 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-secondary-fixed">location_on</span>
              <span className="text-sm font-bold">{t('trips.live_map')}</span>
            </div>
            <p className="text-[10px] opacity-70">{t('trips.map_update_freq')}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
