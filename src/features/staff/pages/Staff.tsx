import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useStaff } from '../hooks/useStaff';
import type { Employee } from '../hooks/useStaff';
import type { StaffRole } from '../api/staffApi';

const roleBadgeClasses: Record<StaffRole, string> = {
  system_admin: 'bg-indigo-50 text-indigo-700',
  admin: 'bg-teal-50 text-teal-700',
  support_agent: 'bg-amber-50 text-amber-700',
};

interface NewEmployeeForm {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  role: StaffRole;
}

const emptyForm: NewEmployeeForm = {
  username: '',
  password: '',
  first_name: '',
  last_name: '',
  email: '',
  role: 'support_agent',
};

const Staff: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<NewEmployeeForm>(emptyForm);
  const [newPassword, setNewPassword] = useState('');

  const {
    staff,
    totalStaff,
    activeStaff,
    inactiveStaff,
    isLoading,
    error,
    createEmployee,
    toggleActive,
    resetPassword,
  } = useStaff();

  const formValid =
    form.username.trim().length >= 3 &&
    form.password.length >= 8 &&
    form.first_name.trim().length > 0 &&
    form.last_name.trim().length > 0;

  const handleCreate = async () => {
    if (!formValid) return;
    await runAction({
      key: 'staff-add',
      action: () =>
        createEmployee({
          username: form.username.trim(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
        }),
      successMessage: t('staff.create_success', { name: `${form.first_name} ${form.last_name}` }),
      errorMessage: t('staff.create_failed'),
      onSuccess: () => setForm(emptyForm),
    });
  };

  const handleToggleActive = async (employee: Employee) => {
    await runAction({
      key: `staff-toggle-${employee.id}`,
      action: () => toggleActive(employee),
      successMessage: employee.isActive
        ? t('staff.deactivate_success', { name: employee.name })
        : t('staff.activate_success', { name: employee.name }),
      errorMessage: t('staff.toggle_failed'),
      onSuccess: () => {
        setSelectedEmployee((prev) =>
          prev && prev.id === employee.id ? { ...prev, isActive: !prev.isActive } : prev
        );
      },
    });
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee || newPassword.length < 8) return;
    await runAction({
      key: 'staff-reset-password',
      action: () => resetPassword(selectedEmployee, newPassword),
      successMessage: t('staff.reset_password_success', { name: selectedEmployee.name }),
      errorMessage: t('staff.reset_password_failed'),
      onSuccess: () => setNewPassword(''),
    });
  };

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {error && (
        <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl">
          {t('common.load_failed')}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tight mb-2 font-headline">{t('staff.title')}</h2>
          <p className="text-on-surface-variant text-sm">{t('staff.subtitle')}</p>
        </div>
      </div>

      {/* Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-primary/10 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-on-surface-variant text-xs font-medium mb-1">{t('staff.total_staff')}</p>
            <h3 className="text-4xl font-manrope font-extrabold text-primary">{isLoading ? '—' : totalStaff}</h3>
          </div>
          <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">groups</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-secondary/10 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-on-surface-variant text-xs font-medium mb-1">{t('staff.active_now')}</p>
            <h3 className="text-4xl font-manrope font-extrabold text-secondary">{isLoading ? '—' : activeStaff}</h3>
          </div>
          <div className="w-12 h-12 bg-secondary/5 rounded-full flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-tertiary-container/10 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-on-surface-variant text-xs font-medium mb-1">{t('staff.inactive_staff')}</p>
            <h3 className="text-4xl font-manrope font-extrabold text-tertiary-container">{isLoading ? '—' : inactiveStaff}</h3>
          </div>
          <div className="w-12 h-12 bg-tertiary-container/5 rounded-full flex items-center justify-center text-tertiary-container">
            <span className="material-symbols-outlined text-3xl">person_off</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Staff Table Container */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="p-6 border-b border-surface-container flex justify-between items-center bg-white">
            <h4 className="font-bold text-lg text-primary">{t('staff.staff_list')}</h4>
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
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant font-medium">
                      {t('common.no_data')}
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
                            <p className="text-xs text-on-surface-variant">{emp.email || `@${emp.username}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-start">
                        <span className={`text-xs font-semibold py-1 px-3 rounded-full ${roleBadgeClasses[emp.role] ?? 'bg-slate-50 text-slate-700'}`}>
                          {t(`staff.roles.${emp.role}`, emp.roleLabel)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-[10px] font-bold ${
                          emp.isActive ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-secondary animate-pulse' : 'bg-slate-400'}`}></span>
                          {emp.isActive ? t('staff.status.active') : t('staff.status.inactive')}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs text-on-surface-variant font-manrope text-start">{emp.lastLogin}</td>
                      <td className="px-6 py-5 text-center">
                        <div className={`flex justify-center gap-2 transition-opacity ${selectedEmployee?.id === emp.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button
                            onClick={async (event) => {
                              event.stopPropagation();
                              await handleToggleActive(emp);
                            }}
                            disabled={isBusy(`staff-toggle-${emp.id}`)}
                            className={`p-1.5 rounded-lg disabled:opacity-40 ${emp.isActive ? 'text-error hover:bg-error-container/20' : 'text-secondary hover:bg-secondary-container/20'}`}
                            title={emp.isActive ? t('staff.deactivate') : t('staff.activate')}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {emp.isActive ? 'person_off' : 'how_to_reg'}
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
        </div>

        {/* Side Panel: Add employee + selected employee actions */}
        <div className="lg:col-span-4 space-y-8 sticky top-24">
          <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm space-y-6 border-t-4 border-secondary border-x border-b border-outline-variant/10">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg text-primary">{t('staff.add_new')}</h4>
              <span className="material-symbols-outlined text-secondary">person_add</span>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder={t('staff.form_first_name')}
                  className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                />
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder={t('staff.form_last_name')}
                  className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                />
              </div>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder={t('staff.form_username')}
                className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                dir="ltr"
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t('staff.form_email')}
                className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                dir="ltr"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={t('staff.form_password')}
                className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                dir="ltr"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30 cursor-pointer"
              >
                <option value="support_agent">{t('staff.roles.support_agent')}</option>
                <option value="admin">{t('staff.roles.admin')}</option>
                <option value="system_admin">{t('staff.roles.system_admin')}</option>
              </select>
              <p className="text-[10px] text-on-surface-variant">{t('staff.form_hint')}</p>
              <button
                onClick={handleCreate}
                disabled={!formValid || isBusy('staff-add')}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 text-sm shadow-md disabled:opacity-50"
              >
                {isBusy('staff-add') ? t('common.loading') : t('staff.add_new')}
              </button>
            </div>
          </div>

          {selectedEmployee && (
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm space-y-6 border border-outline-variant/10">
              <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
                <img className="w-10 h-10 rounded-full object-cover shrink-0" src={selectedEmployee.avatar} alt={selectedEmployee.name} />
                <div className="text-start">
                  <p className="text-sm font-bold text-primary">{selectedEmployee.name}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {t(`staff.roles.${selectedEmployee.role}`, selectedEmployee.roleLabel)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/20 pb-1 text-start">
                  {t('staff.reset_password_title')}
                </p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('staff.form_new_password')}
                  className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                  dir="ltr"
                />
                <button
                  onClick={handleResetPassword}
                  disabled={newPassword.length < 8 || isBusy('staff-reset-password')}
                  className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all text-sm shadow-md disabled:opacity-50"
                >
                  {isBusy('staff-reset-password') ? t('common.loading') : t('staff.reset_password_action')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Staff;
