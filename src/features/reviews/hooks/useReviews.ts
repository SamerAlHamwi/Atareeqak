import { useState, useEffect, useCallback } from 'react';
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

interface ReviewsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

interface UseReviewsReturn {
  reviews: Review[];
  meta: ReviewsMeta | null;
  isLoading: boolean;
  error: Error | null;
  search: string;
  setSearch: (value: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (value: DateFilter) => void;
  page: number;
  setPage: (page: number) => void;
  deleteReview: (review: Review) => Promise<void>;
}

const mapReview = (item: ReviewResponse): Review => ({
  id: item.id,
  comment: item.comment || '',
  commenter: item.commenter?.name || 'غير معروف',
  commenterId: item.commenter?.id ?? null,
  recipient: item.recipient?.name || 'غير معروف',
  recipientId: item.recipient?.id ?? null,
  date: item.created_at ? new Date(item.created_at).toLocaleDateString('ar-SY') : '',
});

export const useReviews = (): UseReviewsReturn => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [meta, setMeta] = useState<ReviewsMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearchState] = useState('');
  const [dateFilter, setDateFilterState] = useState<DateFilter>('all');
  const [page, setPage] = useState(1);
  // Debounce the search input so we don't hit the API on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setDateFilter = useCallback((value: DateFilter) => {
    setDateFilterState(value);
    setPage(1);
  }, []);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reviewsApi.getReviews({
        page,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(dateFilter !== 'all' ? { date: dateFilter } : {}),
      });
      setReviews((response.data || []).map(mapReview));
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
      const fetchError = err instanceof Error ? err : new Error('Failed to load reviews');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, dateFilter]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const deleteReview = useCallback(
    async (review: Review) => {
      await reviewsApi.deleteReview(review.id);
      setReviews((prev) => prev.filter((entry) => entry.id !== review.id));
      setMeta((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
    },
    []
  );

  return {
    reviews,
    meta,
    isLoading,
    error,
    search,
    setSearch,
    dateFilter,
    setDateFilter,
    page,
    setPage,
    deleteReview,
  };
};
