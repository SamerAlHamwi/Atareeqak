import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useSupport } from '../hooks/useSupport';
import type { StatusFilter } from '../hooks/useSupport';
import { SupportStats } from '../components/SupportStats';
import { ComplaintDetails } from '../components/ComplaintDetails';

const statusBadgeClasses: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-200 text-slate-600',
  escalated: 'bg-red-100 text-red-700',
};

const Support: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();

  const {
    counts,
    isLoading,
    error,
    selectedComplaint,
    setSelectedComplaint,
    statusFilter,
    setStatusFilter,
    replyText,
    setReplyText,
    visibleComplaints,
    respondToComplaint,
    escalateComplaint,
  } = useSupport();

  const handleSendReply = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `reply-${selectedComplaint.id}`,
      action: () => respondToComplaint(selectedComplaint, replyText.trim(), 'in_review'),
      successMessage: t('support.reply_success', { user: selectedComplaint.user }),
      errorMessage: t('support.reply_failed'),
      onSuccess: () => setReplyText(''),
    });
  }, [selectedComplaint, replyText, respondToComplaint, setReplyText, runAction, t]);

  const handleResolve = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `resolve-${selectedComplaint.id}`,
      action: () => respondToComplaint(selectedComplaint, replyText.trim(), 'resolved'),
      successMessage: t('support.resolve_success', { id: selectedComplaint.id }),
      errorMessage: t('support.resolve_failed'),
      onSuccess: () => setReplyText(''),
    });
  }, [selectedComplaint, replyText, respondToComplaint, setReplyText, runAction, t]);

  const handleEscalate = useCallback(async () => {
    if (!selectedComplaint) return;
    const reason =
      replyText.trim().length >= 10 ? replyText.trim() : t('support.escalate_reason_default');
    await runAction({
      key: `escalate-${selectedComplaint.id}`,
      action: () => escalateComplaint(selectedComplaint, reason),
      successMessage: t('support.escalate_success', { id: selectedComplaint.id }),
      errorMessage: t('support.escalate_failed'),
      onSuccess: () => setReplyText(''),
    });
  }, [selectedComplaint, replyText, escalateComplaint, setReplyText, runAction, t]);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      )}

      {/* Summary Stats */}
      <SupportStats counts={counts} isLoading={isLoading} />

      {/* Main Workspace Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Complaints Table List */}
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 bg-surface-container-lowest border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-on-surface">{t('support.filter_by')}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer"
              >
                <option value="all">{t('support.all_statuses')}</option>
                <option value="pending">{t('support.pending')}</option>
                <option value="in_review">{t('support.in_review')}</option>
                <option value="resolved">{t('support.resolved')}</option>
                <option value="closed">{t('support.closed')}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-separate border-spacing-y-3 px-6">
              <thead>
                <tr className="text-on-surface-variant text-xs font-semibold">
                  <th className="py-4 pr-4 text-start">{t('support.table_id')}</th>
                  <th className="py-4 text-start">{t('support.table_user')}</th>
                  <th className="py-4 text-start">{t('support.table_category')}</th>
                  <th className="py-4 text-start">{t('support.table_date')}</th>
                  <th className="py-4 text-start">{t('support.table_status')}</th>
                  <th className="py-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : visibleComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      {t('common.no_data')}
                    </td>
                  </tr>
                ) : (
                  visibleComplaints.map((cmp) => (
                    <tr
                      key={cmp.id}
                      onClick={() => setSelectedComplaint(cmp)}
                      className={`bg-surface-container-lowest hover:bg-slate-50 transition-colors cursor-pointer group rounded-lg ${
                        selectedComplaint?.id === cmp.id ? 'border-r-4 border-secondary' : ''
                      }`}
                    >
                      <td
                        className={`py-4 ${
                          isRtl ? 'pr-4 rounded-r-lg' : 'pl-4 rounded-l-lg'
                        } font-bold text-primary text-sm`}
                      >
                        {cmp.id}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                            <img className="w-full h-full object-cover" src={cmp.userAvatar} alt={cmp.user} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-start">{cmp.user}</p>
                            <p className="text-[10px] text-on-surface-variant italic text-start">
                              {cmp.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-start">
                        <span className="text-xs text-on-surface-variant">{cmp.category}</span>
                      </td>
                      <td className="py-4 text-start">
                        <span className="text-xs text-on-surface-variant">{cmp.date}</span>
                      </td>
                      <td className="py-4 text-start">
                        <span
                          className={`text-[10px] px-3 py-1 rounded-full font-bold ${
                            statusBadgeClasses[cmp.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t(`support.${cmp.status}`)}
                        </span>
                      </td>
                      <td
                        className={`py-4 ${
                          isRtl ? 'pl-4 rounded-l-lg' : 'pr-4 rounded-r-lg'
                        } text-start`}
                      >
                        <span
                          className={`material-symbols-outlined ${
                            selectedComplaint?.id === cmp.id ? 'text-secondary' : 'text-slate-300'
                          } group-hover:text-secondary transition-all`}
                        >
                          {isRtl ? 'chevron_left' : 'chevron_right'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Complaint Details View */}
        <ComplaintDetails
          complaint={selectedComplaint}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendReply={handleSendReply}
          onResolve={handleResolve}
          onEscalate={handleEscalate}
          isBusy={isBusy}
        />
      </section>
    </div>
  );
};

export default Support;
