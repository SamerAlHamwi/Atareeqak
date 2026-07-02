import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Complaint } from '../hooks/useSupport';

interface ComplaintDetailsProps {
  complaint: Complaint | null;
  replyText: string;
  setReplyText: (text: string) => void;
  onSendReply: () => void;
  onResolve: () => void;
  onEscalate: () => void;
  isBusy: (key: string) => boolean;
  mode?: 'inbox' | 'escalated';
  onCloseComplaint?: () => void;
}

export const ComplaintDetails: React.FC<ComplaintDetailsProps> = ({
  complaint,
  replyText,
  setReplyText,
  onSendReply,
  onResolve,
  onEscalate,
  isBusy,
  mode = 'inbox',
  onCloseComplaint,
}) => {
  const { t } = useTranslation();

  if (!complaint) {
    return (
      <div className="lg:col-span-4 flex items-center justify-center p-12 text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/10">
        {t('common.no_data')}
      </div>
    );
  }

  const isClosed = complaint.status === 'resolved' || complaint.status === 'closed';

  return (
    <div className="lg:col-span-4 space-y-6 sticky top-24">
      <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/10 overflow-hidden">
        <div className="p-6 bg-primary text-on-primary">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] opacity-70 mb-1">{t('support.details_title')}</p>
              <h4 className="text-lg font-bold">{complaint.id.replace('#', '')}</h4>
            </div>
            <span className="bg-white/20 text-[10px] px-2 py-1 rounded text-white font-bold">
              {t(`support.${complaint.status}`)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <img
              className="w-12 h-12 rounded-full border-2 border-secondary object-cover"
              src={complaint.userAvatar}
              alt={complaint.user}
            />
            <div className="text-start">
              <p className="font-bold text-sm">{complaint.user}</p>
              <p className="text-xs opacity-80">{complaint.userEmail}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h5 className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">description</span>
              {t('support.content_title')}
            </h5>
            <div className="bg-surface-container-low p-4 rounded-lg text-sm text-on-surface-variant leading-relaxed text-start">
              {complaint.content}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
              <p className="text-[10px] text-on-surface-variant">{t('support.table_category')}</p>
              <p className="text-xs font-bold text-secondary">{complaint.category}</p>
            </div>
            <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
              <p className="text-[10px] text-on-surface-variant">{t('support.table_date')}</p>
              <p className="text-xs font-bold">{complaint.date}</p>
            </div>
          </div>

          {complaint.resolutionNotes && (
            <div>
              <h5 className="text-xs font-bold text-indigo-900 mb-2 text-start">
                {t('support.resolution_notes')}
              </h5>
              <div className="bg-tertiary-fixed/20 p-4 rounded-lg text-sm text-on-surface-variant leading-relaxed text-start whitespace-pre-line">
                {complaint.resolutionNotes}
              </div>
            </div>
          )}

          {complaint.assignedTo && (
            <p className="text-xs text-on-surface-variant text-start">
              {t('support.assigned_to')}: <span className="font-bold">{complaint.assignedTo}</span>
            </p>
          )}

          {!isClosed && mode === 'escalated' && (
            <div>
              <h5 className="text-xs font-bold text-indigo-900 mb-2 text-start">
                {t('support.resolution_title')}
              </h5>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-secondary min-h-[100px] outline-none mb-3 text-start"
                placeholder={t('support.resolution_placeholder')}
              ></textarea>
              <div className="flex gap-2">
                <button
                  onClick={onResolve}
                  disabled={replyText.trim().length < 10 || isBusy(`resolve-${complaint.id}`)}
                  className="flex-1 bg-secondary text-on-secondary text-xs font-bold py-3 rounded-lg hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-sm shadow-secondary/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">task_alt</span>
                  {t('support.resolve_and_notify')}
                </button>
                <button
                  onClick={onCloseComplaint}
                  disabled={replyText.trim().length < 10 || isBusy(`close-${complaint.id}`)}
                  className="bg-surface-container-high text-on-surface text-xs font-bold px-4 py-3 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  {t('support.close_complaint')}
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2 text-start">
                {t('support.reply_min_hint')}
              </p>
            </div>
          )}

          {!isClosed && mode === 'inbox' && (
            <div>
              <h5 className="text-xs font-bold text-indigo-900 mb-2 text-start">
                {t('support.quick_reply')}
              </h5>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-secondary min-h-[100px] outline-none mb-3 text-start"
                placeholder={t('support.reply_placeholder')}
              ></textarea>
              <div className="flex gap-2">
                <button
                  onClick={onSendReply}
                  disabled={replyText.trim().length < 10 || isBusy(`reply-${complaint.id}`)}
                  className="flex-1 bg-secondary text-on-secondary text-xs font-bold py-3 rounded-lg hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-sm shadow-secondary/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  {t('support.send_reply')}
                </button>
                <button
                  onClick={onResolve}
                  disabled={replyText.trim().length < 10 || isBusy(`resolve-${complaint.id}`)}
                  className="bg-primary text-on-primary text-xs font-bold px-4 py-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {t('support.mark_resolved')}
                </button>
                <button
                  onClick={onEscalate}
                  disabled={complaint.status === 'escalated' || isBusy(`escalate-${complaint.id}`)}
                  className="bg-surface-container-high text-on-surface text-xs font-bold px-4 py-3 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  {t('support.escalate')}
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2 text-start">
                {t('support.reply_min_hint')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-tertiary-fixed text-on-tertiary-fixed p-4 rounded-xl flex gap-3 items-center">
        <span className="material-symbols-outlined text-on-tertiary-fixed-variant">lightbulb</span>
        <p className="text-xs leading-snug text-start">{t('support.driver_history_note')}</p>
      </div>
    </div>
  );
};
