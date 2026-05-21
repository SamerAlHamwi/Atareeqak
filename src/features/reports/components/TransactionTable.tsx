import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Transaction } from '../hooks/useReports';

interface TransactionTableProps {
  transactions: Transaction[];
  onToggleStatus: (txnId: string) => void;
  onFilter: () => void;
  onExport: () => void;
  isBusy: (key: string) => boolean;
  isRtl: boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onToggleStatus,
  onFilter,
  onExport,
  isBusy,
  isRtl,
}) => {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/10">
      <div className="p-6 flex justify-between items-center bg-white">
        <h3 className="text-lg font-bold text-primary">{t('reports.transaction_history')}</h3>
        <div className="flex gap-3">
          <button
            onClick={onFilter}
            disabled={isBusy('report-filter')}
            className="flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">filter_list</span>
            {t('reports.filter')}
          </button>
          <button
            onClick={onExport}
            disabled={isBusy('export-pdf')}
            className="flex items-center gap-2 text-xs font-bold text-secondary hover:bg-secondary-container px-3 py-1.5 rounded-full border border-secondary transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            {t('reports.export_pdf')}
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
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5 text-sm text-on-surface-variant text-start ltr:font-mono">
                  {txn.id}
                </td>
                <td className="px-6 py-5 text-start">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${
                        txn.userType === 'driver'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-teal-100 text-teal-700'
                      } flex items-center justify-center text-[10px] font-bold`}
                    >
                      {txn.userInitial}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-primary">{txn.user}</span>
                      <span className="text-[10px] text-outline">
                        {t(`users.${txn.userType}`)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-start">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      txn.type === 'commission'
                        ? 'text-secondary bg-secondary-container/20'
                        : txn.type === 'credit'
                        ? 'text-primary bg-primary-fixed/30'
                        : txn.type === 'refund'
                        ? 'text-error bg-error-container/30'
                        : 'text-on-tertiary-fixed-variant bg-tertiary-fixed/30'
                    }`}
                  >
                    {t(`reports.types.${txn.type}`)}
                  </span>
                </td>
                <td className="px-6 py-5 text-sm font-bold text-primary text-start ltr:font-mono">
                  {txn.amount}
                </td>
                <td className="px-6 py-5 text-xs text-on-surface-variant text-start">
                  {txn.date}
                </td>
                <td className="px-6 py-5 text-center">
                  <button
                    onClick={() => onToggleStatus(txn.id)}
                    disabled={isBusy(`txn-${txn.id}`)}
                    className="flex items-center justify-center gap-2 w-full disabled:opacity-50"
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        txn.status === 'completed' ? 'bg-secondary' : 'bg-yellow-500'
                      }`}
                    ></span>
                    <span
                      className={`text-xs font-bold ${
                        txn.status === 'completed' ? 'text-secondary' : 'text-yellow-600'
                      }`}
                    >
                      {t(`reports.txn_status.${txn.status}`)}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination Footer */}
      <div className="p-4 bg-white border-t border-surface-container flex items-center justify-between">
        <span className="text-[10px] text-on-surface-variant">
          {t('reports.pagination_info', { count: 10, total: 1240 })}
        </span>
        <div className="flex gap-1">
          <button className="w-8 h-8 rounded bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-sm">
              {isRtl ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
          <button className="w-8 h-8 rounded bg-primary text-white text-xs font-bold">1</button>
          <button className="w-8 h-8 rounded bg-surface-container text-xs font-bold hover:bg-surface-container-high transition-colors">
            2
          </button>
          <button className="w-8 h-8 rounded bg-surface-container text-xs font-bold hover:bg-surface-container-high transition-colors">
            3
          </button>
          <button className="w-8 h-8 rounded bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-sm">
              {isRtl ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
