import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { initialsOf } from '../../shared/initials';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { dashboardApi } from '../api/dashboardApi';
import type {
  DashboardStats,
  GrowthChartData,
  CityDistribution,
  RecentActivity,
} from '../../../types/index';

/** Month windows offered by the growth chart. The backend clamps to 1..12. */
export const GROWTH_PERIODS = [3, 6, 12] as const;
export type GrowthMonths = (typeof GROWTH_PERIODS)[number];

/**
 * Change between the last two buckets of a growth series.
 *
 * `unit` is 'percent' only when the previous bucket was non-zero — a jump from
 * 0 to 35 is not "+3500%", so those are reported as an absolute count instead.
 * Returns null when there is no previous bucket to compare against, so the UI
 * can omit the badge rather than invent a number.
 */
export interface StatDelta {
  value: number;
  unit: 'percent' | 'absolute';
  direction: 'up' | 'down' | 'flat';
}

const computeDelta = (series: GrowthChartData[], key: keyof GrowthChartData): StatDelta | null => {
  if (series.length < 2) {
    return null;
  }
  const previous = Number(series[series.length - 2][key]) || 0;
  const latest = Number(series[series.length - 1][key]) || 0;
  const difference = latest - previous;
  const direction: StatDelta['direction'] =
    difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat';

  return previous > 0
    ? { value: Math.round((difference / previous) * 100), unit: 'percent', direction }
    : { value: latest, unit: 'absolute', direction };
};

export interface DashboardCityRow {
  /** Already resolved to the active language. */
  name: string;
  count: number;
  percentage: number;
}

export interface DashboardChartPoint {
  key: string;
  /** Short month name in the active language. */
  monthLabel: string;
  /** Month + year in the active language, for tooltips. */
  fullLabel: string;
  newUsers: number;
  completedTrips: number;
}

const EN_SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * The API returns English month names (`month: "Aug"`, `label: "Aug 2026"`).
 * Parsed back into a real date so they can be rendered in the active language —
 * Arabic is the default UI language, and English month labels looked out of
 * place next to everything else on the page.
 */
const localiseMonth = (
  label: string,
  fallbackMonth: string,
  locale: string
): { monthLabel: string; fullLabel: string } => {
  const match = /^([A-Za-z]{3})\s+(\d{4})$/.exec(label ?? '');
  const monthIndex = match ? EN_SHORT_MONTHS.indexOf(match[1]) : -1;

  if (!match || monthIndex < 0) {
    return { monthLabel: fallbackMonth, fullLabel: label || fallbackMonth };
  }

  const date = new Date(Number(match[2]), monthIndex, 1);
  return {
    monthLabel: date.toLocaleDateString(locale, { month: 'short' }),
    fullLabel: date.toLocaleDateString(locale, { month: 'short', year: 'numeric' }),
  };
};

export interface DashboardActivityRow {
  bookingId: number;
  /** Null when the booking's user relation is missing — row renders unlinked. */
  userId: number | null;
  userName: string;
  userNumber: string;
  /** Up to two initials — the payload carries no avatar URL. */
  userInitials: string;
  driver: string;
  route: string;
  dateLabel: string;
  status: string;
  value: string;
}

export const useDashboard = () => {
  const { t, i18n } = useTranslation();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [growth, setGrowth] = useState<GrowthChartData[]>([]);
  const [cities, setCities] = useState<CityDistribution[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [months, setMonthsState] = useState<GrowthMonths>(6);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrowthLoading, setIsGrowthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  const [isForbidden, setIsForbidden] = useState(false);

  /**
   * One BFF call fills every widget on the page — GET /admin/dashboard returns
   * stats, growth chart, city distribution and recent activity together.
   * The server caches it for 5 minutes, so a refresh may return identical data.
   */
  const fetchDashboard = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await dashboardApi.getFullDashboard();
      if (isStale()) {
        return;
      }
      const data = response.data;
      setStats(data.stats);
      setGrowth(data.growth_chart?.data ?? []);
      setCities(data.city_distribution ?? []);
      setActivities(data.recent_activities ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsForbidden(true);
        return;
      }
      setError(extractApiError(err, t('common.load_failed')));
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [t]);

  useFetchEffect(fetchDashboard);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchDashboard(() => false), [fetchDashboard]);

  /**
   * Changing the period refetches only the growth series, not the whole page.
   * The BFF always returns 6 months, so a different window needs this endpoint.
   */
  const setMonths = useCallback(
    async (next: GrowthMonths) => {
      setMonthsState(next);
      setIsGrowthLoading(true);
      try {
        const response = await dashboardApi.getGrowthChart(next);
        setGrowth(response.data?.data ?? []);
      } catch (err) {
        setError(extractApiError(err, t('common.load_failed')));
      } finally {
        setIsGrowthLoading(false);
      }
    },
    [t]
  );

  const newUsersDelta = useMemo(() => computeDelta(growth, 'new_users'), [growth]);
  const completedTripsDelta = useMemo(() => computeDelta(growth, 'completed_trips'), [growth]);

  /**
   * Tallest bar in either series. Bar heights are a share of this instead of
   * the fixed divisors the page used to hardcode (/250 and /850), which made
   * real values render as slivers or overflow the plot area entirely.
   */
  const chartMax = useMemo(
    () => Math.max(1, ...growth.flatMap((point) => [point.new_users, point.completed_trips])),
    [growth]
  );

  const chartPoints = useMemo<DashboardChartPoint[]>(
    () =>
      growth.map((point) => ({
        key: point.label || point.month,
        ...localiseMonth(point.label, point.month, i18n.language),
        newUsers: point.new_users,
        completedTrips: point.completed_trips,
      })),
    [growth, i18n.language]
  );

  const cityRows = useMemo<DashboardCityRow[]>(
    () =>
      cities.map((city) => ({
        // The API returns the stored Arabic name plus an English mapping.
        name: i18n.language.startsWith('ar') ? city.city || city.city_en : city.city_en || city.city,
        count: city.count,
        percentage: city.percentage,
      })),
    [cities, i18n.language]
  );

  const activityRows = useMemo<DashboardActivityRow[]>(
    () =>
      activities.map((activity) => {
        const name = activity.user?.name?.trim() || t('common.unknown_user');
        // date.human is built server-side in English ("Today, 09:33"), so the
        // ISO timestamp is reformatted here for the active locale.
        const iso = activity.date?.raw;
        const parsed = iso ? new Date(iso) : null;
        const dateLabel =
          parsed && !Number.isNaN(parsed.getTime())
            ? parsed.toLocaleString(i18n.language, {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : activity.date?.human || '—';

        return {
          bookingId: activity.booking_id,
          userId: activity.user?.id ?? null,
          userName: name,
          userNumber: activity.user?.number || '—',
          userInitials: initialsOf(name),
          driver: activity.driver || '—',
          route: activity.route || '—',
          dateLabel,
          status: activity.status,
          value: activity.value,
        };
      }),
    [activities, i18n.language, t]
  );

  return {
    stats,
    growth,
    chartPoints,
    chartMax,
    months,
    setMonths,
    newUsersDelta,
    completedTripsDelta,
    cityRows,
    activityRows,
    isLoading,
    isGrowthLoading,
    error,
    isForbidden,
    lastUpdated,
    refetch,
  };
};
