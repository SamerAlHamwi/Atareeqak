import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import TablePagination from '../../shared/components/TablePagination';
import FilterTabs from '../../shared/components/FilterTabs';
import type { FilterTabItem } from '../../shared/components/FilterTabs';
import PerPageSelect from '../../shared/components/PerPageSelect';
import { useTrips, TRIPS_PER_PAGE_OPTIONS } from '../hooks/useTrips';
import type { Trip, TripFilter } from '../hooks/useTrips';
import {
  useBookings,
  BOOKING_FILTERS,
  BOOKINGS_PER_PAGE_OPTIONS,
} from '../hooks/useBookings';
import type { Booking, BookingFilter } from '../hooks/useBookings';
import { useLiveTrips } from '../hooks/useLiveTrips';
import { TripsTable } from '../components/TripsTable';
import { BookingsTable } from '../components/BookingsTable';
import { TripDetailsCard } from '../components/TripDetailsCard';
import { MonitoringSidebar } from '../components/MonitoringSidebar';

type TripsTab = 'trips' | 'bookings';

/** Mirrors the backend's `filter` enum, `awaiting` included. */
const TRIP_FILTERS: readonly TripFilter[] = [
  'all',
  'active',
  'scheduled',
  'awaiting',
  'completed',
  'cancelled',
] as const;

const Trips: React.FC = () => {
  const { t } = useTranslation();
  const {
    runAction: runApiAction,
    isBusy: isApiBusy,
    feedback: apiFeedback,
    clearFeedback: clearApiFeedback,
  } = useApiAction();

  const [tab, setTab] = useState<TripsTab>('trips');

  const {
    trips,
    counts,
    activeFilter,
    setActiveFilter,
    selectedTripId,
    setSelectedTripId,
    selectedTrip,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    setPerPage,
    cancelTrip,
    isLoading,
    error,
    refetch,
  } = useTrips();

  const {
    bookings,
    statusFilter: bookingFilter,
    setStatusFilter: setBookingFilter,
    page: bookingPage,
    setPage: setBookingPage,
    lastPage: bookingLastPage,
    total: bookingTotal,
    perPage: bookingPerPage,
    setPerPage: setBookingPerPage,
    isLoading: isLoadingBookings,
    error: bookingsError,
    refetch: refetchBookings,
    cancelBooking,
  } = useBookings();

  const {
    liveTrips,
    isLoading: isLoadingLive,
    updatedAt: liveUpdatedAt,
  } = useLiveTrips();

  const handleViewDetails = (tripId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedTripId(tripId);
  };

  const [cancelTarget, setCancelTarget] = useState<Trip | null>(null);
  const [bookingCancelTarget, setBookingCancelTarget] = useState<Booking | null>(null);

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

  const handleConfirmCancelBooking = async ({ reason }: ConfirmActionPayload) => {
    if (!bookingCancelTarget) return;
    const booking = bookingCancelTarget;
    await runApiAction({
      key: `cancel-booking-${booking.rawId}`,
      action: () => cancelBooking(booking, reason),
      successMessage: t('bookings.cancel_success', { id: booking.id }),
      errorMessage: t('bookings.cancel_failed'),
    });
    setBookingCancelTarget(null);
  };

  // Badges come straight from the server's `counts` block — never from
  // trips.length, which only ever describes the current page.
  const tripFilterItems = useMemo<FilterTabItem<TripFilter>[]>(
    () =>
      TRIP_FILTERS.map((filter) => ({
        value: filter,
        label: t(`trips.filter_${filter}`),
        count: counts ? counts[filter] : undefined,
      })),
    [counts, t]
  );

  /**
   * GET /staff/bookings returns no `counts` block, so these tabs carry no
   * badges. Deriving them would mean one request per status — filed as REQ-2
   * in docs/api/backend-issues.md rather than faked here.
   */
  const bookingFilterItems = useMemo<FilterTabItem<BookingFilter>[]>(
    () =>
      BOOKING_FILTERS.map((filter) => ({
        value: filter,
        label: t(`bookings.filter_${filter}`),
      })),
    [t]
  );

  const rangeInfo = (currentPage: number, size: number, totalRows: number): string => {
    if (totalRows === 0) return '';
    const from = (currentPage - 1) * size + 1;
    const to = Math.min(currentPage * size, totalRows);
    // `count` drives the Arabic plural category, so it must be the total.
    return t('common.showing_range', { from, to, count: totalRows });
  };

  return (
    <div className="grid grid-cols-12 gap-8">
      {/* Left Column: Trips / Bookings Management */}
      <div className="col-span-12 xl:col-span-8 space-y-10">
        <ActionBanner feedback={apiFeedback} onDismiss={clearApiFeedback} />

        {/* Primary tab switch: trips vs bookings */}
        <FilterTabs
          items={[
            { value: 'trips', label: t('trips.tab_trips'), count: counts?.all },
            { value: 'bookings', label: t('trips.tab_bookings'), count: undefined },
          ]}
          active={tab}
          onChange={(next) => setTab(next as TripsTab)}
          aria-label={t('trips.tab_switch_label')}
        />

        {tab === 'trips' ? (
          <>
            <section className="flex flex-wrap items-center justify-between gap-4">
              <FilterTabs
                items={tripFilterItems}
                active={activeFilter}
                onChange={setActiveFilter}
                disabled={isLoading}
                aria-label={t('trips.filter_label')}
              />
              <PerPageSelect
                value={perPage}
                options={TRIPS_PER_PAGE_OPTIONS}
                onChange={setPerPage}
                disabled={isLoading}
              />
              {/*
                No "create trip" action here: rides are created by drivers through
                the end-user API (POST /rides), and the admin API has no equivalent.
              */}
            </section>

            {error && <ErrorBanner message={error.message} onRetry={() => void refetch()} />}

            <TripsTable
              trips={trips}
              selectedTripId={selectedTripId}
              onSelectTrip={setSelectedTripId}
              onViewDetails={handleViewDetails}
              onCancelTrip={handleCancelTrip}
              isBusy={isApiBusy}
              isLoading={isLoading}
              footer={
                <TablePagination
                  page={page}
                  lastPage={lastPage}
                  onPageChange={setPage}
                  info={rangeInfo(page, perPage, total)}
                  isLoading={isLoading}
                />
              }
            />

            <TripDetailsCard
              trip={selectedTrip}
              liveTrips={liveTrips}
              isLoadingLive={isLoadingLive}
              liveUpdatedAt={liveUpdatedAt}
            />
          </>
        ) : (
          <>
            <section className="flex flex-wrap items-center justify-between gap-4">
              <FilterTabs
                items={bookingFilterItems}
                active={bookingFilter}
                onChange={setBookingFilter}
                disabled={isLoadingBookings}
                aria-label={t('bookings.filter_label')}
              />
              <PerPageSelect
                value={bookingPerPage}
                options={BOOKINGS_PER_PAGE_OPTIONS}
                onChange={setBookingPerPage}
                disabled={isLoadingBookings}
              />
            </section>

            {bookingsError && (
              <ErrorBanner
                message={bookingsError.message}
                onRetry={() => void refetchBookings()}
              />
            )}

            <BookingsTable
              bookings={bookings}
              onCancelBooking={setBookingCancelTarget}
              isBusy={isApiBusy}
              isLoading={isLoadingBookings}
              footer={
                <TablePagination
                  page={bookingPage}
                  lastPage={bookingLastPage}
                  onPageChange={setBookingPage}
                  info={rangeInfo(bookingPage, bookingPerPage, bookingTotal)}
                  isLoading={isLoadingBookings}
                />
              }
            />
          </>
        )}
      </div>

      {/* Right Column: Monitoring Sidebar */}
      <MonitoringSidebar />

      {/* Cancel confirmation modals — both enforce the backend's 10-char reason */}
      <ConfirmActionModal
        open={!!cancelTarget}
        title={t('trips.cancel_modal_title', { id: cancelTarget?.id ?? '' })}
        description={t('trips.cancel_modal_description')}
        confirmLabel={t('trips.cancel_confirm')}
        isBusy={cancelTarget ? isApiBusy(`cancel-${cancelTarget.id}`) : false}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />

      <ConfirmActionModal
        open={!!bookingCancelTarget}
        title={t('bookings.cancel_modal_title', { id: bookingCancelTarget?.id ?? '' })}
        description={t('bookings.cancel_modal_description')}
        confirmLabel={t('bookings.cancel_confirm')}
        isBusy={
          bookingCancelTarget
            ? isApiBusy(`cancel-booking-${bookingCancelTarget.rawId}`)
            : false
        }
        onConfirm={handleConfirmCancelBooking}
        onClose={() => setBookingCancelTarget(null)}
      />
    </div>
  );
};

export default Trips;
