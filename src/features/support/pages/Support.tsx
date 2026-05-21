import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useSupport } from '../hooks/useSupport';
import type { StatusFilter } from '../hooks/useSupport';
import { SupportStats } from '../components/SupportStats';
import { ComplaintDetails } from '../components/ComplaintDetails';

const Support: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  const {
    isLoading,
    selectedComplaint,
    setSelectedComplaint,
    statusFilter,
    setStatusFilter,
    replyText,
    setReplyText,
    visibleComplaints,
    markComplaintAsProcessing,
  } = useSupport();

  const handleAdvancedFilter = useCallback(async () => {
    await runAction({
      key: 'advanced-filter',
      successMessage: 'Advanced filters loaded. API endpoint can be attached next.',
      errorMessage: 'Could not load advanced filters.',
    });
  }, [runAction]);

  const handleSendReply = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `reply-${selectedComplaint.id}`,
      successMessage: `Reply sent to ${selectedComplaint.user}.`,
      errorMessage: 'Reply could not be sent.',
      onSuccess: () => {
        markComplaintAsProcessing(selectedComplaint.id);
        setReplyText('');
      },
    });
  }, [selectedComplaint, markComplaintAsProcessing, setReplyText, runAction]);

  const handleEscalate = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `escalate-${selectedComplaint.id}`,
      successMessage: `${selectedComplaint.id} escalated to security team.`,
      errorMessage: 'Escalation failed.',
    });
  }, [selectedComplaint, runAction]);

  const handleHideComment = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `hide-${selectedComplaint.id}`,
      successMessage: 'Comment hidden successfully.',
      errorMessage: 'Could not hide comment.',
    });
  }, [selectedComplaint, runAction]);

  const handleSecurityReview = useCallback(async () => {
    if (!selectedComplaint) return;
    await runAction({
      key: `review-${selectedComplaint.id}`,
      successMessage: 'Security review requested.',
      errorMessage: 'Could not request security review.',
    });
  }, [selectedComplaint, runAction]);

  const handleNewNote = useCallback(async () => {
    await runAction({
      key: 'new-complaint-note',
      successMessage: 'Quick complaint note opened.',
      errorMessage: 'Could not open quick note.',
    });
  }, [runAction]);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/* Summary Stats */}
      <SupportStats />

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
                <option value="processing">{t('support.processing')}</option>
                <option value="resolved">{t('support.resolved')}</option>
              </select>
              <select className="bg-surface border-none text-xs rounded-full px-4 py-2 ring-1 ring-outline-variant/30 focus:ring-secondary cursor-pointer">
                <option>{t('support.all_categories')}</option>
                <option>{t('support.category_harassment')}</option>
                <option>{t('support.category_technical')}</option>
                <option>{t('support.category_pricing')}</option>
                <option>{t('support.category_driver_behavior')}</option>
              </select>
            </div>
            <button
              onClick={handleAdvancedFilter}
              disabled={isBusy('advanced-filter')}
              className="flex items-center gap-2 text-xs font-bold text-secondary px-4 py-2 hover:bg-secondary/5 rounded-full transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">filter_list</span>
              {t('support.advanced_filter')}
            </button>
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
                      {t('common.loading', 'Loading...')}
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
                              {t(`users.${cmp.userType}`)}
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
                            cmp.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : cmp.status === 'processing'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-teal-100 text-teal-700'
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
          <div className="p-6 bg-surface-container-lowest text-center border-t border-outline-variant/10">
            <button className="text-xs font-bold text-on-surface-variant hover:text-primary transition-all underline underline-offset-4">
              {t('support.view_more')}
            </button>
          </div>
        </div>

        {/* Complaint Details View */}
        <ComplaintDetails
          complaint={selectedComplaint}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendReply={handleSendReply}
          onEscalate={handleEscalate}
          onHideComment={handleHideComment}
          onSecurityReview={handleSecurityReview}
          isBusy={isBusy}
        />
      </section>

      {/* Floating Action Button */}
      <button
        onClick={handleNewNote}
        disabled={isBusy('new-complaint-note')}
        className="fixed bottom-8 ltr:right-8 rtl:left-8 bg-secondary text-white p-4 rounded-full shadow-xl shadow-secondary/40 hover:scale-110 transition-transform z-50 flex items-center justify-center active:scale-95 disabled:opacity-50"
      >
        <span className="material-symbols-outlined">add_comment</span>
      </button>
    </div>
  );
};

export default Support;
