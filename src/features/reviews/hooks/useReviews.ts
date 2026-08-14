import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { reviewsApi } from '../api/reviewsApi';
import type { ReviewResponse, ReviewDateFilter } from '../api/reviewsApi';

export interface Review {
  id: number;
  comment: string;
  commenter: string;
  commenterId: number | null;
  recipient: string;
  recipientId: number | null;
  date: string;
}

export type DateFilter = 'all' | ReviewDateFilter;

export const REVIEWS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

interface ReviewsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

interface UseReviewsOptions {
  /**
   * Deep link: `?user_id=` on the Reviews route, so a profile page can jump to
   * "reviews about this user". The server matches it against the commenter OR
   * the recipient (`ReviewModerationService::getComments`), so it means
   * "reviews involving this user", not only ones written about them.
   */
  userId?: number | null;
}

interface UseReviewsReturn {
  reviews: Review[];
  meta: ReviewsMeta | null;
  isLoading: boolean;
  error: string | null;
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  isForbidden: boolean;
  search: string;
  setSearch: (value: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (value: DateFilter) => void;
  perPage: number;
  setPerPage: (value: number) => void;
  page: number;
  setPage: (page: number) => void;
  /** True once the active search has been sent to the server. */
  hasActiveSearch: boolean;
  refetch: () => Promise<void>;
  deleteReview: (review: Review) => Promise<void>;
}

const mapReview = (item: ReviewResponse, t: TFunction, language: string): Review => ({
  id: item.id,
  comment: item.comment || '',
  commenter: item.commenter?.name?.trim() || t('common.unknown'),
  commenterId: item.commenter?.id ?? null,
  recipient: item.recipient?.name?.trim() || t('common.unknown'),
  recipientId: item.recipient?.id ?? null,
  // Was pinned to 'ar-SY' regardless of the active language, like the drivers,
  // users and verifications pages before their phases fixed it.
  date: item.created_at ? new Date(item.created_at).toLocaleDateString(language) : '',
});

export const useReviews = ({ userId = null }: UseReviewsOptions = {}): UseReviewsReturn => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [meta, setMeta] = useState<ReviewsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  const [isForbidden, setIsForbidden] = useState(false);
  const [search, setSearchState] = useState('');
  const [dateFilter, setDateFilterState] = useState<DateFilter>('all');
  const [perPage, setPerPageState] = useState<number>(10);
  const [page, setPage] = useState(1);
  // Debounced so a keystroke does not become a request. `search` is genuinely
  // server-side: the service does `where('comment','like',"%…%")` — and matches
  // the COMMENT BODY ONLY, never the commenter or recipient name.
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  // Every filter resets to page 1, so narrowing never strands the user on a
  // page past `last_page` with an empty table.
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setDateFilter = useCallback((value: DateFilter) => {
    setDateFilterState(value);
    setPage(1);
  }, []);

  const setPerPage = useCallback((value: number) => {
    setPerPageState(value);
    setPage(1);
  }, []);

  const fetchReviews = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await reviewsApi.getReviews({
        page,
        per_page: perPage,
        ...(userId ? { user_id: userId } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(dateFilter !== 'all' ? { date: dateFilter } : {}),
      });
      if (isStale()) {
        return;
      }
      setReviews((response.data || []).map((item) => mapReview(item, t, language)));
      setMeta(
        response.meta
          ? {
              currentPage: response.meta.current_page,
              lastPage: response.meta.last_page,
              perPage: response.meta.per_page,
              total: response.meta.total,
            }
          : null
      );
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsForbidden(true);
        return;
      }
      // `user_id` is validated `exists:users,id`, so a deep link carrying a
      // stale or hand-typed id 422s. That message now reaches the ErrorBanner
      // instead of console.error, which is where it used to go.
      setError(extractApiError(err, t('reviews.load_failed')));
      setReviews([]);
      setMeta(null);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [page, perPage, userId, debouncedSearch, dateFilter, t, language]);

  useFetchEffect(fetchReviews);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchReviews(() => false), [fetchReviews]);

  /**
   * Deleting a profile comment is irreversible — there is no restore endpoint
   * and no soft delete (`ProfileComment::findOrFail($id)->delete()`). The row is
   * dropped locally for an immediate response and the total decremented; the
   * caller is responsible for having confirmed first.
   */
  const deleteReview = useCallback(async (review: Review) => {
    await reviewsApi.deleteReview(review.id);
    setReviews((prev) => prev.filter((entry) => entry.id !== review.id));
    setMeta((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
  }, []);

  return {
    reviews,
    meta,
    isLoading,
    error,
    isForbidden,
    search,
    setSearch,
    dateFilter,
    setDateFilter,
    perPage,
    setPerPage,
    page,
    setPage,
    hasActiveSearch: debouncedSearch.length > 0,
    refetch,
    deleteReview,
  };
};
