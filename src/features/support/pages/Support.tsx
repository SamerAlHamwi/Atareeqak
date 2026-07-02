import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useSupport } from '../hooks/useSupport';
import type { StatusFilter, SupportView } from '../hooks/useSupport';
import { SupportStats } from '../components/SupportStats';
import { ComplaintDetails } from '../components/ComplaintDetails';

const statusBadgeClasses: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-200 text-slate-600',
  escalated: 'bg-red-100 text-red-700',
};

const inboxStatusOptions: StatusFilter[] = ['pending', 'in_review', 'resolved', 'closed'];
const escalatedStatusOptions: StatusFilter[] = ['escalated', 'resolved', 'closed'];

const Support: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();

  const {
    counts,
    escalatedCounts,
    isLoading,
    error,
    selectedComplaint,
    setSelectedComplaint,
    statusFilter,
    setStatusFilter,
    view,
    setView,
    replyText,
    setReplyText,
    visibleComplaints,
    respondToComplaint,
    escalateComplaint,
    resolveEscalatedComplaint,
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
      action: () =>
        view === 'escalated'
          ? resolveEscalatedComplaint(selectedComplaint, replyText.trim(), 'resolved')
          : respondToComplaint(selectedComplaint, replyText.trim(), 'resolved'),
      successMessage: t('support.resolve_success', { id: selectedComplaint.id }),
      errorMessage: t('support.resolve_failed'),
      onSuccess: () => setReplyText(''),
    });
  }, [
    selectedComplaint,
    replyText,
    view,
    respondToComplaint,
    resolveEscalatedComplaint,
    setReplyText,
    runAction,
    t,
  ]);

  const handleCloseComplaint = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `close-${selectedComplaint.id}`,
      action: () => resolveEscalatedComplaint(selectedComplaint, replyText.trim(), 'closed'),
      successMessage: t('support.close_success', { id: selectedComplaint.id }),
      errorMessage: t('support.close_failed'),
      onSuccess: () => setReplyText(''),
    });
  }, [selectedComplaint, replyText, resolveEscalatedComplaint, setReplyText, runAction, t]);

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

  const statusOptions = view === 'escalated' ? escalatedStatusOptions : inboxStatusOptions;

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      )}

      {/* View Tabs */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex p-1 bg-surface-container-low rounded-xl">
          {(['inbox', 'escalated'] as SupportView[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                view === tab
                  ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {tab === 'inbox' ? 'inbox' : 'priority_high'}
              </span>
              {t(`support.tab_${tab}`)}
              {tab === 'escalated' && escalatedCounts && escalatedCounts.escalated > 0 && (
                <span className="bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {escalatedCounts.escalated}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Summary Stats (global complaint counts) */}
      <SupportStats counts={counts} isLoading={isLoading && !counts} />

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
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {t(`support.${status}`)}
                  </option>
                ))}
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
                      {view === 'escalated' ? t('support.no_escalated') : t('common.no_data')}
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
          mode={view}
          onCloseComplaint={handleCloseComplaint}
        />
      </section>
    </div>
  );
};

export default Support;
