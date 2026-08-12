import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ErrorBanner from '../../shared/components/ErrorBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import FilterTabs from '../../shared/components/FilterTabs';
import Avatar from '../../shared/components/Avatar';
import { useVerifications } from '../hooks/useVerifications';
import type { VerificationTypeFilter } from '../hooks/useVerifications';
import { VerificationDocuments } from '../components/VerificationDocuments';
import ApproveVerificationModal from '../components/ApproveVerificationModal';

const RequestListSkeleton: React.FC = () => (
  <ul className="divide-y divide-outline-variant/10">
    {Array.from({ length: 4 }).map((_, index) => (
      <li key={index} className="flex items-center gap-4 p-5 animate-pulse">
        <div className="w-11 h-11 rounded-full bg-surface-container-high shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-surface-container-high rounded-full w-1/2" />
          <div className="h-2.5 bg-surface-container-high rounded-full w-2/3" />
        </div>
        <div className="h-5 w-16 bg-surface-container-high rounded-full shrink-0" />
      </li>
    ))}
  </ul>
);

const Verifications: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [approveTarget, setApproveTarget] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const {
    visibleRequests,
    total,
    isLoading,
    error,
    updatedAt,
    selectedRequest,
    setSelectedRequest,
    typeFilter,
    setTypeFilter,
    driverCount,
    passengerCount,
    approveRequest,
    rejectRequest,
    refresh,
  } = useVerifications();

  const handleApprove = useCallback(
    async (nationalId: string) => {
      if (!selectedRequest) return;
      const request = selectedRequest;
      await runAction({
        key: `approve-${request.userId}`,
        action: () => approveRequest(request, nationalId),
        // The server echoes the stored national ID and the resulting flags —
        // report those rather than assuming the request succeeded as sent.
        successMessage: (response) =>
          t('verifications.approve_success', {
            name: request.name,
            national_id: response.data.national_id,
          }),
        errorMessage: t('verifications.approve_failed'),
        onSuccess: () => setApproveTarget(null),
      });
    },
    [selectedRequest, approveRequest, runAction, t]
  );

  const handleReject = useCallback(
    async (reason: string) => {
      if (!selectedRequest) return;
      const request = selectedRequest;
      await runAction({
        key: `reject-${request.userId}`,
        action: () => rejectRequest(request, reason),
        successMessage: t('verifications.reject_success', { name: request.name }),
        errorMessage: t('verifications.reject_failed'),
        onSuccess: () => setRejectTarget(null),
      });
    },
    [selectedRequest, rejectRequest, runAction, t]
  );

  const isApproving = selectedRequest ? isBusy(`approve-${selectedRequest.userId}`) : false;
  const isRejecting = selectedRequest ? isBusy(`reject-${selectedRequest.userId}`) : false;

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-primary mb-2">
            {t('verifications.title')}
          </h2>
          <p className="text-on-surface-variant text-sm">{t('verifications.subtitle')}</p>
          <p data-testid="verifications-total-label" className="text-on-surface-variant text-sm mt-1">
            {isLoading && total === null
              ? t('common.loading')
              : t('verifications.pending_total', { count: total ?? 0 })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            data-testid="verifications-refresh"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="flex items-center gap-2 bg-surface-container-high text-on-surface text-xs font-bold px-4 py-2 rounded-full hover:bg-surface-container-highest transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {t('verifications.refresh')}
          </button>
          {updatedAt && (
            <span className="text-[11px] text-on-surface-variant">
              {t('verifications.updated_at', {
                time: updatedAt.toLocaleTimeString(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </span>
          )}
        </div>
      </section>

      {/* Summary Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-secondary flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
              {t('verifications.total_pending')}
            </p>
            <h3
              data-testid="verifications-total"
              className="text-4xl font-headline font-extrabold text-primary"
            >
              {total === null ? '—' : total}
            </h3>
          </div>
          <div className="bg-secondary/10 p-4 rounded-full">
            <span className="material-symbols-outlined text-secondary text-3xl">verified_user</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-primary flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
              {t('verifications.pending_drivers')}
            </p>
            <h3
              data-testid="verifications-driver-count"
              className="text-4xl font-headline font-extrabold text-primary"
            >
              {isLoading ? '—' : driverCount}
            </h3>
          </div>
          <div className="bg-primary/10 p-4 rounded-full">
            <span className="material-symbols-outlined text-primary text-3xl">directions_car</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-tertiary-fixed-variant flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
              {t('verifications.pending_passengers')}
            </p>
            <h3
              data-testid="verifications-passenger-count"
              className="text-4xl font-headline font-extrabold text-primary"
            >
              {isLoading ? '—' : passengerCount}
            </h3>
          </div>
          <div className="bg-tertiary-fixed/30 p-4 rounded-full">
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant text-3xl">
              group
            </span>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Requests List */}
        <div className="lg:col-span-5 bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 bg-surface-container-lowest border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm font-bold text-on-surface">
              {t('verifications.requests_list')}
            </span>
            {/* Counts are exact, not estimates: this endpoint returns the whole
                queue in one unpaginated response. */}
            <FilterTabs<VerificationTypeFilter>
              items={[
                { value: 'all', label: t('verifications.filter_all'), count: total ?? undefined },
                { value: 'driver', label: t('verifications.type_driver'), count: driverCount },
                {
                  value: 'passenger',
                  label: t('verifications.type_passenger'),
                  count: passengerCount,
                },
              ]}
              active={typeFilter}
              onChange={setTypeFilter}
              disabled={isLoading}
              aria-label={t('verifications.filter_all')}
            />
          </div>

          {isLoading ? (
            <RequestListSkeleton />
          ) : visibleRequests.length === 0 ? (
            <div
              data-testid="verifications-empty"
              className="py-16 text-center text-on-surface-variant flex flex-col items-center gap-3 px-6"
            >
              <span className="material-symbols-outlined text-5xl text-secondary/40">task_alt</span>
              {typeFilter === 'all'
                ? t('verifications.empty')
                : t('verifications.empty_filtered', {
                    type: t(`verifications.type_${typeFilter}`),
                  })}
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/10">
              {visibleRequests.map((request) => (
                <li key={request.userId}>
                  <button
                    data-testid={`verification-row-${request.userId}`}
                    onClick={() => setSelectedRequest(request)}
                    className={`w-full flex items-center gap-4 p-5 text-start hover:bg-surface-container transition-colors ${
                      selectedRequest?.userId === request.userId
                        ? `bg-surface-container ${isRtl ? 'border-r-4' : 'border-l-4'} border-secondary`
                        : ''
                    }`}
                  >
                    <Avatar name={request.name} photo={request.photo} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{request.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{request.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] px-3 py-1 rounded-full font-bold ${
                          request.type === 'driver'
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}
                      >
                        {t(`verifications.type_${request.type}`)}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {request.submittedLabel}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Documents Review Panel */}
        <VerificationDocuments
          request={selectedRequest}
          onApprove={() => selectedRequest && setApproveTarget(selectedRequest.userId)}
          onReject={() => selectedRequest && setRejectTarget(selectedRequest.userId)}
          isApproving={isApproving}
          isRejecting={isRejecting}
        />
      </section>

      <ApproveVerificationModal
        open={approveTarget !== null && selectedRequest?.userId === approveTarget}
        userName={selectedRequest?.name ?? ''}
        documents={selectedRequest?.documents ?? []}
        isBusy={isApproving}
        onConfirm={(nationalId) => handleApprove(nationalId)}
        onClose={() => setApproveTarget(null)}
      />

      {/*
        The reject reason is `nullable|string|max:500` server-side — no minimum
        length, so this does NOT reuse the 10-char rule that ban, trip-cancel
        and escalate share. It is required here as a product decision: the text
        is forwarded verbatim into the user's rejection notification, and an
        empty one tells them nothing.
      */}
      <ConfirmActionModal
        open={rejectTarget !== null && selectedRequest?.userId === rejectTarget}
        title={t('verifications.reject_title')}
        description={t('verifications.reject_description', { name: selectedRequest?.name ?? '' })}
        confirmLabel={t('verifications.reject_confirm')}
        minReasonLength={1}
        maxReasonLength={500}
        isBusy={isRejecting}
        onConfirm={({ reason }) => handleReject(reason)}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
};

export default Verifications;
