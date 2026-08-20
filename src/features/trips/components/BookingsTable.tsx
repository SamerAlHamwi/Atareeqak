import React from 'react';
import { useTranslation } from 'react-i18next';
import TableSkeleton from '../../shared/components/TableSkeleton';
import type { Booking } from '../hooks/useBookings';
import { isCancellableBooking } from '../hooks/useBookings';

const BOOKINGS_TABLE_COLS = 7;

const STATUS_STYLES: Record<Booking['status'], string> = {
  confirmed: 'bg-secondary-container text-on-secondary-container',
  pending: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  completed: 'bg-primary-container text-on-primary-container',
  cancelled: 'bg-error-container text-on-error-container',
  no_show: 'bg-surface-container text-on-surface-variant',
};

interface BookingsTableProps {
  bookings: Booking[];
  onCancelBooking: (booking: Booking) => void;
  isBusy: (key: string) => boolean;
  isLoading?: boolean;
  footer?: React.ReactNode;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  onCancelBooking,
  isBusy,
  isLoading = false,
  footer,
}) => {
  const { t, i18n } = useTranslation();

  const formatDeparture = (iso: string | null): string => {
    if (!iso) return '--';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString(i18n.language, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (value: number): string =>
    new Intl.NumberFormat(i18n.language).format(value);

  return (
    <section className="bg-surface-container-lowest rounded-[2rem] shadow-ambient border border-outline-variant overflow-hidden">
      <div className="overflow-x-auto p-8 pb-0">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-start border-b border-outline-variant">
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">
                {t('bookings.table_booking_id')}
              </th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">
                {t('bookings.table_passenger')}
              </th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">
                {t('bookings.table_route')}
              </th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">
                {t('bookings.table_departure')}
              </th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-center">
                {t('bookings.table_seats')}
              </th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 text-start">
                {t('bookings.table_status')}
              </th>
              <th className="pb-6 font-headline font-bold text-on-surface-variant text-sm px-4 ltr:text-right rtl:text-left">
                {t('bookings.table_actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {isLoading && <TableSkeleton cols={BOOKINGS_TABLE_COLS} firstColAvatar />}
            {!isLoading && bookings.length === 0 && (
              <tr>
                <td colSpan={BOOKINGS_TABLE_COLS} className="py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline block mb-2">
                    event_busy
                  </span>
                  <p className="text-sm font-bold text-on-surface-variant">
                    {t('bookings.empty_title')}
                  </p>
                  <p className="text-xs text-on-surface-variant/70 mt-1">
                    {t('bookings.empty_hint')}
                  </p>
                </td>
              </tr>
            )}
            {!isLoading &&
              bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="group hover:bg-surface-container-low/30 transition-colors"
                >
                  <td className="py-6 px-4 font-bold text-primary text-start">{booking.id}</td>
                  <td className="py-6 px-4 text-start">
                    <p className="text-sm font-medium">{booking.passenger}</p>
                    <p className="text-[10px] text-on-surface-variant">{booking.passengerEmail}</p>
                  </td>
                  <td className="py-6 px-4 text-start">
                    <div className="flex items-center gap-2 text-sm">
                      <span>{booking.from}</span>
                      <span className="material-symbols-outlined text-xs text-outline rotate-180 ltr:rotate-0">
                        trending_flat
                      </span>
                      <span>{booking.to}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      {t('bookings.driver_label', { name: booking.driver })}
                    </p>
                  </td>
                  <td className="py-6 px-4 text-start">
                    <p className="text-sm font-medium">{formatDeparture(booking.departureTime)}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {t('bookings.total_price', { price: formatPrice(booking.totalPrice) })}
                    </p>
                  </td>
                  <td className="py-6 px-4 text-center">
                    <span className="bg-surface-container-high px-2.5 py-1 rounded-full text-xs font-bold ltr:font-mono">
                      {booking.seats}
                    </span>
                  </td>
                  <td className="py-6 px-4 text-start">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        STATUS_STYLES[booking.status]
                      }`}
                    >
                      {t(`bookings.status_${booking.status}`)}
                    </span>
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-2">
                      {/*
                        POST /staff/bookings/{id}/cancel 422s unless the booking
                        is still pending or confirmed, so the control is hidden
                        for the terminal states rather than failing on click.
                      */}
                      {booking.communicationNumber && (
                        <a
                          href={`tel:${booking.communicationNumber}`}
                          className="p-2 text-on-surface-variant hover:text-secondary transition-colors"
                          title={t('bookings.call_passenger')}
                        >
                          <span className="material-symbols-outlined text-lg">call</span>
                        </a>
                      )}
                      {isCancellableBooking(booking) && (
                        <button
                          onClick={() => onCancelBooking(booking)}
                          disabled={isBusy(`cancel-booking-${booking.rawId}`)}
                          className="p-2 text-on-surface-variant hover:text-error transition-colors disabled:opacity-40"
                          title={t('bookings.cancel_booking')}
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
