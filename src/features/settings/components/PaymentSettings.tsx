import React from 'react';
import { useTranslation } from 'react-i18next';

interface PaymentSettingsProps {
  commission: number;
  setCommission: (val: number) => void;
  minWithdrawal: number;
  setMinWithdrawal: (val: number) => void;
  isRtl: boolean;
}

export const PaymentSettings: React.FC<PaymentSettingsProps> = ({
  commission,
  setCommission,
  minWithdrawal,
  setMinWithdrawal,
  isRtl,
}) => {
  const { t } = useTranslation();

  return (
    <section className="col-span-12 lg:col-span-5 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
          <span className="material-symbols-outlined">account_balance_wallet</span>
        </div>
        <h3 className="text-xl font-bold font-headline">{t('settings.payment_settings')}</h3>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-on-surface-variant flex justify-between">
            {t('settings.platform_commission')}
            <span className="text-secondary font-bold">{commission}%</span>
          </label>
          <input
            className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-secondary"
            max="50"
            min="0"
            type="range"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-on-surface-variant block text-start">
            {t('settings.min_withdrawal')}
          </label>
          <div className="relative">
            <input
              className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-on-surface font-bold text-start outline-none"
              type="number"
              value={minWithdrawal}
              onChange={(e) => setMinWithdrawal(Number(e.target.value))}
            />
            <span
              className={`absolute ${
                isRtl ? 'left-3' : 'right-3'
              } top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-bold uppercase`}
            >
              {t('users.currency')}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-on-surface-variant block text-start">
            {t('settings.accepted_payments')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Mada', 'Apple Pay', t('settings.cash'), 'Visa/MC'].map((method, idx) => (
              <label
                key={idx}
                className="flex items-center gap-3 p-3 bg-surface-container rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors"
              >
                <input
                  defaultChecked={idx < 3}
                  className="rounded text-secondary focus:ring-secondary w-5 h-5 cursor-pointer"
                  type="checkbox"
                />
                <span className="text-sm font-medium">{method}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
