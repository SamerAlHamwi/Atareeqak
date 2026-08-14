import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { reportsApi } from '../api/reportsApi';
import type { ReportData, ReportDateRange, PdfSection } from '../api/reportsApi';
import { walletApi } from '../../wallet/api/walletApi';
import type {
  Wallet,
  WalletRequestResponse,
  WalletRequestStatus,
  WalletRequestType,
  ChargeWalletResponse,
} from '../../wallet/api/walletApi';

export interface WalletRequestRow {
  id: number;
  displayId: string;
  user: string;
  userName: string;
  type: WalletRequestType;
  amount: number;
  phone: string;
  walletNumber: string;
  userNotes: string | null;
  adminNotes: string | null;
  date: string;
  status: WalletRequestStatus;
}

/**
 * `AdminWalletRequestController::index()` now applies `status` only when it
 * is present (`if ($request->filled('status'))`), matching `type` below, so
 * omitting it genuinely means "every status" — fixed per REQ-6 in
 * docs/api/backend-issues.md (previously it defaulted to `pending` and an
 * "All" tab silently showed pending rows under an "all" label).
 */
export type RequestStatusFilter = 'all' | WalletRequestStatus;

/**
 * `'all'` **is** honest here: the controller applies `type` only
 * `if ($request->filled('type'))`, so omitting it really does return both.
 */
export type RequestTypeFilter = 'all' | WalletRequestType;

export const REQUESTS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

const mapRequest = (r: WalletRequestResponse, t: TFunction, locale: string): WalletRequestRow => ({
  id: r.id,
  displayId: `#WR-${r.id}`,
  user: r.user?.name || t('common.unknown'),
  userName: r.user?.name || '',
  type: r.type,
  amount: r.amount,
  phone: r.wallet?.phone_number || '',
  walletNumber: r.wallet?.wallet_number || '',
  userNotes: r.user_notes,
  adminNotes: r.admin_notes,
  date: r.created_at ? new Date(r.created_at).toLocaleDateString(locale) : '',
  status: r.status,
});

export const useReports = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const [report, setReport] = useState<ReportData | null>(null);
  const [reportUpdatedAt, setReportUpdatedAt] = useState<Date | null>(null);
  const [range, setRangeState] = useState<ReportDateRange>({});

  const [myWallet, setMyWallet] = useState<Wallet | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletQuery, setWalletQuery] = useState('');

  const [requests, setRequests] = useState<WalletRequestRow[]>([]);
  const [requestCounts, setRequestCounts] = useState<{
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  } | null>(null);
  const [statusFilter, setStatusFilterState] = useState<RequestStatusFilter>('all');
  const [typeFilter, setTypeFilterState] = useState<RequestTypeFilter>('all');
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsPerPage, setRequestsPerPageState] = useState<number>(10);
  const [requestsLastPage, setRequestsLastPage] = useState(1);
  const [requestsTotal, setRequestsTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  /**
   * A role change mid-session can 403 a page `RoleRoute` already let through.
   * Report and requests are independent fetchers against (potentially)
   * different permission scopes, so each gets its own flag.
   */
  const [isReportForbidden, setIsReportForbidden] = useState(false);
  const [isRequestsForbidden, setIsRequestsForbidden] = useState(false);

  // ── Report + wallets (their own request; the request filters must not refetch them)
  const fetchReport = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    setIsReportForbidden(false);
    try {
      const [reportResponse, walletsResponse, myWalletResponse] = await Promise.all([
        reportsApi.generateFinancialReport(range),
        walletApi.getAllWallets(),
        walletApi.getMyWallet(),
      ]);
      if (isStale()) {
        return;
      }
      setReport(reportResponse.report_data);
      setReportUpdatedAt(new Date());
      setWallets(walletsResponse.all_wallets || []);
      setMyWallet(myWalletResponse.wallet ?? null);
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsReportForbidden(true);
        return;
      }
      setError(extractApiError(err, t('reports.load_failed_hint')));
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [range, t]);

  useFetchEffect(fetchReport);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchReport(() => false), [fetchReport]);

  // ── Wallet requests (own request, own loading + error state)
  const fetchRequests = useCallback(async (isStale: IsStale) => {
    setIsRequestsLoading(true);
    setRequestsError(null);
    setIsRequestsForbidden(false);
    try {
      const response = await walletApi.getWalletRequests({
        page: requestsPage,
        per_page: requestsPerPage,
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        ...(typeFilter === 'all' ? {} : { type: typeFilter }),
      });
      if (isStale()) {
        return;
      }
      setRequests((response.data || []).map((r) => mapRequest(r, t, locale)));
      // The server's `counts` block has no `all` key — derive it as the sum
      // of the three real statuses, the same pattern BUG-9's inboxTotal uses.
      setRequestCounts(
        response.counts
          ? {
              ...response.counts,
              all: response.counts.pending + response.counts.approved + response.counts.rejected,
            }
          : null
      );
      setRequestsLastPage(response.meta?.last_page ?? 1);
      setRequestsTotal(response.meta?.total ?? 0);
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsRequestsForbidden(true);
        return;
      }
      setRequestsError(extractApiError(err, t('reports.requests_load_failed')));
    } finally {
      if (!isStale()) {
        setIsRequestsLoading(false);
      }
    }
  }, [statusFilter, typeFilter, requestsPage, requestsPerPage, t, locale]);

  useFetchEffect(fetchRequests);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetchRequests = useCallback(() => fetchRequests(() => false), [fetchRequests]);

  // Every filter change resets to page 1 — otherwise page 3 of `pending` asks
  // for a page 3 of `approved` that may not exist and renders an empty table.
  const setStatusFilter = useCallback((filter: RequestStatusFilter) => {
    setStatusFilterState(filter);
    setRequestsPage(1);
  }, []);

  const setTypeFilter = useCallback((filter: RequestTypeFilter) => {
    setTypeFilterState(filter);
    setRequestsPage(1);
  }, []);

  const setRequestsPerPage = useCallback((perPage: number) => {
    setRequestsPerPageState(perPage);
    setRequestsPage(1);
  }, []);

  const setRange = useCallback((next: ReportDateRange) => {
    setRangeState(next);
  }, []);

  /**
   * Client-side filter over `all_wallets`, kept for the same reason Phase 6
   * kept `visibleRequests`: `GET /admin/wallets` accepts **no query params at
   * all** and returns every wallet unpaginated, so a client filter is the only
   * one possible and it compares fields exactly as the server emitted them.
   * This is *not* the `visibleTrips`/`visibleDrivers` bug class — there is no
   * server-side filter here for it to fight with.
   *
   * It previously returned `[]` whenever the query was empty, so the sidebar
   * rendered "no wallets" on load while holding 32 of them. An empty query now
   * means "everything".
   */
  const filteredWallets = useMemo(() => {
    const query = walletQuery.trim().toLowerCase();
    if (!query) {
      return wallets;
    }
    return wallets.filter(
      (wallet) =>
        wallet.phone_number?.toLowerCase().includes(query) ||
        wallet.wallet_number?.toLowerCase().includes(query) ||
        wallet.owner?.toLowerCase().includes(query) ||
        wallet.name?.toLowerCase().includes(query)
    );
  }, [wallets, walletQuery]);

  const approveRequest = useCallback(
    async (request: WalletRequestRow, adminNotes?: string) => {
      const response = await walletApi.approveWalletRequest(request.id, adminNotes);
      // An approval moves real money, so the list AND the wallet balances are
      // both stale afterwards — re-read rather than patching state locally.
      // Not part of the effect's sequence — always commit.
      await Promise.all([refetchRequests(), refetch()]);
      return response;
    },
    [refetchRequests, refetch]
  );

  const rejectRequest = useCallback(
    async (request: WalletRequestRow, adminNotes?: string) => {
      const response = await walletApi.rejectWalletRequest(request.id, adminNotes);
      await refetchRequests();
      return response;
    },
    [refetchRequests]
  );

  const chargeWalletByPhone = useCallback(
    async (phoneNumber: string, amount: number): Promise<ChargeWalletResponse> => {
      const response = await walletApi.chargeUserWallet(phoneNumber, amount);
      // Refetch so the sidebar list and the balance cards reflect the new total.
      await refetch();
      return response;
    },
    [refetch]
  );

  const exportPdf = useCallback(
    async (sections: readonly PdfSection[] = []) => {
      const blob = await reportsApi.exportReportToPdf(range, sections);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = range.start_date && range.end_date
        ? `${range.start_date}_${range.end_date}`
        : new Date().toISOString().slice(0, 10);
      link.download = `financial-report-${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    [range]
  );

  return {
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
    isReportForbidden,
    isRequestsForbidden,
    refetch,
    refetchRequests,
    approveRequest,
    rejectRequest,
    chargeWalletByPhone,
    exportPdf,
  };
};
