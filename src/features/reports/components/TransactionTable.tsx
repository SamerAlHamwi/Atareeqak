import React from 'react';
import { useTranslation } from 'react-i18next';
import TableSkeleton from '../../shared/components/TableSkeleton';
import TablePagination from '../../shared/components/TablePagination';
import PerPageSelect from '../../shared/components/PerPageSelect';
import ErrorBanner from '../../shared/components/ErrorBanner';
import FilterTabs from '../../shared/components/FilterTabs';
import type { FilterTabItem } from '../../shared/components/FilterTabs';
import Avatar from '../../shared/components/Avatar';
import { REQUESTS_PER_PAGE_OPTIONS } from '../hooks/useReports';
import type {
  WalletRequestRow,
  RequestStatusFilter,
  RequestTypeFilter,
} from '../hooks/useReports';

interface TransactionTableProps {
  requests: WalletRequestRow[];
  requestCounts: { pending: number; approved: number; rejected: number } | null;
  statusFilter: RequestStatusFilter;
  setStatusFilter: (filter: RequestStatusFilter) => void;
  typeFilter: RequestTypeFilter;
  setTypeFilter: (filter: RequestTypeFilter) => void;
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPerPageChange: (perPage: number) => void;
  onPageChange: (page: number) => void;
  onApprove: (request: WalletRequestRow) => void;
  onReject: (request: WalletRequestRow) => void;
  isBusy: (key: string) => boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const STATUS_TABS: readonly RequestStatusFilter[] = ['pending', 'approved', 'rejected'];

/**
 * Wallet requests inbox.
 *
 * ⚠️ There is **no "All" tab**, on purpose. The controller always filters by
 * status (defaulting to `pending`), so the previous All tab showed pending rows
 * under an "all" label. See `RequestStatusFilter` in useReports for the full
 * reasoning. The `counts` badges make the other statuses' totals visible from
 * whichever tab is active, so nothing is concealed by the removal.
 *
 * The **type** filter does have a legitimate "all" — that param is applied only
 * when present.
 */
export const TransactionTable: React.FC<TransactionTableProps> = ({
  requests,
  requestCounts,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  page,
  lastPage,
  total,
  perPage,
  onPerPageChange,
  onPageChange,
  onApprove,
  onReject,
  isBusy,
  isLoading,
  error,
  onRetry,
}) => {
  const { t } = useTranslation();

  // Badges come from the server's whole-table `counts` block, never from
  // `requests.length` — which only ever describes the current page.
  const statusTabs: FilterTabItem<RequestStatusFilter>[] = STATUS_TABS.map((status) => ({
    value: status,
    label: t(`reports.request_status.${status}`),
    ...(requestCounts ? { count: requestCounts[status] } : {}),
  }));

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/10">
      <div className="p-6 space-y-4 border-b border-outline-variant/10">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h3 className="text-lg font-bold text-primary">{t('reports.wallet_requests')}</h3>
          <PerPageSelect
            value={perPage}
            options={REQUESTS_PER_PAGE_OPTIONS}
            onChange={onPerPageChange}
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs
            items={statusTabs}
            active={statusFilter}
            onChange={setStatusFilter}
            disabled={isLoading}
            aria-label={t('reports.wallet_requests')}
          />
          <select
            data-testid="request-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RequestTypeFilter)}
            disabled={isLoading}
            aria-label={t('reports.table_type')}
            className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-2 rounded-full border border-outline-variant cursor-pointer disabled:opacity-50"
          >
            <option value="all">{t('reports.request_type_all')}</option>
            <option value="charge">{t('reports.request_type.charge')}</option>
            <option value="withdraw">{t('reports.request_type.withdraw')}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-6">
          <ErrorBanner message={error} onRetry={onRetry} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-start">
          <thead className="bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 text-start">{t('reports.table_txn_id')}</th>
              <th className="px-6 py-4 text-start">{t('reports.table_user')}</th>
              <th className="px-6 py-4 text-start">{t('reports.table_type')}</th>
              <th className="px-6 py-4 text-start">{t('reports.table_amount')}</th>
              <th className="px-6 py-4 text-start">{t('reports.table_date')}</th>
              <th className="px-6 py-4 text-center">{t('reports.table_status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} firstColAvatar />
            ) : requests.length === 0 && !error ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                  {typeFilter === 'all'
                    ? t('reports.requests_empty_status', {
                        status: t(`reports.request_status.${statusFilter}`),
                      })
                    : t('reports.requests_empty_filtered')}
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr
                  key={request.id}
                  data-testid="wallet-request-row"
                  className="hover:bg-surface-container-low/60 transition-colors"
                >
                  <td className="px-6 py-5 text-sm text-on-surface-variant text-start ltr:font-mono">
                    {request.displayId}
                  </td>
                  <td className="px-6 py-5 text-start">
                    <div className="flex items-center gap-3">
                      <Avatar name={request.user} photo={null} size="sm" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary">{request.user}</span>
                        <span className="text-[10px] text-outline" dir="ltr">
                          {request.phone}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-start">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        request.type === 'charge'
                          ? 'text-secondary bg-secondary-container/20'
                          : 'text-error bg-error-container/30'
                      }`}
                    >
                      {t(`reports.request_type.${request.type}`)}
                    </span>
                  </td>
                  {/*
                    `amount` here is a RAW number (the controller casts it to
                    float), unlike the pre-formatted balance strings elsewhere on
                    this page — so a unit does have to be appended. It is NOT
                    `t('users.currency')`, which is "SAR": this platform settles
                    in SYP, and the backend's own notification text says so
                    ("Your wallet charge request of {amount} SYP…"). Appending
                    SAR to a SYP figure was the second half of the double-
                    currency bug the KPI row had.
                  */}
                  <td className="px-6 py-5 text-sm font-bold text-primary text-start ltr:font-mono">
                    {t('reports.amount_syp', { amount: request.amount.toLocaleString() })}
                  </td>
                  <td className="px-6 py-5 text-xs text-on-surface-variant text-start">
                    {request.date}
                  </td>
                  <td className="px-6 py-5 text-center">
                    {request.status === 'pending' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          data-testid={`approve-request-${request.id}`}
                          onClick={() => onApprove(request)}
                          disabled={isBusy(`request-${request.id}`)}
                          className="text-xs font-bold text-on-secondary bg-secondary px-3 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50"
                        >
                          {t('reports.approve')}
                        </button>
                        <button
                          data-testid={`reject-request-${request.id}`}
                          onClick={() => onReject(request)}
                          disabled={isBusy(`request-${request.id}`)}
                          className="text-xs font-bold text-error border border-error px-3 py-1.5 rounded-full hover:bg-error-container/40 disabled:opacity-50"
                        >
                          {t('reports.reject')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              request.status === 'approved' ? 'bg-secondary' : 'bg-error'
                            }`}
                          />
                          <span
                            className={`text-xs font-bold ${
                              request.status === 'approved' ? 'text-secondary' : 'text-error'
                            }`}
                          >
                            {t(`reports.request_status.${request.status}`)}
                          </span>
                        </div>
                        {request.adminNotes && (
                          <span
                            className="text-[10px] text-on-surface-variant max-w-40 truncate"
                            title={request.adminNotes}
                          >
                            {request.adminNotes}
                          </span>
                        )}
                      </div>
                    )}
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
        onPageChange={onPageChange}
        isLoading={isLoading}
        info={t('common.showing_range', { from, to, count: total })}
      />
    </div>
  );
};
