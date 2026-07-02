import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useVerifications } from '../hooks/useVerifications';
import type { VerificationTypeFilter } from '../hooks/useVerifications';
import { VerificationDocuments } from '../components/VerificationDocuments';

const Verifications: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();

  const {
    requests,
    visibleRequests,
    isLoading,
    error,
    selectedRequest,
    setSelectedRequest,
    typeFilter,
    setTypeFilter,
    driverCount,
    passengerCount,
    approveRequest,
    rejectRequest,
  } = useVerifications();

  const handleApprove = useCallback(async () => {
    if (!selectedRequest) return;
    await runAction({
      key: `approve-${selectedRequest.userId}`,
      action: () => approveRequest(selectedRequest),
      successMessage: t('verifications.approve_success', { name: selectedRequest.name }),
      errorMessage: t('verifications.approve_failed'),
    });
  }, [selectedRequest, approveRequest, runAction, t]);

  const handleReject = useCallback(async () => {
    if (!selectedRequest) return;
    await runAction({
      key: `reject-${selectedRequest.userId}`,
      action: () => rejectRequest(selectedRequest),
      successMessage: t('verifications.reject_success', { name: selectedRequest.name }),
      errorMessage: t('verifications.reject_failed'),
    });
  }, [selectedRequest, rejectRequest, runAction, t]);

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
            {t('verifications.title')}
          </h2>
          <p className="text-on-surface-variant text-sm">{t('verifications.subtitle')}</p>
        </div>
      </section>

      {/* Summary Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-secondary flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
              {t('verifications.total_pending')}
            </p>
            <h3 className="text-4xl font-headline font-extrabold text-primary">
              {isLoading ? '—' : requests.length}
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
            <h3 className="text-4xl font-headline font-extrabold text-primary">
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
            <h3 className="text-4xl font-headline font-extrabold text-primary">
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as VerificationTypeFilter)}
              className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer"
            >
              <option value="all">{t('verifications.filter_all')}</option>
              <option value="driver">{t('verifications.type_driver')}</option>
              <option value="passenger">{t('verifications.type_passenger')}</option>
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-on-surface-variant">{t('common.loading')}</div>
          ) : visibleRequests.length === 0 ? (
            <div className="py-16 text-center text-on-surface-variant flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-5xl text-secondary/40">task_alt</span>
              {t('verifications.empty')}
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/10">
              {visibleRequests.map((request) => (
                <li key={request.userId}>
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className={`w-full flex items-center gap-4 p-5 text-start hover:bg-slate-50 transition-colors ${
                      selectedRequest?.userId === request.userId
                        ? `bg-slate-50 ${isRtl ? 'border-r-4' : 'border-l-4'} border-secondary`
                        : ''
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold shrink-0">
                      {request.name.charAt(0)}
                    </div>
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
                        {request.submittedDate}
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
          onApprove={handleApprove}
          onReject={handleReject}
          isApproving={selectedRequest ? isBusy(`approve-${selectedRequest.userId}`) : false}
          isRejecting={selectedRequest ? isBusy(`reject-${selectedRequest.userId}`) : false}
        />
      </section>
    </div>
  );
};

export default Verifications;
