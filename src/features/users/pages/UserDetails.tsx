import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Calendar,
  BadgeCheck,
  CreditCard,
  Undo2,
  Ban,
  TrendingUp,
  TrendingDown,
  Award,
  Route,
  Banknote,
  Star,
  ThumbsUp,
  Wallet,
  Smartphone,
  Mail,
  MapPin,
} from 'lucide-react';
import ActionBanner from '../../shared/components/ActionBanner';
import Avatar from '../../shared/components/Avatar';
import BanStatusBanner from '../../shared/components/BanStatusBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import TableSkeleton from '../../shared/components/TableSkeleton';
import { useApiAction } from '../../shared/useApiAction';
import { getFieldErrors } from '../../../services/apiError';
import {
  useUserDetails,
  COMPLAINT_FILTERS,
  MONTHLY_TRIP_WINDOWS,
  RECENT_TRIP_LIMITS,
} from '../hooks/useUserDetails';
import type { PassengerSection } from '../hooks/useUserDetails';
import {
  CHARGE_AMOUNT_MAX,
  CHARGE_AMOUNT_MIN,
  CHARGE_NOTES_MAX,
  SCORE_POINTS_MAX,
  SCORE_POINTS_MIN,
  SCORE_REASON_MAX,
} from '../api/usersApi';
import type { PassengerComplaintFilter } from '../api/usersApi';

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
      return { label: t('common.status.in_review'), classes: 'bg-secondary-fixed text-on-secondary-container' };
    case 'resolved':
      return { label: t('common.status.resolved'), classes: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
    case 'closed':
      return { label: t('common.status.closed'), classes: 'bg-surface-container-high text-on-surface-variant' };
    case 'escalated':
      return { label: t('common.status.escalated'), classes: 'bg-error-container text-on-error-container' };
    default:
      return { label: t('common.status.pending'), classes: 'bg-surface-container-high text-on-surface-variant' };
  }
};

/** `UserScore::tier` is one of these four English labels — map to a translation key. */
const scoreTierLabel = (tier: string, t: TFunction): string => {
  switch (tier) {
    case 'Gold':
      return t('users.score_tier_gold');
    case 'Bronze':
      return t('users.score_tier_bronze');
    case 'Restricted':
      return t('users.score_tier_restricted');
    default:
      return t('users.score_tier_silver');
  }
};

/** Per-section reload control, backed by that section's own endpoint. */
const RefreshButton: React.FC<{
  section: PassengerSection;
  isBusy: boolean;
  onClick: () => void;
  label: string;
}> = ({ section, isBusy, onClick, label }) => (
  <button
    type="button"
    data-testid={`refresh-${section}`}
    onClick={onClick}
    disabled={isBusy}
    title={label}
    aria-label={label}
    className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40"
  >
    <RefreshCw size={18} className={isBusy ? 'animate-spin' : ''} />
  </button>
);

const UserDetails: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const {
    passenger,
    stats,
    monthlyTrips,
    recentTrips,
    complaints,
    complaintCounts,
    walletCharges,
    status,
    monthlyWindow,
    setMonthlyWindow,
    tripLimit,
    setTripLimit,
    complaintFilter,
    setComplaintFilter,
    refreshingSection,
    refreshSection,
    isLoading,
    error,
    isForbidden,
    refetch,
    chargeWallet,
    increaseScore,
    decreaseScore,
    banUser,
    unbanUser,
  } = useUserDetails(userId);

  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNotes, setChargeNotes] = useState('');
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeFieldErrors, setChargeFieldErrors] = useState<Record<string, string>>({});
  const [showBanModal, setShowBanModal] = useState(false);

  /** Which inline score form is open, if any — null closes both. */
  const [scoreDirection, setScoreDirection] = useState<'increase' | 'decrease' | null>(null);
  const [scorePoints, setScorePoints] = useState('');
  const [scoreReason, setScoreReason] = useState('');
  const [scoreFieldErrors, setScoreFieldErrors] = useState<Record<string, string>>({});

  const isRtl = i18n.language.startsWith('ar');
  const locale = i18n.language;
  /** Authoritative — `GET /admin/users/{id}/status`, never the row status. */
  const isBanned = status?.ban != null;

  const maxMonthlyTrips = useMemo(
    () => Math.max(1, ...(monthlyTrips.map((m) => m.trips) ?? [1])),
    [monthlyTrips]
  );

  const amountValue = Number(chargeAmount);
  /**
   * Mirrors `PassengerProfileController::chargeWallet()`
   * (`numeric|min:1|max:10000000`) so an invalid amount disables the button
   * instead of being sent and 422'd.
   */
  const amountError =
    chargeAmount.trim() === ''
      ? null
      : !Number.isFinite(amountValue)
      ? t('users.charge_amount_invalid')
      : amountValue < CHARGE_AMOUNT_MIN
      ? t('users.charge_amount_min', { count: CHARGE_AMOUNT_MIN })
      : amountValue > CHARGE_AMOUNT_MAX
      ? t('users.charge_amount_max', { count: CHARGE_AMOUNT_MAX })
      : null;
  const notesError =
    chargeNotes.length > CHARGE_NOTES_MAX
      ? t('users.charge_notes_max', { count: CHARGE_NOTES_MAX })
      : null;
  const canSubmitCharge =
    chargeAmount.trim() !== '' && !amountError && !notesError && !isBusy('wallet-topup');

  const scorePointsValue = Number(scorePoints);
  /**
   * Mirrors `PassengerProfileController::adjustScore()`
   * (`required|integer|min:1|max:100`) so an invalid amount disables the
   * button instead of being sent and 422'd.
   */
  const scorePointsError =
    scorePoints.trim() === ''
      ? null
      : !Number.isInteger(scorePointsValue)
      ? t('users.adjust_score_points_invalid')
      : scorePointsValue < SCORE_POINTS_MIN
      ? t('users.adjust_score_points_min', { count: SCORE_POINTS_MIN })
      : scorePointsValue > SCORE_POINTS_MAX
      ? t('users.adjust_score_points_max', { count: SCORE_POINTS_MAX })
      : null;
  const scoreReasonError =
    scoreReason.length > SCORE_REASON_MAX
      ? t('users.adjust_score_reason_max', { count: SCORE_REASON_MAX })
      : null;
  const scoreActionKey = scoreDirection === 'decrease' ? 'score-decrease' : 'score-increase';
  const canSubmitScore =
    scoreDirection !== null &&
    scorePoints.trim() !== '' &&
    !scorePointsError &&
    !scoreReasonError &&
    !isBusy(scoreActionKey);

  const formatMoney = (value: number): string =>
    `${value.toLocaleString(locale)} ${t('users.currency')}`;

  const formatDate = (value: string): string => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale);
  };

  /**
   * `runAction` turns the failure into a banner message, so the 422's
   * field-level details are captured on the way past for inline display.
   */
  const handleChargeWallet = async () => {
    if (!canSubmitCharge) return;
    setChargeFieldErrors({});
    await runAction({
      key: 'wallet-topup',
      action: async () => {
        try {
          return await chargeWallet(amountValue, chargeNotes.trim() || undefined);
        } catch (err) {
          const fields = getFieldErrors(err);
          if (fields) {
            setChargeFieldErrors(fields);
          }
          throw err;
        }
      },
      // The backend doesn't always return `previous_balance`/`transaction_id`
      // (REQ-3, docs/api/backend-issues.md) — fall back to the simpler message
      // rather than crashing on a `toLocaleString()` of `undefined`.
      successMessage: (result) =>
        result.previousBalance != null && result.transactionId != null
          ? t('users.charge_success_detailed', {
              previous: result.previousBalance.toLocaleString(locale),
              next: result.newBalance.toLocaleString(locale),
              currency: t('users.currency'),
              transaction: result.transactionId,
            })
          : t('users.charge_success', {
              amount: result.amount.toLocaleString(locale),
              balance: result.newBalance.toLocaleString(locale),
              currency: t('users.currency'),
            }),
      errorMessage: t('users.charge_failed'),
      onSuccess: () => {
        setChargeAmount('');
        setChargeNotes('');
        setShowChargeForm(false);
      },
    });
  };

  /** Shared by the increase/decrease buttons — `scoreDirection` picks the endpoint. */
  const handleAdjustScore = async () => {
    if (!canSubmitScore || scoreDirection === null) return;
    const direction = scoreDirection;
    setScoreFieldErrors({});
    await runAction({
      key: scoreActionKey,
      action: async () => {
        try {
          const adjust = direction === 'increase' ? increaseScore : decreaseScore;
          return await adjust(scorePointsValue, scoreReason.trim() || undefined);
        } catch (err) {
          const fields = getFieldErrors(err);
          if (fields) {
            setScoreFieldErrors(fields);
          }
          throw err;
        }
      },
      successMessage: (result) =>
        direction === 'increase'
          ? t('users.increase_score_success', { points: result.points, score: result.newScore })
          : t('users.decrease_score_success', { points: result.points, score: result.newScore }),
      errorMessage: t('users.adjust_score_failed'),
      onSuccess: () => {
        setScorePoints('');
        setScoreReason('');
        setScoreDirection(null);
      },
    });
  };

  const handleUnban = async () => {
    if (!passenger) return;
    await runAction({
      key: 'user-ban',
      action: () => unbanUser(),
      successMessage: t('users.unban_success', { name: passenger.name }),
      errorMessage: t('users.status_update_failed'),
    });
  };

  const handleConfirmBan = async ({ reason, banType, expiresAt }: ConfirmActionPayload) => {
    if (!passenger) return;
    await runAction({
      key: 'user-ban',
      action: () =>
        banUser({
          reason,
          type: banType ?? 'permanent',
          ...(expiresAt ? { expires_at: expiresAt } : {}),
        }),
      successMessage: t('users.ban_success', { name: passenger.name }),
      errorMessage: t('users.status_update_failed'),
    });
    setShowBanModal(false);
  };

  const handleRefresh = (section: PassengerSection) => {
    void runAction({
      key: `refresh-${section}`,
      action: () => refreshSection(section),
      successMessage: t('users.section_refreshed'),
      errorMessage: t('users.section_refresh_failed'),
    });
  };

  if (isLoading && !passenger) {
    return (
      <div className="space-y-8" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="h-8 w-40 bg-surface-container-high rounded-full animate-pulse" />
        <div className="flex items-center gap-6 animate-pulse">
          <div className="w-32 h-32 rounded-3xl bg-surface-container-high" />
          <div className="space-y-3">
            <div className="h-8 w-64 bg-surface-container-high rounded-full" />
            <div className="h-4 w-48 bg-surface-container-high rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-3xl bg-surface-container-high animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through — `services/api.ts` deliberately
  // passes 403 through untouched so this renders the same panel instead of a
  // generic ErrorBanner that implies a Retry would help.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  if (error || !passenger) {
    return (
      <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <button
          type="button"
          onClick={() => navigate('/passengers')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} />
          {t('users.back_to_list')}
        </button>
        <ErrorBanner message={error ?? undefined} onRetry={() => void refetch()} />
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
          <ArrowLeft size={16} />
          {t('users.back_to_list')}
        </button>
        <span className="text-xs text-on-surface-variant">
          {t('users.user_id_label', { id: passenger.id })}
        </span>
      </section>

      {/* Authoritative account state — GET /admin/users/{id}/status */}
      <BanStatusBanner status={status} />

      <section className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-surface-container-highest overflow-hidden shadow-sm">
              <Avatar name={passenger.name} photo={passenger.photo} size="xl" className="rounded-none" />
            </div>
            <div
              className={`absolute -bottom-2 -right-2 text-white text-[10px] px-3 py-1 rounded-full font-bold ${
                isBanned ? 'bg-error' : 'bg-secondary'
              }`}
            >
              {isBanned ? t('users.account_banned') : t('users.active_label')}
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl md:text-4xl font-extrabold text-primary font-headline">{passenger.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar size={16} />
                {t('users.member_since', { date: passenger.joinedLabel })}
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck size={16} />
                {passenger.isVerified ? t('users.status_verified') : t('users.status_pending')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showChargeForm ? (
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 space-y-3 w-full md:w-80">
              <div className="space-y-1">
                <label
                  htmlFor="charge-amount"
                  className="text-xs font-bold text-on-surface-variant uppercase tracking-wider"
                >
                  {t('users.charge_amount_label')}
                </label>
                <input
                  id="charge-amount"
                  data-testid="charge-amount"
                  type="number"
                  min={CHARGE_AMOUNT_MIN}
                  max={CHARGE_AMOUNT_MAX}
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder={t('users.charge_amount_placeholder')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-on-surface-variant">
                  {t('users.charge_amount_hint', {
                    min: CHARGE_AMOUNT_MIN.toLocaleString(locale),
                    max: CHARGE_AMOUNT_MAX.toLocaleString(locale),
                  })}
                </p>
                {(amountError || chargeFieldErrors.amount) && (
                  <p data-testid="charge-amount-error" className="text-xs text-error font-medium">
                    {amountError ?? chargeFieldErrors.amount}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="charge-notes"
                  className="text-xs font-bold text-on-surface-variant uppercase tracking-wider"
                >
                  {t('users.charge_notes_label')}
                </label>
                <textarea
                  id="charge-notes"
                  data-testid="charge-notes"
                  rows={2}
                  maxLength={CHARGE_NOTES_MAX}
                  value={chargeNotes}
                  onChange={(e) => setChargeNotes(e.target.value)}
                  placeholder={t('users.charge_notes_placeholder')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
                {(notesError || chargeFieldErrors.admin_notes) && (
                  <p className="text-xs text-error font-medium">
                    {notesError ?? chargeFieldErrors.admin_notes}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="charge-confirm"
                  onClick={() => void handleChargeWallet()}
                  disabled={!canSubmitCharge}
                  className="flex-1 bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isBusy('wallet-topup') ? t('common.loading') : t('users.confirm_charge')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChargeForm(false);
                    setChargeFieldErrors({});
                  }}
                  className="px-4 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="charge-wallet-open"
              onClick={() => setShowChargeForm(true)}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2"
            >
              <CreditCard size={18} />
              {t('users.charge_wallet')}
            </button>
          )}

          {/*
            Ban and unban are separate controls driven by the authoritative
            status: the backend 422s an unban on a non-banned account and a ban
            on an already-banned one, so only the applicable one is rendered.
          */}
          <button
            type="button"
            data-testid="user-ban-toggle"
            onClick={() => (isBanned ? void handleUnban() : setShowBanModal(true))}
            disabled={isBusy('user-ban')}
            className={`px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-colors flex items-center gap-2 disabled:opacity-50 ${
              isBanned ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'
            }`}
          >
            {isBanned ? <Undo2 size={18} /> : <Ban size={18} />}
            {isBanned ? t('users.unban_action') : t('users.ban_action')}
          </button>

          {scoreDirection ? (
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 space-y-3 w-full md:w-80">
              <div className="space-y-1">
                <label
                  htmlFor="score-points"
                  className="text-xs font-bold text-on-surface-variant uppercase tracking-wider"
                >
                  {t('users.adjust_score_points_label')}
                </label>
                <input
                  id="score-points"
                  data-testid="score-points"
                  type="number"
                  min={SCORE_POINTS_MIN}
                  max={SCORE_POINTS_MAX}
                  step={1}
                  value={scorePoints}
                  onChange={(e) => setScorePoints(e.target.value)}
                  placeholder={t('users.adjust_score_points_placeholder')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-on-surface-variant">
                  {t('users.charge_amount_hint', {
                    min: SCORE_POINTS_MIN,
                    max: SCORE_POINTS_MAX,
                  })}
                </p>
                {(scorePointsError || scoreFieldErrors.points) && (
                  <p data-testid="score-points-error" className="text-xs text-error font-medium">
                    {scorePointsError ?? scoreFieldErrors.points}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="score-reason"
                  className="text-xs font-bold text-on-surface-variant uppercase tracking-wider"
                >
                  {t('users.adjust_score_reason_label')}
                </label>
                <textarea
                  id="score-reason"
                  data-testid="score-reason"
                  rows={2}
                  maxLength={SCORE_REASON_MAX}
                  value={scoreReason}
                  onChange={(e) => setScoreReason(e.target.value)}
                  placeholder={t('users.adjust_score_reason_placeholder')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
                {(scoreReasonError || scoreFieldErrors.reason) && (
                  <p className="text-xs text-error font-medium">
                    {scoreReasonError ?? scoreFieldErrors.reason}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="score-confirm"
                  onClick={() => void handleAdjustScore()}
                  disabled={!canSubmitScore}
                  className="flex-1 bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isBusy(scoreActionKey)
                    ? t('common.loading')
                    : scoreDirection === 'increase'
                    ? t('users.confirm_increase_score')
                    : t('users.confirm_decrease_score')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScoreDirection(null);
                    setScoreFieldErrors({});
                  }}
                  className="px-4 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-bold text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                data-testid="increase-score-open"
                onClick={() => {
                  setScorePoints('');
                  setScoreReason('');
                  setScoreFieldErrors({});
                  setScoreDirection('increase');
                }}
                className="bg-secondary-container text-on-secondary-container px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2"
              >
                <TrendingUp size={18} />
                {t('users.increase_score')}
              </button>
              <button
                type="button"
                data-testid="decrease-score-open"
                onClick={() => {
                  setScorePoints('');
                  setScoreReason('');
                  setScoreFieldErrors({});
                  setScoreDirection('decrease');
                }}
                className="bg-error-container text-on-error-container px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2"
              >
                <TrendingDown size={18} />
                {t('users.decrease_score')}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Stats — own endpoint, refreshable without the BFF */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
            {t('users.stats_title')}
          </h4>
          <RefreshButton
            section="stats"
            isBusy={refreshingSection === 'stats'}
            onClick={() => handleRefresh('stats')}
            label={t('users.refresh_stats')}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.score_title')}</p>
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-3xl font-extrabold text-primary" data-testid="stat-score">
                  {(stats?.score ?? 70).toLocaleString(locale)}
                </h3>
                <span className="text-xs font-bold text-on-surface-variant">
                  {scoreTierLabel(stats?.scoreTier ?? 'Silver', t)}
                </span>
              </div>
              <Award size={28} className="text-secondary opacity-40" />
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.total_trips')}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-extrabold text-primary" data-testid="stat-total-rides">
                {(stats?.totalRides ?? 0).toLocaleString(locale)}
              </h3>
              <Route size={28} className="text-secondary opacity-40" />
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.total_spending')}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-extrabold text-primary" data-testid="stat-total-spending">
                {formatMoney(stats?.totalSpending ?? 0)}
              </h3>
              <Banknote size={28} className="text-secondary opacity-40" />
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.rating')}</p>
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-3xl font-extrabold text-primary">
                  {(stats?.avgRating ?? 0).toLocaleString(locale)}
                </h3>
                <Star size={20} fill="currentColor" className="text-amber-500" />
              </div>
              <ThumbsUp size={28} className="text-secondary opacity-40" />
            </div>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant">
            <p className="text-sm font-medium text-on-surface-variant mb-2">{t('users.wallet_balance')}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-extrabold text-primary" data-testid="stat-wallet-balance">
                {formatMoney(stats?.walletBalance ?? 0)}
              </h3>
              <Wallet size={28} className="text-secondary opacity-40" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Monthly trips chart — GET /admin/passengers/{id}/monthly-trips?months= */}
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <h4 className="text-xl font-bold text-on-surface">{t('users.monthly_stats_title')}</h4>
                <p className="text-sm text-on-surface-variant">{t('users.monthly_stats_subtitle')}</p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  role="tablist"
                  aria-label={t('users.monthly_window_label')}
                  className="flex p-1 bg-surface-container-low rounded-xl"
                >
                  {MONTHLY_TRIP_WINDOWS.map((months) => (
                    <button
                      key={months}
                      role="tab"
                      aria-selected={months === monthlyWindow}
                      data-testid={`monthly-window-${months}`}
                      disabled={refreshingSection === 'monthly-trips'}
                      onClick={() => void setMonthlyWindow(months)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                        months === monthlyWindow
                          ? 'bg-surface-container-lowest text-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {t('users.months_window', { count: months })}
                    </button>
                  ))}
                </div>
                <RefreshButton
                  section="monthly-trips"
                  isBusy={refreshingSection === 'monthly-trips'}
                  onClick={() => handleRefresh('monthly-trips')}
                  label={t('users.refresh_monthly_trips')}
                />
              </div>
            </div>

            {monthlyTrips.length === 0 ? (
              <p className="py-10 text-center text-on-surface-variant">{t('common.no_data')}</p>
            ) : (
              <div className="h-64 flex items-end justify-between gap-4 px-4" data-testid="monthly-chart">
                {monthlyTrips.map((entry) => (
                  <div key={entry.monthKey} className="flex-1 flex flex-col items-center gap-3 group">
                    <span className="text-xs font-bold text-on-surface-variant">{entry.trips}</span>
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
            )}
          </div>

          {/* Recent trips — GET /admin/passengers/{id}/recent-trips?limit= */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-2xl font-bold text-primary">{t('users.recent_trips')}</h4>
              <div className="flex items-center gap-2">
                <label htmlFor="trip-limit" className="text-xs text-on-surface-variant font-medium">
                  {t('users.trip_limit_label')}
                </label>
                <select
                  id="trip-limit"
                  value={tripLimit}
                  disabled={refreshingSection === 'recent-trips'}
                  onChange={(e) => void setTripLimit(Number(e.target.value))}
                  className="bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50"
                >
                  {RECENT_TRIP_LIMITS.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
                <RefreshButton
                  section="recent-trips"
                  isBusy={refreshingSection === 'recent-trips'}
                  onClick={() => handleRefresh('recent-trips')}
                  label={t('users.refresh_recent_trips')}
                />
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant">
              <table className="w-full text-start">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4 text-start">{t('users.table_join_date')}</th>
                    <th className="px-8 py-4 text-start">{t('trips.table_route')}</th>
                    <th className="px-8 py-4 text-start">{t('dashboard.table_driver')}</th>
                    <th className="px-8 py-4 text-start">{t('users.trip_cost')}</th>
                    <th className="px-8 py-4 text-start">{t('users.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {refreshingSection === 'recent-trips' ? (
                    <TableSkeleton rows={3} cols={5} />
                  ) : recentTrips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8 text-center text-on-surface-variant">
                        {t('users.no_trips')}
                      </td>
                    </tr>
                  ) : (
                    recentTrips.map((trip) => {
                      const badge = tripStatusBadge(trip.status, t);
                      return (
                        <tr key={trip.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-8 py-6 font-medium">{formatDate(trip.date)}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 font-bold">
                              <span>{trip.from}</span>
                              {isRtl ? (
                                <ArrowLeft size={14} className="text-secondary" />
                              ) : (
                                <ArrowRight size={14} className="text-secondary" />
                              )}
                              <span>{trip.to}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">{trip.driver}</td>
                          <td className="px-8 py-6 font-bold">{formatMoney(trip.cost)}</td>
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

          {/* Complaints — GET /admin/passengers/{id}/complaints?status= (server-filtered) */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-2xl font-bold text-primary">{t('users.complaints_title')}</h4>
              <div className="flex flex-wrap items-center gap-2">
                {COMPLAINT_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={complaintFilter === filter}
                    data-testid={`complaint-filter-${filter}`}
                    disabled={refreshingSection === 'complaints'}
                    onClick={() => void setComplaintFilter(filter as PassengerComplaintFilter)}
                    className={`text-xs font-bold px-4 py-2 rounded-full border transition-colors disabled:opacity-50 ${
                      complaintFilter === filter
                        ? 'bg-surface-container-lowest border-outline-variant/15 text-primary'
                        : 'text-on-surface-variant bg-transparent border-transparent'
                    }`}
                  >
                    {t(`users.complaint_filter_${filter}`)}
                    {complaintCounts && complaintCounts[filter] !== undefined && (
                      <span className="ms-2 ltr:font-mono">{complaintCounts[filter]}</span>
                    )}
                  </button>
                ))}
                <RefreshButton
                  section="complaints"
                  isBusy={refreshingSection === 'complaints'}
                  onClick={() => handleRefresh('complaints')}
                  label={t('users.refresh_complaints')}
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant">
              <table className="w-full text-start">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4 text-start">{t('support.table_id')}</th>
                    <th className="px-8 py-4 text-start">{t('support.table_date')}</th>
                    <th className="px-8 py-4 text-start">{t('support.table_category')}</th>
                    <th className="px-8 py-4 text-start">{t('support.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {refreshingSection === 'complaints' ? (
                    <TableSkeleton rows={3} cols={4} />
                  ) : complaints.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-8 text-center text-on-surface-variant">
                        {t('users.no_complaints')}
                      </td>
                    </tr>
                  ) : (
                    complaints.map((item) => {
                      const badge = complaintStatusBadge(item.status, t);
                      return (
                        <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-8 py-6 font-bold">{item.ref}</td>
                          <td className="px-8 py-6 font-medium">{formatDate(item.date)}</td>
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

          {/* Wallet charge log — GET /admin/passengers/{id}/wallet-charges */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-bold text-primary">{t('users.wallet_charge_log')}</h4>
              <RefreshButton
                section="wallet-charges"
                isBusy={refreshingSection === 'wallet-charges'}
                onClick={() => handleRefresh('wallet-charges')}
                label={t('users.refresh_wallet_charges')}
              />
            </div>

            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant">
              <table className="w-full text-start">
                <thead className="bg-surface-container-low text-on-surface-variant text-sm font-bold">
                  <tr>
                    <th className="px-8 py-4 text-start">{t('support.table_date')}</th>
                    <th className="px-8 py-4 text-start">{t('users.transaction_id')}</th>
                    <th className="px-8 py-4 text-start">{t('users.amount')}</th>
                    <th className="px-8 py-4 text-start">{t('users.balance_change')}</th>
                    <th className="px-8 py-4 text-start">{t('users.table_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {refreshingSection === 'wallet-charges' ? (
                    <TableSkeleton rows={3} cols={5} />
                  ) : walletCharges.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8 text-center text-on-surface-variant">
                        {t('users.no_wallet_charges')}
                      </td>
                    </tr>
                  ) : (
                    walletCharges.map((entry) => (
                      <tr key={entry.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-8 py-6 font-medium">{formatDate(entry.date)}</td>
                        <td className="px-8 py-6 font-bold ltr:font-mono">{entry.transactionId}</td>
                        <td className="px-8 py-6 font-bold">{formatMoney(entry.amount)}</td>
                        <td className="px-8 py-6 text-on-surface-variant">
                          {entry.previousBalance.toLocaleString(locale)} →{' '}
                          {entry.newBalance.toLocaleString(locale)}
                        </td>
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
          <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant space-y-8">
            <h4 className="text-xl font-bold text-primary">{t('users.account_info')}</h4>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><Smartphone size={20} className="text-secondary" /></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">{t('users.phone')}</p>
                  <p className="text-sm font-bold text-on-surface" dir="ltr">{passenger.phone || '--'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><Mail size={20} className="text-secondary" /></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">{t('auth.email')}</p>
                  <p className="text-sm font-bold text-on-surface">{passenger.email || '--'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="bg-surface-container-low p-3 rounded-2xl"><MapPin size={20} className="text-secondary" /></div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold mb-1">{t('users.city')}</p>
                  <p className="text-sm font-bold text-on-surface">{passenger.address || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ban confirmation modal (reason + permanent/temporary + expiry) */}
      <ConfirmActionModal
        open={showBanModal}
        title={t('users.ban_modal_title', { name: passenger.name })}
        description={t('users.ban_modal_description')}
        confirmLabel={t('users.ban_confirm')}
        showBanOptions
        isBusy={isBusy('user-ban')}
        onConfirm={handleConfirmBan}
        onClose={() => setShowBanModal(false)}
      />
    </div>
  );
};

export default UserDetails;
