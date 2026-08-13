import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface PerPageSelectProps {
  value: number;
  options: readonly number[];
  onChange: (perPage: number) => void;
  disabled?: boolean;
}

/**
 * Page-size selector. The backend validates `per_page` as 1–50, so the option
 * list must stay inside that range or the request 422s.
 */
const PerPageSelect: React.FC<PerPageSelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-on-surface-variant font-medium">
        {t('common.per_page')}
      </label>
      <select
        id={id}
        data-testid="per-page-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-surface-container-low border-none rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PerPageSelect;
