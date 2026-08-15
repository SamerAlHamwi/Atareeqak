import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TableSkeleton from '../../shared/components/TableSkeleton';
import type { Trip } from '../hooks/useTrips';
import { isCancellableTrip } from '../hooks/useTrips';

const TRIPS_TABLE_COLS = 7;

interface TripsTableProps {
  trips: Trip[];
  selectedTripId: string;
  onSelectTrip: (id: string) => void;
  onViewDetails: (tripId: string, event: React.MouseEvent) => void;
  onCancelTrip: (trip: Trip, event: React.MouseEvent) => void;
  isBusy: (key: string) => boolean;
  isLoading?: boolean;
  /** Pagination footer, rendered inside the table card. */
  footer?: React.ReactNode;
}

export const TripsTable: React.FC<TripsTableProps> = ({
  trips,
  selectedTripId,
  onSelectTrip,
  onViewDetails,
  onCancelTrip,
  isBusy,
  isLoading = false,
  footer,
}) => {
  const { t } = useTranslation();

  return (
    <section className="bg-surface-container-lowest rounded-[2rem] shadow-ambient border border-outline-variant/10 overflow-hidden">
      <div className="overflow-x-auto p-8 pb-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-start border-b border-outline-variant/10">
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_trip_id')}</th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_driver')}</th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_route')}</th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_timing')}</th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-center">{t('trips.table_passengers')}</th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">{t('trips.table_status')}</th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 ltr:text-right rtl:text-left">{t('trips.table_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {isLoading && <TableSkeleton cols={TRIPS_TABLE_COLS} />}
            {!isLoading && trips.length === 0 && (
              <tr>
                <td colSpan={TRIPS_TABLE_COLS} className="py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline block mb-2">
                    explore_off
                  </span>
                  <p className="text-sm font-bold text-on-surface-variant">{t('trips.empty_title')}</p>
                  <p className="text-xs text-on-surface-variant/70 mt-1">{t('trips.empty_hint')}</p>
                </td>
              </tr>
            )}
            {!isLoading && trips.map((trip) => (
              <tr
                key={trip.id}
                onClick={() => onSelectTrip(trip.id)}
                className={`group hover:bg-surface-container-low/30 transition-colors cursor-pointer ${
                  selectedTripId === trip.id ? 'bg-surface-container-low/40' : ''
                }`}
              >
                <td className="py-6 px-4 font-bold text-primary text-start">{trip.id}</td>
                <td className="py-6 px-4 text-start">
                  {trip.driverId ? (
                    <Link
                      to={`/drivers/${trip.driverId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-3 group/driver w-fit"
                      title={t('trips.show_driver')}
                    >
                      <div
                        className={`w-8 h-8 rounded-full ${
                          trip.status === 'active'
                            ? 'bg-secondary/10 text-secondary'
                            : trip.status === 'scheduled'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        } flex items-center justify-center font-bold text-xs`}
                      >
                        {trip.driverInitial}
                      </div>
                      <span className="text-sm font-medium group-hover/driver:text-primary group-hover/driver:underline transition-colors">
                        {trip.driver}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full ${
                          trip.status === 'active'
                            ? 'bg-secondary/10 text-secondary'
                            : trip.status === 'scheduled'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        } flex items-center justify-center font-bold text-xs`}
                      >
                        {trip.driverInitial}
                      </div>
                      <span className="text-sm font-medium">{trip.driver}</span>
                    </div>
                  )}
                </td>
                <td className="py-6 px-4 text-start">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{trip.from}</span>
                    <span className="material-symbols-outlined text-xs text-outline rotate-180 ltr:rotate-0">
                      trending_flat
                    </span>
                    <span>{trip.to}</span>
                  </div>
                </td>
                <td className="py-6 px-4 text-start">
                  <p className="text-sm font-medium">{t(`dashboard.${trip.timing}`)}</p>
                  <p className="text-[10px] text-on-surface-variant ltr:font-mono">{trip.timeDetail}</p>
                </td>
                <td className="py-6 px-4 text-center">
                  <span className="bg-surface-container-high px-2.5 py-1 rounded-full text-xs font-bold ltr:font-mono">
                    {trip.passengers}
                  </span>
                </td>
                <td className="py-6 px-4 text-start">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      trip.status === 'active'
                        ? 'bg-secondary-container text-on-secondary-container'
                        : trip.status === 'scheduled'
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                        : trip.status === 'awaiting'
                        ? 'bg-primary-container text-on-primary-container'
                        : trip.status === 'cancelled'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {t(`trips.filter_${trip.status}`)}
                  </span>
                </td>
                <td className="py-6 px-4">
                  <div className="flex items-center ltr:justify-end rtl:justify-start gap-2">
                    {/*
                      Details is available for every status. Cancellation is not:
                      POST /staff/trips/{id}/cancel 422s unless the underlying
                      ride is still active/full/awaiting_confirmation, so the
                      button is hidden rather than shown-and-rejected.
                    */}
                    <button
                      onClick={(e) => onViewDetails(trip.id, e)}
                      className="p-2 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
                      title={t('trips.view_details')}
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                    </button>
                    {isCancellableTrip(trip) && (
                      <button
                        onClick={(e) => onCancelTrip(trip, e)}
                        disabled={isBusy(`cancel-${trip.id}`)}
                        className="p-2 text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"
                        title={t('trips.cancel_trip')}
                      >
                        <span className="material-symbols-outlined text-lg">cancel</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </section>
  );
};
