import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Timer, CheckCircle2, AlertOctagon, type LucideIcon } from 'lucide-react';
import type { ComplaintCounts, EscalatedCounts } from '../api/supportApi';

interface SupportStatsProps {
  counts: ComplaintCounts | null;
  escalatedCounts: EscalatedCounts | null;
  isLoading: boolean;
}

interface StatCard {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  /** Palette tokens only — no raw hex, per the frontend conventions. */
  accent: string;
  iconWrap: string;
  iconColor: string;
  valueColor: string;
}

/**
 * KPI row for the Support page.
 *
 * REDESIGNED IN PHASE 7. It previously called `GET /staff/complaints/metrics`,
 * which does not exist: `"metrics"` is matched by the `{id}` route and fails its
 * `int` type hint, so the request returns **500 with a full Ignition stack
 * trace**, not a 404 (BUG-8). The old row therefore rendered four cards of which
 * one ("avg response time") was permanently a dash because of a server error.
 *
 * Every figure here is now derived from the two `counts` blocks the list
 * endpoints already return, and **the avg-response-time card was removed rather
 * than left dashed** — no endpoint in the checkout exposes response latency, and
 * a card that can never fill is worse than no card. Filed as REQ-5.
 *
 * The escalated card is rendered only when `escalatedCounts` is present:
 * `/staff/escalated-complaints` is `staff:admin,system_admin`, so a
 * `support_agent` genuinely has no source for that number and gets a 3-card row
 * instead of a 4th card showing a lie.
 */
export const SupportStats: React.FC<SupportStatsProps> = ({
  counts,
  escalatedCounts,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (isLoading && !counts) {
    return (
      <section
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8"
        data-testid="support-stats-skeleton"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-sm animate-pulse flex items-center justify-between"
          >
            <div className="space-y-3">
              <div className="h-3 w-28 bg-surface-container-high rounded" />
              <div className="h-9 w-16 bg-surface-container-high rounded" />
            </div>
            <div className="w-14 h-14 rounded-full bg-surface-container-high" />
          </div>
        ))}
      </section>
    );
  }

  if (!counts) {
    return null;
  }

  const cards: StatCard[] = [
    {
      key: 'open',
      // pending + in_review — the two states an agent can still act on.
      label: t('support.total_open'),
      value: counts.pending + counts.in_review,
      icon: ClipboardList,
      accent: 'border-secondary',
      iconWrap: 'bg-secondary/10',
      iconColor: 'text-secondary',
      valueColor: 'text-primary',
    },
    {
      key: 'pending',
      label: t('support.pending'),
      value: counts.pending,
      icon: Timer,
      accent: 'border-tertiary-fixed-variant',
      iconWrap: 'bg-tertiary-fixed/30',
      iconColor: 'text-on-tertiary-fixed-variant',
      valueColor: 'text-primary',
    },
    {
      key: 'resolved',
      label: t('support.resolved'),
      value: counts.resolved,
      icon: CheckCircle2,
      accent: 'border-secondary',
      iconWrap: 'bg-secondary/10',
      iconColor: 'text-secondary',
      valueColor: 'text-secondary',
    },
  ];

  if (escalatedCounts) {
    cards.splice(2, 0, {
      key: 'escalated',
      label: t('support.escalated'),
      value: escalatedCounts.escalated,
      icon: AlertOctagon,
      accent: 'border-error',
      iconWrap: 'bg-error-container',
      iconColor: 'text-error',
      valueColor: 'text-error',
    });
  }

  return (
    <section
      className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${
        cards.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
      }`}
    >
      {cards.map((card) => (
        <div
          key={card.key}
          data-testid={`support-stat-${card.key}`}
          className={`bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 ${card.accent} flex items-center justify-between`}
        >
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
              {card.label}
            </p>
            <h3 className={`text-4xl font-headline font-extrabold ${card.valueColor}`}>
              {card.value.toLocaleString()}
            </h3>
          </div>
          <div className={`${card.iconWrap} p-4 rounded-full`}>
            <card.icon size={28} className={card.iconColor} />
          </div>
        </div>
      ))}
    </section>
  );
};
