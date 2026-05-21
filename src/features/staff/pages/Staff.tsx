import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { staffApi } from '../api/staffApi';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'ops_manager' | 'finance' | 'support' | string;
  status: 'active' | 'inactive';
  lastLogin: string;
  avatar: string;
}

const Staff: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [staff, setStaff] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [enabledPermissions, setEnabledPermissions] = useState<Record<string, boolean>>({
    '0-0': true,
    '1-0': true,
    '2-0': true,
    '3-0': true,
  });

  useEffect(() => {
    const fetchStaff = async () => {
      setIsLoading(true);
      try {
        const response = await staffApi.getAllStaff();
        const data = response.data || [];
        const mapped = data.map((e: any) => ({
          id: String(e.id),
          name: e.name || 'مستخدم غير معروف',
          email: e.email || '',
          role: e.type || e.role || 'support',
          status: e.is_active || !e.is_banned ? 'active' : 'inactive',
          lastLogin: e.last_active || 'Recently',
          avatar: e.profile_photo || `https://i.pravatar.cc/100?u=${e.id}`,
        }));
        setStaff(mapped);
        if (mapped.length > 0) {
          setSelectedEmployee(mapped[0]);
        }
      } catch (err) {
        console.error('Failed to load staff', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStaff();
  }, []);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tight mb-2 font-headline">{t('staff.title')}</h2>
          <p className="text-on-surface-variant text-sm">{t('staff.subtitle')}</p>
        </div>
        <button
          onClick={async () => {
            await runAction({
              key: 'staff-add',
              successMessage: 'New staff draft created.',
              errorMessage: 'Could not create staff draft.',
              onSuccess: () => {
                setStaff((prev) => [{
                  id: String(Date.now()),
                  name: 'موظف جديد',
                  email: `staff.${prev.length + 1}@atareeqak.com`,
                  role: 'support',
                  status: 'active',
                  lastLogin: 'Just now',
                  avatar: 'https://i.pravatar.cc/100?u=new-staff',
                }, ...prev]);
              },
            });
          }}
          disabled={isBusy('staff-add')}
          className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:opacity-90 transition-all active:scale-95 shadow-sm shadow-primary/20 self-start md:self-auto disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          {isBusy('staff-add') ? 'Adding...' : t('staff.add_new')}
        </button>
      </div>

      {/* Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-primary/10 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-on-surface-variant text-xs font-medium mb-1">{t('staff.total_staff')}</p>
            <h3 className="text-4xl font-manrope font-extrabold text-primary">42</h3>
          </div>
          <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">groups</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-secondary/10 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-on-surface-variant text-xs font-medium mb-1">{t('staff.active_now')}</p>
            <h3 className="text-4xl font-manrope font-extrabold text-secondary">38</h3>
          </div>
          <div className="w-12 h-12 bg-secondary/5 rounded-full flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-tertiary-container/10 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-on-surface-variant text-xs font-medium mb-1">{t('staff.pending_requests')}</p>
            <h3 className="text-4xl font-manrope font-extrabold text-tertiary-container">04</h3>
          </div>
          <div className="w-12 h-12 bg-tertiary-container/5 rounded-full flex items-center justify-center text-tertiary-container">
            <span className="material-symbols-outlined text-3xl">pending_actions</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Staff Table Container */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-6 border-b border-surface-container flex justify-between items-center bg-white">
            <h4 className="font-bold text-lg text-primary">{t('staff.staff_list')}</h4>
            <div className="flex gap-2 text-slate-400">
              <button className="p-2 hover:bg-surface-container rounded-lg transition-colors"><span className="material-symbols-outlined">filter_list</span></button>
              <button className="p-2 hover:bg-surface-container rounded-lg transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold text-start">{t('staff.table_employee')}</th>
                  <th className="px-6 py-4 font-bold text-start">{t('staff.table_role')}</th>
                  <th className="px-6 py-4 font-bold text-center">{t('staff.table_status')}</th>
                  <th className="px-6 py-4 font-bold text-start">{t('staff.table_last_login')}</th>
                  <th className="px-6 py-4 font-bold text-center">{t('staff.table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant font-medium">
                      {t('common.loading', 'Loading...')}
                    </td>
                  </tr>
                ) : (
                  staff.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`hover:bg-slate-50 transition-colors group cursor-pointer ${selectedEmployee?.id === emp.id ? 'bg-slate-50/80' : ''}`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden shrink-0">
                          <img className="w-full h-full object-cover" src={emp.avatar} alt={emp.name} />
                        </div>
                        <div className="text-start">
                          <p className="font-bold text-sm text-primary">{emp.name}</p>
                          <p className="text-xs text-on-surface-variant">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-start">
                      <span className={`text-xs font-semibold py-1 px-3 rounded-full ${
                        emp.role === 'ops_manager' ? 'bg-indigo-50 text-indigo-700' :
                        emp.role === 'finance' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {t(`staff.roles.${emp.role}`)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-[10px] font-bold ${
                        emp.status === 'active' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-secondary animate-pulse' : 'bg-slate-400'}`}></span>
                        {t(`staff.status.${emp.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs text-on-surface-variant font-manrope text-start">{emp.lastLogin}</td>
                    <td className="px-6 py-5 text-center">
                      <div className={`flex justify-center gap-2 transition-opacity ${selectedEmployee?.id === emp.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={async (event) => {
                            event.stopPropagation();
                            await runAction({
                              key: `staff-edit-${emp.id}`,
                              successMessage: `Edit mode opened for ${emp.name}.`,
                              errorMessage: 'Could not open employee editor.',
                            });
                          }}
                          disabled={isBusy(`staff-edit-${emp.id}`)}
                          className="p-1.5 text-secondary hover:bg-secondary-container/20 rounded-lg disabled:opacity-40"
                        ><span className="material-symbols-outlined text-sm">edit</span></button>
                        <button
                          onClick={async (event) => {
                            event.stopPropagation();
                            await runAction({
                              key: `staff-delete-${emp.id}`,
                              successMessage: `${emp.name} removed from local list.`,
                              errorMessage: 'Could not remove employee.',
                              onSuccess: () => {
                                setStaff((prev) => prev.filter((entry) => entry.id !== emp.id));
                                if (selectedEmployee?.id === emp.id && staff.length > 1) {
                                  const fallback = staff.find((entry) => entry.id !== emp.id);
                                  if (fallback) {
                                    setSelectedEmployee(fallback);
                                  }
                                }
                              },
                            });
                          }}
                          disabled={isBusy(`staff-delete-${emp.id}`)}
                          className="p-1.5 text-error hover:bg-error-container/20 rounded-lg disabled:opacity-40"
                        ><span className="material-symbols-outlined text-sm">delete</span></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
          <div className="p-4 bg-surface-container-low/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant font-manrope">
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center border border-outline-variant hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
              </button>
              <button className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">1</button>
              <button className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center border border-outline-variant hover:bg-surface-container transition-colors">2</button>
              <button className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center border border-outline-variant hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
              </button>
            </div>
            <span>{t('staff.pagination_info', { count: 10, total: 42 })}</span>
          </div>
        </div>

        {/* Side Panel: Permissions */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-3xl p-8 shadow-sm space-y-8 sticky top-24 border-t-4 border-secondary border-x border-b border-outline-variant/10">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-lg text-primary">{t('staff.edit_permissions')}</h4>
              <span className="material-symbols-outlined text-secondary">security</span>
            </div>
            <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
              <img className="w-10 h-10 rounded-full object-cover shrink-0" src={selectedEmployee?.avatar} alt="Avatar" />
              <div className="text-start">
                <p className="text-sm font-bold text-primary">{selectedEmployee?.name}</p>
                <p className="text-[10px] text-on-surface-variant">{t('staff.editing_for', { role: t(`staff.roles.${selectedEmployee?.role}`) })}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { group: t('staff.user_mgmt'), perms: [t('staff.perm_add_delete'), t('staff.perm_edit_drivers')] },
              { group: t('staff.trip_mgmt'), perms: [t('staff.perm_view_routes'), t('staff.perm_cancel_trips')] },
              { group: t('staff.finance_mgmt'), perms: [t('staff.perm_view_finance'), t('staff.perm_issue_invoices')] },
              { group: t('staff.system_settings'), perms: [t('staff.perm_edit_configs')] }
            ].map((section, idx) => (
              <div key={idx} className="space-y-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/20 pb-1 text-start">{section.group}</p>
                {section.perms.map((perm, pIdx) => (
                  <label key={pIdx} className="flex items-center gap-3 cursor-pointer group w-fit">
                    <div className="relative w-5 h-5 border-2 border-outline-variant rounded group-hover:border-secondary transition-colors flex items-center justify-center bg-white">
                      <input
                        checked={Boolean(enabledPermissions[`${idx}-${pIdx}`])}
                        onChange={(event) => {
                          setEnabledPermissions((prev) => ({
                            ...prev,
                            [`${idx}-${pIdx}`]: event.target.checked,
                          }));
                        }}
                        className="hidden peer"
                        type="checkbox"
                      />
                      <span className="material-symbols-outlined text-white text-[16px] peer-checked:bg-secondary w-full h-full flex items-center justify-center rounded-[2px]">check</span>
                    </div>
                    <span className="text-sm font-medium">{perm}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className="pt-6 flex gap-3">
            <button
              onClick={async () => {
                await runAction({
                  key: 'save-perms',
                  successMessage: `Permissions saved for ${selectedEmployee?.name}.`,
                  errorMessage: 'Could not save permissions.',
                });
              }}
              disabled={isBusy('save-perms')}
              className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 text-sm shadow-md disabled:opacity-50"
            >
              {t('staff.save_edits')}
            </button>
            <button
              onClick={async () => {
                await runAction({ key: 'cancel-perms', successMessage: 'Permission changes reverted in UI.', errorMessage: 'Unable to reset changes.' });
                setEnabledPermissions({
                  '0-0': true,
                  '1-0': true,
                  '2-0': true,
                  '3-0': true,
                });
              }}
              className="px-6 py-3 border border-outline-variant rounded-xl font-bold hover:bg-surface-container transition-all text-sm"
            >
              {t('staff.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Staff;
