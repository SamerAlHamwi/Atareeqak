import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import { useTrips } from '../hooks/useTrips';
import type { Trip } from '../hooks/useTrips';
import { useLiveTrips } from '../hooks/useLiveTrips';
import { TripsTable } from '../components/TripsTable';
import { TripDetailsCard } from '../components/TripDetailsCard';
import { MonitoringSidebar } from '../components/MonitoringSidebar';

const Trips: React.FC = () => {
  const { t } = useTranslation();
  const {
    runAction: runApiAction,
    isBusy: isApiBusy,
    feedback: apiFeedback,
    clearFeedback: clearApiFeedback,
  } = useApiAction();

  const {
    visibleTrips,
    activeFilter,
    setActiveFilter,
    selectedTripId,
    setSelectedTripId,
    selectedTrip,
    cancelTrip,
    isLoading,
  } = useTrips();

  const { liveTrips, isLoading: isLoadingLive } = useLiveTrips();

  const handleViewDetails = (tripId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedTripId(tripId);
  };

  const [cancelTarget, setCancelTarget] = useState<Trip | null>(null);

  const handleCancelTrip = (trip: Trip, event: React.MouseEvent) => {
    event.stopPropagation();
    setCancelTarget(trip);
  };

  const handleConfirmCancel = async ({ reason }: ConfirmActionPayload) => {
    if (!cancelTarget) return;
    const trip = cancelTarget;
    await runApiAction({
      key: `cancel-${trip.id}`,
      action: () => cancelTrip(trip, reason),
      successMessage: t('trips.cancel_success', { id: trip.id }),
      errorMessage: t('trips.cancel_failed'),
    });
    // Close either way — success and error feedback both show in the page banner
    setCancelTarget(null);
  };

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Left Column: Trips Management */}
      <div className="col-span-12 xl:col-span-8 space-y-10">
        <ActionBanner feedback={apiFeedback} onDismiss={clearApiFeedback} />

        {/* Filters Section */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex p-1 bg-surface-container-low rounded-xl">
            {(['all', 'active', 'scheduled', 'completed', 'cancelled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeFilter === filter
                    ? filter === 'all'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-primary font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t(`trips.filter_${filter}`)}
              </button>
            ))}
          </div>
          {/*
            No "create trip" action here: rides are created by drivers through
            the end-user API (POST /rides), and the admin API has no equivalent.
            The old button fabricated a local row that existed only in the
            browser, so it was removed rather than left to mislead.
          */}
        </section>

        {/* Loading State or Table */}
        {isLoading ? (
          <div className="py-20 text-center text-on-surface-variant">{t('common.loading', 'Loading...')}</div>
        ) : (
          <TripsTable
            trips={visibleTrips}
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
            onViewDetails={handleViewDetails}
            onCancelTrip={handleCancelTrip}
            isBusy={isApiBusy}
          />
        )}

        {/* Detailed Trip Preview Card */}
        <TripDetailsCard
          trip={selectedTrip}
          liveTrips={liveTrips}
          isLoadingLive={isLoadingLive}
        />
      </div>

      {/* Right Column: Monitoring Sidebar */}
      <MonitoringSidebar />

      {/* Cancel confirmation modal (real reason instead of the hardcoded default) */}
      <ConfirmActionModal
        open={!!cancelTarget}
        title={t('trips.cancel_modal_title', { id: cancelTarget?.id ?? '' })}
        description={t('trips.cancel_modal_description')}
        confirmLabel={t('trips.cancel_confirm')}
        isBusy={cancelTarget ? isApiBusy(`cancel-${cancelTarget.id}`) : false}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default Trips;
