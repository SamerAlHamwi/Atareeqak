import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Phone } from 'lucide-react';
import type { Trip } from '../hooks/useTrips';
import type { LiveTrip } from '../hooks/useLiveTrips';
import { LiveTripsMap } from './LiveTripsMap';

interface TripDetailsCardProps {
  trip: Trip | null;
  liveTrips: LiveTrip[];
  isLoadingLive: boolean;
  liveUpdatedAt?: Date | null;
}

export const TripDetailsCard: React.FC<TripDetailsCardProps> = ({
  trip,
  liveTrips,
  isLoadingLive,
  liveUpdatedAt = null,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Live telemetry for the selected trip, when it is currently on the road
  const selectedRawId = trip ? Number(trip.rawId) : null;
  const selectedLive =
    selectedRawId != null ? liveTrips.find((l) => l.id === selectedRawId) ?? null : null;
  const featured = selectedLive ?? liveTrips[0] ?? null;

  const driverUserId = featured?.driver?.id ?? trip?.driverId;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-primary-container text-on-primary-container p-8 rounded-[2rem] flex flex-col justify-between min-h-[280px] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div>
          <h3 className="font-headline text-2xl font-bold mb-2">{t('trips.active_trip_details')}</h3>
          <p className="text-primary-fixed-dim/80 text-sm">
            {featured
              ? t('trips.on_the_road', { from: featured.from, to: featured.to })
              : t('trips.no_live_trips')}
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">
              {t('trips.expected_time')}
            </p>
            <p className="text-lg font-bold">
              {featured?.etaMinutes != null
                ? t('trips.eta_value', { count: featured.etaMinutes })
                : '--'}
            </p>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70">
              {t('trips.remaining_distance')}
            </p>
            <p className="text-lg font-bold">
              {featured?.distanceKm != null
                ? t('trips.distance_value', { count: featured.distanceKm })
                : '--'}
            </p>
          </div>
        </div>

        {/* Passengers section */}
        {featured && featured.passengers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-xs font-bold mb-2 opacity-80">{t('trips.passengers_list')}</p>
            <div className="flex flex-wrap gap-2">
              {featured.passengers.map((passenger, index) => (
                <div
                  key={passenger.id ?? index}
                  className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl text-xs backdrop-blur-sm"
                >
                  <span className="font-medium">{passenger.name}</span>
                  {passenger.id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/chat?userId=${passenger.id}`)}
                      className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
                      title={t('trips.chat_with_passenger')}
                    >
                      <MessageSquare size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex -space-x-3 rtl:space-x-reverse items-center">
            {(featured?.passengers ?? []).slice(0, 3).map((passenger, index) => (
              <div
                key={passenger.id ?? index}
                title={passenger.name}
                className="w-10 h-10 rounded-full border-2 border-primary-container bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold"
              >
                {passenger.name.charAt(0) || '?'}
              </div>
            ))}
            {featured && featured.passengers.length > 3 && (
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold border-2 border-primary-container">
                +{featured.passengers.length - 3}
              </div>
            )}
            {featured && (
              <span className="text-xs opacity-80 ms-5">
                {t('trips.current_passengers', { count: featured.passengerCount })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {driverUserId && (
              <button
                type="button"
                onClick={() => navigate(`/chat?userId=${driverUserId}`)}
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all"
                title={t('trips.chat_with_driver')}
              >
                <MessageSquare size={16} />
                <span>{t('trips.chat_driver')}</span>
              </button>
            )}
            {featured?.driverPhone && (
              <a
                href={`tel:${featured.driverPhone}`}
                className="inline-flex items-center gap-1.5 bg-secondary text-on-secondary px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all"
                title={t('trips.contact_driver')}
              >
                <Phone size={16} />
                <span>{t('trips.contact_driver')}</span>
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="bg-surface-container-low rounded-[2rem] overflow-hidden min-h-[280px] shadow-md border border-outline-variant">
        <LiveTripsMap
          trips={liveTrips}
          selectedTripId={selectedRawId}
          isLoading={isLoadingLive}
          updatedAt={liveUpdatedAt}
        />
      </div>
    </section>
  );
};
