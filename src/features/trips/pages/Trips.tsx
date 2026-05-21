import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useTrips } from '../hooks/useTrips';
import type { Trip } from '../hooks/useTrips';
import { TripsTable } from '../components/TripsTable';
import { TripDetailsCard } from '../components/TripDetailsCard';
import { MonitoringSidebar } from '../components/MonitoringSidebar';

const Trips: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  const {
    visibleTrips,
    activeFilter,
    setActiveFilter,
    selectedTripId,
    setSelectedTripId,
    selectedTrip,
    cancelTrip,
    addDraftTrip,
    isLoading,
  } = useTrips();

  const handleNewTrip = async () => {
    await runAction({
      key: 'new-trip',
      successMessage: 'Trip draft created and queued for backend validation.',
      errorMessage: 'Could not create trip draft.',
      onSuccess: () => {
        const newTrip: Trip = {
          id: `#TR-${9000 + Math.floor(Math.random() * 1000)}`,
          rawId: Date.now(),
          driver: 'سائق جديد',
          driverInitial: 'س.ج',
          from: 'الرياض',
          to: 'جدة',
          timing: 'today',
          timeDetail: '07:30 م',
          passengers: '0/4',
          status: 'scheduled',
          color: 'primary',
        };
        addDraftTrip(newTrip);
      },
    });
  };

  const handleViewHistory = async (tripId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    await runAction({
      key: `history-${tripId}`,
      successMessage: `${tripId} history opened.`,
      errorMessage: 'Could not load trip history.',
    });
  };

  const handleViewDetails = async (tripId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedTripId(tripId);
    await runAction({
      key: `view-${tripId}`,
      successMessage: `${tripId} details refreshed.`,
      errorMessage: 'Failed to load trip details.',
    });
  };

  const handleCancelTrip = async (trip: Trip, event: React.MouseEvent) => {
    event.stopPropagation();
    await runAction({
      key: `cancel-${trip.id}`,
      successMessage: `${trip.id} marked as cancelled.`,
      errorMessage: 'Could not cancel trip.',
      onSuccess: async () => {
        await cancelTrip(trip);
      },
    });
  };

  const handleContactDriver = async () => {
    if (!selectedTrip) return;
    await runAction({
      key: 'contact-driver',
      successMessage: `Contact request sent to ${selectedTrip.driver}.`,
      errorMessage: 'Could not send contact request.',
    });
  };

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Left Column: Trips Management */}
      <div className="col-span-12 xl:col-span-8 space-y-10">
        <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

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
          <button
            onClick={handleNewTrip}
            disabled={isBusy('new-trip')}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-medium shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>{isBusy('new-trip') ? 'Creating...' : t('trips.new_trip')}</span>
          </button>
        </section>

        {/* Loading State or Table */}
        {isLoading ? (
          <div className="py-20 text-center text-on-surface-variant">{t('common.loading', 'Loading...')}</div>
        ) : (
          <TripsTable
            trips={visibleTrips}
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
            onViewHistory={handleViewHistory}
            onViewDetails={handleViewDetails}
            onCancelTrip={handleCancelTrip}
            isBusy={isBusy}
          />
        )}

        {/* Detailed Trip Preview Card */}
        <TripDetailsCard
          trip={selectedTrip}
          onContactDriver={handleContactDriver}
          isContacting={isBusy('contact-driver')}
        />
      </div>

      {/* Right Column: Monitoring Sidebar */}
      <MonitoringSidebar />
    </div>
  );
};

export default Trips;
