import React from 'react';
import { useTranslation } from 'react-i18next';
import type { WalletRequestRow, RequestStatusFilter } from '../hooks/useReports';

interface TransactionTableProps {
  requests: WalletRequestRow[];
  statusFilter: RequestStatusFilter;
  setStatusFilter: (filter: RequestStatusFilter) => void;
  onApprove: (request: WalletRequestRow) => void;
  onReject: (request: WalletRequestRow) => void;
  onExport: () => void;
  isBusy: (key: string) => boolean;
  isLoading: boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  requests,
  statusFilter,
  setStatusFilter,
  onApprove,
  onReject,
  onExport,
  isBusy,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/10">
      <div className="p-6 flex justify-between items-center bg-white">
        <h3 className="text-lg font-bold text-primary">{t('reports.wallet_requests')}</h3>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RequestStatusFilter)}
            className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant cursor-pointer"
          >
            <option value="all">{t('users.all')}</option>
            <option value="pending">{t('reports.request_status.pending')}</option>
            <option value="approved">{t('reports.request_status.approved')}</option>
            <option value="rejected">{t('reports.request_status.rejected')}</option>
          </select>
          <button
            onClick={onExport}
            disabled={isBusy('export-pdf')}
            className="flex items-center gap-2 text-xs font-bold text-secondary hover:bg-secondary-container px-3 py-1.5 rounded-full border border-secondary transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            {isBusy('export-pdf') ? t('common.loading') : t('reports.export_pdf')}
          </button>
        </div>
      </div>
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
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">
                  {t('common.loading')}
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">
                  {t('common.no_data')}
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5 text-sm text-on-surface-variant text-start ltr:font-mono">
                    {request.displayId}
                  </td>
                  <td className="px-6 py-5 text-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                        {request.userInitial}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary">{request.user}</span>
                        <span className="text-[10px] text-outline" dir="ltr">{request.phone}</span>
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
                  <td className="px-6 py-5 text-sm font-bold text-primary text-start ltr:font-mono">
                    {request.amount.toLocaleString()} {t('users.currency')}
                  </td>
                  <td className="px-6 py-5 text-xs text-on-surface-variant text-start">
                    {request.date}
                  </td>
                  <td className="px-6 py-5 text-center">
                    {request.status === 'pending' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onApprove(request)}
                          disabled={isBusy(`request-${request.id}`)}
                          className="text-xs font-bold text-white bg-secondary px-3 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50"
                        >
                          {t('reports.approve')}
                        </button>
                        <button
                          onClick={() => onReject(request)}
                          disabled={isBusy(`request-${request.id}`)}
                          className="text-xs font-bold text-error border border-error px-3 py-1.5 rounded-full hover:bg-error-container/40 disabled:opacity-50"
                        >
                          {t('reports.reject')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            request.status === 'approved' ? 'bg-secondary' : 'bg-error'
                          }`}
                        ></span>
                        <span
                          className={`text-xs font-bold ${
                            request.status === 'approved' ? 'text-secondary' : 'text-error'
                          }`}
                        >
                          {t(`reports.request_status.${request.status}`)}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
