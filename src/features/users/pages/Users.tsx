import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';

interface User {
  id: string;
  name: string;
  email: string;
  type: 'driver' | 'passenger';
  joinDate: string;
  status: 'verified' | 'pending' | 'blocked';
  phone: string;
  carType?: string;
  city: string;
  rating: number;
  totalTrips: number;
  walletBalance: number;
  avatar: string;
  memberSince: string;
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'أحمد محمود',
    email: 'ahmed.m@email.com',
    type: 'driver',
    joinDate: '12 أكتوبر 2023',
    status: 'verified',
    phone: '+966 50 123 4567',
    carType: 'تويوتا كامري 2022',
    city: 'الرياض',
    rating: 4.9,
    totalTrips: 842,
    walletBalance: 1450.5,
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDA18Z5mZrjO-ChSarcRLrYML0Q7dcEEevD4B93G9JtG9X3LubkuaN58ZNi2T5NGohU7XzDoqIzIvHBKBFIMbcFZqNK3oDcUxzKvzwsS3cRd8DvGbni8XauPLy77AjIlnbsQJA3JVrG-yB661Dx_YFqfunR6AzU-oWbUysj5tybVXV6XiA9YdxP1AXw_1OzlbxlKl-BND7Y4kKcb9l6nmcPIXDqUEHKqqW2fWIrZDP3QMmTN93Zi5Hi4lQ50REAXAmiyqojQXHC7QQ',
    memberSince: 'يناير 2023',
  },
  {
    id: '2',
    name: 'سارة الكيلاني',
    email: 'sara.k@email.com',
    type: 'passenger',
    joinDate: '15 أكتوبر 2023',
    status: 'pending',
    phone: '+966 55 987 6543',
    city: 'جدة',
    rating: 4.7,
    totalTrips: 156,
    walletBalance: 240.0,
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD3H0r0hCLo64GCSbpxzVYDdAGPrqvsYarQ30L4tbOJaampRwua-QFMOmcLx0TcBWA79ZwTGBws3b9slo7QBFjRSINJd7lF-BVcHsU-aWjUUVRycHHkpOiVs9Moj9ORW35jang4CFssAuEZH7oAd1xH1ctwbgGp5HTUOhxLUvHMJQ0fw1E7PtccwGocPwzMiGvPkwpm-ZRVULL3RUGaX1drD1q8bD-qwKMa2T7w2TFRraSag65R-VHHI4hfq6CPuQqSOJ9ih1CT90o',
    memberSince: 'مارس 2023',
  },
  {
    id: '3',
    name: 'ياسين عمر',
    email: 'yasin.o@email.com',
    type: 'driver',
    joinDate: '18 أكتوبر 2023',
    status: 'blocked',
    phone: '+966 54 321 0987',
    carType: 'هيونداي إلنترا 2021',
    city: 'الدمام',
    rating: 3.2,
    totalTrips: 45,
    walletBalance: -12.5,
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAttem1e4cmCZ-flW81pfotjLayDqoHvYb0SdI8RhQrAViWrpfGWSKVnxYcTTcriZL9Fzp54L0AwvLrSLKBu7FwlPe92lF7d1c8amLJBzq_JWwYyxemE3TKpEyVXhOGJGeKABZufIZB1T-n2ecbap65O1Kgjn5jYtjizBuQc2GrBqB1aTjYUAccBR3igzCWr-q87P9-Vqd2rKr5NFmJ58JtyE9Ue7YaNxTQXYmmYGT_AcX-yUZ6tIrxOJhLZgjpoPSGnN5v1UtSeNM',
    memberSince: 'يونيو 2023',
  },
];

const Users: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | User['type']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | User['status']>('all');
  const isRtl = i18n.language === 'ar';

  const closePanel = () => setSelectedUser(null);

  const visibleUsers = useMemo(() => users.filter((user) => {
    const typePass = typeFilter === 'all' || user.type === typeFilter;
    const statusPass = statusFilter === 'all' || user.status === statusFilter;
    return typePass && statusPass;
  }), [statusFilter, typeFilter, users]);

  const createDemoUser = async () => {
    await runAction({
      key: 'add-user',
      successMessage: 'User draft created and ready for API sync.',
      errorMessage: 'Could not create user draft.',
      onSuccess: () => {
        setUsers((prev) => [{
          id: String(Date.now()),
          name: 'مستخدم جديد',
          email: `new.user.${prev.length + 1}@email.com`,
          type: prev.length % 2 === 0 ? 'driver' : 'passenger',
          joinDate: '20 أبريل 2026',
          status: 'pending',
          phone: '+966 50 000 0000',
          city: 'الرياض',
          rating: 4.5,
          totalTrips: 0,
          walletBalance: 0,
          avatar: 'https://i.pravatar.cc/120?u=new-user',
          memberSince: 'أبريل 2026',
        }, ...prev]);
      },
    });
  };

  return (
    <div className="space-y-8 relative">
      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
          feedback.tone === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : feedback.tone === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <span>{feedback.message}</span>
            <button onClick={clearFeedback} className="text-xs underline underline-offset-2">Dismiss</button>
          </div>
        </div>
      )}

      {/* Page Header & Actions */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-3xl font-extrabold font-headline tracking-tight text-primary">{t('users.active_users')}</h3>
          <p className="text-on-surface-variant text-sm">{t('users.subtitle')}</p>
        </div>
        <button
          onClick={createDemoUser}
          disabled={isBusy('add-user')}
          className="bg-primary hover:opacity-90 text-on-primary px-6 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all shadow-lg shadow-primary/20 self-start md:self-auto disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>{isBusy('add-user') ? 'Creating...' : t('users.add_user')}</span>
        </button>
      </section>

      {/* Filters Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant/10">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('users.filter_type')}</label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | User['type'])}
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
              onClick={() => setStatusFilter(statusFilter === 'blocked' ? 'all' : 'blocked')}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${statusFilter === 'blocked' ? 'bg-error text-white' : 'bg-error-container text-error'}`}
            >
              {t('users.blocked')}
            </button>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-2xl flex flex-col gap-2 border border-outline-variant/10">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('users.filter_date')}</label>
          <span className="text-sm font-medium text-on-surface flex items-center gap-2 cursor-pointer">
            {t('users.last_30_days')}
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </span>
        </div>
        <div className="bg-primary-container p-4 rounded-2xl flex items-center justify-between text-on-primary-container shadow-lg shadow-primary/10">
          <div>
            <p className="text-xs opacity-70">{t('users.total_registered')}</p>
                <p className="text-2xl font-bold font-headline">{users.length.toLocaleString()}</p>
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
              {visibleUsers.map((user) => (
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
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full`}></div>
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
                      {t(`users.${user.status === 'pending' ? 'pending_review' : user.status === 'verified' ? 'verified' : 'blocked'}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedUser(user);
                        }}
                        className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant"
                        title={t('users.view_docs')}
                      >
                        <span className="material-symbols-outlined">description</span>
                      </button>
                      <button
                        onClick={async (event) => {
                          event.stopPropagation();
                          await runAction({
                            key: `edit-${user.id}`,
                            successMessage: `${user.name} profile prepared for editing.`,
                            errorMessage: 'Failed to load profile editor.',
                          });
                        }}
                        disabled={isBusy(`edit-${user.id}`)}
                        className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant disabled:opacity-40"
                        title={t('users.edit')}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={async (event) => {
                          event.stopPropagation();
                          await runAction({
                            key: `status-${user.id}`,
                            successMessage: user.status === 'blocked' ? 'User unblocked successfully.' : 'User blocked successfully.',
                            errorMessage: 'Status update failed.',
                            onSuccess: () => {
                              setUsers((prev) => prev.map((entry) => {
                                if (entry.id !== user.id) {
                                  return entry;
                                }
                                return {
                                  ...entry,
                                  status: entry.status === 'blocked' ? 'verified' : 'blocked',
                                };
                              }));
                            },
                          });
                        }}
                        disabled={isBusy(`status-${user.id}`)}
                        className="p-2 hover:bg-error-container text-error rounded-lg disabled:opacity-40"
                        title={t('users.block')}
                      >
                        <span className="material-symbols-outlined">block</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="bg-surface-container-low px-8 py-4 flex items-center justify-between border-t border-outline-variant/10">
          <span className="text-xs text-on-surface-variant">
            {t('users.pagination_info', { start: 1, end: 10, total: 1240 })}
          </span>
          <div className="flex gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-on-primary text-xs font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant text-xs font-bold">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant text-xs font-bold">3</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Detailed User Profile View (Side Panel Modal Design) */}
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
                  <p className="text-on-surface-variant">{t('users.member_since', { date: selectedUser.memberSince })}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low p-5 rounded-3xl text-center shadow-sm">
                  <span className="material-symbols-outlined text-secondary mb-2">star</span>
                  <p className="text-xl font-bold">{selectedUser.rating}</p>
                  <p className="text-xs text-on-surface-variant uppercase tracking-tighter">{t('users.rating')}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-3xl text-center shadow-sm">
                  <span className="material-symbols-outlined text-primary mb-2">route</span>
                  <p className="text-xl font-bold">{selectedUser.totalTrips}</p>
                  <p className="text-xs text-on-surface-variant uppercase tracking-tighter">{t('users.total_trips')}</p>
                </div>
              </div>

              {/* Wallet Card */}
              <div className="bg-primary-container text-on-primary-container p-6 rounded-3xl relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                  <p className="text-xs opacity-70 mb-1">{t('users.wallet_balance')}</p>
                  <h5 className="text-3xl font-extrabold font-headline">
                    {selectedUser.walletBalance.toLocaleString()} {t('users.currency')}
                  </h5>
                </div>
                <span className="material-symbols-outlined absolute -bottom-4 ltr:-right-4 rtl:-left-4 text-8xl opacity-10">
                  account_balance_wallet
                </span>
              </div>

              {/* User Details List */}
              <div className="space-y-4">
                <h6 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-2">{t('users.additional_info')}</h6>
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl divide-y divide-outline-variant/10 shadow-sm">
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('users.phone')}</span>
                    <span className="text-sm font-bold ltr:font-mono">{selectedUser.phone}</span>
                  </div>
                  {selectedUser.carType && (
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-sm text-on-surface-variant">{t('users.car_type')}</span>
                      <span className="text-sm font-bold">{selectedUser.carType}</span>
                    </div>
                  )}
                  <div className="p-4 flex justify-between items-center">
                    <span className="text-sm text-on-surface-variant">{t('users.city')}</span>
                    <span className="text-sm font-bold">{selectedUser.city}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={async () => {
                    if (!selectedUser) {
                      return;
                    }
                    await runAction({
                      key: `panel-edit-${selectedUser.id}`,
                      successMessage: 'Profile changes queued for update API.',
                      errorMessage: 'Could not save profile changes.',
                    });
                  }}
                  disabled={!selectedUser || isBusy(`panel-edit-${selectedUser?.id ?? ''}`)}
                  className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-md disabled:opacity-50"
                >
                  {t('users.edit_profile')}
                </button>
                <button
                  onClick={async () => {
                    if (!selectedUser) {
                      return;
                    }
                    await runAction({
                      key: `panel-block-${selectedUser.id}`,
                      successMessage: `${selectedUser.name} status updated from profile panel.`,
                      errorMessage: 'Unable to update user status.',
                    });
                  }}
                  disabled={!selectedUser || isBusy(`panel-block-${selectedUser?.id ?? ''}`)}
                  className="px-4 py-3 border border-error text-error rounded-xl hover:bg-error-container transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">block</span>
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
