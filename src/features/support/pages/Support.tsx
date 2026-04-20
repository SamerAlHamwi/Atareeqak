import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';

interface Complaint {
  id: string;
  user: string;
  userType: 'driver' | 'passenger';
  userAvatar: string;
  category: string;
  date: string;
  status: 'pending' | 'processing' | 'resolved';
  content: string;
  tripId: string;
  location: string;
  userRating: string;
}

const mockComplaints: Complaint[] = [
  {
    id: '#CMP-9042',
    user: 'سارة حسن',
    userType: 'passenger',
    userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBkbB6v3yo8UqkoxrWowwAMVnOmF5xz32zrl1r8iwKodUmXs-eoKekMNmn8XkTJrCi6t4nCeWoi3s-aJnqlVmvxNMyf5ID1ieovSo1j3_RO-AkA_qSGwbP7vT-rJpH8PSqapPNtyT1MWOO_ytfcWdExvqvTR18HqtePNmsEIiYbQnrgPAPa6V0WsYWi5Ohh91JGpcyGhFzU5RPc1glMneseqMlEo9ZNRbN6XeqbajZim-U3n0XwkkdlisJ1nkcnPO86GM3p6RV63CI',
    category: 'تحرش لفظي',
    date: '12 أكتوبر 2023',
    status: 'pending',
    content: 'مرحباً، أواجه مشكلة في سلوك السائق...',
    tripId: 'TRIP-X991',
    location: 'الرياض، حي النخيل',
    userRating: '4.5',
  },
  {
    id: '#CMP-8812',
    user: 'خالد محمود',
    userType: 'driver',
    userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjNPvCkf6LVe6OlZ5vuOq1_rqod8s4qaHD_8WtI4P31kSaYj9A4qlBiazCPgDB4SXLYDlDwfInh0Oeel6wEAs7T5BFEoItm9-kEYlbc7ixrBLzHxwd7fvnrgrFHW_AeiIHz_toHqP3KuZ0710Sbs1qWgDGy9e8mGF4GNSzyqZ-dn0FUOQY4G0H_qmJX2fafC5oGo9AEvQ2sapSHh-Hagv7jN-jqd6W_zTjnAoIqq9rH3OnK_SGx8Ek6dyc9oChC39tgLw9n-oGTsM',
    category: 'خطأ في التسعير',
    date: '12 أكتوبر 2023',
    status: 'processing',
    content: '"مرحباً، أواجه مشكلة في احتساب قيمة الرحلة رقم TRIP-X992. تم خصم مبلغ 45 ريال بينما السعر المتفق عليه كان 30 ريال. الرجاء المراجعة وتعديل الرصيد."',
    tripId: 'TRIP-X992',
    location: 'الرياض، حي النخيل',
    userRating: '4.8',
  },
  {
    id: '#CMP-8750',
    user: 'ياسين علي',
    userType: 'passenger',
    userAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbFOCGjCqsPpKkryLvFgS000rOVTo_Ul02KwvFWanmDtS8L8Mx8dZ1hcOWHlqcjUlBNfef0_S1EJrQ8LIYL-2zkk-wjT7kzol7SCaqDbMvOLHvdj8l7smoRQ2kykSZGg7HbbKf2c5YnwcvwER3PvTkXdDHM3Bhy5a1s-lDuh56fOLUKX0Fckqpwq1jnB_JzyOByveOA7gFfwPyK4rdUFuGA7uvEHWuskmxsEQgwYl6tBm15RriQCaumWdy7Yf-uhwH0a5pnFpy46Q',
    category: 'مشكلة تقنية (التطبيق)',
    date: '11 أكتوبر 2023',
    status: 'resolved',
    content: 'التطبيق يتوقف فجأة عند اختيار الوجهة...',
    tripId: 'N/A',
    location: 'جدة',
    userRating: '5.0',
  },
];

const Support: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [complaints, setComplaints] = useState<Complaint[]>(mockComplaints);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint>(mockComplaints[1]);
  const [statusFilter, setStatusFilter] = useState<'all' | Complaint['status']>('all');
  const [replyText, setReplyText] = useState('');

  const visibleComplaints = useMemo(() => {
    if (statusFilter === 'all') {
      return complaints;
    }
    return complaints.filter((item) => item.status === statusFilter);
  }, [complaints, statusFilter]);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/* Summary Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-secondary flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">{t('support.total_open')}</p>
            <h3 className="text-4xl font-headline font-extrabold text-primary">124</h3>
          </div>
          <div className="bg-secondary/10 p-4 rounded-full">
            <span className="material-symbols-outlined text-secondary text-3xl">pending_actions</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-tertiary-fixed-variant flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">{t('support.avg_response')}</p>
            <h3 className="text-4xl font-headline font-extrabold text-primary">14 <span className="text-sm font-normal text-slate-400">{t('support.minutes')}</span></h3>
          </div>
          <div className="bg-tertiary-fixed/30 p-4 rounded-full">
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant text-3xl">timer</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-error flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">{t('support.critical_issues')}</p>
            <h3 className="text-4xl font-headline font-extrabold text-error">08</h3>
          </div>
          <div className="bg-error-container p-4 rounded-full">
            <span className="material-symbols-outlined text-error text-3xl">priority_high</span>
          </div>
        </div>
      </section>

      {/* Main Workspace Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Complaints Table List */}
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 bg-surface-container-lowest border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-on-surface">{t('support.filter_by')}</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | Complaint['status'])}
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
              onClick={async () => {
                await runAction({
                  key: 'advanced-filter',
                  successMessage: 'Advanced filters loaded. API endpoint can be attached next.',
                  errorMessage: 'Could not load advanced filters.',
                });
              }}
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
                {visibleComplaints.map((cmp) => (
                  <tr
                    key={cmp.id}
                    onClick={() => setSelectedComplaint(cmp)}
                    className={`bg-surface-container-lowest hover:bg-slate-50 transition-colors cursor-pointer group rounded-lg ${selectedComplaint.id === cmp.id ? 'border-r-4 border-secondary' : ''}`}
                  >
                    <td className={`py-4 ${isRtl ? 'pr-4 rounded-r-lg' : 'pl-4 rounded-l-lg'} font-bold text-primary text-sm`}>{cmp.id}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                          <img className="w-full h-full object-cover" src={cmp.userAvatar} alt={cmp.user} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-start">{cmp.user}</p>
                          <p className="text-[10px] text-on-surface-variant italic text-start">{t(`users.${cmp.userType}`)}</p>
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
                      <span className={`text-[10px] px-3 py-1 rounded-full font-bold ${
                        cmp.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        cmp.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {t(`support.${cmp.status}`)}
                      </span>
                    </td>
                    <td className={`py-4 ${isRtl ? 'pl-4 rounded-l-lg' : 'pr-4 rounded-r-lg'} text-start`}>
                      <span className={`material-symbols-outlined ${selectedComplaint.id === cmp.id ? 'text-secondary' : 'text-slate-300'} group-hover:text-secondary transition-all`}>
                        {isRtl ? 'chevron_left' : 'chevron_right'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-surface-container-lowest text-center border-t border-outline-variant/10">
            <button className="text-xs font-bold text-on-surface-variant hover:text-primary transition-all underline underline-offset-4">{t('support.view_more')}</button>
          </div>
        </div>

        {/* Complaint Details View */}
        <div className="lg:col-span-4 space-y-6 sticky top-24">
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/10 overflow-hidden">
            <div className="p-6 bg-primary text-on-primary">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] opacity-70 mb-1">{t('support.details_title')}</p>
                  <h4 className="text-lg font-bold">{selectedComplaint.id.replace('#', '')}</h4>
                </div>
                <span className="bg-white/20 text-[10px] px-2 py-1 rounded text-white font-bold">{t('support.status_active')}</span>
              </div>
              <div className="flex items-center gap-3">
                <img className="w-12 h-12 rounded-full border-2 border-secondary object-cover" src={selectedComplaint.userAvatar} alt={selectedComplaint.user} />
                <div className="text-start">
                  <p className="font-bold text-sm">{selectedComplaint.user}</p>
                  <p className="text-xs opacity-80">{t(`users.${selectedComplaint.userType}`)} • {selectedComplaint.userRating} {t('support.rating')}</p>
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
                  {selectedComplaint.content}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
                  <p className="text-[10px] text-on-surface-variant">{t('support.trip_id')}</p>
                  <p className="text-xs font-bold text-secondary">{selectedComplaint.tripId}</p>
                </div>
                <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
                  <p className="text-[10px] text-on-surface-variant">{t('support.location')}</p>
                  <p className="text-xs font-bold">{selectedComplaint.location}</p>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-indigo-900 mb-2 text-start">{t('support.quick_reply')}</h5>
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-secondary min-h-[100px] outline-none mb-3 text-start"
                  placeholder={t('support.reply_placeholder')}
                ></textarea>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await runAction({
                        key: `reply-${selectedComplaint.id}`,
                        successMessage: `Reply sent to ${selectedComplaint.user}.`,
                        errorMessage: 'Reply could not be sent.',
                        onSuccess: () => {
                          setComplaints((prev) => prev.map((entry) => entry.id === selectedComplaint.id ? { ...entry, status: 'processing' } : entry));
                          setSelectedComplaint((prev) => ({ ...prev, status: 'processing' }));
                          setReplyText('');
                        },
                      });
                    }}
                    disabled={!replyText.trim() || isBusy(`reply-${selectedComplaint.id}`)}
                    className="flex-1 bg-secondary text-on-secondary text-xs font-bold py-3 rounded-lg hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-sm shadow-secondary/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                    {t('support.send_reply')}
                  </button>
                  <button
                    onClick={async () => {
                      await runAction({
                        key: `escalate-${selectedComplaint.id}`,
                        successMessage: `${selectedComplaint.id} escalated to security team.`,
                        errorMessage: 'Escalation failed.',
                      });
                    }}
                    disabled={isBusy(`escalate-${selectedComplaint.id}`)}
                    className="bg-surface-container-high text-on-surface text-xs font-bold px-4 py-3 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    {t('support.escalate')}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant/20">
                <p className="text-[10px] text-on-surface-variant mb-3 uppercase font-bold tracking-tight text-start">{t('support.moderation_tools')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      await runAction({
                        key: `hide-${selectedComplaint.id}`,
                        successMessage: 'Comment hidden successfully.',
                        errorMessage: 'Could not hide comment.',
                      });
                    }}
                    disabled={isBusy(`hide-${selectedComplaint.id}`)}
                    className="flex items-center gap-2 text-[11px] font-bold text-error border border-error/20 px-3 py-2 rounded-lg hover:bg-error-container/50 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">visibility_off</span>
                    {t('support.hide_comment')}
                  </button>
                  <button
                    onClick={async () => {
                      await runAction({
                        key: `review-${selectedComplaint.id}`,
                        successMessage: 'Security review requested.',
                        errorMessage: 'Could not request security review.',
                      });
                    }}
                    disabled={isBusy(`review-${selectedComplaint.id}`)}
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
      </section>

      {/* Floating Action Button */}
      <button
        onClick={async () => {
          await runAction({
            key: 'new-complaint-note',
            successMessage: 'Quick complaint note opened.',
            errorMessage: 'Could not open quick note.',
          });
        }}
        disabled={isBusy('new-complaint-note')}
        className="fixed bottom-8 ltr:right-8 rtl:left-8 bg-secondary text-white p-4 rounded-full shadow-xl shadow-secondary/40 hover:scale-110 transition-transform z-50 flex items-center justify-center active:scale-95 disabled:opacity-50"
      >
        <span className="material-symbols-outlined">add_comment</span>
      </button>
    </div>
  );
};

export default Support;
