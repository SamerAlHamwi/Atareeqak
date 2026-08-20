import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark, CreditCard } from 'lucide-react';
import type { Wallet } from '../../wallet/api/walletApi';
import {
  ADMIN_CHARGE_MAX_AMOUNT,
  ADMIN_CHARGE_MIN_AMOUNT,
  ADMIN_CHARGE_PHONE_MAX,
  ADMIN_CHARGE_PHONE_MIN,
} from '../../wallet/api/walletApi';

interface ManagementSidebarProps {
  walletQuery: string;
  setWalletQuery: (val: string) => void;
  filteredWallets: Wallet[];
  totalWallets: number;
  onManualCredit: (phoneNumber: string, amount: number) => void;
  onOpenTransactions: (walletId: number) => void;
  isBusy: (key: string) => boolean;
  isLoading: boolean;
}

export const ManagementSidebar: React.FC<ManagementSidebarProps> = ({
  walletQuery,
  setWalletQuery,
  filteredWallets,
  totalWallets,
  onManualCredit,
  onOpenTransactions,
  isBusy,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [creditPhone, setCreditPhone] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const phone = creditPhone.trim();
  const amount = Number(creditAmount);

  // Mirrors POST /admin/wallet/charge exactly: phone_number min:10|max:15,
  // amount numeric|min:1|**max:1000000**. Note the cap differs from the
  // passenger-side charge of Phase 5 (10,000,000) — this is the smaller one.
  // The confirm button is DISABLED on a violation rather than submitting and
  // 422'ing, per the Phase 5/6 precedent.
  const phoneValid =
    phone.length >= ADMIN_CHARGE_PHONE_MIN && phone.length <= ADMIN_CHARGE_PHONE_MAX;
  const amountValid =
    creditAmount !== '' &&
    Number.isFinite(amount) &&
    amount >= ADMIN_CHARGE_MIN_AMOUNT &&
    amount <= ADMIN_CHARGE_MAX_AMOUNT;
  const creditValid = phoneValid && amountValid;

  return (
    <div className="lg:col-span-1 space-y-8">
      {/* ── Wallet directory ──────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-6 border border-outline-variant">
        <div className="flex items-center gap-3">
          <Landmark size={20} className="text-primary" />
          <h3 className="text-lg font-bold text-primary">{t('reports.wallet_mgmt')}</h3>
        </div>
        <div className="space-y-4">
          <input
            data-testid="wallet-search"
            className="w-full bg-surface-container border border-outline-variant rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/20 text-start"
            placeholder={t('reports.wallet_search_placeholder')}
            type="text"
            value={walletQuery}
            onChange={(e) => setWalletQuery(e.target.value)}
          />

          {/*
            `GET /admin/wallets` takes no search param and returns all 32 wallets
            unpaginated, so this list is filtered client-side. It used to render
            `[]` until the user typed, which read as "there are no wallets"
            rather than "search to begin". It now shows the full directory.
          */}
          <p data-testid="wallet-list-count" className="text-[11px] text-on-surface-variant">
            {isLoading
              ? t('common.loading')
              : t('reports.wallet_list_count', {
                  count: filteredWallets.length,
                  total: totalWallets,
                })}
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-surface-container-low rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredWallets.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">
              {walletQuery.trim()
                ? t('reports.wallet_search_miss', { query: walletQuery.trim() })
                : t('reports.wallet_list_empty')}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pe-1">
              {filteredWallets.map((wallet) => (
                <button
                  key={wallet.id}
                  data-testid="wallet-list-item"
                  // BUG-8 guard: a non-numeric id in the route segment 500s with
                  // a stack trace, so it is never navigated to.
                  onClick={() =>
                    Number.isFinite(wallet.id) ? onOpenTransactions(wallet.id) : undefined
                  }
                  className="w-full p-3 bg-surface-container-low rounded-lg flex items-center justify-between gap-3 text-start hover:bg-surface-container transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary truncate" dir="ltr">
                      {wallet.phone_number}
                    </p>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {wallet.owner || wallet.name || wallet.wallet_number}
                    </p>
                  </div>
                  {/* Pre-formatted with its own "SYP" — rendered as-is. */}
                  <span className="text-xs font-bold shrink-0" dir="ltr">
                    {wallet.balance}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Manual charge (system_admin only) ─────────────────────────────── */}
      <div className="bg-surface-container-low p-8 rounded-xl space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard size={20} className="text-secondary" />
          <h3 className="text-lg font-bold text-primary">{t('reports.manual_credit')}</h3>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {t('reports.manual_credit_desc')}
        </p>
        <div className="space-y-3">
          <input
            data-testid="charge-phone"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/20 text-start"
            placeholder={t('reports.credit_phone_placeholder')}
            type="text"
            dir="ltr"
            maxLength={ADMIN_CHARGE_PHONE_MAX}
            value={creditPhone}
            onChange={(e) => setCreditPhone(e.target.value)}
          />
          {creditPhone !== '' && !phoneValid && (
            <p className="text-[11px] text-error">
              {t('reports.credit_phone_invalid', {
                min: ADMIN_CHARGE_PHONE_MIN,
                max: ADMIN_CHARGE_PHONE_MAX,
              })}
            </p>
          )}

          <input
            data-testid="charge-amount"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/20 text-start"
            placeholder={t('reports.credit_amount_placeholder')}
            type="number"
            min={ADMIN_CHARGE_MIN_AMOUNT}
            max={ADMIN_CHARGE_MAX_AMOUNT}
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
          />
          {creditAmount !== '' && !amountValid && (
            <p data-testid="charge-amount-error" className="text-[11px] text-error">
              {t('reports.credit_amount_invalid', {
                min: ADMIN_CHARGE_MIN_AMOUNT,
                max: ADMIN_CHARGE_MAX_AMOUNT.toLocaleString(),
              })}
            </p>
          )}
          <p className="text-[10px] text-on-surface-variant">
            {t('reports.credit_amount_hint', { max: ADMIN_CHARGE_MAX_AMOUNT.toLocaleString() })}
          </p>

          <button
            data-testid="charge-submit"
            onClick={() => {
              onManualCredit(phone, amount);
              setCreditPhone('');
              setCreditAmount('');
            }}
            disabled={!creditValid || isBusy('manual-credit')}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isBusy('manual-credit') ? t('common.loading') : t('reports.manual_credit')}
          </button>
        </div>
      </div>
    </div>
  );
};
