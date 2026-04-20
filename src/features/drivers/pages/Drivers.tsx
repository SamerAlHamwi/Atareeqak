import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';

interface Driver {
  id: string;
  name: string;
  displayId: string;
  phone: string;
  vehicle: string;
  vehicleDetails: string;
  status: 'verified' | 'pending' | 'suspended';
  rating: number | null;
  avatar: string;
}

const mockDrivers: Driver[] = [
  {
    id: '1',
    name: 'أحمد محمود الخالدي',
    displayId: '#DR-9921',
    phone: '+966 50 123 4567',
    vehicle: 'كيا سيراتو',
    vehicleDetails: '2021 | أبيض',
    status: 'verified',
    rating: 4.9,
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDD4VNGsonziGKZwtSfXpx-b6AeoCQGzLxMm0NVU_KpoKIO9SHsjpmsJaRxgVLlS99JqtWv6689ZCj8FqlGsZgNb7KRfSJk40Z0RUUGAcvtPrb9dy1J4dceA9An7d1LAzpVvr3kL0-FqeJQ5EKPgw83N0BHueXaiqm3sItl-QnDtqapN68g3Bkk-WMljSQMHjQ0pWK__Tx5-w-XFnGzM9Zcy0MoRieLl9oBqQQLHI76zV6VOZOuWAp-f6a2wS4V4-BfezQ5PJWSCsc',
  },
  {
    id: '2',
    name: 'سارة إبراهيم منصور',
    displayId: '#DR-8842',
    phone: '+966 55 987 6543',
    vehicle: 'تويوتا كامري',
    vehicleDetails: '2023 | فضي',
    status: 'pending',
    rating: null,
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpCc4srRFa_T8I4LTmZJ9ZuhjXKjaDN2fLpF-uwPYX3DfH3LPo614zcWy2oYCqoAZOPtLeL9TKMdoCwrJ2bAcigzP4dNoIuOOYe51q6LJBLmwrtzbgr-nX0klmgxh45CTIWIJ8Uj2sDcQSDpYBb9xS2Sf_0F-rucq9ShxJpGoeG18dq1QWqYK8YZQrhcLP5XTNY8vnWtwKqM8OMNbX8e6UwT9NlyR5hF4j7VC8GtPYtc512vpprlRcEomX6GXK1qnie0m9NpKWhe8',
  },
  {
    id: '3',
    name: 'خالد يوسف العلي',
    displayId: '#DR-7715',
    phone: '+966 54 555 1212',
    vehicle: 'هيونداي إلنترا',
    vehicleDetails: '2020 | أسود',
    status: 'suspended',
    rating: 4.2,
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXuZR2QuRZlghPOpPjt3-e0xsWiTyCg3cOFgQZ2wmskGGNELQ5T6LdC8FwFNbyM2aq66o64IArpucisrg8edCYhQECqvuA_tef6asEgQZYe2U82etq-2DPjloACms4fPxzapelb8UokwLizdN3Z4BIUjvZArY0-heBKUefFsxhUa9tsO9mec1wlv8mgvl5PlJH8fsNJy7L501VWqH23T9Hv5fQ6PDvv3D9cyYc7giiBOqwzJiwLdii6k85GZTxJU3aaq0UzDHUYLc',
  },
];

const Drivers: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers);
  const [statusFilter, setStatusFilter] = useState<'all' | Driver['status']>('all');
  const isRtl = i18n.language === 'ar';

  const visibleDrivers = useMemo(() => {
    if (statusFilter === 'all') {
      return drivers;
    }
    return drivers.filter((driver) => driver.status === statusFilter);
  }, [drivers, statusFilter]);

  return (
    <div className="space-y-10">
      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
          feedback.tone === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : feedback.tone === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <span>{feedback.message}</span>
            <button onClick={clearFeedback} className="text-xs underline underline-offset-2">Dismiss</button>
          </div>
        </div>
      )}

      {/* Summary Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-full">+12%</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.total_drivers')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">1,284</h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
            </div>
            <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-full">{t('dashboard.live')}</span>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.active_drivers')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">856</h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center text-error">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.pending_verifications')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">42</h2>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-xl flex flex-col justify-between h-40 group hover:translate-y-[-4px] transition-transform duration-300 border border-outline-variant/10 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">{t('drivers.avg_rating')}</p>
            <h2 className="text-3xl font-extrabold font-headline text-primary">4.85</h2>
          </div>
        </div>
      </section>

      {/* Filters & Actions */}
      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          <button className="bg-surface-container-high px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-on-surface whitespace-nowrap">
            <span className="material-symbols-outlined text-lg">filter_list</span>
            {t('drivers.filter')}
          </button>
          <div className="flex bg-surface-container-low rounded-full p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-6 py-1.5 rounded-full text-sm font-bold shadow-sm ${statusFilter === 'all' ? 'bg-surface-container-lowest text-on-surface' : 'text-on-surface-variant hover:text-on-surface transition-colors'}`}
            >
              {t('users.all')}
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-6 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === 'verified' ? 'bg-secondary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('drivers.status_verified')}
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-6 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === 'pending' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('users.pending_review')}
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-6 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === 'suspended' ? 'bg-error text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t('drivers.status_suspended')}
            </button>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={async () => {
              await runAction({
                key: 'add-driver',
                successMessage: 'Driver draft added and ready for onboarding API.',
                errorMessage: 'Could not create driver draft.',
                onSuccess: () => {
                  setDrivers((prev) => [{
                    id: String(Date.now()),
                    name: 'سائق جديد',
                    displayId: `#DR-${9000 + prev.length}`,
                    phone: '+966 50 000 1111',
                    vehicle: 'تويوتا يارس',
                    vehicleDetails: '2024 | رمادي',
                    status: 'pending',
                    rating: null,
                    avatar: 'https://i.pravatar.cc/100?u=new-driver',
                  }, ...prev]);
                },
              });
            }}
            disabled={isBusy('add-driver')}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">person_add</span>
            {isBusy('add-driver') ? 'Adding...' : t('drivers.add_new')}
          </button>
        </div>
      </section>

      {/* Data Table Section */}
      <section className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-separate border-spacing-y-0">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-xs font-bold tracking-wider">
                <th className="px-8 py-5 text-start">{t('drivers.table_driver')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_phone')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_vehicle')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_status')}</th>
                <th className="px-6 py-5 text-start">{t('drivers.table_rating')}</th>
                <th className="px-8 py-5 ltr:text-right rtl:text-left">{t('drivers.table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-sm">
              {visibleDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-surface-container/30 transition-colors group">
                  <td className="px-8 py-5 text-start">
                    <div className="flex items-center gap-3">
                      <img alt={driver.name} className="w-10 h-10 rounded-full object-cover" src={driver.avatar} />
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface">{driver.name}</span>
                        <span className="text-xs text-on-surface-variant">{t('dashboard.phone_label')}: {driver.displayId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-on-surface-variant font-medium text-start ltr:font-mono">{driver.phone}</td>
                  <td className="px-6 py-5 text-start">
                    <div className="flex flex-col">
                      <span className="text-on-surface font-medium">{driver.vehicle}</span>
                      <span className="text-xs text-on-surface-variant">{driver.vehicleDetails}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-start">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                        driver.status === 'verified'
                          ? 'bg-secondary-fixed text-on-secondary-container'
                          : driver.status === 'pending'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                          : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      {t(`drivers.status_${driver.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-start">
                    <div className={`flex items-center gap-1 ${driver.rating ? 'text-amber-500' : 'text-slate-400'}`}>
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: driver.rating ? "'FILL' 1" : "" }}>
                        {driver.rating ? 'star' : 'star_outline'}
                      </span>
                      <span className="font-bold">{driver.rating || '--'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-2">
                      <button
                        onClick={async () => {
                          await runAction({
                            key: `view-${driver.id}`,
                            successMessage: `${driver.name} profile data loaded.`,
                            errorMessage: 'Could not fetch driver profile.',
                          });
                        }}
                        disabled={isBusy(`view-${driver.id}`)}
                        className="p-2 hover:bg-surface-container-high rounded-lg text-primary transition-colors disabled:opacity-40"
                        title={t('drivers.view_profile')}
                      >
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button
                        onClick={async () => {
                          await runAction({
                            key: `edit-${driver.id}`,
                            successMessage: `Editing mode opened for ${driver.name}.`,
                            errorMessage: 'Failed to open edit mode.',
                          });
                        }}
                        disabled={isBusy(`edit-${driver.id}`)}
                        className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors disabled:opacity-40"
                        title={t('users.edit')}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={async () => {
                          await runAction({
                            key: `status-${driver.id}`,
                            successMessage: driver.status === 'suspended' ? 'Driver reactivated.' : 'Driver suspended.',
                            errorMessage: 'Failed to update driver status.',
                            onSuccess: () => {
                              setDrivers((prev) => prev.map((entry) => {
                                if (entry.id !== driver.id) {
                                  return entry;
                                }
                                return {
                                  ...entry,
                                  status: entry.status === 'suspended' ? 'verified' : 'suspended',
                                };
                              }));
                            },
                          });
                        }}
                        disabled={isBusy(`status-${driver.id}`)}
                        className={`p-2 rounded-lg transition-colors ${driver.status === 'suspended' ? 'hover:bg-secondary/10 text-secondary' : 'hover:bg-error/10 text-error'}`}
                        title={driver.status === 'suspended' ? t('users.approve') : t('users.block')}
                      >
                        <span className="material-symbols-outlined">{driver.status === 'suspended' ? 'undo' : 'block'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-8 py-6 bg-surface-container-low/30 flex items-center justify-between border-t border-outline-variant/10">
          <p className="text-xs text-on-surface-variant font-medium">
            {t('drivers.pagination_info', { start: 1, end: 10, total: 1284 })}
          </p>
          <div className="flex gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-on-primary text-xs font-bold">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-xs font-medium border border-outline-variant/10">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high text-xs font-medium border border-outline-variant/10">3</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Secondary High-End Widget Section (Asymmetric) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (Editorial Style) */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-lg font-bold mb-6 font-headline text-primary">{t('drivers.recent_activity')}</h3>
          <div className="space-y-6">
            <div className="flex gap-4 relative">
              <div className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-8 bottom-0 w-[2px] bg-outline-variant/20`}></div>
              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center z-10 shrink-0">
                <span className="material-symbols-outlined text-sm">check_circle</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold">{t('drivers.activity_verified', { name: 'عمر العتيبي' })}</p>
                <p className="text-xs text-on-surface-variant">{t('drivers.time_ago.minutes', { count: 15 })} {t('drivers.by_system')}</p>
              </div>
            </div>
            <div className="flex gap-4 relative">
              <div className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-8 bottom-0 w-[2px] bg-outline-variant/20`}></div>
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center z-10 shrink-0 text-primary">
                <span className="material-symbols-outlined text-sm">edit_square</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold">{t('drivers.activity_updated', { name: 'سارة إبراهيم' })}</p>
                <p className="text-xs text-on-surface-variant">{t('drivers.time_ago.hours', { count: 2 })} {t('drivers.by_admin')}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-error-container/40 flex items-center justify-center z-10 shrink-0 text-error">
                <span className="material-symbols-outlined text-sm">warning</span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold">{t('drivers.activity_warning', { name: 'فهد الشمري' })}</p>
                <p className="text-xs text-on-surface-variant">{t('drivers.time_ago.hours', { count: 4 })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Funnel Map/Visual (Concept) */}
        <div className="bg-primary p-8 rounded-2xl text-on-primary flex flex-col justify-between overflow-hidden relative shadow-lg shadow-primary/20">
          {/* Abstract Background Shape */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-on-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h3 className="text-lg font-bold mb-2 font-headline">{t('drivers.efficiency_title')}</h3>
            <p className="text-sm opacity-80 mb-6">{t('drivers.efficiency_subtitle')}</p>
            <div className="text-4xl font-extrabold font-headline mb-4">92%</div>
            <div className="w-full bg-on-primary/20 h-2 rounded-full mb-2">
              <div className="bg-secondary-fixed h-full rounded-full transition-all duration-1000" style={{ width: '92%' }}></div>
            </div>
            <p className="text-xs font-medium">{t('drivers.efficiency_growth', { percent: 5 })}</p>
          </div>
          <button
            onClick={async () => {
              await runAction({
                key: 'download-driver-report',
                successMessage: 'Driver performance report export queued.',
                errorMessage: 'Could not start report export.',
              });
            }}
            disabled={isBusy('download-driver-report')}
            className="relative z-10 mt-8 w-full py-3 bg-on-primary text-primary rounded-xl font-bold text-sm hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            {t('drivers.download_report')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default Drivers;
