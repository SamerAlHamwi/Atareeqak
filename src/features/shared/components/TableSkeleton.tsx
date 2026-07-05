import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  cols: number;
  /** Render an avatar + two-line block in the first column (user-style tables). */
  firstColAvatar?: boolean;
}

/**
 * Pulsing placeholder rows matching a table's column count — replaces the
 * plain "جاري التحميل..." loading text while data is being fetched.
 */
const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols, firstColAvatar = false }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex} className="animate-pulse">
        {Array.from({ length: cols }).map((_, colIndex) => (
          <td key={colIndex} className="px-6 py-5">
            {colIndex === 0 && firstColAvatar ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0" />
                <div className="space-y-2 w-full max-w-[140px]">
                  <div className="h-3 bg-surface-container-high rounded-full w-full" />
                  <div className="h-2.5 bg-surface-container-high rounded-full w-2/3" />
                </div>
              </div>
            ) : (
              <div className="h-3 bg-surface-container-high rounded-full w-3/4" />
            )}
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default TableSkeleton;
