import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';

interface Transaction {
  id: string;
  user: string;
  userType: 'driver' | 'passenger';
  userInitial: string;
  type: 'commission' | 'credit' | 'refund' | 'withdrawal';
  amount: string;
  date: string;
  status: 'completed' | 'pending';
}

const mockTransactions: Transaction[] = [
  {
    id: '#TXN-89210',
    user: 'أحمد محمد',
    userType: 'driver',
    userInitial: 'أ م',
    type: 'commission',
    amount: '24.50 ر.س',
    date: '14 أكتوبر 2023',
    status: 'completed',
  },
  {
    id: '#TXN-89209',
    user: 'سارة غانم',
    userType: 'passenger',
    userInitial: 'س غ',
    type: 'credit',
    amount: '150.00 ر.س',
    date: '14 أكتوبر 2023',
    status: 'completed',
  },
  {
    id: '#TXN-89208',
    user: 'محمد علي',
    userType: 'driver',
    userInitial: 'م ع',
    type: 'refund',
    amount: '45.00 ر.س',
    date: '13 أكتوبر 2023',
    status: 'pending',
  },
  {
    id: '#TXN-89207',
    user: 'خالد لؤي',
    userType: 'driver',
    userInitial: 'خ ل',
    type: 'withdrawal',
    amount: '1,200.00 ر.س',
    date: '13 أكتوبر 2023',
    status: 'completed',
  },
];

const Reports: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [commissionRate, setCommissionRate] = useState('15');
  const [walletQuery, setWalletQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);

  const filteredTransactions = useMemo(() => transactions.filter((entry) => {
    if (!walletQuery.trim()) {
      return true;
    }
    const query = walletQuery.toLowerCase();
    return entry.id.toLowerCase().includes(query) || entry.user.toLowerCase().includes(query);
  }), [transactions, walletQuery]);

  return (
    <div className="space-y-10">
      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
          feedback.tone === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : feedback.tone === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <span>{feedback.message}</span>
            <button onClick={clearFeedback} className="text-xs underline underline-offset-2">Dismiss</button>
          </div>
        </div>
      )}

      {/* Overview Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Platform Commission */}
        <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-xl text-white shadow-lg flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined bg-white/20 p-2 rounded-lg text-white">account_balance_wallet</span>
            <span className="text-xs font-bold bg-secondary px-2 py-1 rounded text-white">+12%</span>
          </div>
          <div>
            <p className="text-white/70 text-sm mb-1">{t('reports.commission')}</p>
            <h2 className="text-2xl font-bold font-headline">45,280.50 {t('users.currency')}</h2>
          </div>
        </div>

        {/* Wallet Balances */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">savings</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm mb-1">{t('reports.wallet_balances')}</p>
            <h2 className="text-2xl font-bold text-primary font-headline">128,400.00 {t('users.currency')}</h2>
          </div>
        </div>

        {/* Total Payouts */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-primary bg-primary-fixed-dim/30 p-2 rounded-lg">payments</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm mb-1">{t('reports.payouts')}</p>
            <h2 className="text-2xl font-bold text-primary font-headline">92,150.25 {t('users.currency')}</h2>
          </div>
        </div>

        {/* Refund Requests */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-error bg-error-container p-2 rounded-lg">assignment_return</span>
            <span className="text-xs font-bold bg-error text-white px-2 py-1 rounded-full">{t('reports.requests_count', { count: 8 })}</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm mb-1">{t('reports.refund_requests')}</p>
            <h2 className="text-2xl font-bold text-primary font-headline">3,420.00 {t('users.currency')}</h2>
          </div>
        </div>
      </section>

      {/* Secondary Actions Section (Asymmetric Layout) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
          {/* Commission Settings Card */}
          <div className="bg-surface-container-low p-8 rounded-xl space-y-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">percent</span>
              <h3 className="text-lg font-bold text-primary">{t('reports.commission_settings')}</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">{t('reports.commission_desc')}</p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase">{t('reports.current_rate')}</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    className="w-full bg-surface-container-lowest border-none border-b-2 border-outline-variant focus:border-secondary focus:ring-0 rounded-t-lg py-3 px-4 font-bold text-lg text-primary text-start"
                    type="number"
                    value={commissionRate}
                    onChange={(event) => setCommissionRate(event.target.value)}
                  />
                  <span className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-3 text-outline`}>%</span>
                </div>
                <button
                  onClick={async () => {
                    await runAction({
                      key: 'update-commission',
                      successMessage: `Commission set to ${commissionRate || '0'}%.`,
                      errorMessage: 'Failed to update commission rate.',
                    });
                  }}
                  disabled={isBusy('update-commission')}
                  className="bg-primary text-white px-6 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isBusy('update-commission') ? 'Saving...' : t('reports.update')}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Management Search */}
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-6 border border-outline-variant/10">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">account_balance</span>
              <h3 className="text-lg font-bold text-primary">{t('reports.wallet_mgmt')}</h3>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-surface-container border-none rounded-lg text-sm px-4 focus:ring-2 focus:ring-secondary/20 text-start"
                  placeholder={t('reports.wallet_search_placeholder')}
                  type="text"
                  value={walletQuery}
                  onChange={(event) => setWalletQuery(event.target.value)}
                />
                <button
                  onClick={async () => {
                    await runAction({
                      key: 'wallet-search',
                      successMessage: walletQuery.trim() ? `Search done for "${walletQuery}".` : 'Wallet search reset.',
                      errorMessage: 'Wallet search failed.',
                    });
                  }}
                  disabled={isBusy('wallet-search')}
                  className="p-3 bg-secondary text-white rounded-lg disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">search</span>
                </button>
              </div>
              <div className="p-4 bg-surface-container-low rounded-lg border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center py-8">
                <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">person_search</span>
                <p className="text-xs text-outline italic text-center">{t('reports.wallet_search_empty')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    await runAction({
                      key: 'manual-credit',
                      successMessage: 'Manual credit form prepared for API submit.',
                      errorMessage: 'Could not open manual credit form.',
                    });
                  }}
                  disabled={isBusy('manual-credit')}
                  className="bg-surface-container-high text-primary-container px-4 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">add_card</span>
                  {t('reports.manual_credit')}
                </button>
                <button
                  onClick={async () => {
                    await runAction({
                      key: 'withdraw-balance',
                      successMessage: 'Withdrawal request draft generated.',
                      errorMessage: 'Failed to prepare withdrawal request.',
                    });
                  }}
                  disabled={isBusy('withdraw-balance')}
                  className="bg-surface-container-high text-error px-4 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-error-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">outbox</span>
                  {t('reports.withdraw_balance')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History Table Section */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/10">
          <div className="p-6 flex justify-between items-center bg-white">
            <h3 className="text-lg font-bold text-primary">{t('reports.transaction_history')}</h3>
            <div className="flex gap-3">
                <button
                  onClick={async () => {
                    await runAction({ key: 'report-filter', successMessage: 'Report filters applied.', errorMessage: 'Could not apply report filter.' });
                  }}
                  disabled={isBusy('report-filter')}
                  className="flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant transition-colors disabled:opacity-50"
                >
                <span className="material-symbols-outlined text-sm">filter_list</span>
                {t('reports.filter')}
              </button>
                <button
                  onClick={async () => {
                    await runAction({ key: 'export-pdf', successMessage: 'PDF export job started.', errorMessage: 'Could not export report.' });
                  }}
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
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5 text-sm text-on-surface-variant text-start ltr:font-mono">{txn.id}</td>
                    <td className="px-6 py-5 text-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${txn.userType === 'driver' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'} flex items-center justify-center text-[10px] font-bold`}>
                          {txn.userInitial}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-primary">{txn.user}</span>
                          <span className="text-[10px] text-outline">{t(`users.${txn.userType}`)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        txn.type === 'commission' ? 'text-secondary bg-secondary-container/20' :
                        txn.type === 'credit' ? 'text-primary bg-primary-fixed/30' :
                        txn.type === 'refund' ? 'text-error bg-error-container/30' :
                        'text-on-tertiary-fixed-variant bg-tertiary-fixed/30'
                      }`}>
                        {t(`reports.types.${txn.type}`)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-primary text-start ltr:font-mono">{txn.amount}</td>
                    <td className="px-6 py-5 text-xs text-on-surface-variant text-start">{txn.date}</td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={async () => {
                          await runAction({
                            key: `txn-${txn.id}`,
                            successMessage: `${txn.id} status updated.`,
                            errorMessage: 'Could not update transaction status.',
                            onSuccess: () => {
                              setTransactions((prev) => prev.map((entry) => {
                                if (entry.id !== txn.id) {
                                  return entry;
                                }
                                return { ...entry, status: entry.status === 'pending' ? 'completed' : 'pending' };
                              }));
                            },
                          });
                        }}
                        disabled={isBusy(`txn-${txn.id}`)}
                        className="flex items-center justify-center gap-2 w-full disabled:opacity-50"
                      >
                        <span className={`inline-block w-2 h-2 rounded-full ${txn.status === 'completed' ? 'bg-secondary' : 'bg-yellow-500'}`}></span>
                        <span className={`text-xs font-bold ${txn.status === 'completed' ? 'text-secondary' : 'text-yellow-600'}`}>
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
                <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
              </button>
              <button className="w-8 h-8 rounded bg-primary text-white text-xs font-bold">1</button>
              <button className="w-8 h-8 rounded bg-surface-container text-xs font-bold hover:bg-surface-container-high transition-colors">2</button>
              <button className="w-8 h-8 rounded bg-surface-container text-xs font-bold hover:bg-surface-container-high transition-colors">3</button>
              <button className="w-8 h-8 rounded bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Reports;
