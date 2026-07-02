import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useReviews } from '../hooks/useReviews';
import type { Review, DateFilter } from '../hooks/useReviews';

const Reviews: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const {
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
  } = useReviews();

  const handleDelete = useCallback(
    async (review: Review) => {
      await runAction({
        key: `delete-${review.id}`,
        action: () => deleteReview(review),
        successMessage: t('reviews.delete_success', { id: review.id }),
        errorMessage: t('reviews.delete_failed'),
        onSuccess: () => setConfirmDeleteId(null),
      });
    },
    [deleteReview, runAction, t]
  );

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      )}

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
          <p className="text-2xl font-headline font-extrabold text-primary">
            {meta ? meta.total.toLocaleString() : '—'}
          </p>
        </div>
      </section>

      {/* Filters + Table */}
      <section className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 bg-surface-container-lowest border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <span
              className={`absolute inset-y-0 ${
                isRtl ? 'right-0 pr-4' : 'left-0 pl-4'
              } flex items-center pointer-events-none text-on-surface-variant`}
            >
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`block w-full ${
                isRtl ? 'pr-12' : 'pl-12'
              } py-2.5 bg-surface border-none rounded-full text-xs ring-1 ring-outline-variant/30 focus:ring-secondary outline-none`}
              placeholder={t('reviews.search_placeholder')}
              type="text"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer"
          >
            <option value="all">{t('reviews.all_dates')}</option>
            <option value="last_7_days">{t('reviews.last_7_days')}</option>
            <option value="last_30_days">{t('reviews.last_30_days')}</option>
          </select>
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
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                    {t('reviews.empty')}
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr
                    key={review.id}
                    className="bg-surface-container-lowest hover:bg-slate-50 transition-colors rounded-lg"
                  >
                    <td
                      className={`py-4 ${
                        isRtl ? 'pr-4 rounded-r-lg' : 'pl-4 rounded-l-lg'
                      } max-w-md`}
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
                    <td className={`py-4 ${isRtl ? 'pl-4 rounded-l-lg' : 'pr-4 rounded-r-lg'} text-start`}>
                      {confirmDeleteId === review.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(review)}
                            disabled={isBusy(`delete-${review.id}`)}
                            className="bg-error text-on-error text-[10px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {isBusy(`delete-${review.id}`)
                              ? t('common.loading')
                              : t('reviews.confirm_delete')}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-surface-container-high text-on-surface text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all"
                          >
                            {t('reviews.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(review.id)}
                          className="flex items-center gap-1 text-error text-xs font-bold hover:bg-error-container/50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          {t('reviews.delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.lastPage > 1 && (
          <div className="p-6 bg-surface-container-lowest border-t border-outline-variant/10 flex items-center justify-between">
            <p className="text-xs text-on-surface-variant">
              {t('reviews.pagination_info', { page: meta.currentPage, pages: meta.lastPage })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="w-9 h-9 rounded-full bg-surface flex items-center justify-center ring-1 ring-outline-variant/30 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">
                  {isRtl ? 'chevron_right' : 'chevron_left'}
                </span>
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= meta.lastPage || isLoading}
                className="w-9 h-9 rounded-full bg-surface flex items-center justify-center ring-1 ring-outline-variant/30 text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">
                  {isRtl ? 'chevron_left' : 'chevron_right'}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Reviews;
