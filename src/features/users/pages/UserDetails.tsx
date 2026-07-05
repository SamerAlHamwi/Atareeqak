import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import ActionBanner from '../../shared/components/ActionBanner';
import { useApiAction } from '../../shared/useApiAction';
import { useUserDetails } from '../hooks/useUserDetails';

const tripStatusBadge = (status: string, t: TFunction): { label: string; classes: string } => {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return { label: t('common.status.completed'), classes: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
    case 'cancelled':
      return { label: t('common.status.cancelled'), classes: 'bg-error-container text-on-error-container' };
    case 'pending':
      return { label: t('common.status.pending'), classes: 'bg-surface-container-high text-on-surface-variant' };
    default:
      return { label: status, classes: 'bg-surface-container-high text-on-surface-variant' };
  }
};

const complaintStatusBadge = (status: string, t: TFunction): { label: string; classes: string } => {
  switch (status) {
    case 'in_review':
      return { label: t('common.status.in_review'), classes: 'bg-yellow-100 text-yellow-800' };
    case 'resolved':
      return { label: t('common.status.resolved'), classes: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
    case 'closed':
      return { label: t('common.status.closed'), classes: 'bg-surface-container-high text-on-surface-variant' };
    case 'escalated':
      return { label: t('common.status.escalated'), classes: 'bg-red-100 text-red-700' };
    default:
      return { label: t('common.status.pending'), classes: 'bg-surface-container-high text-on-surface-variant' };
  }
};

const UserDetails: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const { profile, isLoading, error, chargeWallet, banUser, unbanUser } = useUserDetails(userId);

  const [showAllTrips, setShowAllTrips] = useState(false);
  const [complaintFilter, setComplaintFilter] = useState<'all' | 'in_review'>('all');
  const [chargeAmount, setChargeAmount] = useState('');
  const [showChargeForm, setShowChargeForm] = useState(false);

  const isRtl = i18n.language.startsWith('ar');

  const visibleTrips = useMemo(
    () => (profile ? (showAllTrips ? profile.recentTrips : profile.recentTrips.slice(0, 3)) : []),
    [showAllTrips, profile]
  );
  const visibleComplaints = useMemo(
    () =>
      profile
        ? profile.complaints.filter(
            (item) => complaintFilter === 'all' || item.status === 'in_review'
          )
        : [],
    [complaintFilter, profile]
  );

  const maxMonthlyTrips = useMemo(
    () => Math.max(1, ...(profile?.monthlyTrips.map((m) => m.trips) ?? [1])),
    [profile]
  );

  const handleChargeWallet = async () => {
    const amount = Number(chargeAmount);
    if (!amount || amount <= 0) return;
    await runAction({
      key: 'wallet-topup',
      action: () => chargeWallet(amount),
      successMessage: t('users.charge_success', { amount }),
      errorMessage: t('users.charge_failed'),
      onSuccess: () => {
        setChargeAmount('');
        setShowChargeForm(false);
      },
    });
  };

  const handleToggleBan = async () => {
    if (!profile) return;
    await runAction({
      key: 'freeze-user-account',
      action: () => (profile.isBanned ? unbanUser() : banUser(t('users.ban_reason_default'))),
      successMessage: profile.isBanned
        ? t('users.unban_success', { name: profile.name })
        : t('users.ban_success', { name: profile.name }),
      errorMessage: t('users.status_update_failed'),
    });
  };

  if (isLoading) {
    return <div className="py-24 text-center text-on-surface-variant">{t('common.loading')}</div>;
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/passengers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('users.back_to_list')}
        </button>
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10" dir={isRtl ? 'rtl' : 'ltr'}>
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      <section className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/passengers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('users.back_to_list')}
        </button>
        <span className="text-xs text-on-surface-variant">User ID: {profile.id}</span>
      </section>

      <section className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-surface-container-highest overflow-hidden shadow-sm">
              <img className="w-full h-full object-cover" src={profile.photo} alt={profile.name} />
            </div>
            <div
              className={`absolute -bottom-2 -right-2 text-white text-[10px] px-3 py-1 rounded-full font-bold ${
                profile.isBanned ? 'bg-error' : 'bg-secondary'
              }`}
            >
              {profile.isBanned ? t('users.blocked') : t('users.active_label')}
            </div>
          </div>
          <div className="space-y-1 text-right">
            <h2 className="text-3xl md:text-4xl font-extrabold text-primary font-headline">{profile.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                {t('users.member_since', { date: profile.joinedLabel })}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">verified</span>
                {profile.isVerified ? t('users.verified') : t('users.pending_review')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showChargeForm ? (
            <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-1.5">
              <input
                type="number"
                min="1"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder={t('users.charge_amount_placeholder')}
                className="w-32 bg-transparent border-none text-sm font-bold focus:ring-0 px-2"
              />
              <button
                type="button"
                onClick={handleChargeWallet}
                disabled={!Number(chargeAmount) || isBusy('wallet-topup')}
                className="bg-primary-container text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50"
              >
                {isBusy('wallet-topup') ? t('common.loading') : t('users.confirm_charge')}
              </button>
              <button
                type="button"
                onClick={() => setShowChargeForm(false)}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowChargeForm(true)}
              className="bg-primary-container text-white px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add_card</span>
              {t('users.charge_wallet')}
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleBan}
            disabled={isBusy('freeze-user-account')}
            className="bg-error-container text-on-error-container px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">{profile.isBanned ? 'undo' : 'block'}</span>
            {profile.isBanned ? t('users.approve') : t('users.block')}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.total_trips')}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-extrabold text-primary">{profile.stats.totalRides.toLocaleString()}</h3>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">route</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.total_spending')}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-extrabold text-primary">
              {profile.stats.totalSpending.toLocaleString()} {t('users.currency')}
            </h3>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">payments</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.rating')}</p>
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-3xl font-extrabold text-primary">{profile.stats.avgRating}</h3>
              <span className="material-symbols-outlined text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">thumb_up</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10">
          <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.wallet_balance')}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-extrabold text-primary">
              {profile.stats.walletBalance.toLocaleString()} {t('users.currency')}
            </h3>
            <span className="material-symbols-outlined text-secondary text-3xl opacity-40">account_balance_wallet</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Monthly trips chart */}
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold text-on-surface">{t('users.monthly_stats_title')}</h4>
                <p className="text-sm text-on-surface-variant">{t('users.monthly_stats_subtitle')}</p>
              </div>
            </div>

            <div className="h-64 flex items-end justify-between gap-4 px-4">
              {profile.monthlyTrips.map((entry) => (
                <div key={entry.month} className="flex-1 flex flex-col items-center gap-3 group">
                  <div className="w-full bg-surface-container-high rounded-full h-56 relative overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full bg-secondary-container transition-all duration-500"
                      style={{ height: `${Math.round((entry.trips / maxMonthlyTrips) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant">{entry.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent trips */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">{t('users.recent_trips')}</h4>
              {profile.recentTrips.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllTrips((prev) => !prev)}
                  className="text-secondary font-bold hover:underline"
                >
                  {showAllTrips ? t('users.show_latest') : t('dashboard.view_all')}
                </button>
              )}
            </div>
            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4">{t('users.table_join_date')}</th>
                    <th className="px-8 py-4">{t('trips.table_route')}</th>
                    <th className="px-8 py-4">{t('dashboard.table_driver')}</th>
                    <th className="px-8 py-4">{t('users.trip_cost')}</th>
                    <th className="px-8 py-4">{t('users.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {visibleTrips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8 text-center text-on-surface-variant">
                        {t('common.no_data')}
                      </td>
                    </tr>
                  ) : (
                    visibleTrips.map((trip) => {
                      const badge = tripStatusBadge(trip.status, t);
                      return (
                        <tr key={trip.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-8 py-6 font-medium">{trip.date}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 font-bold">
                              <span>{trip.from}</span>
                              <span className="material-symbols-outlined text-xs text-secondary">arrow_back</span>
                              <span>{trip.to}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">{trip.driver}</td>
                          <td className="px-8 py-6 font-bold">
                            {trip.cost.toLocaleString()} {t('users.currency')}
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.classes}`}>
                              {badge.label}
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

          {/* Complaints */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">{t('users.complaints_title')}</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setComplaintFilter('all')}
                  className={`text-xs font-bold px-4 py-2 rounded-full border ${complaintFilter === 'all' ? 'bg-surface-container-lowest border-outline-variant/15 text-primary' : 'text-on-surface-variant bg-transparent border-transparent'}`}
                >
                  {t('users.all')}
                </button>
                <button
                  type="button"
                  onClick={() => setComplaintFilter('in_review')}
                  className={`text-xs font-bold px-4 py-2 rounded-full border ${complaintFilter === 'in_review' ? 'bg-surface-container-lowest border-outline-variant/15 text-primary' : 'text-on-surface-variant bg-transparent border-transparent'}`}
                >
                  {t('support.in_review')}
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4">{t('support.table_id')}</th>
                    <th className="px-8 py-4">{t('support.table_date')}</th>
                    <th className="px-8 py-4">{t('support.table_category')}</th>
                    <th className="px-8 py-4">{t('support.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {visibleComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-8 text-center text-on-surface-variant">
                        {t('common.no_data')}
                      </td>
                    </tr>
                  ) : (
                    visibleComplaints.map((item) => {
                      const badge = complaintStatusBadge(item.status, t);
                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-8 py-6 font-bold">{item.id}</td>
                          <td className="px-8 py-6 font-medium">{item.date}</td>
                          <td className="px-8 py-6">{item.category}</td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.classes}`}>
                              {badge.label}
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

          {/* Wallet charge log */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">{t('users.wallet_charge_log')}</h4>
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4">{t('support.table_date')}</th>
                    <th className="px-8 py-4">{t('users.transaction_id')}</th>
                    <th className="px-8 py-4">{t('users.amount')}</th>
                    <th className="px-8 py-4">{t('users.processed_by')}</th>
                    <th className="px-8 py-4">{t('users.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {profile.walletCharges.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8 text-center text-on-surface-variant">
                        {t('common.no_data')}
                      </td>
                    </tr>
                  ) : (
                    profile.walletCharges.map((entry) => (
                      <tr key={entry.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-8 py-6 font-medium">{entry.date}</td>
                        <td className="px-8 py-6 font-bold">{entry.transactionId}</td>
                        <td className="px-8 py-6 font-bold">
                          {entry.amount.toLocaleString()} {t('users.currency')}
                        </td>
                        <td className="px-8 py-6">{entry.processedBy}</td>
                        <td className="px-8 py-6">
                          <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-xs font-bold">
                            {entry.status === 'completed' ? t('users.charge_completed') : entry.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Account info sidebar */}
        <div className="space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10 space-y-8">
            <h4 className="text-xl font-bold text-primary">{t('users.account_info')}</h4>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><span className="material-symbols-outlined text-secondary">phone_iphone</span></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">{t('users.phone')}</p>
                  <p className="text-sm font-bold text-on-surface" dir="ltr">{profile.phone || '--'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><span className="material-symbols-outlined text-secondary">mail_outline</span></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">{t('auth.email')}</p>
                  <p className="text-sm font-bold text-on-surface">{profile.email || '--'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><span className="material-symbols-outlined text-secondary">location_on</span></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">{t('users.city')}</p>
                  <p className="text-sm font-bold text-on-surface">{profile.address || '--'}</p>
                </div>
              </div>
            </div>

            {profile.isBanned && profile.banReason && (
              <>
                <hr className="border-surface-container" />
                <div className="bg-error-container/40 text-on-error-container p-4 rounded-2xl text-sm">
                  <p className="font-bold mb-1">{t('users.ban_reason_label')}</p>
                  <p>{profile.banReason}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetails;
