import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ArrowLeft,
  BadgeCheck,
  IdCard,
  Calendar,
  Phone,
  Star,
  Undo2,
  Ban,
  Route,
  Wallet,
  XCircle,
  MapPin,
  Car,
  ShieldCheck,
  CheckCircle2,
  History,
} from 'lucide-react';
import ActionBanner from '../../shared/components/ActionBanner';
import Avatar from '../../shared/components/Avatar';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import { useApiAction } from '../../shared/useApiAction';
import { useDriverDetails } from '../hooks/useDriverDetails';
import BanStatusBanner from '../../shared/components/BanStatusBanner';
import PageLoader from '../../shared/components/PageLoader';

const documentLabelKeys: Record<string, string> = {
  face_id: 'common.documents.face_id',
  back_id: 'common.documents.back_id',
  license: 'common.documents.license',
  mechanic_card: 'common.documents.mechanic_card',
};

const rideStatusLabel = (status: string, t: TFunction): { label: string; classes: string } => {
  switch (status) {
    case 'finished':
      return { label: t('common.status.completed'), classes: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
    case 'cancelled':
      return { label: t('common.status.cancelled'), classes: 'bg-error-container text-on-error-container' };
    case 'active':
      return { label: t('common.status.active'), classes: 'bg-secondary-container text-on-secondary-container' };
    default:
      return { label: status, classes: 'bg-surface-container-high text-on-surface-variant' };
  }
};

const DriverDetails: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { driverId } = useParams();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const { driver, status, isLoading, error, isForbidden, banDriver, unbanDriver } =
    useDriverDetails(driverId);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);

  const isRtl = i18n.language.startsWith('ar');
  // Authoritative: the driver payload's own `status` never reflects a ban.
  const isBanned = status?.ban != null;

  const handleUnban = async () => {
    if (!driver) return;
    await runAction({
      key: 'toggle-freeze-driver',
      action: () => unbanDriver(),
      successMessage: t('drivers.unban_success', { name: driver.name }),
      errorMessage: t('drivers.status_update_failed'),
    });
  };

  /**
   * Sends the real ban type and expiry the modal collected. This used to send
   * `type: 'permanent'` unconditionally, so a temporary ban was impossible from
   * this page even though `AdminBanController` accepts one.
   */
  const handleConfirmBan = async ({ reason, banType, expiresAt }: ConfirmActionPayload) => {
    if (!driver) return;
    await runAction({
      key: 'toggle-freeze-driver',
      action: () =>
        banDriver({
          reason,
          type: banType ?? 'permanent',
          ...(banType === 'temporary' && expiresAt ? { expires_at: expiresAt } : {}),
        }),
      successMessage: t('drivers.ban_success', { name: driver.name }),
      errorMessage: t('drivers.status_update_failed'),
    });
    setIsBanModalOpen(false);
  };

  if (isLoading) {
    return <PageLoader size="lg" className="py-24" />;
  }

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through — `services/api.ts` deliberately
  // passes 403 through untouched so this renders the same panel instead of a
  // generic ErrorBanner that implies a Retry would help.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  if (error || !driver) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          {t('drivers.back_to_list')}
        </button>
        <ErrorBanner message={error ?? undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/* Live account state from GET /admin/users/{id}/status */}
      <BanStatusBanner status={status} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          {t('drivers.back_to_list')}
        </button>
        <span className="text-xs text-on-surface-variant">{driver.ref}</span>
      </div>

      <section className="bg-surface-container-lowest rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center gap-8 border border-outline-variant/20">
        <div className="relative shrink-0">
          <div className="h-28 w-28 md:h-32 md:w-32 rounded-full overflow-hidden border-4 border-secondary-container ring-4 ring-primary/5">
            <Avatar name={driver.name} photo={driver.photo} size="xl" className="rounded-none" />
          </div>
          {driver.isVerified && (
            <div className="absolute bottom-1 right-1 bg-secondary text-white h-8 w-8 rounded-full flex items-center justify-center border-2 border-white">
              <BadgeCheck size={16} fill="currentColor" className="text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 text-right space-y-2">
          <div className="flex flex-wrap items-center gap-4 justify-end">
            <h2 className="text-2xl md:text-3xl font-extrabold text-primary font-headline">{driver.name}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isBanned ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
              {t(`drivers.status_${driver.status}`)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-on-surface-variant font-medium justify-end text-sm">
            <span className="inline-flex items-center gap-1"><IdCard size={16} /> {driver.ref}</span>
            <span className="inline-flex items-center gap-1"><Calendar size={16} /> {t('drivers.member_since', { date: driver.joinedLabel })}</span>
            {driver.phone && (
              <span className="inline-flex items-center gap-1" dir="ltr"><Phone size={16} /> {driver.phone}</span>
            )}
            <span className="inline-flex items-center gap-1 text-on-surface bg-surface-container-high px-2 py-0.5 rounded">
              <Star size={16} fill="currentColor" className="text-amber-500" />
              {driver.ratingAverage.toFixed(2)} ({driver.ratingCount})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="driver-ban-toggle"
            onClick={() => (isBanned ? void handleUnban() : setIsBanModalOpen(true))}
            disabled={isBusy('toggle-freeze-driver')}
            className="bg-error-container text-error px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isBanned ? <Undo2 size={20} /> : <Ban size={20} />}
            {isBusy('toggle-freeze-driver')
              ? t('common.loading')
              : isBanned
              ? t('drivers.unban_action')
              : t('drivers.ban_action')}
          </button>
        </div>
      </section>

      {/* Reason (≥10 chars) + permanent/temporary + expiry, per AdminBanController */}
      <ConfirmActionModal
        open={isBanModalOpen}
        title={t('drivers.ban_modal_title', { name: driver.name })}
        description={t('drivers.ban_modal_description')}
        confirmLabel={t('drivers.ban_confirm')}
        showBanOptions
        isBusy={isBusy('toggle-freeze-driver')}
        onConfirm={handleConfirmBan}
        onClose={() => setIsBanModalOpen(false)}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-secondary bg-secondary-container/30 p-2 rounded-lg inline-flex"><Route size={20} /></span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.total_rides')}</span>
          </div>
          <div className="text-3xl font-extrabold text-primary font-headline">{driver.totalRides.toLocaleString()}</div>
          <div className="text-xs text-on-surface-variant font-bold">
            {t('drivers.completed_rides', { count: driver.completedRides })}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-secondary bg-secondary-container/30 p-2 rounded-lg inline-flex"><Wallet size={20} /></span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.total_earnings')}</span>
          </div>
          <div className="text-3xl font-extrabold text-primary font-headline">
            {driver.totalEarnings.toLocaleString()} <span className="text-lg font-medium">{t('users.currency')}</span>
          </div>
          <div className="text-xs text-on-surface-variant font-bold">{t('drivers.net_after_fees')}</div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-error bg-error-container/30 p-2 rounded-lg inline-flex"><XCircle size={20} /></span>
            <span className="text-on-surface-variant text-sm font-bold">{t('drivers.cancel_rate')}</span>
          </div>
          <div className="text-3xl font-extrabold text-error font-headline">{driver.cancelRate}%</div>
          <div className="text-xs text-on-surface-variant font-bold">
            {t('drivers.cancelled_rides', { count: driver.cancelledRides })}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-primary bg-primary-container/10 p-2 rounded-lg inline-flex"><MapPin size={20} /></span>
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
                  <Car size={56} className="opacity-30" />
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
              <ShieldCheck size={20} />
              {t('drivers.documents_title')}
            </h3>
            {driver.documents.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('common.no_data')}</p>
            ) : (
              <div className="space-y-3">
                {driver.documents.map((doc) => (
                  <div key={doc.type} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-secondary" />
                      <span className="font-medium">{documentLabelKeys[doc.type] ? t(documentLabelKeys[doc.type]) : doc.type}</span>
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
                <History size={20} />
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
                      const status = rideStatusLabel(ride.status, t);
                      return (
                        <tr key={ride.id} className="hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-on-surface font-medium">{ride.from}</span>
                              <ArrowLeft size={14} className="text-outline" />
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
