import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import Avatar from '../../shared/components/Avatar';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import type { ConfirmActionPayload } from '../../shared/components/ConfirmActionModal';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import FilterTabs from '../../shared/components/FilterTabs';
import type { FilterTabItem } from '../../shared/components/FilterTabs';
import PerPageSelect from '../../shared/components/PerPageSelect';
import TablePagination from '../../shared/components/TablePagination';
import TableSkeleton from '../../shared/components/TableSkeleton';
import {
  useUsers,
  isBannedUser,
  USER_TYPE_FILTERS,
  USER_STATUS_FILTERS,
  USER_DATE_FILTERS,
  USERS_PER_PAGE_OPTIONS,
} from '../hooks/useUsers';
import type { UserRow, UserStatusFilter } from '../hooks/useUsers';

/**
 * Five statuses, not three: `AdminUserService::resolveUserStatus()` also returns
 * `rejected` and `unverified`, which previously fell through the badge map and
 * rendered a raw i18n key.
 */
const statusBadgeClasses = (status: UserRow['status']): string => {
  switch (status) {
    case 'verified':
      return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    case 'pending':
      return 'bg-surface-container-high text-on-surface-variant';
    case 'banned':
    case 'rejected':
      return 'bg-error-container text-error';
    default:
      return 'bg-surface-container-high text-on-surface-variant';
  }
};

const Users: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const isRtl = i18n.language === 'ar';

  const {
    users,
    counts,
    stats,
    adminPhoto,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    search,
    setSearch,
    page,
    setPage,
    perPage,
    setPerPage,
    lastPage,
    total,
    isLoading,
    error,
    isForbidden,
    refetch,
    banUser,
    unbanUser,
  } = useUsers();

  const statusTabs = useMemo<FilterTabItem<UserStatusFilter>[]>(
    () =>
      USER_STATUS_FILTERS.map((filter) => ({
        value: filter,
        label: t(`users.filter_status_${filter}`),
        count: counts ? counts[filter] : undefined,
      })),
    [counts, t]
  );

  const closePanel = () => setSelectedUser(null);

  const statusLabel = (status: UserRow['status']) => t(`users.status_${status}`);

  const handleUnban = async (user: UserRow) => {
    await runAction({
      key: `status-${user.id}`,
      action: () => unbanUser(user),
      successMessage: t('users.unban_success', { name: user.name }),
      errorMessage: t('users.status_update_failed'),
    });
  };

  const handleToggleStatus = async (user: UserRow) => {
    if (isBannedUser(user)) {
      await handleUnban(user);
    } else {
      setBanTarget(user);
    }
  };

  const handleConfirmBan = async ({ reason, banType, expiresAt }: ConfirmActionPayload) => {
    if (!banTarget) return;
    const user = banTarget;
    await runAction({
      key: `status-${user.id}`,
      action: () =>
        banUser(user, {
          reason,
          type: banType ?? 'permanent',
          ...(expiresAt ? { expires_at: expiresAt } : {}),
        }),
      successMessage: t('users.ban_success', { name: user.name }),
      errorMessage: t('users.status_update_failed'),
    });
    // Close either way — success and error feedback both show in the page banner
    setBanTarget(null);
  };

  const rangeInfo = (): string => {
    if (total === 0) return '';
    const from = (page - 1) * perPage + 1;
    const to = Math.min(page * perPage, total);
    // `count` drives the Arabic plural category, so it must be the total.
    return t('common.showing_range', { from, to, count: total });
  };

  /** The panel's copy of the row is stale after a ban; re-read it from the list. */
  const panelUser = selectedUser
    ? users.find((entry) => entry.id === selectedUser.id) ?? selectedUser
    : null;

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through — `services/api.ts` deliberately
  // passes 403 through untouched so this renders the same panel instead of a
  // generic ErrorBanner that implies a Retry would help.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  return (
    <div className="space-y-8 relative">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && <ErrorBanner message={error} onRetry={() => void refetch()} />}

      {/* Page Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={t('users.admin_avatar_alt')}
            photo={adminPhoto}
            size="md"
            className="hidden md:flex"
          />
          <div className="space-y-1">
            <h3 className="text-3xl font-extrabold font-headline tracking-tight text-primary">
              {t('users.active_users')}
            </h3>
            <p className="text-on-surface-variant text-sm">{t('users.subtitle')}</p>
          </div>
        </div>
        <div className="relative w-full md:max-w-xs">
          <span className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-on-surface-variant`}>
            <span className="material-symbols-outlined text-lg">search</span>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`block w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-surface-container-lowest border border-outline-variant rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
            placeholder={t('users.search_placeholder')}
            type="text"
          />
        </div>
      </section>

      {/* Stats + filters */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant">
          <label
            htmlFor="users-type-filter"
            className="text-xs font-bold text-on-surface-variant uppercase tracking-wider"
          >
            {t('users.filter_type')}
          </label>
          <select
            id="users-type-filter"
            value={typeFilter}
            disabled={isLoading}
            onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            className="bg-transparent border-none text-on-surface font-medium focus:ring-0 p-0 cursor-pointer disabled:opacity-50"
          >
            {USER_TYPE_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {t(`users.filter_type_${filter}`)}
              </option>
            ))}
          </select>
        </div>
        {/* `date` was typed in UsersListParams but never exposed until Phase 5. */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant">
          <label
            htmlFor="users-date-filter"
            className="text-xs font-bold text-on-surface-variant uppercase tracking-wider"
          >
            {t('users.filter_date')}
          </label>
          <select
            id="users-date-filter"
            value={dateFilter}
            disabled={isLoading}
            onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)}
            className="bg-transparent border-none text-on-surface font-medium focus:ring-0 p-0 cursor-pointer disabled:opacity-50"
          >
            {USER_DATE_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {t(`users.filter_date_${filter}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {t('users.suspended_users')}
          </label>
          <p className="text-2xl font-bold font-headline text-error">
            {stats ? stats.suspended_users.toLocaleString(i18n.language) : '—'}
          </p>
        </div>
        <div className="bg-primary-container p-4 rounded-2xl flex items-center justify-between text-on-primary-container shadow-lg shadow-primary/10">
          <div>
            <p className="text-xs opacity-70">{t('users.total_registered')}</p>
            <p className="text-2xl font-bold font-headline">
              {stats ? stats.total_registered.toLocaleString(i18n.language) : '—'}
            </p>
          </div>
          <span className="material-symbols-outlined text-3xl opacity-30">group</span>
        </div>
      </section>

      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          <FilterTabs
            items={statusTabs}
            active={statusFilter}
            onChange={setStatusFilter}
            disabled={isLoading}
            aria-label={t('users.filter_status')}
          />
          <PerPageSelect
            value={perPage}
            options={USERS_PER_PAGE_OPTIONS}
            onChange={setPerPage}
            disabled={isLoading}
          />
        </div>
      </section>

      {/* Users Table Section */}
      <section className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant">
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
                <TableSkeleton rows={6} cols={5} firstColAvatar />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-on-surface-variant font-medium">
                    {search ? t('users.no_results', { term: search }) : t('common.no_data')}
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
                          <Avatar name={user.name} photo={user.photo} size="sm" />
                          {user.status === 'verified' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-secondary border-2 border-surface-container-lowest rounded-full"></div>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          data-testid={isBannedUser(user) ? `user-banned-${user.id}` : undefined}
                          className={`px-3 py-1 text-xs font-bold rounded-full ${statusBadgeClasses(user.status)}`}
                        >
                          {statusLabel(user.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
                        {user.status === 'pending' && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/verifications?userId=${user.id}`);
                            }}
                            className="p-2 hover:bg-secondary/10 rounded-lg text-secondary"
                            title={t('users.verify_action')}
                          >
                            <span className="material-symbols-outlined">verified</span>
                          </button>
                        )}
                        <button
                          data-testid={`user-ban-toggle-${user.id}`}
                          onClick={async (event) => {
                            event.stopPropagation();
                            await handleToggleStatus(user);
                          }}
                          disabled={isBusy(`status-${user.id}`)}
                          className={`p-2 rounded-lg disabled:opacity-40 ${
                            isBannedUser(user)
                              ? 'hover:bg-secondary/10 text-secondary'
                              : 'hover:bg-error-container text-error'
                          }`}
                          title={isBannedUser(user) ? t('users.unban_action') : t('users.ban_action')}
                        >
                          <span className="material-symbols-outlined">
                            {isBannedUser(user) ? 'undo' : 'block'}
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
        <TablePagination
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
          info={rangeInfo()}
          isLoading={isLoading}
        />
      </section>

      {/* Ban confirmation modal (reason + permanent/temporary + expiry) */}
      <ConfirmActionModal
        open={!!banTarget}
        title={t('users.ban_modal_title', { name: banTarget?.name ?? '' })}
        description={t('users.ban_modal_description')}
        confirmLabel={t('users.ban_confirm')}
        showBanOptions
        isBusy={banTarget ? isBusy(`status-${banTarget.id}`) : false}
        onConfirm={handleConfirmBan}
        onClose={() => setBanTarget(null)}
      />

      {/* User Quick View (Side Panel) */}
      {panelUser && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]" onClick={closePanel}></div>
          <div
            className={`fixed top-0 ${isRtl ? 'left-0 border-r' : 'right-0 border-l'} h-full w-full max-w-[400px] bg-surface-container-lowest/90 backdrop-blur-3xl z-[60] shadow-2xl flex flex-col border-outline-variant/20 overflow-y-auto`}
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
                  <Avatar name={panelUser.name} photo={panelUser.photo} size="lg" className="h-28 w-28 text-3xl border-4 border-surface-container-lowest shadow-lg mx-auto" />
                  {panelUser.status === 'verified' && (
                    <div className="absolute bottom-1 right-1 p-1.5 bg-secondary text-white rounded-full border-2 border-surface-container-lowest">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-2xl font-extrabold font-headline text-primary">{panelUser.name}</h4>
                  <p className="text-on-surface-variant">{t('users.member_since', { date: panelUser.joinDate })}</p>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-4">
                <h6 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-2">{t('users.additional_info')}</h6>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl divide-y divide-outline-variant/10 shadow-sm">
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('users.table_type')}</span>
                    <span className="text-sm font-bold">{t(`users.${panelUser.type}`)}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('users.table_status')}</span>
                    <span className="text-sm font-bold">{statusLabel(panelUser.status)}</span>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('auth.email')}</span>
                    <span className="text-sm font-bold">{panelUser.email || '--'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => navigate(`/passengers/${panelUser.id}`)}
                  className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-md"
                >
                  {t('users.open_profile')}
                </button>
                {panelUser.status === 'pending' && (
                  <button
                    onClick={() => navigate(`/verifications?userId=${panelUser.id}`)}
                    className="px-4 py-3 border border-secondary text-secondary rounded-xl hover:bg-secondary/10 transition-all"
                    title={t('users.verify_action')}
                  >
                    <span className="material-symbols-outlined">verified</span>
                  </button>
                )}
                <button
                  onClick={() => void handleToggleStatus(panelUser)}
                  disabled={isBusy(`status-${panelUser.id}`)}
                  className="px-4 py-3 border border-error text-error rounded-xl hover:bg-error-container transition-all disabled:opacity-50"
                  title={isBannedUser(panelUser) ? t('users.unban_action') : t('users.ban_action')}
                >
                  <span className="material-symbols-outlined">
                    {isBannedUser(panelUser) ? 'undo' : 'block'}
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
