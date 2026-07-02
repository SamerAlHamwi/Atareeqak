import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useUsers } from '../hooks/useUsers';
import type { UserRow } from '../hooks/useUsers';

const Users: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const isRtl = i18n.language === 'ar';

  const {
    users,
    stats,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    isLoading,
    error,
    banUser,
    unbanUser,
  } = useUsers();

  const closePanel = () => setSelectedUser(null);

  const handleToggleStatus = async (user: UserRow) => {
    const isSuspended = user.status === 'suspended';
    await runAction({
      key: `status-${user.id}`,
      action: () =>
        isSuspended ? unbanUser(user) : banUser(user, t('users.ban_reason_default')),
      successMessage: isSuspended
        ? t('users.unban_success', { name: user.name })
        : t('users.ban_success', { name: user.name }),
      errorMessage: t('users.status_update_failed'),
      onSuccess: () => {
        setSelectedUser((prev) =>
          prev && prev.id === user.id
            ? { ...prev, status: isSuspended ? 'verified' : 'suspended' }
            : prev
        );
      },
    });
  };

  const paginationStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const paginationEnd = Math.min(page * perPage, total);

  const statusLabel = (status: UserRow['status']) =>
    status === 'pending'
      ? t('users.pending_review')
      : status === 'verified'
      ? t('users.verified')
      : t('users.blocked');

  return (
    <div className="space-y-8 relative">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      )}

      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-3xl font-extrabold font-headline tracking-tight text-primary">{t('users.active_users')}</h3>
          <p className="text-on-surface-variant text-sm">{t('users.subtitle')}</p>
        </div>
      </section>

      {/* Filters Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant/10">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('users.filter_type')}</label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            className="bg-transparent border-none text-on-surface font-medium focus:ring-0 p-0 cursor-pointer"
          >
            <option value="all">{t('users.all')}</option>
            <option value="driver">{t('users.driver')}</option>
            <option value="passenger">{t('users.passenger')}</option>
          </select>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant/10">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('users.filter_status')}</label>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setStatusFilter(statusFilter === 'verified' ? 'all' : 'verified')}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${statusFilter === 'verified' ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary hover:bg-secondary hover:text-white'}`}
            >
              {t('users.verified')}
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${statusFilter === 'pending' ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
            >
              {t('users.pending_review')}
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${statusFilter === 'suspended' ? 'bg-error text-white' : 'bg-error-container text-error'}`}
            >
              {t('users.blocked')}
            </button>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant/10">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('users.suspended_users')}</label>
          <p className="text-2xl font-bold font-headline text-error">
            {stats ? stats.suspended_users.toLocaleString() : '—'}
          </p>
        </div>
        <div className="bg-primary-container p-4 rounded-2xl flex items-center justify-between text-on-primary-container shadow-lg shadow-primary/10">
          <div>
            <p className="text-xs opacity-70">{t('users.total_registered')}</p>
            <p className="text-2xl font-bold font-headline">
              {stats ? stats.total_registered.toLocaleString() : '—'}
            </p>
          </div>
          <span className="material-symbols-outlined text-3xl opacity-30">group</span>
        </div>
      </section>

      {/* Users Table Section */}
      <section className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-widest border-none">
                <th className="px-8 py-5 text-start">{t('users.table_user')}</th>
                <th className="px-6 py-5 text-start">{t('users.table_type')}</th>
                <th className="px-6 py-5 text-start">{t('users.table_join_date')}</th>
                <th className="px-6 py-5 text-start">{t('users.table_status')}</th>
                <th className="px-6 py-5 ltr:text-right rtl:text-left">{t('users.table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-on-surface-variant font-medium">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-on-surface-variant font-medium">
                    {t('common.no_data')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="group hover:bg-surface-container-low transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img className="h-10 w-10 rounded-full object-cover" src={user.avatar} alt={user.name} />
                          {user.status === 'verified' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{user.name}</p>
                          <p className="text-xs text-on-surface-variant">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className={`material-symbols-outlined ${user.type === 'driver' ? 'text-secondary' : 'text-primary'} text-lg`}>
                          {user.type === 'driver' ? 'steering_wheel_heat' : 'person'}
                        </span>
                        {t(`users.${user.type}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{user.joinDate}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          user.status === 'verified'
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                            : user.status === 'pending'
                            ? 'bg-surface-container-high text-on-surface-variant'
                            : 'bg-error-container text-error'
                        }`}
                      >
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/passengers/${user.id}`);
                          }}
                          className="p-2 hover:bg-surface-container-high rounded-lg text-primary"
                          title={t('users.open_profile')}
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        <button
                          onClick={async (event) => {
                            event.stopPropagation();
                            await handleToggleStatus(user);
                          }}
                          disabled={isBusy(`status-${user.id}`)}
                          className={`p-2 rounded-lg disabled:opacity-40 ${
                            user.status === 'suspended'
                              ? 'hover:bg-secondary/10 text-secondary'
                              : 'hover:bg-error-container text-error'
                          }`}
                          title={user.status === 'suspended' ? t('users.approve') : t('users.block')}
                        >
                          <span className="material-symbols-outlined">
                            {user.status === 'suspended' ? 'undo' : 'block'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="bg-surface-container-low px-8 py-4 flex items-center justify-between border-t border-outline-variant/10">
          <span className="text-xs text-on-surface-variant">
            {t('users.pagination_info', { start: paginationStart, end: paginationEnd, total })}
          </span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
            </button>
            <span className="text-xs font-bold text-on-surface px-2">
              {page} / {lastPage}
            </span>
            <button
              onClick={() => setPage(Math.min(lastPage, page + 1))}
              disabled={page >= lastPage}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* User Quick View (Side Panel) */}
      {selectedUser && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]" onClick={closePanel}></div>
          <div
            className={`fixed top-0 ${isRtl ? 'left-0 border-r' : 'right-0 border-l'} h-full w-full max-w-[400px] bg-white/70 backdrop-blur-3xl z-[60] shadow-2xl flex flex-col border-outline-variant/20 overflow-y-auto animate-in slide-in-from-${isRtl ? 'left' : 'right'} duration-300`}
          >
            <div className="p-8 space-y-8">
              <div className="flex justify-between items-start">
                <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors" onClick={closePanel}>
                  <span className="material-symbols-outlined">close</span>
                </button>
                <span className="px-4 py-1.5 bg-secondary text-white text-xs font-bold rounded-full">{t('users.profile_panel_title')}</span>
              </div>

              <div className="text-center space-y-4">
                <div className="relative inline-block">
                  <img className="h-28 w-28 rounded-full object-cover border-4 border-white shadow-lg mx-auto" src={selectedUser.avatar} alt={selectedUser.name} />
                  {selectedUser.status === 'verified' && (
                    <div className="absolute bottom-1 right-1 p-1.5 bg-secondary text-white rounded-full border-2 border-white">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-2xl font-extrabold font-headline text-primary">{selectedUser.name}</h4>
                  <p className="text-on-surface-variant">{t('users.member_since', { date: selectedUser.joinDate })}</p>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-4">
                <h6 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-2">{t('users.additional_info')}</h6>
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl divide-y divide-outline-variant/10 shadow-sm">
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('users.table_type')}</span>
                    <span className="text-sm font-bold">{t(`users.${selectedUser.type}`)}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('users.table_status')}</span>
                    <span className="text-sm font-bold">{statusLabel(selectedUser.status)}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('auth.email')}</span>
                    <span className="text-sm font-bold">{selectedUser.email || '--'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => navigate(`/passengers/${selectedUser.id}`)}
                  className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-md"
                >
                  {t('users.open_profile')}
                </button>
                <button
                  onClick={() => void handleToggleStatus(selectedUser)}
                  disabled={isBusy(`status-${selectedUser.id}`)}
                  className="px-4 py-3 border border-error text-error rounded-xl hover:bg-error-container transition-all disabled:opacity-50"
                  title={selectedUser.status === 'suspended' ? t('users.approve') : t('users.block')}
                >
                  <span className="material-symbols-outlined">
                    {selectedUser.status === 'suspended' ? 'undo' : 'block'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Users;
