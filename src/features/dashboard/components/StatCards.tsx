import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Minus, type LucideIcon } from 'lucide-react';
import type { DashboardStats } from '../../../types/index';
import type { StatDelta } from '../hooks/useDashboard';

interface StatCardsProps {
  stats: DashboardStats;
  newUsersDelta: StatDelta | null;
  completedTripsDelta: StatDelta | null;
}

const DIRECTION_STYLES: Record<StatDelta['direction'], { icon: LucideIcon; classes: string }> = {
  up: { icon: ArrowUp, classes: 'text-secondary bg-secondary-container/40' },
  down: { icon: ArrowDown, classes: 'text-error bg-error-container' },
  flat: { icon: Minus, classes: 'text-on-surface-variant bg-surface-container' },
};

/**
 * Badge for a month-over-month change. Renders nothing when the series had no
 * previous bucket to compare against — an absent badge is better than a
 * made-up number, which is what the hardcoded "1.2%" used to be.
 */
const DeltaBadge: React.FC<{ delta: StatDelta | null }> = ({ delta }) => {
  const { t } = useTranslation();
  if (!delta) {
    return null;
  }

  const { icon: DeltaIcon, classes } = DIRECTION_STYLES[delta.direction];
  const magnitude = Math.abs(delta.value);
  const label =
    delta.unit === 'percent'
      ? `${delta.value > 0 ? '+' : delta.value < 0 ? '−' : ''}${magnitude}%`
      : `+${magnitude}`;

  return (
    <div
      className={`flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full ${classes}`}
      title={t('dashboard.delta_tooltip')}
    >
      <DeltaIcon size={12} strokeWidth={3} />
      {label}
    </div>
  );
};

export const StatCards: React.FC<StatCardsProps> = ({
  stats,
  newUsersDelta,
  completedTripsDelta,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <article className="bg-surface-container-lowest text-on-surface p-8 rounded-[2rem] shadow-sm border border-outline-variant/30 flex flex-col justify-between h-44">
        <span className="text-on-surface-variant text-[13px] font-black">
          {t('dashboard.total_users')}
        </span>
        <div className="mt-auto flex items-center gap-3">
          <span className="text-3xl font-black tracking-tight">
            {stats.total_users.toLocaleString()}
          </span>
          <DeltaBadge delta={newUsersDelta} />
        </div>
      </article>

      <article className="bg-surface-container-lowest text-on-surface p-8 rounded-[2rem] shadow-sm border border-outline-variant/30 flex flex-col justify-between h-44">
        <span className="text-on-surface-variant text-[13px] font-black">
          {t('dashboard.active_trips')}
        </span>
        <div className="mt-auto flex items-center gap-3">
          <span className="text-3xl font-black tracking-tight">{stats.active_trips}</span>
          <span className="text-[11px] font-black bg-secondary-container/40 text-secondary px-3 py-1 rounded-full">
            {t('dashboard.live')}
          </span>
        </div>
      </article>

      <article className="bg-surface-container-lowest text-on-surface p-8 rounded-[2rem] shadow-sm border border-outline-variant/30 flex flex-col justify-between h-44">
        <span className="text-on-surface-variant text-[13px] font-black">
          {t('dashboard.completed_trips')}
        </span>
        <div className="mt-auto flex items-center gap-3">
          <span className="text-3xl font-black tracking-tight">
            {stats.completed_trips.toLocaleString()}
          </span>
          <DeltaBadge delta={completedTripsDelta} />
        </div>
      </article>

      <article className="bg-primary-container text-on-primary p-8 rounded-[2rem] shadow-sm flex flex-col justify-between h-44 relative overflow-hidden">
        <span className="text-primary-fixed text-[13px] font-black">
          {t('dashboard.total_revenue')}
        </span>
        <div className="mt-auto">
          <span className="text-3xl font-black tracking-tight">
            {stats.total_revenue.formatted}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-on-primary/10 flex items-end px-1 gap-1">
          <div className="w-full h-4 bg-secondary-fixed-dim/40 rounded-t-md" />
        </div>
      </article>
    </div>
  );
};

interface SideStatsProps {
  stats: DashboardStats;
}

/**
 * Both counters are actionable, so each card links to the page that resolves
 * it: complaints to the support inbox, verifications to the review queue.
 */
export const SideStats: React.FC<SideStatsProps> = ({ stats }) => {
  const { t } = useTranslation();

  const cards = [
    {
      to: '/support',
      label: t('dashboard.pending_complaints'),
      value: stats.pending_complaints,
      urgent: stats.pending_complaints > 0,
    },
    {
      to: '/verifications',
      label: t('dashboard.verification_requests'),
      value: stats.verification_requests,
      urgent: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      {cards.map((card) => (
        <Link
          key={card.to}
          to={card.to}
          className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-sm border border-outline-variant/30 flex flex-col items-center justify-center text-center h-44 hover:border-primary/40 transition-colors"
        >
          <span className="text-on-surface-variant text-[13px] font-black mb-3">{card.label}</span>
          <span className={`text-4xl font-black ${card.urgent ? 'text-error' : 'text-primary'}`}>
            {card.value}
          </span>
          {card.value > 0 && (
            <span className="text-[11px] text-on-surface-variant font-bold mt-2">
              {t('dashboard.requires_action')}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};
