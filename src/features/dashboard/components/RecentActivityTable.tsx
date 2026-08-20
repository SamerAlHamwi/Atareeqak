import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import TableSkeleton from '../../shared/components/TableSkeleton';
import type { DashboardActivityRow } from '../hooks/useDashboard';

interface RecentActivityTableProps {
  rows: DashboardActivityRow[];
  isLoading: boolean;
}

/**
 * Booking statuses returned by GET /admin/dashboard (recent_activities[].status).
 * Anything unmapped falls back to neutral styling and the raw value, so a new
 * backend status degrades instead of rendering an empty badge.
 */
const STATUS_CLASSES: Record<string, string> = {
  completed: 'bg-secondary-container/40 text-on-secondary-container',
  confirmed: 'bg-secondary-container/40 text-on-secondary-container',
  active: 'bg-secondary-container/40 text-on-secondary-container',
  pending: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  cancelled: 'bg-error-container text-on-error-container',
  no_show: 'bg-error-container text-on-error-container',
};

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ rows, isLoading }) => {
  const { t } = useTranslation();

  return (
    <section className="col-span-12 bg-surface-container-lowest p-10 rounded-[2.5rem] shadow-sm border border-outline-variant/30">
      <div className="flex items-center justify-between mb-12">
        <h3 className="text-2xl font-black text-primary">{t('dashboard.recent_activities')}</h3>
        <Link
          to="/trips"
          className="text-secondary text-sm font-black hover:underline underline-offset-8 transition-all"
        >
          {t('dashboard.view_all')}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-start">
          <thead>
            <tr className="text-on-surface-variant text-xs font-black border-b border-outline-variant/20 uppercase tracking-widest">
              <th className="pb-8 pe-6 font-black text-start">{t('dashboard.table_user')}</th>
              <th className="pb-8 font-black text-center">{t('dashboard.table_driver')}</th>
              <th className="pb-8 font-black text-center">{t('dashboard.table_route')}</th>
              <th className="pb-8 font-black text-center">{t('dashboard.table_date')}</th>
              <th className="pb-8 font-black text-center">{t('dashboard.table_status')}</th>
              <th className="pb-8 ps-6 font-black text-end">{t('dashboard.table_value')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} firstColAvatar />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <Receipt size={48} className="opacity-40" />
                    <p className="text-sm font-bold">{t('dashboard.activities_empty')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.bookingId} className="group hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-8 pe-6">
                    {row.userId !== null ? (
                      <Link
                        to={`/passengers/${row.userId}`}
                        className="flex items-center gap-4 group/user w-fit"
                      >
                        {/* The payload carries no avatar URL, so initials stand in. */}
                        <div className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-sm font-black shrink-0">
                          {row.userInitials}
                        </div>
                        <div>
                          <p className="text-[15px] font-black text-on-surface leading-tight group-hover/user:underline">
                            {row.userName}
                          </p>
                          <p className="text-[11px] font-bold text-on-surface-variant mt-1.5">
                            {t('dashboard.phone_label')}: {row.userNumber}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-sm font-black shrink-0">
                          {row.userInitials}
                        </div>
                        <div>
                          <p className="text-[15px] font-black text-on-surface leading-tight">
                            {row.userName}
                          </p>
                          <p className="text-[11px] font-bold text-on-surface-variant mt-1.5">
                            {t('dashboard.phone_label')}: {row.userNumber}
                          </p>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-8 text-[15px] font-bold text-on-surface-variant text-center">
                    {row.driver}
                  </td>
                  <td className="py-8 text-[15px] font-bold text-on-surface-variant text-center">
                    {row.route}
                  </td>
                  <td className="py-8 text-[14px] font-bold text-on-surface-variant text-center whitespace-nowrap">
                    {row.dateLabel}
                  </td>
                  <td className="py-8 text-center">
                    <span
                      className={`px-5 py-2 rounded-full text-[11px] font-black ${
                        STATUS_CLASSES[row.status] ?? 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {t(`dashboard.status.${row.status}`, row.status)}
                    </span>
                  </td>
                  <td className="py-8 ps-6 text-[15px] font-black text-on-surface text-end whitespace-nowrap">
                    {row.value}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
