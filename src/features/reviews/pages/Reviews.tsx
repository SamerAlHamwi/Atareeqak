import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { UserSearch, X, Search, Trash2 } from 'lucide-react';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import TableSkeleton from '../../shared/components/TableSkeleton';
import TablePagination from '../../shared/components/TablePagination';
import PerPageSelect from '../../shared/components/PerPageSelect';
import { useReviews, REVIEWS_PER_PAGE_OPTIONS } from '../hooks/useReviews';
import type { Review, DateFilter } from '../hooks/useReviews';
import { REVIEW_DATE_FILTERS } from '../api/reviewsApi';

const Reviews: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [pendingDelete, setPendingDelete] = useState<Review | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * `?user_id=` deep link, so a profile page can link to "reviews involving this
   * user". A non-numeric value is ignored outright rather than sent — the server
   * validates `integer|exists:users,id`, and a nonexistent id still 422s, which
   * the hook surfaces through the ErrorBanner.
   */
  const userIdParam = searchParams.get('user_id');
  const userId = useMemo(() => {
    if (!userIdParam) return null;
    const parsed = Number(userIdParam);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [userIdParam]);
  const hasInvalidUserId = userIdParam !== null && userId === null;

  const clearUserFilter = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('user_id');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
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
    hasActiveSearch,
    refetch,
    deleteReview,
  } = useReviews({ userId });

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const review = pendingDelete;
    await runAction({
      key: `delete-${review.id}`,
      action: () => deleteReview(review),
      successMessage: t('reviews.delete_success', { id: review.id }),
      errorMessage: t('reviews.delete_failed'),
    });
    setPendingDelete(null);
  }, [pendingDelete, deleteReview, runAction, t]);

  const total = meta?.total ?? 0;
  const rangeFrom = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeTo = total === 0 ? 0 : rangeFrom + reviews.length - 1;

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through — `services/api.ts` deliberately
  // passes 403 through untouched so this renders the same panel instead of a
  // generic ErrorBanner that implies a Retry would help.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {hasInvalidUserId && (
        <ErrorBanner message={t('reviews.invalid_user_id', { value: userIdParam })} />
      )}
      {error && <ErrorBanner message={error} onRetry={() => void refetch()} />}

      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-primary mb-2">
            {t('reviews.title')}
          </h2>
          <p className="text-on-surface-variant text-sm">{t('reviews.subtitle')}</p>
        </div>
        <div className="bg-surface-container-lowest px-6 py-4 rounded-2xl shadow-sm text-center">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">
            {t('reviews.total_comments')}
          </p>
          <p
            data-testid="reviews-total"
            className="text-2xl font-headline font-extrabold text-primary"
          >
            {meta ? meta.total.toLocaleString() : '—'}
          </p>
        </div>
      </section>

      {/* Active deep-link chip */}
      {userId !== null && (
        <div
          data-testid="reviews-user-filter"
          className="flex items-center gap-3 bg-secondary-container text-on-secondary-container px-5 py-3 rounded-2xl"
        >
          <UserSearch size={18} />
          <span className="text-sm font-medium">{t('reviews.filtered_by_user', { id: userId })}</span>
          <button
            onClick={clearUserFilter}
            data-testid="reviews-clear-user-filter"
            className="ms-auto flex items-center gap-1 text-xs font-bold hover:underline"
          >
            <X size={16} />
            {t('reviews.clear_user_filter')}
          </button>
        </div>
      )}

      {/* Filters + Table */}
      <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 bg-surface-container-lowest border-b border-outline-variant flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <span
              className={`absolute inset-y-0 ${
                isRtl ? 'right-0 pr-4' : 'left-0 pl-4'
              } flex items-center pointer-events-none text-on-surface-variant`}
            >
              <Search size={18} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="reviews-search"
              className={`block w-full ${
                isRtl ? 'pr-12' : 'pl-12'
              } py-2.5 bg-surface border-none rounded-full text-xs ring-1 ring-outline-variant/30 focus:ring-secondary outline-none`}
              placeholder={t('reviews.search_placeholder')}
              type="text"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={dateFilter}
              data-testid="reviews-date-filter"
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              disabled={isLoading}
              className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer disabled:opacity-50"
            >
              <option value="all">{t('reviews.all_dates')}</option>
              {REVIEW_DATE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`reviews.${value}`)}
                </option>
              ))}
            </select>
            <PerPageSelect
              value={perPage}
              options={REVIEWS_PER_PAGE_OPTIONS}
              onChange={setPerPage}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-separate border-spacing-y-3 px-6">
            <thead>
              <tr className="text-on-surface-variant text-xs font-semibold">
                <th className="py-4 pr-4 text-start">{t('reviews.table_comment')}</th>
                <th className="py-4 text-start">{t('reviews.table_commenter')}</th>
                <th className="py-4 text-start">{t('reviews.table_recipient')}</th>
                <th className="py-4 text-start">{t('reviews.table_date')}</th>
                <th className="py-4 text-start">{t('reviews.table_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : reviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    data-testid="reviews-empty"
                    className="py-12 text-center text-on-surface-variant"
                  >
                    {/* Distinct states: nothing to moderate vs. a search that missed. */}
                    {hasActiveSearch
                      ? t('reviews.empty_search', { query: search.trim() })
                      : dateFilter !== 'all' || userId !== null
                        ? t('reviews.empty_filtered')
                        : t('reviews.empty')}
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr
                    key={review.id}
                    data-testid="review-row"
                    className="bg-surface-container-lowest hover:bg-surface-container transition-colors rounded-lg"
                  >
                    <td
                      className={`py-4 ${isRtl ? 'pr-4 rounded-r-lg' : 'pl-4 rounded-l-lg'} max-w-md`}
                    >
                      <p className="text-xs text-on-surface leading-relaxed text-start line-clamp-2">
                        {review.comment}
                      </p>
                    </td>
                    <td className="py-4 text-start">
                      <span className="text-xs font-bold">{review.commenter}</span>
                    </td>
                    <td className="py-4 text-start">
                      <span className="text-xs font-bold text-secondary">{review.recipient}</span>
                    </td>
                    <td className="py-4 text-start">
                      <span className="text-xs text-on-surface-variant">{review.date}</span>
                    </td>
                    <td
                      className={`py-4 ${isRtl ? 'pl-4 rounded-l-lg' : 'pr-4 rounded-r-lg'} text-start`}
                    >
                      <button
                        onClick={() => setPendingDelete(review)}
                        data-testid="review-delete"
                        className="flex items-center gap-1 text-error text-xs font-bold hover:bg-error-container/50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                        {t('reviews.delete')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          lastPage={meta?.lastPage ?? 1}
          onPageChange={setPage}
          isLoading={isLoading}
          info={t('common.showing_range', { from: rangeFrom, to: rangeTo, count: total })}
        />
      </section>

      {/*
        Deletion is a moderation action against a real person's words, and there
        is no undo: `deleteComment()` is a hard delete with no restore endpoint.
        The dialog names both parties and says so explicitly, and a reason is
        required so the moderator has to articulate why before the row goes.
      */}
      <ConfirmActionModal
        open={pendingDelete !== null}
        title={t('reviews.delete_modal_title')}
        description={t('reviews.delete_modal_description')}
        confirmLabel={t('reviews.confirm_delete')}
        minReasonLength={1}
        maxReasonLength={500}
        isBusy={pendingDelete ? isBusy(`delete-${pendingDelete.id}`) : false}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      >
        {pendingDelete && (
          <div
            data-testid="review-delete-summary"
            className="bg-surface-container-low rounded-2xl p-4 space-y-3 text-start"
          >
            <p className="text-sm text-on-surface leading-relaxed">“{pendingDelete.comment}”</p>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-on-surface-variant">{t('reviews.table_commenter')}</dt>
                <dd className="font-bold" data-testid="review-delete-commenter">
                  {pendingDelete.commenter}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">{t('reviews.table_recipient')}</dt>
                <dd className="font-bold text-secondary" data-testid="review-delete-recipient">
                  {pendingDelete.recipient}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] font-bold text-error">{t('reviews.delete_no_undo')}</p>
          </div>
        )}
      </ConfirmActionModal>
    </div>
  );
};

export default Reviews;
