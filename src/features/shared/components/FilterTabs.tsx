import React from 'react';

export interface FilterTabItem<T extends string> {
  value: T;
  label: string;
  /** Server-provided count. Omit when the payload carries no counts — the
   *  badge is then simply not rendered rather than showing a made-up figure. */
  count?: number;
}

interface FilterTabsProps<T extends string> {
  items: readonly FilterTabItem<T>[];
  active: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Segmented filter control with optional server-driven count badges. */
export function FilterTabs<T extends string>({
  items,
  active,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: FilterTabsProps<T>): React.ReactElement {
  return (
    <div className="flex flex-wrap p-1 bg-surface-container-low rounded-xl" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              isActive
                ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ltr:font-mono ${
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FilterTabs;
