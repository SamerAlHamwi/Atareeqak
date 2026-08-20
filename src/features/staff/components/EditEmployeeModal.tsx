import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from '../api/staffApi';
import type { UpdateEmployeeRequest } from '../api/staffApi';
import type { Employee } from '../hooks/useStaff';

interface EditEmployeeModalProps {
  employee: Employee;
  isBusy: boolean;
  fieldErrors: Record<string, string>;
  onSave: (payload: UpdateEmployeeRequest) => void | Promise<void>;
  onClose: () => void;
}

/**
 * `PUT /employees/{id}` accepts only `first_name`, `last_name` and `email`, all
 * `sometimes` — username and role are immutable through this route. Only the
 * fields the user actually changed are sent, which is what `sometimes` is for.
 *
 * The caller mounts this only while an employee is selected, so the field state
 * seeded from `employee` is always fresh — the same "mounted fresh every time"
 * arrangement `ConfirmActionModal`'s inner `ModalForm` relies on. Rendering it
 * unconditionally would keep the first employee's values on the second edit.
 */
export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  isBusy,
  fieldErrors,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName);
  const [email, setEmail] = useState(employee.email);

  const firstNameValid = firstName.trim().length > 0 && firstName.trim().length <= NAME_MAX_LENGTH;
  const lastNameValid = lastName.trim().length > 0 && lastName.trim().length <= NAME_MAX_LENGTH;
  const emailValid = email.trim() === '' || email.trim().length <= EMAIL_MAX_LENGTH;
  const isValid = firstNameValid && lastNameValid && emailValid;

  const changed: UpdateEmployeeRequest = {};
  if (firstName.trim() !== employee.firstName) changed.first_name = firstName.trim();
  if (lastName.trim() !== employee.lastName) changed.last_name = lastName.trim();
  if (email.trim() !== employee.email) changed.email = email.trim() || null;
  const isDirty = Object.keys(changed).length > 0;

  const fieldError = (field: string) => fieldErrors[field];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]"
        onClick={isBusy ? undefined : onClose}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none">
        <div
          data-testid="edit-employee-modal"
          className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl p-8 space-y-6 pointer-events-auto"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-extrabold font-headline text-primary">
                {t('staff.edit_title')}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {t('staff.edit_subtitle', { username: employee.username })}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-40"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  data-testid="edit-first-name"
                  type="text"
                  value={firstName}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('staff.form_first_name')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                />
                {fieldError('first_name') && (
                  <p className="text-[11px] text-error mt-1">{fieldError('first_name')}</p>
                )}
              </div>
              <div>
                <input
                  data-testid="edit-last-name"
                  type="text"
                  value={lastName}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('staff.form_last_name')}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
                />
                {fieldError('last_name') && (
                  <p className="text-[11px] text-error mt-1">{fieldError('last_name')}</p>
                )}
              </div>
            </div>

            <div>
              <input
                data-testid="edit-email"
                type="email"
                value={email}
                maxLength={EMAIL_MAX_LENGTH}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('staff.form_email')}
                dir="ltr"
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/30"
              />
              {fieldError('email') && (
                <p className="text-[11px] text-error mt-1">{fieldError('email')}</p>
              )}
            </div>

            <p className="text-[10px] text-on-surface-variant">{t('staff.edit_hint')}</p>
          </div>

          <div className="flex gap-3">
            <button
              data-testid="edit-employee-submit"
              onClick={() => void onSave(changed)}
              disabled={!isValid || !isDirty || isBusy}
              className="flex-1 bg-primary text-on-primary py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isBusy ? t('common.loading') : t('staff.save_changes')}
            </button>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="px-6 py-3 bg-surface-container-high text-on-surface rounded-2xl font-bold text-sm hover:bg-surface-container-highest transition-all disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
