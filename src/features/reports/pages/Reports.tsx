import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ErrorBanner from '../../shared/components/ErrorBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import { useReports } from '../hooks/useReports';
import type { WalletRequestRow } from '../hooks/useReports';
import { ADMIN_NOTES_MAX_LENGTH } from '../../wallet/api/walletApi';
import type { PdfSection } from '../api/reportsApi';
import { OverviewCards } from '../components/OverviewCards';
import { ReportFilters } from '../components/ReportFilters';
import { AdminWalletCard } from '../components/AdminWalletCard';
import { ManagementSidebar } from '../components/ManagementSidebar';
import { TransactionTable } from '../components/TransactionTable';
import { WalletTransactionsDrawer } from '../components/WalletTransactionsDrawer';

type PendingAction = { request: WalletRequestRow; kind: 'approve' | 'reject' } | null;

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [transactionsWalletId, setTransactionsWalletId] = useState<number | null>(null);

  const {
    report,
    reportUpdatedAt,
    range,
    setRange,
    myWallet,
    wallets,
    filteredWallets,
    walletQuery,
    setWalletQuery,
    requests,
    requestCounts,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    requestsPage,
    setRequestsPage,
    requestsPerPage,
    setRequestsPerPage,
    requestsLastPage,
    requestsTotal,
    isLoading,
    isRequestsLoading,
    error,
    requestsError,
    refetch,
    refetchRequests,
    approveRequest,
    rejectRequest,
    chargeWalletByPhone,
    exportPdf,
  } = useReports();

  const handleManualCredit = useCallback(
    async (phoneNumber: string, amount: number) => {
      await runAction({
        key: 'manual-credit',
        action: () => chargeWalletByPhone(phoneNumber, amount),
        // All three figures the endpoint returns are shown — they are nested
        // under `wallet`, and this is the endpoint that actually carries them
        // (the passenger-side charge of Phase 5 returns only `new_balance`).
        successMessage: (result) =>
          t('reports.credit_success_detailed', {
            phone: result.wallet.phone_number,
            previous: result.wallet.previous_balance,
            next: result.wallet.new_balance,
            transaction: result.transaction_id,
          }),
        errorMessage: t('reports.credit_failed'),
      });
    },
    [chargeWalletByPhone, runAction, t]
  );

  const handleConfirmRequestAction = useCallback(
    async (adminNotes: string) => {
      if (!pendingAction) return;
      const { request, kind } = pendingAction;
      // `admin_notes` is `nullable|string|max:500` — an empty box is legal, so
      // it is sent as undefined rather than as an empty string.
      const notes = adminNotes.trim() || undefined;

      await runAction({
        key: `request-${request.id}`,
        action: () =>
          kind === 'approve'
            ? approveRequest(request, notes)
            : rejectRequest(request, notes),
        successMessage:
          kind === 'approve'
            ? t('reports.approve_success', { id: request.displayId })
            : t('reports.reject_success', { id: request.displayId }),
        errorMessage: t('reports.request_action_failed'),
        onSuccess: () => setPendingAction(null),
      });
    },
    [pendingAction, approveRequest, rejectRequest, runAction, t]
  );

  const handleExport = useCallback(
    async (sections: readonly PdfSection[]) => {
      await runAction({
        key: 'export-pdf',
        action: () => exportPdf(sections),
        successMessage: t('reports.export_success'),
        errorMessage: t('reports.export_failed'),
      });
    },
    [exportPdf, runAction, t]
  );

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/*
        `admin_notes` is optional server-side, so `minReasonLength={1}` is the
        strongest client rule that is still honest — the Phase 6 reject
        precedent, NOT the 10-char ban rule.
      */}
      <ConfirmActionModal
        open={pendingAction !== null}
        title={
          pendingAction?.kind === 'approve'
            ? t('reports.approve_confirm_title')
            : t('reports.reject_confirm_title')
        }
        description={
          pendingAction
            ? t('reports.request_confirm_desc', {
                id: pendingAction.request.displayId,
                user: pendingAction.request.user,
                amount: pendingAction.request.amount.toLocaleString(),
                type: t(`reports.request_type.${pendingAction.request.type}`),
              })
            : undefined
        }
        confirmLabel={
          pendingAction?.kind === 'approve' ? t('reports.approve') : t('reports.reject')
        }
        confirmTone={pendingAction?.kind === 'approve' ? 'primary' : 'destructive'}
        minReasonLength={1}
        maxReasonLength={ADMIN_NOTES_MAX_LENGTH}
        isBusy={pendingAction ? isBusy(`request-${pendingAction.request.id}`) : false}
        onConfirm={async ({ reason }) => {
          await handleConfirmRequestAction(reason);
        }}
        onClose={() => setPendingAction(null)}
      >
        {pendingAction?.request.userNotes && (
          <div className="bg-surface-container-low rounded-2xl p-4">
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              {t('reports.user_notes')}
            </p>
            <p className="text-sm text-on-surface">{pendingAction.request.userNotes}</p>
          </div>
        )}
        {pendingAction?.kind === 'approve' && (
          <p className="text-xs text-error font-medium">{t('reports.approve_irreversible')}</p>
        )}
      </ConfirmActionModal>

      <WalletTransactionsDrawer
        walletId={transactionsWalletId}
        onClose={() => setTransactionsWalletId(null)}
      />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tight mb-2 font-headline">
            {t('reports.title')}
          </h2>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void refetch()} />}

      {/* 🆕 The acting admin's own wallet — GET /admin/wallet had no consumer. */}
      <AdminWalletCard
        wallet={myWallet}
        isLoading={isLoading && !myWallet}
        onOpenTransactions={setTransactionsWalletId}
      />

      <ReportFilters
        range={range}
        onApplyRange={setRange}
        onExport={(sections) => void handleExport(sections)}
        onRefresh={() => void refetch()}
        updatedAt={reportUpdatedAt}
        isLoading={isLoading}
        isExporting={isBusy('export-pdf')}
      />

      <OverviewCards
        report={report}
        isLoading={isLoading}
        hasRange={Boolean(range.start_date || range.end_date)}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        <ManagementSidebar
          walletQuery={walletQuery}
          setWalletQuery={setWalletQuery}
          filteredWallets={filteredWallets}
          totalWallets={wallets.length}
          onManualCredit={handleManualCredit}
          onOpenTransactions={setTransactionsWalletId}
          isBusy={isBusy}
          isLoading={isLoading}
        />

        <TransactionTable
          requests={requests}
          requestCounts={requestCounts}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          page={requestsPage}
          lastPage={requestsLastPage}
          total={requestsTotal}
          perPage={requestsPerPage}
          onPerPageChange={setRequestsPerPage}
          onPageChange={setRequestsPage}
          onApprove={(request) => setPendingAction({ request, kind: 'approve' })}
          onReject={(request) => setPendingAction({ request, kind: 'reject' })}
          isBusy={isBusy}
          isLoading={isRequestsLoading}
          error={requestsError}
          onRetry={() => void refetchRequests()}
        />
      </section>
    </div>
  );
};

export default Reports;
