import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, AlertOctagon, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../app/context/useAuth';
import { hasPermission } from '../../../app/permissions';
import { extractApiError } from '../../../services/apiError';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import TableSkeleton from '../../shared/components/TableSkeleton';
import TablePagination from '../../shared/components/TablePagination';
import PerPageSelect from '../../shared/components/PerPageSelect';
import FilterTabs from '../../shared/components/FilterTabs';
import type { FilterTabItem } from '../../shared/components/FilterTabs';
import Avatar from '../../shared/components/Avatar';
import { SupportStats } from '../components/SupportStats';
import { ComplaintDetails } from '../components/ComplaintDetails';
import { useSupport, SUPPORT_PER_PAGE_OPTIONS } from '../hooks/useSupport';
import type { StatusFilter, SupportView, TypeFilter, DateFilter } from '../hooks/useSupport';
import {
  COMPLAINT_TYPES,
  COMPLAINT_DATE_FILTERS,
  ESCALATE_REASON_MAX,
  ESCALATE_REASON_MIN,
  RESOLUTION_NOTES_MAX,
  RESOLUTION_NOTES_MIN,
  RESPOND_STATUSES,
  ESCALATED_RESOLVE_STATUSES,
} from '../api/supportApi';
import type { RespondStatus, EscalatedResolveStatus } from '../api/supportApi';

const statusBadgeClasses: Record<string, string> = {
  pending: 'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant',
  in_review: 'bg-secondary-container text-on-secondary-container',
  resolved: 'bg-secondary/15 text-secondary',
  closed: 'bg-surface-container-high text-on-surface-variant',
  escalated: 'bg-error-container text-on-error-container',
};

type ModalKind = 'respond' | 'escalate' | 'resolve-escalated' | null;

const Support: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { role } = useAuth();
  const { runAction, isBusy, feedback, clearFeedback, notify } = useApiAction();
  const [modal, setModal] = useState<ModalKind>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  // `/staff/escalated-complaints` is `staff:admin,system_admin` — a support_agent
  // would get a hard 403, so the whole view is withheld rather than shown broken.
  // Matches permissions.json's 'View Escalate' (admin ownPermissions) exactly.
  const canSeeEscalated = hasPermission(role, 'View Escalate');

  const {
    counts,
    escalatedCounts,
    inboxTotal,
    complaints,
    isLoading,
    error,
    isForbidden,
    selectedComplaint,
    openComplaint,
    view,
    setView,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    dateFilter,
    setDateFilter,
    perPage,
    setPerPage,
    page,
    setPage,
    lastPage,
    total,
    refetch,
    respondToComplaint,
    escalateComplaint,
    resolveEscalatedComplaint,
  } = useSupport({ canSeeEscalated });

  /**
   * Opening a row is a WRITE — `GET /staff/complaints/{id}` transitions a
   * pending, unassigned complaint to `in_review` and assigns it to this
   * employee. When that happens the user is told explicitly, because the row
   * they clicked changes status under them and the badges move with it.
   */
  const handleSelect = useCallback(
    async (rawId: number) => {
      const complaint = complaints.find((c) => c.rawId === rawId);
      if (!complaint) return;
      setOpeningId(rawId);
      try {
        const { wasAssignedToMe, complaint: opened } = await openComplaint(complaint);
        if (wasAssignedToMe) {
          notify(
            'info',
            t('support.auto_assigned', { id: opened.id, agent: opened.assignedTo ?? '' })
          );
        }
      } catch (err) {
        notify('error', extractApiError(err, t('support.open_failed')));
      } finally {
        setOpeningId(null);
      }
    },
    [complaints, openComplaint, notify, t]
  );

  const handleConfirmRespond = useCallback(
    async ({ reason, status }: ConfirmActionPayload) => {
      if (!selectedComplaint) return;
      await runAction({
        key: `respond-${selectedComplaint.id}`,
        action: () =>
          respondToComplaint(selectedComplaint, reason, (status ?? 'in_review') as RespondStatus),
        successMessage: t('support.respond_success', { id: selectedComplaint.id }),
        errorMessage: t('support.respond_failed'),
      });
      setModal(null);
    },
    [selectedComplaint, respondToComplaint, runAction, t]
  );

  const handleConfirmEscalate = useCallback(
    async ({ reason }: ConfirmActionPayload) => {
      if (!selectedComplaint) return;
      await runAction({
        key: `escalate-${selectedComplaint.id}`,
        action: () => escalateComplaint(selectedComplaint, reason),
        successMessage: t('support.escalate_success', { id: selectedComplaint.id }),
        errorMessage: t('support.escalate_failed'),
      });
      setModal(null);
    },
    [selectedComplaint, escalateComplaint, runAction, t]
  );

  const handleConfirmResolveEscalated = useCallback(
    async ({ reason, status }: ConfirmActionPayload) => {
      if (!selectedComplaint) return;
      await runAction({
        key: `resolve-escalated-${selectedComplaint.id}`,
        action: () =>
          resolveEscalatedComplaint(
            selectedComplaint,
            reason,
            (status ?? 'resolved') as EscalatedResolveStatus
          ),
        successMessage: t('support.resolve_success', { id: selectedComplaint.id }),
        errorMessage: t('support.resolve_failed'),
      });
      setModal(null);
    },
    [selectedComplaint, resolveEscalatedComplaint, runAction, t]
  );

  /**
   * Inbox tabs carry REAL badges from `counts` — this is the first inbox in the
   * project where the payload allows it (`/staff/bookings`, `/admin/drivers` and
   * `/admin/users` all lack a counts block — REQ-2).
   *
   * The `all` badge is `inboxTotal` (the four buckets summed), NOT `counts.all`,
   * which also counts escalated rows that `index` never returns — see BUG-9.
   *
   * There is deliberately no `escalated` tab here: `index` 422s on that value.
   */
  const inboxTabs = useMemo<FilterTabItem<StatusFilter>[]>(
    () => [
      { value: 'all', label: t('support.all_statuses'), count: inboxTotal ?? undefined },
      { value: 'pending', label: t('common.status.pending'), count: counts?.pending },
      { value: 'in_review', label: t('common.status.in_review'), count: counts?.in_review },
      { value: 'resolved', label: t('common.status.resolved'), count: counts?.resolved },
      { value: 'closed', label: t('common.status.closed'), count: counts?.closed },
    ],
    [t, counts, inboxTotal]
  );

  /**
   * The escalated view has its own vocabulary and its own counts block.
   * `listEscalated()` and `escalatedStatusCounts()` both scope to
   * `whereNotNull('escalated_at')` regardless of which `status` is passed
   * (BUG-10, fixed), so `resolved` / `closed` here genuinely mean "escalated,
   * then resolved/closed" — plain labels, no "(all)" qualifier needed.
   */
  const escalatedTabs = useMemo<FilterTabItem<StatusFilter>[]>(
    () => [
      { value: 'escalated', label: t('common.status.escalated'), count: escalatedCounts?.escalated },
      { value: 'resolved', label: t('common.status.resolved'), count: escalatedCounts?.resolved },
      { value: 'closed', label: t('common.status.closed'), count: escalatedCounts?.closed },
    ],
    [t, escalatedCounts]
  );

  const tabs = view === 'escalated' ? escalatedTabs : inboxTabs;
  const rangeFrom = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeTo = total === 0 ? 0 : rangeFrom + complaints.length - 1;
  const hasFilters = typeFilter !== 'all' || dateFilter !== 'all' || statusFilter !== 'all';

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

      {error && <ErrorBanner message={error} onRetry={() => void refetch()} />}

      {/* View switch */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-primary mb-1">
            {t('support.title')}
          </h2>
          <p className="text-on-surface-variant text-sm">{t('support.subtitle')}</p>
        </div>
        {canSeeEscalated && (
          <div className="flex p-1 bg-surface-container-low rounded-xl" role="tablist">
            {(['inbox', 'escalated'] as SupportView[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={view === tab}
                data-testid={`support-view-${tab}`}
                onClick={() => setView(tab)}
                className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === tab
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab === 'inbox' ? <Inbox size={18} /> : <AlertOctagon size={18} />}
                {t(`support.tab_${tab}`)}
                {tab === 'escalated' && escalatedCounts && escalatedCounts.escalated > 0 && (
                  <span className="bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {escalatedCounts.escalated}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <SupportStats
        counts={counts}
        escalatedCounts={canSeeEscalated ? escalatedCounts : null}
        isLoading={isLoading}
      />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          {/* Filters */}
          <div className="p-6 bg-surface-container-lowest border-b border-outline-variant space-y-4">
            <FilterTabs
              items={tabs}
              active={statusFilter}
              onChange={setStatusFilter}
              disabled={isLoading}
              aria-label={t('support.filter_by')}
            />
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={typeFilter}
                data-testid="support-type-filter"
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                disabled={isLoading}
                className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer disabled:opacity-50"
              >
                <option value="all">{t('support.all_types')}</option>
                {COMPLAINT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`support.type.${type}`)}
                  </option>
                ))}
              </select>
              <select
                value={dateFilter}
                data-testid="support-date-filter"
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                disabled={isLoading}
                className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer disabled:opacity-50"
              >
                <option value="all">{t('support.all_dates')}</option>
                {COMPLAINT_DATE_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {t(`support.date_${value}`)}
                  </option>
                ))}
              </select>
              <div className="ms-auto">
                <PerPageSelect
                  value={perPage}
                  options={SUPPORT_PER_PAGE_OPTIONS}
                  onChange={setPerPage}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-separate border-spacing-y-3 px-6">
              <thead>
                <tr className="text-on-surface-variant text-xs font-semibold">
                  <th className="py-4 pr-4 text-start">{t('support.table_id')}</th>
                  <th className="py-4 text-start">{t('support.table_user')}</th>
                  <th className="py-4 text-start">{t('support.table_category')}</th>
                  <th className="py-4 text-start">{t('support.table_date')}</th>
                  <th className="py-4 text-start">{t('support.table_status')}</th>
                  <th className="py-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton rows={5} cols={6} firstColAvatar />
                ) : complaints.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      data-testid="support-empty"
                      className="py-12 text-center text-on-surface-variant"
                    >
                      {hasFilters
                        ? t('support.empty_filtered')
                        : view === 'escalated'
                          ? t('support.no_escalated')
                          : t('support.empty')}
                    </td>
                  </tr>
                ) : (
                  complaints.map((cmp) => (
                    <tr
                      key={cmp.id}
                      data-testid="complaint-row"
                      onClick={() => void handleSelect(cmp.rawId)}
                      className={`bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer group rounded-lg ${
                        selectedComplaint?.rawId === cmp.rawId
                          ? isRtl
                            ? 'border-r-4 border-secondary'
                            : 'border-l-4 border-secondary'
                          : ''
                      }`}
                    >
                      <td
                        className={`py-4 ${
                          isRtl ? 'pr-4 rounded-r-lg' : 'pl-4 rounded-l-lg'
                        } font-bold text-primary text-sm`}
                      >
                        {cmp.id}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={cmp.user} photo={cmp.userPhoto} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-start truncate">{cmp.user}</p>
                            <p className="text-[10px] text-on-surface-variant italic text-start truncate">
                              {cmp.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-start">
                        <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                          {cmp.isAutoGenerated && (
                            <AlertTriangle
                              size={12}
                              className="text-error shrink-0"
                              aria-label={t('support.auto_generated_badge')}
                            />
                          )}
                          {cmp.category}
                        </span>
                      </td>
                      <td className="py-4 text-start">
                        <span className="text-xs text-on-surface-variant">{cmp.date}</span>
                      </td>
                      <td className="py-4 text-start">
                        <span
                          data-testid="complaint-row-status"
                          className={`text-[10px] px-3 py-1 rounded-full font-bold ${
                            statusBadgeClasses[cmp.status] ??
                            'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {t(`common.status.${cmp.status}`)}
                        </span>
                      </td>
                      <td
                        className={`py-4 ${isRtl ? 'pl-4 rounded-l-lg' : 'pr-4 rounded-r-lg'} text-start`}
                      >
                        {(() => {
                          const RowChevron = isRtl ? ChevronLeft : ChevronRight;
                          return (
                            <RowChevron
                              className={`${
                                selectedComplaint?.rawId === cmp.rawId
                                  ? 'text-secondary'
                                  : 'text-outline-variant'
                              } group-hover:text-secondary transition-all`}
                            />
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            lastPage={lastPage}
            onPageChange={setPage}
            isLoading={isLoading}
            info={t('common.showing_range', { from: rangeFrom, to: rangeTo, count: total })}
          />
        </div>

        <ComplaintDetails
          complaint={selectedComplaint}
          isOpening={openingId !== null && openingId === selectedComplaint?.rawId}
          onRespond={() => setModal('respond')}
          onEscalate={() => setModal('escalate')}
          onResolveEscalated={() => setModal('resolve-escalated')}
          isBusy={isBusy}
          mode={view}
        />
      </section>

      {/* respond — resolution_notes min:10 max:3000 + a status from in_review|resolved|closed */}
      <ConfirmActionModal
        open={modal === 'respond'}
        title={t('support.respond_modal_title', { id: selectedComplaint?.id ?? '' })}
        description={t('support.respond_modal_description')}
        confirmLabel={t('support.respond_confirm')}
        confirmTone="primary"
        minReasonLength={RESOLUTION_NOTES_MIN}
        maxReasonLength={RESOLUTION_NOTES_MAX}
        statusOptions={RESPOND_STATUSES.map((value) => ({
          value,
          label: t(`common.status.${value}`),
        }))}
        isBusy={selectedComplaint ? isBusy(`respond-${selectedComplaint.id}`) : false}
        onConfirm={handleConfirmRespond}
        onClose={() => setModal(null)}
      />

      {/* escalate — reason min:10 max:1000 */}
      <ConfirmActionModal
        open={modal === 'escalate'}
        title={t('support.escalate_modal_title', { id: selectedComplaint?.id ?? '' })}
        description={t('support.escalate_modal_description')}
        confirmLabel={t('support.escalate_confirm')}
        minReasonLength={ESCALATE_REASON_MIN}
        maxReasonLength={ESCALATE_REASON_MAX}
        isBusy={selectedComplaint ? isBusy(`escalate-${selectedComplaint.id}`) : false}
        onConfirm={handleConfirmEscalate}
        onClose={() => setModal(null)}
      />

      {/* escalated resolve — resolution_notes min:10 max:3000 + resolved|closed */}
      <ConfirmActionModal
        open={modal === 'resolve-escalated'}
        title={t('support.resolve_modal_title', { id: selectedComplaint?.id ?? '' })}
        description={t('support.resolve_modal_description')}
        confirmLabel={t('support.resolve_confirm')}
        confirmTone="primary"
        minReasonLength={RESOLUTION_NOTES_MIN}
        maxReasonLength={RESOLUTION_NOTES_MAX}
        statusOptions={ESCALATED_RESOLVE_STATUSES.map((value) => ({
          value,
          label: t(`common.status.${value}`),
        }))}
        isBusy={selectedComplaint ? isBusy(`resolve-escalated-${selectedComplaint.id}`) : false}
        onConfirm={handleConfirmResolveEscalated}
        onClose={() => setModal(null)}
      />
    </div>
  );
};

export default Support;
