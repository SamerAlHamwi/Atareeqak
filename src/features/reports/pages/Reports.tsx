import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useReports } from '../hooks/useReports';
import type { WalletRequestRow } from '../hooks/useReports';
import { OverviewCards } from '../components/OverviewCards';
import { ManagementSidebar } from '../components/ManagementSidebar';
import { TransactionTable } from '../components/TransactionTable';

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();

  const {
    report,
    filteredWallets,
    requests,
    statusFilter,
    setStatusFilter,
    walletQuery,
    setWalletQuery,
    isLoading,
    error,
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
        successMessage: t('reports.credit_success', { amount, phone: phoneNumber }),
        errorMessage: t('reports.credit_failed'),
      });
    },
    [chargeWalletByPhone, runAction, t]
  );

  const handleApprove = useCallback(
    async (request: WalletRequestRow) => {
      await runAction({
        key: `request-${request.id}`,
        action: () => approveRequest(request),
        successMessage: t('reports.approve_success', { id: request.displayId }),
        errorMessage: t('reports.request_action_failed'),
      });
    },
    [approveRequest, runAction, t]
  );

  const handleReject = useCallback(
    async (request: WalletRequestRow) => {
      await runAction({
        key: `request-${request.id}`,
        action: () => rejectRequest(request),
        successMessage: t('reports.reject_success', { id: request.displayId }),
        errorMessage: t('reports.request_action_failed'),
      });
    },
    [rejectRequest, runAction, t]
  );

  const handleExport = useCallback(async () => {
    await runAction({
      key: 'export-pdf',
      action: () => exportPdf(),
      successMessage: t('reports.export_success'),
      errorMessage: t('reports.export_failed'),
    });
  }, [exportPdf, runAction, t]);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('reports.load_failed_hint')}
        </div>
      )}

      {/* Overview Bento Grid */}
      <OverviewCards report={report} isLoading={isLoading} />

      {/* Secondary Actions Section (Asymmetric Layout) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <ManagementSidebar
          walletQuery={walletQuery}
          setWalletQuery={setWalletQuery}
          filteredWallets={filteredWallets}
          onManualCredit={handleManualCredit}
          isBusy={isBusy}
        />

        <TransactionTable
          requests={requests}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onApprove={handleApprove}
          onReject={handleReject}
          onExport={handleExport}
          isBusy={isBusy}
          isLoading={isLoading}
        />
      </section>
    </div>
  );
};

export default Reports;
