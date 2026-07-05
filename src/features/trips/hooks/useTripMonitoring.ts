import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { tripsApi } from '../api/tripsApi';
import type { PopularRouteResponse, TopDriverResponse } from '../api/tripsApi';
import { dashboardApi } from '../../dashboard/api/dashboardApi';

export interface PopularRoute {
  label: string;
  demandPercentage: number;
  demandLevelKey: 'very_high' | 'high' | 'medium' | 'low';
  tripCount: number;
  totalPassengers: number;
}

export interface TopDriver {
  rank: number;
  name: string;
  rating: string;
}

export interface TripEvent {
  id: number;
  status: string;
  route: string;
  driver: string;
  timeLabel: string;
}

interface UseTripMonitoringReturn {
  popularRoutes: PopularRoute[];
  topDrivers: TopDriver[];
  recentEvents: TripEvent[];
  isLoading: boolean;
  error: Error | null;
}

const demandKeyMap: Record<PopularRouteResponse['demand_level'], PopularRoute['demandLevelKey']> = {
  'Very High': 'very_high',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
};

export const useTripMonitoring = (): UseTripMonitoringReturn => {
  const { t } = useTranslation();
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[]>([]);
  const [topDrivers, setTopDrivers] = useState<TopDriver[]>([]);
  const [recentEvents, setRecentEvents] = useState<TripEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMonitoring = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [routes, drivers, activities] = await Promise.all([
        tripsApi.getPopularRoutes(4),
        tripsApi.getTopDrivers(3),
        dashboardApi.getRecentActivities(4),
      ]);

      setPopularRoutes(
        routes.map((route: PopularRouteResponse) => ({
          label: `${route.from} - ${route.to}`,
          demandPercentage: route.demand_percentage,
          demandLevelKey: demandKeyMap[route.demand_level] ?? 'low',
          tripCount: route.trip_count,
          totalPassengers: route.total_passengers,
        }))
      );

      setTopDrivers(
        drivers.map((driver: TopDriverResponse) => ({
          rank: driver.rank,
          name: driver.name || t('common.unknown'),
          rating: driver.avg_rating != null ? driver.avg_rating.toFixed(1) : '--',
        }))
      );

      setRecentEvents(
        (activities.data || []).map((activity) => ({
          id: activity.booking_id,
          status: activity.status,
          route: activity.route,
          driver: activity.driver,
          timeLabel: activity.date.human,
        }))
      );
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch monitoring data');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFetchEffect(fetchMonitoring);

  return { popularRoutes, topDrivers, recentEvents, isLoading, error };
};
