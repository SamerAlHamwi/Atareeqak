import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
  PiggyBank,
  Landmark,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import type { ReportData } from '../api/reportsApi';

interface OverviewCardsProps {
  report: ReportData | null;
  isLoading: boolean;
  /** True when a start/end range is applied, which changes the group caption. */
  hasRange: boolean;
}

interface MoneyCardProps {
  icon: LucideIcon;
  label: string;
  /** Pre-formatted server string, e.g. "135,600.00 SYP". Never re-formatted. */
  value: string | undefined;
  isLoading: boolean;
  tone?: 'primary' | 'secondary' | 'error';
  testId: string;
  badge?: React.ReactNode;
}

const toneClasses = {
  primary: 'text-primary bg-primary-fixed-dim/30',
  secondary: 'text-secondary bg-secondary-container/30',
  error: 'text-error bg-error-container',
} as const;

const MoneyCard: React.FC<MoneyCardProps> = ({
  icon: Icon,
  label,
  value,
  isLoading,
  tone = 'primary',
  testId,
  badge,
}) => (
  <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
    <div className="flex justify-between items-start">
      <span className={`p-2 rounded-lg inline-flex ${toneClasses[tone]}`}>
        <Icon size={20} />
      </span>
      {badge}
    </div>
    <div>
      <p className="text-on-surface-variant text-sm mb-1">{label}</p>
      {isLoading ? (
        <div className="h-8 w-32 bg-surface-container-high rounded animate-pulse" />
      ) : (
        // Money arrives pre-formatted and already carries "SYP" — it is rendered
        // verbatim, with no second currency label appended.
        <h2
          data-testid={testId}
          className="text-2xl font-bold text-primary font-headline"
          dir="ltr"
        >
          {value}
        </h2>
      )}
    </div>
  </div>
);

/**
 * The KPI row, rebuilt against the payload that actually ships.
 *
 * Before this phase it read `primary_admin.total_collected` and
 * `primary_admin.total_disbursed` — **neither field exists** — so two of its
 * four cards rendered a permanent "—", while the four real `sycash` figures and
 * `total_platform_fees` were rendered nowhere at all.
 *
 * The cards are now split into two groups, because half of them respond to the
 * date picker above and half do not:
 *
 *  - **Period** — flows, genuinely filtered by `start_date`/`end_date`.
 *  - **Current balances** — point-in-time, identical on every range.
 *
 * A single row under a range picker would present a live balance as a period
 * figure. The split, and the explicit "as of now" caption, are the fix.
 */
export const OverviewCards: React.FC<OverviewCardsProps> = ({ report, isLoading, hasRange }) => {
  const { t } = useTranslation();

  const financial = report?.financial_stats;
  const rides = report?.ride_stats;

  const rideStatItems = [
    { key: 'total', value: rides?.total },
    { key: 'active', value: rides?.active },
    { key: 'completed', value: rides?.completed },
    { key: 'cancelled', value: rides?.cancelled },
    { key: 'awaiting_confirmation', value: rides?.awaiting_confirmation },
  ] as const;

  return (
    <div className="space-y-8">
      {/* ── Group 1: figures the date range actually filters ─────────────── */}
      <section aria-labelledby="reports-period-heading" className="space-y-4">
        <div>
          <h3
            id="reports-period-heading"
            data-testid="reports-period-heading"
            className="text-lg font-bold text-primary font-headline"
          >
            {t('reports.group_period')}
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {hasRange ? t('reports.group_period_ranged') : t('reports.group_period_all_time')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MoneyCard
            icon={Wallet}
            label={t('reports.platform_fees')}
            value={financial?.primary_admin.total_platform_fees}
            isLoading={isLoading}
            tone="primary"
            testId="kpi-platform-fees"
          />
          <MoneyCard
            icon={ArrowDownToLine}
            label={t('reports.escrow_in')}
            value={financial?.sycash.total_escrow_in}
            isLoading={isLoading}
            tone="secondary"
            testId="kpi-escrow-in"
          />
          <MoneyCard
            icon={ArrowUpFromLine}
            label={t('reports.escrow_out')}
            value={financial?.sycash.total_escrow_out}
            isLoading={isLoading}
            tone="secondary"
            testId="kpi-escrow-out"
          />
          <MoneyCard
            icon={Undo2}
            label={t('reports.refunds_paid')}
            value={financial?.sycash.total_refunds_paid}
            isLoading={isLoading}
            tone="error"
            testId="kpi-refunds-paid"
          />
        </div>

        {/* Ride stats are range-filtered too, so they belong in this group. */}
        <div className="bg-surface-container-low rounded-xl p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          {rideStatItems.map((item) => (
            <div key={item.key} className="text-center">
              <p
                data-testid={`ride-stat-${item.key}`}
                className="text-2xl font-extrabold text-primary font-manrope"
              >
                {isLoading || item.value === undefined ? '—' : item.value}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {t(`reports.ride_stats.${item.key}`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Group 2: point-in-time balances the range does NOT touch ─────── */}
      <section aria-labelledby="reports-balances-heading" className="space-y-4">
        <div>
          <h3
            id="reports-balances-heading"
            data-testid="reports-balances-heading"
            className="text-lg font-bold text-primary font-headline"
          >
            {t('reports.group_balances')}
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {t('reports.group_balances_hint')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MoneyCard
            icon={PiggyBank}
            label={t('reports.primary_admin_balance')}
            value={financial?.primary_admin.current_balance}
            isLoading={isLoading}
            tone="secondary"
            testId="kpi-primary-balance"
          />
          <MoneyCard
            icon={Landmark}
            label={t('reports.sycash_balance')}
            value={financial?.sycash.current_balance}
            isLoading={isLoading}
            tone="primary"
            testId="kpi-sycash-balance"
          />
          <MoneyCard
            icon={Lock}
            label={t('reports.locked_funds')}
            value={financial?.active_rides_locked}
            isLoading={isLoading}
            tone="error"
            testId="kpi-locked-funds"
            badge={
              rides ? (
                <span className="text-xs font-bold bg-error text-on-error px-2 py-1 rounded-full">
                  {t('reports.active_rides_count', { count: rides.active })}
                </span>
              ) : undefined
            }
          />
        </div>
      </section>
    </div>
  );
};
