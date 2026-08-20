import React from 'react';
import { useTranslation } from 'react-i18next';

interface TablePaginationProps {
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  /** Optional "showing x–y of z" label rendered on the opposite side. */
  info?: string;
  isLoading?: boolean;
}

/** Prev/next pagination footer matching the Drivers/Users table style, RTL-aware. */
const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  lastPage,
  onPageChange,
  info,
  isLoading = false,
}) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  return (
    <div className="bg-surface-container-low px-8 py-4 flex items-center justify-between border-t border-outline-variant">
      <span className="text-xs text-on-surface-variant">{info ?? ''}</span>
      <div className="flex gap-2 items-center">
        <button
          data-testid="pagination-prev"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isLoading}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_right' : 'chevron_left'}</span>
        </button>
        <span className="text-xs font-bold text-on-surface px-2">
          {page} / {Math.max(lastPage, 1)}
        </span>
        <button
          data-testid="pagination-next"
          onClick={() => onPageChange(Math.min(lastPage, page + 1))}
          disabled={page >= lastPage || isLoading}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">{isRtl ? 'chevron_left' : 'chevron_right'}</span>
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
