import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BroadcastAlertRequest } from '../api/staffApi';

interface BroadcastAlertModalProps {
  open: boolean;
  isBusy?: boolean;
  onSend: (payload: BroadcastAlertRequest) => void | Promise<void>;
  onClose: () => void;
}

type FormProps = Omit<BroadcastAlertModalProps, 'open'>;

// Mounted fresh every time the modal opens, so field state resets naturally.
const ModalForm: React.FC<FormProps> = ({ isBusy = false, onSend, onClose }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [type, setType] = useState<BroadcastAlertRequest['type']>('alert');
  const [recipientType, setRecipientType] = useState<BroadcastAlertRequest['recipient_type']>('all');

  const isValid = message.trim().length >= 5;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]" onClick={isBusy ? undefined : onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl p-8 space-y-6 pointer-events-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold font-headline text-primary">{t('broadcast.title')}</h3>
              <p className="text-sm text-on-surface-variant">{t('broadcast.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                {t('broadcast.message_label')}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                placeholder={t('broadcast.message_placeholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                  {t('broadcast.type_label')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as BroadcastAlertRequest['type'])}
                  className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="alert">{t('broadcast.type_alert')}</option>
                  <option value="warning">{t('broadcast.type_warning')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                  {t('broadcast.recipients_label')}
                </label>
                <select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value as BroadcastAlertRequest['recipient_type'])}
                  className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">{t('broadcast.recipients_all')}</option>
                  <option value="users">{t('broadcast.recipients_users')}</option>
                  <option value="drivers">{t('broadcast.recipients_drivers')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => void onSend({ message: message.trim(), type, recipient_type: recipientType })}
              disabled={!isValid || isBusy}
              className="flex-1 bg-primary text-white py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isBusy ? t('common.loading') : t('broadcast.send')}
            </button>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="px-6 py-3 bg-surface-container-high text-on-surface rounded-2xl font-bold text-sm hover:bg-surface-container-highest transition-all disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/** Modal for sending a general alert/warning to users, drivers, or everyone. */
const BroadcastAlertModal: React.FC<BroadcastAlertModalProps> = ({ open, ...formProps }) => {
  if (!open) {
    return null;
  }
  return <ModalForm {...formProps} />;
};

export default BroadcastAlertModal;
