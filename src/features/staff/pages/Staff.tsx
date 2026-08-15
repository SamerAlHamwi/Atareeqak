import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ConfirmActionModal from '../../shared/components/ConfirmActionModal';
import TableSkeleton from '../../shared/components/TableSkeleton';
import Avatar from '../../shared/components/Avatar';
import { getFieldErrors } from '../../../services/apiError';
import { useStaff } from '../hooks/useStaff';
import type { Employee } from '../hooks/useStaff';
import { StaffUnavailablePanel } from '../components/StaffUnavailablePanel';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import {
  CREATABLE_STAFF_ROLES,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../api/staffApi';
import type {
  StaffRole,
  CreatableStaffRole,
  UpdateEmployeeRequest,
} from '../api/staffApi';

const roleBadgeClasses: Record<StaffRole, string> = {
  system_admin: 'bg-primary-fixed text-on-primary-fixed-variant',
  // Financial administrator — a restricted, seeded role like system_admin
  sycash: 'bg-violet-50 text-violet-700',
  admin: 'bg-secondary-container text-on-secondary-container',
  support_agent: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
};

interface NewEmployeeForm {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  role: CreatableStaffRole;
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
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [passwordResetTarget, setPasswordResetTarget] = useState<Employee | null>(null);
  const [rowNewPassword, setRowNewPassword] = useState('');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const {
    staff,
    totalStaff,
    activeStaff,
    inactiveStaff,
    isLoading,
    error,
    isBackendAvailable,
    refetch,
    createEmployee,
    updateEmployee,
    toggleActive,
    resetPassword,
    deleteEmployee,
  } = useStaff();

  // Every write control requires a proven-usable backend — see
  // `isBackendAvailable` in useStaff.
  const canManage = isBackendAvailable === true;

  const usernameValid =
    form.username.trim().length >= USERNAME_MIN_LENGTH &&
    form.username.trim().length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(form.username.trim());
  const passwordValid = form.password.length >= PASSWORD_MIN_LENGTH;
  const formValid =
    usernameValid &&
    passwordValid &&
    form.first_name.trim().length > 0 &&
    form.first_name.trim().length <= NAME_MAX_LENGTH &&
    form.last_name.trim().length > 0 &&
    form.last_name.trim().length <= NAME_MAX_LENGTH;

  const handleCreate = async () => {
    if (!formValid || !canManage) return;
    setCreateErrors({});
    await runAction({
      key: 'staff-add',
      // Error codes (BUG-11 fixed): 422 → validation (per-field, pinned under
      // the inputs below); 403 → genuine domain refusals (restricted role,
      // permission check); 409 → duplicate username/email, now that
      // `EmployeeManagementService` throws `\RuntimeException` for those two
      // checks instead of `\DomainException`. Still no branching on the code
      // here — the server's message is unambiguous either way, and
      // extractApiError surfaces it verbatim in the banner.
      //
      // The catch records the 422 field errors and rethrows so runAction still
      // reports the failure in the banner.
      action: async () => {
        try {
          return await createEmployee({
            username: form.username.trim(),
            password: form.password,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            role: form.role,
            ...(form.email.trim() ? { email: form.email.trim() } : {}),
          });
        } catch (err) {
          setCreateErrors(getFieldErrors(err) ?? {});
          throw err;
        }
      },
      successMessage: t('staff.create_success', { name: `${form.first_name} ${form.last_name}` }),
      errorMessage: t('staff.create_failed'),
      onSuccess: () => setForm(emptyForm),
    });
  };

  const handleEdit = async (payload: UpdateEmployeeRequest) => {
    if (!editTarget || !canManage) return;
    setEditErrors({});
    await runAction({
      key: `staff-edit-${editTarget.id}`,
      action: async () => {
        try {
          return await updateEmployee(editTarget, payload);
        } catch (err) {
          setEditErrors(getFieldErrors(err) ?? {});
          throw err;
        }
      },
      successMessage: t('staff.update_success', { name: editTarget.name }),
      errorMessage: t('staff.update_failed'),
      onSuccess: () => setEditTarget(null),
    });
  };

  const handleToggleActive = async (employee: Employee) => {
    if (!canManage) return;
    await runAction({
      key: `staff-toggle-${employee.id}`,
      action: () => toggleActive(employee),
      successMessage: employee.isActive
        ? t('staff.deactivate_success', { name: employee.name })
        : t('staff.activate_success', { name: employee.name }),
      errorMessage: t('staff.toggle_failed'),
      onSuccess: () => {
        setToggleTarget(null);
        setSelectedEmployee((prev) =>
          prev && prev.id === employee.id ? { ...prev, isActive: !prev.isActive } : prev
        );
      },
    });
  };

  const handleDelete = async (employee: Employee) => {
    if (!canManage) return;
    await runAction({
      key: `staff-delete-${employee.id}`,
      action: () => deleteEmployee(employee),
      successMessage: t('staff.delete_success', { name: employee.name }),
      errorMessage: t('staff.delete_failed'),
      onSuccess: () => {
        setDeleteTarget(null);
        setSelectedEmployee((prev) => (prev && prev.id === employee.id ? null : prev));
      },
    });
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee || newPassword.length < PASSWORD_MIN_LENGTH || !canManage) return;
    await runAction({
      key: 'staff-reset-password',
      action: () => resetPassword(selectedEmployee, newPassword),
      successMessage: t('staff.reset_password_success', { name: selectedEmployee.name }),
      errorMessage: t('staff.reset_password_failed'),
      onSuccess: () => setNewPassword(''),
    });
  };

  const handleRowResetPassword = async () => {
    if (!passwordResetTarget || rowNewPassword.length < PASSWORD_MIN_LENGTH || !canManage) return;
    const target = passwordResetTarget;
    await runAction({
      key: `staff-reset-password-row-${target.id}`,
      action: () => resetPassword(target, rowNewPassword),
      successMessage: t('staff.reset_password_success', { name: target.name }),
      errorMessage: t('staff.reset_password_failed'),
      onSuccess: () => {
        setPasswordResetTarget(null);
        setRowNewPassword('');
      },
    });
  };

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tight mb-2 font-headline">
            {t('staff.title')}
          </h2>
          <p className="text-on-surface-variant text-sm">{t('staff.subtitle')}</p>
        </div>
        {/*
          The "Send General Alert" button and its BroadcastAlertModal were
          removed here: POST /admin/broadcast-alert returns 404, confirmed live
          2026-08-13. Per the Phase 0 decision, a control that 404s is not
          shipped. If the route ever lands, restore the modal from git history.
        */}
      </div>

      {isBackendAvailable === false ? (
        <StaffUnavailablePanel message={error} onRetry={() => void refetch()} />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-primary/10 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-on-surface-variant text-xs font-medium mb-1">
                  {t('staff.total_staff')}
                </p>
                <h3
                  data-testid="staff-total"
                  className="text-4xl font-manrope font-extrabold text-primary"
                >
                  {isLoading ? '—' : totalStaff}
                </h3>
              </div>
              <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-secondary/10 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-on-surface-variant text-xs font-medium mb-1">
                  {t('staff.active_now')}
                </p>
                <h3
                  data-testid="staff-active"
                  className="text-4xl font-manrope font-extrabold text-secondary"
                >
                  {isLoading ? '—' : activeStaff}
                </h3>
              </div>
              <div className="w-12 h-12 bg-secondary/5 rounded-full flex items-center justify-center text-secondary">
                <span
                  className="material-symbols-outlined text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  bolt
                </span>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-6 rounded-2xl border-b-2 border-tertiary-container/10 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-on-surface-variant text-xs font-medium mb-1">
                  {t('staff.inactive_staff')}
                </p>
                <h3
                  data-testid="staff-inactive"
                  className="text-4xl font-manrope font-extrabold text-tertiary-container"
                >
                  {isLoading ? '—' : inactiveStaff}
                </h3>
              </div>
              <div className="w-12 h-12 bg-tertiary-container/5 rounded-full flex items-center justify-center text-tertiary-container">
                <span className="material-symbols-outlined text-3xl">person_off</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Staff table */}
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
              <div className="p-6 border-b border-surface-container flex justify-between items-center">
                <h4 className="font-bold text-lg text-primary">{t('staff.staff_list')}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold text-start">
                        {t('staff.table_employee')}
                      </th>
                      <th className="px-6 py-4 font-bold text-start">{t('staff.table_role')}</th>
                      <th className="px-6 py-4 font-bold text-center">
                        {t('staff.table_status')}
                      </th>
                      {/*
                        `created_by` deliberately has NO column: it is NULL for
                        every seeded employee, so the column would read
                        "Unknown" on every row. Same call Phase 4 made for
                        `banned_by` (BUG-5). `last_login_at` IS shown — only one
                        of three rows has a value, but "never" is a real,
                        useful fact about an account, not a missing field.
                      */}
                      <th className="px-6 py-4 font-bold text-start">
                        {t('staff.table_last_login')}
                      </th>
                      <th className="px-6 py-4 font-bold text-center">
                        {t('staff.table_actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/50">
                    {isLoading ? (
                      <TableSkeleton rows={3} cols={5} firstColAvatar />
                    ) : staff.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-10 text-center text-on-surface-variant font-medium"
                        >
                          {t('staff.empty')}
                        </td>
                      </tr>
                    ) : (
                      staff.map((emp) => (
                        <tr
                          key={emp.id}
                          data-testid="staff-row"
                          onClick={() => setSelectedEmployee(emp)}
                          className={`hover:bg-surface-container-low/60 transition-colors group cursor-pointer ${
                            selectedEmployee?.id === emp.id ? 'bg-surface-container-low/80' : ''
                          }`}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <Avatar name={emp.name} photo={emp.photo} size="sm" />
                              <div className="text-start">
                                <p className="font-bold text-sm text-primary">{emp.name}</p>
                                <p className="text-xs text-on-surface-variant">
                                  {emp.email || `@${emp.username}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-start">
                            <span
                              className={`text-xs font-semibold py-1 px-3 rounded-full whitespace-nowrap ${
                                roleBadgeClasses[emp.role] ?? 'bg-surface-container-high text-on-surface-variant'
                              }`}
                            >
                              {t(`staff.roles.${emp.role}`, emp.roleLabel)}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-[10px] font-bold ${
                                emp.isActive
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-surface-container-highest text-on-surface-variant'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  emp.isActive ? 'bg-secondary animate-pulse' : 'bg-outline'
                                }`}
                              />
                              {emp.isActive ? t('staff.status.active') : t('staff.status.inactive')}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-xs text-on-surface-variant font-manrope text-start">
                            {emp.lastLogin ?? t('staff.never_logged_in')}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div
                              className={`flex justify-center gap-2 transition-opacity ${
                                selectedEmployee?.id === emp.id
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <button
                                data-testid={`staff-edit-${emp.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditErrors({});
                                  setEditTarget(emp);
                                }}
                                disabled={isBusy(`staff-edit-${emp.id}`)}
                                className="p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                title={t('staff.edit_title')}
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              {/*
                                system_admin / sycash passwords are restricted —
                                EmployeeManagementService::rotatePassword() 403s
                                and points to `php artisan admin:rotate-password`.
                                Only offered for admin/support_agent rows.
                              */}
                              {(emp.role === 'admin' || emp.role === 'support_agent') && (
                                <button
                                  data-testid={`staff-reset-password-${emp.id}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setRowNewPassword('');
                                    setPasswordResetTarget(emp);
                                  }}
                                  disabled={isBusy(`staff-reset-password-row-${emp.id}`)}
                                  className="p-1.5 rounded-lg text-secondary hover:bg-secondary/10 disabled:opacity-40"
                                  title={t('staff.reset_password_title')}
                                >
                                  <span className="material-symbols-outlined text-sm">lock_reset</span>
                                </button>
                              )}
                              <button
                                data-testid={`staff-toggle-${emp.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setToggleTarget(emp);
                                }}
                                disabled={isBusy(`staff-toggle-${emp.id}`)}
                                className={`p-1.5 rounded-lg disabled:opacity-40 ${
                                  emp.isActive
                                    ? 'text-error hover:bg-error-container/20'
                                    : 'text-secondary hover:bg-secondary-container/20'
                                }`}
                                title={emp.isActive ? t('staff.deactivate') : t('staff.activate')}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {emp.isActive ? 'person_off' : 'how_to_reg'}
                                </span>
                              </button>
                              <button
                                data-testid={`staff-delete-${emp.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteTarget(emp);
                                }}
                                disabled={isBusy(`staff-delete-${emp.id}`)}
                                className="p-1.5 rounded-lg text-error hover:bg-error-container/20 disabled:opacity-40"
                                title={t('staff.delete')}
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
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

            {/* Side panel */}
            <div className="lg:col-span-4 space-y-8 sticky top-24">
              <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm space-y-6 border-t-4 border-secondary border-x border-b border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-lg text-primary">{t('staff.add_new')}</h4>
                  <span className="material-symbols-outlined text-secondary">person_add</span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      data-testid="create-first-name"
                      type="text"
                      value={form.first_name}
                      maxLength={NAME_MAX_LENGTH}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      placeholder={t('staff.form_first_name')}
                      className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                    />
                    <input
                      data-testid="create-last-name"
                      type="text"
                      value={form.last_name}
                      maxLength={NAME_MAX_LENGTH}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      placeholder={t('staff.form_last_name')}
                      className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                    />
                  </div>

                  <div>
                    <input
                      data-testid="create-username"
                      type="text"
                      value={form.username}
                      maxLength={USERNAME_MAX_LENGTH}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder={t('staff.form_username')}
                      className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                      dir="ltr"
                    />
                    {/* Mirrors `alpha_dash|min:3|max:50` rather than 422'ing. */}
                    {form.username !== '' && !usernameValid && (
                      <p data-testid="create-username-error" className="text-[11px] text-error mt-1">
                        {t('staff.username_invalid', {
                          min: USERNAME_MIN_LENGTH,
                          max: USERNAME_MAX_LENGTH,
                        })}
                      </p>
                    )}
                    {createErrors.username && (
                      <p className="text-[11px] text-error mt-1">{createErrors.username}</p>
                    )}
                  </div>

                  <div>
                    <input
                      data-testid="create-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder={t('staff.form_email')}
                      className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                      dir="ltr"
                    />
                    {createErrors.email && (
                      <p className="text-[11px] text-error mt-1">{createErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <input
                      data-testid="create-password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={t('staff.form_password')}
                      className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                      dir="ltr"
                    />
                    {form.password !== '' && !passwordValid && (
                      <p className="text-[11px] text-error mt-1">
                        {t('staff.password_too_short', { count: PASSWORD_MIN_LENGTH })}
                      </p>
                    )}
                  </div>

                  {/*
                    Only creatable roles are offered. system_admin and sycash are
                    StaffRole::isRestricted() — seeded at deployment — and POST
                    /employees 422s with "You are not permitted to assign this
                    role". CREATABLE_STAFF_ROLES is the Phase 1 constant, reused.
                  */}
                  <select
                    data-testid="create-role"
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as CreatableStaffRole })
                    }
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30 cursor-pointer"
                  >
                    {CREATABLE_STAFF_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t(`staff.roles.${role}`)}
                      </option>
                    ))}
                  </select>

                  <p className="text-[10px] text-on-surface-variant">{t('staff.form_hint')}</p>

                  <button
                    data-testid="create-submit"
                    onClick={() => void handleCreate()}
                    disabled={!formValid || !canManage || isBusy('staff-add')}
                    className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 text-sm shadow-md disabled:opacity-50"
                  >
                    {isBusy('staff-add') ? t('common.loading') : t('staff.add_new')}
                  </button>
                </div>
              </div>

              {selectedEmployee && (
                <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm space-y-6 border border-outline-variant/10">
                  <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-2xl">
                    <Avatar name={selectedEmployee.name} photo={selectedEmployee.photo} size="sm" />
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
                      data-testid="reset-password-input"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('staff.form_new_password')}
                      className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                      dir="ltr"
                    />
                    <button
                      data-testid="reset-password-submit"
                      onClick={() => void handleResetPassword()}
                      disabled={
                        newPassword.length < PASSWORD_MIN_LENGTH ||
                        !canManage ||
                        isBusy('staff-reset-password')
                      }
                      className="w-full bg-secondary text-on-secondary py-3 rounded-xl font-bold hover:opacity-90 transition-all text-sm shadow-md disabled:opacity-50"
                    >
                      {isBusy('staff-reset-password')
                        ? t('common.loading')
                        : t('staff.reset_password_action')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals are only mounted when the backend is usable. */}
      {canManage && (
        <>
          {editTarget && (
            <EditEmployeeModal
              employee={editTarget}
              isBusy={isBusy(`staff-edit-${editTarget.id}`)}
              fieldErrors={editErrors}
              onSave={(payload) => void handleEdit(payload)}
              onClose={() => setEditTarget(null)}
            />
          )}

          <ConfirmActionModal
            open={toggleTarget !== null}
            title={
              toggleTarget?.isActive
                ? t('staff.deactivate_confirm_title')
                : t('staff.activate_confirm_title')
            }
            description={
              toggleTarget
                ? toggleTarget.isActive
                  ? t('staff.deactivate_confirm_desc', { name: toggleTarget.name })
                  : t('staff.activate_confirm_desc', { name: toggleTarget.name })
                : undefined
            }
            confirmLabel={
              toggleTarget?.isActive ? t('staff.deactivate') : t('staff.activate')
            }
            confirmTone={toggleTarget?.isActive ? 'destructive' : 'primary'}
            // `toggle-active` takes no body at all, so no reason is collected —
            // a reason box here would imply the text gets recorded somewhere.
            hideReason
            isBusy={toggleTarget ? isBusy(`staff-toggle-${toggleTarget.id}`) : false}
            onConfirm={async () => {
              if (toggleTarget) {
                await handleToggleActive(toggleTarget);
              }
            }}
            onClose={() => setToggleTarget(null)}
          />

          <ConfirmActionModal
            open={deleteTarget !== null}
            title={t('staff.delete_confirm_title')}
            description={
              deleteTarget ? t('staff.delete_confirm_desc', { name: deleteTarget.name }) : undefined
            }
            confirmLabel={t('staff.delete')}
            confirmTone="destructive"
            // DELETE /employees/{id} takes no body — same reasoning as toggle-active above.
            hideReason
            isBusy={deleteTarget ? isBusy(`staff-delete-${deleteTarget.id}`) : false}
            onConfirm={async () => {
              if (deleteTarget) {
                await handleDelete(deleteTarget);
              }
            }}
            onClose={() => setDeleteTarget(null)}
          />

          <ConfirmActionModal
            open={passwordResetTarget !== null}
            title={t('staff.reset_password_modal_title', { name: passwordResetTarget?.name ?? '' })}
            description={t('staff.reset_password_modal_desc', { name: passwordResetTarget?.name ?? '' })}
            confirmLabel={t('staff.reset_password_action')}
            // POST /employees/{id}/reset-password takes `new_password`, not a
            // free-text reason — the password field below is the real payload.
            hideReason
            isBusy={passwordResetTarget ? isBusy(`staff-reset-password-row-${passwordResetTarget.id}`) : false}
            onConfirm={() => handleRowResetPassword()}
            onClose={() => {
              setPasswordResetTarget(null);
              setRowNewPassword('');
            }}
          >
            <div>
              <label
                htmlFor="row-reset-password-input"
                className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block"
              >
                {t('staff.form_new_password')}
              </label>
              <input
                id="row-reset-password-input"
                data-testid="row-reset-password-input"
                type="password"
                value={rowNewPassword}
                onChange={(e) => setRowNewPassword(e.target.value)}
                placeholder={t('staff.form_new_password')}
                className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                dir="ltr"
              />
              {rowNewPassword !== '' && rowNewPassword.length < PASSWORD_MIN_LENGTH && (
                <p className="text-[11px] text-error mt-1">
                  {t('staff.password_too_short', { count: PASSWORD_MIN_LENGTH })}
                </p>
              )}
            </div>
          </ConfirmActionModal>
        </>
      )}
    </div>
  );
};

export default Staff;
