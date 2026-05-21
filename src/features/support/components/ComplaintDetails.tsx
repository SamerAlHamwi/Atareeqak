import React from 'react';
import { useTranslation } from 'react-i18next';
import { Complaint } from '../hooks/useSupport';

interface ComplaintDetailsProps {
  complaint: Complaint | null;
  replyText: string;
  setReplyText: (text: string) => void;
  onSendReply: () => void;
  onEscalate: () => void;
  onHideComment: () => void;
  onSecurityReview: () => void;
  isBusy: (key: string) => boolean;
}

export const ComplaintDetails: React.FC<ComplaintDetailsProps> = ({
  complaint,
  replyText,
  setReplyText,
  onSendReply,
  onEscalate,
  onHideComment,
  onSecurityReview,
  isBusy,
}) => {
  const { t } = useTranslation();

  if (!complaint) {
    return (
      <div className="lg:col-span-4 flex items-center justify-center p-12 text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/10">
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

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
              {t('support.status_active')}
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
              <p className="text-xs opacity-80">
                {t(`users.${complaint.userType}`)} • {complaint.userRating} {t('support.rating')}
              </p>
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
              <p className="text-[10px] text-on-surface-variant">{t('support.trip_id')}</p>
              <p className="text-xs font-bold text-secondary">{complaint.tripId}</p>
            </div>
            <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
              <p className="text-[10px] text-on-surface-variant">{t('support.location')}</p>
              <p className="text-xs font-bold">{complaint.location}</p>
            </div>
          </div>

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
                disabled={!replyText.trim() || isBusy(`reply-${complaint.id}`)}
                className="flex-1 bg-secondary text-on-secondary text-xs font-bold py-3 rounded-lg hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-sm shadow-secondary/20 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                {t('support.send_reply')}
              </button>
              <button
                onClick={onEscalate}
                disabled={isBusy(`escalate-${complaint.id}`)}
                className="bg-surface-container-high text-on-surface text-xs font-bold px-4 py-3 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                {t('support.escalate')}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-outline-variant/20">
            <p className="text-[10px] text-on-surface-variant mb-3 uppercase font-bold tracking-tight text-start">
              {t('support.moderation_tools')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onHideComment}
                disabled={isBusy(`hide-${complaint.id}`)}
                className="flex items-center gap-2 text-[11px] font-bold text-error border border-error/20 px-3 py-2 rounded-lg hover:bg-error-container/50 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">visibility_off</span>
                {t('support.hide_comment')}
              </button>
              <button
                onClick={onSecurityReview}
                disabled={isBusy(`review-${complaint.id}`)}
                className="flex items-center gap-2 text-[11px] font-bold text-indigo-900 border border-indigo-900/20 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">gavel</span>
                {t('support.security_review')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-tertiary-fixed text-on-tertiary-fixed p-4 rounded-xl flex gap-3 items-center">
        <span className="material-symbols-outlined text-on-tertiary-fixed-variant">lightbulb</span>
        <p className="text-xs leading-snug text-start">{t('support.driver_history_note')}</p>
      </div>
    </div>
  );
};
