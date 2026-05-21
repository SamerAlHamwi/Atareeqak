import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useReports } from '../hooks/useReports';
import { OverviewCards } from '../components/OverviewCards';
import { ManagementSidebar } from '../components/ManagementSidebar';
import { TransactionTable } from '../components/TransactionTable';

const Reports: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  const {
    commissionRate,
    setCommissionRate,
    walletQuery,
    setWalletQuery,
    filteredTransactions,
    toggleTransactionStatus,
  } = useReports();

  const handleUpdateCommission = useCallback(async () => {
    await runAction({
      key: 'update-commission',
      successMessage: `Commission set to ${commissionRate || '0'}%.`,
      errorMessage: 'Failed to update commission rate.',
    });
  }, [commissionRate, runAction]);

  const handleSearchWallet = useCallback(async () => {
    await runAction({
      key: 'wallet-search',
      successMessage: walletQuery.trim()
        ? `Search done for "${walletQuery}".`
        : 'Wallet search reset.',
      errorMessage: 'Wallet search failed.',
    });
  }, [walletQuery, runAction]);

  const handleManualCredit = useCallback(async () => {
    await runAction({
      key: 'manual-credit',
      successMessage: 'Manual credit form prepared for API submit.',
      errorMessage: 'Could not open manual credit form.',
    });
  }, [runAction]);

  const handleWithdrawBalance = useCallback(async () => {
    await runAction({
      key: 'withdraw-balance',
      successMessage: 'Withdrawal request draft generated.',
      errorMessage: 'Failed to prepare withdrawal request.',
    });
  }, [runAction]);

  const handleToggleStatus = useCallback(
    async (txnId: string) => {
      await runAction({
        key: `txn-${txnId}`,
        successMessage: `${txnId} status updated.`,
        errorMessage: 'Could not update transaction status.',
        onSuccess: () => toggleTransactionStatus(txnId),
      });
    },
    [runAction, toggleTransactionStatus]
  );

  const handleFilter = useCallback(async () => {
    await runAction({
      key: 'report-filter',
      successMessage: 'Report filters applied.',
      errorMessage: 'Could not apply report filter.',
    });
  }, [runAction]);

  const handleExport = useCallback(async () => {
    await runAction({
      key: 'export-pdf',
      successMessage: 'PDF export job started.',
      errorMessage: 'Could not export report.',
    });
  }, [runAction]);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/* Overview Bento Grid */}
      <OverviewCards />

      {/* Secondary Actions Section (Asymmetric Layout) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <ManagementSidebar
          commissionRate={commissionRate}
          setCommissionRate={setCommissionRate}
          walletQuery={walletQuery}
          setWalletQuery={setWalletQuery}
          onUpdateCommission={handleUpdateCommission}
          onSearchWallet={handleSearchWallet}
          onManualCredit={handleManualCredit}
          onWithdrawBalance={handleWithdrawBalance}
          isBusy={isBusy}
          isRtl={isRtl}
        />

        <TransactionTable
          transactions={filteredTransactions}
          onToggleStatus={handleToggleStatus}
          onFilter={handleFilter}
          onExport={handleExport}
          isBusy={isBusy}
          isRtl={isRtl}
        />
      </section>
    </div>
  );
};

export default Reports;
