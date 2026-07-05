import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { reportsApi } from '../api/reportsApi';
import type { ReportData } from '../api/reportsApi';
import { walletApi } from '../../wallet/api/walletApi';
import type { Wallet, WalletRequestResponse } from '../../wallet/api/walletApi';

export interface WalletRequestRow {
  id: number;
  displayId: string;
  user: string;
  userInitial: string;
  type: 'charge' | 'withdraw';
  amount: number;
  phone: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export type RequestStatusFilter = 'all' | WalletRequestRow['status'];

const mapRequest = (r: WalletRequestResponse, t: TFunction): WalletRequestRow => ({
  id: r.id,
  displayId: `#WR-${r.id}`,
  user: r.user?.name || t('common.unknown'),
  userInitial: r.user?.name
    ? r.user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join(' ')
    : '?',
  type: r.type,
  amount: r.amount,
  phone: r.wallet?.phone_number || '',
  date: r.created_at ? new Date(r.created_at).toLocaleDateString('ar-SY') : '',
  status: r.status,
});

export const useReports = () => {
  const { t } = useTranslation();
  const [report, setReport] = useState<ReportData | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [requests, setRequests] = useState<WalletRequestRow[]>([]);
  const [requestCounts, setRequestCounts] = useState<{ pending: number; approved: number; rejected: number } | null>(null);
  const [statusFilter, setStatusFilterState] = useState<RequestStatusFilter>('all');
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsLastPage, setRequestsLastPage] = useState(1);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [walletQuery, setWalletQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setStatusFilter = useCallback((filter: RequestStatusFilter) => {
    setStatusFilterState(filter);
    setRequestsPage(1);
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reportResponse, walletsResponse, requestsResponse] = await Promise.all([
        reportsApi.generateFinancialReport(),
        walletApi.getAllWallets(),
        walletApi.getWalletRequests({
          page: requestsPage,
          ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        }),
      ]);
      setReport(reportResponse.report_data);
      setWallets(walletsResponse.all_wallets || []);
      setRequests((requestsResponse.data || []).map((r) => mapRequest(r, t)));
      setRequestCounts(requestsResponse.counts ?? null);
      setRequestsLastPage(requestsResponse.meta?.last_page ?? 1);
      setRequestsTotal(requestsResponse.meta?.total ?? 0);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load reports');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, requestsPage, t]);

  useFetchEffect(fetchAll);

  const filteredWallets = useMemo(() => {
    const query = walletQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return wallets
      .filter(
        (wallet) =>
          wallet.phone_number?.toLowerCase().includes(query) ||
          wallet.wallet_number?.toLowerCase().includes(query) ||
          wallet.owner?.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [wallets, walletQuery]);

  const approveRequest = useCallback(async (request: WalletRequestRow) => {
    await walletApi.approveWalletRequest(request.id);
    setRequests((prev) =>
      prev.map((entry) => (entry.id === request.id ? { ...entry, status: 'approved' } : entry))
    );
    setRequestCounts((prev) =>
      prev ? { ...prev, pending: Math.max(0, prev.pending - 1), approved: prev.approved + 1 } : prev
    );
  }, []);

  const rejectRequest = useCallback(async (request: WalletRequestRow) => {
    await walletApi.rejectWalletRequest(request.id);
    setRequests((prev) =>
      prev.map((entry) => (entry.id === request.id ? { ...entry, status: 'rejected' } : entry))
    );
    setRequestCounts((prev) =>
      prev ? { ...prev, pending: Math.max(0, prev.pending - 1), rejected: prev.rejected + 1 } : prev
    );
  }, []);

  const chargeWalletByPhone = useCallback(async (phoneNumber: string, amount: number) => {
    return walletApi.chargeUserWallet(phoneNumber, amount);
  }, []);

  const exportPdf = useCallback(async () => {
    const blob = await reportsApi.exportReportToPdf();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, []);

  return {
    report,
    wallets,
    filteredWallets,
    requests,
    requestCounts,
    statusFilter,
    setStatusFilter,
    requestsPage,
    setRequestsPage,
    requestsLastPage,
    requestsTotal,
    walletQuery,
    setWalletQuery,
    isLoading,
    error,
    refetch: fetchAll,
    approveRequest,
    rejectRequest,
    chargeWalletByPhone,
    exportPdf,
  };
};
