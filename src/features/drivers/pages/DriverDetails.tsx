import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ActionBanner from '../../shared/components/ActionBanner';
import { useApiAction } from '../../shared/useApiAction';
import { useDriverDetails } from '../hooks/useDriverDetails';

const documentLabels: Record<string, string> = {
  face_id: 'الهوية الشخصية (وجه)',
  back_id: 'الهوية الشخصية (ظهر)',
  license: 'رخصة القيادة',
  mechanic_card: 'استمارة المركبة',
};

const rideStatusLabel = (status: string): { label: string; classes: string } => {
  switch (status) {
    case 'finished':
      return { label: 'مكتملة', classes: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
    case 'cancelled':
      return { label: 'ملغاة', classes: 'bg-error-container text-on-error-container' };
    case 'active':
      return { label: 'نشطة', classes: 'bg-secondary-container text-on-secondary-container' };
    default:
      return { label: status, classes: 'bg-surface-container-high text-on-surface-variant' };
  }
};

const DriverDetails: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { driverId } = useParams();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const { driver, isLoading, error, banDriver, unbanDriver } = useDriverDetails(driverId);

  const isRtl = i18n.language.startsWith('ar');

  const handleToggleBan = async () => {
    if (!driver) return;
    const isSuspended = driver.status === 'suspended';
    await runAction({
      key: 'toggle-freeze-driver',
      action: () => (isSuspended ? unbanDriver() : banDriver(t('drivers.ban_reason_default'))),
      successMessage: isSuspended
        ? t('drivers.unban_success', { name: driver.name })
        : t('drivers.ban_success', { name: driver.name }),
      errorMessage: t('drivers.status_update_failed'),
    });
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-on-surface-variant">{t('common.loading')}</div>
    );
  }

  if (error || !driver) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('drivers.back_to_list')}
        </button>
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      </div>
    );
  }

  const isSuspended = driver.status === 'suspended';

  return (
    <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('drivers.back_to_list')}
        </button>
        <span className="text-xs text-on-surface-variant">{driver.ref}</span>
      </div>

      <section className="bg-surface-container-lowest rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center gap-8 border border-outline-variant/20">
        <div className="relative shrink-0">
          <div className="h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden border-4 border-secondary-container ring-4 ring-primary/5">
            <img alt={driver.name} className="w-full h-full object-cover" src={driver.photo} />
          </div>
          {driver.isVerified && (
            <div className="absolute bottom-1 right-1 bg-secondary text-white h-8 w-8 rounded-full flex items-center justify-center border-2 border-white">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          )}
        </div>

        <div className="flex-1 text-right space-y-2">
          <div className="flex flex-wrap items-center gap-4 justify-end">
            <h2 className="text-2xl md:text-3xl font-extrabold text-primary font-headline">{driver.name}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isSuspended ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
              {t(`drivers.status_${driver.status}`)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-on-surface-variant font-medium justify-end text-sm">
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">id_card</span> {driver.ref}</span>
            <span className="inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {t('drivers.member_since', { date: driver.joinedLabel })}</span>
            {driver.phone && (
              <span className="inline-flex items-center gap-1" dir="ltr"><span className="material-symbols-outlined text-sm">call</span> {driver.phone}</span>
            )}
            <span className="inline-flex items-center gap-1 text-on-surface bg-surface-container-high px-2 py-0.5 rounded">
              <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {driver.ratingAverage.toFixed(2)} ({driver.ratingCount})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleToggleBan}
            disabled={isBusy('toggle-freeze-driver')}
            className="bg-error-container text-error px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined">{isSuspended ? 'undo' : 'block'}</span>
            {isBusy('toggle-freeze-driver')
              ? t('common.loading')
              : isSuspended
              ? t('users.approve')
              : t('users.block')}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">route</span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.total_rides')}</span>
          </div>
          <div className="text-3xl font-extrabold text-primary font-headline">{driver.totalRides.toLocaleString()}</div>
          <div className="text-xs text-on-surface-variant font-bold">
            {t('drivers.completed_rides', { count: driver.completedRides })}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">account_balance_wallet</span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.total_earnings')}</span>
          </div>
          <div className="text-3xl font-extrabold text-primary font-headline">
            {driver.totalEarnings.toLocaleString()} <span className="text-lg font-medium">{t('users.currency')}</span>
          </div>
          <div className="text-xs text-on-surface-variant font-bold">{t('drivers.net_after_fees')}</div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-error bg-error-container/30 p-2 rounded-lg">cancel</span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.cancel_rate')}</span>
          </div>
          <div className="text-3xl font-extrabold text-error font-headline">{driver.cancelRate}%</div>
          <div className="text-xs text-on-surface-variant font-bold">
            {t('drivers.cancelled_rides', { count: driver.cancelledRides })}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="material-symbols-outlined text-primary bg-primary-container/10 p-2 rounded-lg">location_on</span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.favorite_destination')}</span>
          </div>
          <div className="text-xl font-extrabold text-primary font-headline">
            {driver.favoriteDestination?.name ?? t('common.no_data')}
          </div>
          {driver.favoriteDestination && (
            <div className="text-xs text-on-surface-variant font-bold">
              {t('drivers.visit_count', { count: driver.favoriteDestination.visitCount })}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="h-48 w-full bg-surface-container-high relative">
              {driver.vehiclePhoto ? (
                <img alt={driver.vehicleType} className="w-full h-full object-cover" src={driver.vehiclePhoto} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-6xl opacity-30">directions_car</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <h3 className="text-white font-bold text-lg">{driver.vehicleType}</h3>
              </div>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-surface-container-low pb-3">
                <span className="text-on-surface-variant">{t('drivers.vehicle_color')}</span>
                <span className="font-bold">{driver.vehicleColor || '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">{t('drivers.vehicle_seats')}</span>
                <span className="font-bold">{driver.vehicleSeats ?? '--'}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-extrabold text-primary font-headline flex items-center gap-2 border-b border-surface-container-low pb-4">
              <span className="material-symbols-outlined">verified_user</span>
              {t('drivers.documents_title')}
            </h3>
            {driver.documents.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('common.no_data')}</p>
            ) : (
              <div className="space-y-3">
                {driver.documents.map((doc) => (
                  <div key={doc.type} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                      <span className="font-medium">{documentLabels[doc.type] ?? doc.type}</span>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-secondary font-bold text-sm hover:underline"
                    >
                      {t('drivers.view_document')}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            <div className="p-6 border-b border-surface-container-low flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-primary font-headline flex items-center gap-2">
                <span className="material-symbols-outlined">history</span>
                {t('drivers.recent_rides')}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface text-on-surface-variant text-sm">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t('trips.table_route')}</th>
                    <th className="px-6 py-4 font-bold">{t('users.table_join_date')}</th>
                    <th className="px-6 py-4 font-bold text-center">{t('drivers.price_per_seat')}</th>
                    <th className="px-6 py-4 font-bold">{t('trips.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {driver.recentRides.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-on-surface-variant">
                        {t('common.no_data')}
                      </td>
                    </tr>
                  ) : (
                    driver.recentRides.map((ride) => {
                      const status = rideStatusLabel(ride.status);
                      return (
                        <tr key={ride.id} className="hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-on-surface font-medium">{ride.from}</span>
                              <span className="material-symbols-outlined text-xs text-outline">arrow_back</span>
                              <span className="text-on-surface font-medium">{ride.to}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-on-surface-variant">{ride.date}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-bold text-primary">
                              {ride.price.toLocaleString()} {t('users.currency')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.classes}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDetails;
