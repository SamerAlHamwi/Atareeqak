import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PDF_SECTIONS, isValidRangeStrings } from '../api/reportsApi';
import type { PdfSection, ReportDateRange } from '../api/reportsApi';

interface ReportFiltersProps {
  range: ReportDateRange;
  onApplyRange: (range: ReportDateRange) => void;
  onExport: (sections: readonly PdfSection[]) => void;
  onRefresh: () => void;
  updatedAt: Date | null;
  isLoading: boolean;
  isExporting: boolean;
}

/**
 * Date range + PDF export controls.
 *
 * The range is threaded through **both** `GET /admin/reports` and
 * `GET /admin/export/pdf`, which share the same validators
 * (`nullable|date_format:Y-m-d`, `end_date` `after_or_equal:start_date`). The
 * apply button is **disabled** on an invalid range rather than submitting and
 * 422'ing, matching the Phase 5/6 precedent.
 *
 * `sections[]` is a real, validated feature of the export endpoint
 * (`in:stats,financial,growth,cities,recent`) that changes the generated file,
 * so it is exposed rather than hidden. Selecting none sends none, which is the
 * server's "everything" default.
 */
export const ReportFilters: React.FC<ReportFiltersProps> = ({
  range,
  onApplyRange,
  onExport,
  onRefresh,
  updatedAt,
  isLoading,
  isExporting,
}) => {
  const { t, i18n } = useTranslation();
  const [start, setStart] = useState(range.start_date ?? '');
  const [end, setEnd] = useState(range.end_date ?? '');
  const [sections, setSections] = useState<PdfSection[]>([]);

  const rangeValid = isValidRangeStrings(start, end);
  const isDirty = (range.start_date ?? '') !== start || (range.end_date ?? '') !== end;
  const hasRange = Boolean(range.start_date || range.end_date);

  const toggleSection = (section: PdfSection) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const apply = () => {
    if (!rangeValid) return;
    onApplyRange({
      ...(start ? { start_date: start } : {}),
      ...(end ? { end_date: end } : {}),
    });
  };

  const clear = () => {
    setStart('');
    setEnd('');
    onApplyRange({});
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="report-start-date"
            className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block"
          >
            {t('reports.range_start')}
          </label>
          <input
            id="report-start-date"
            data-testid="report-start-date"
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => setStart(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label
            htmlFor="report-end-date"
            className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block"
          >
            {t('reports.range_end')}
          </label>
          <input
            id="report-end-date"
            data-testid="report-end-date"
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          data-testid="report-apply-range"
          onClick={apply}
          disabled={!rangeValid || !isDirty || isLoading}
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {t('reports.range_apply')}
        </button>

        {hasRange && (
          <button
            data-testid="report-clear-range"
            onClick={clear}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl font-bold text-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all disabled:opacity-50"
          >
            {t('reports.range_clear')}
          </button>
        )}

        <button
          data-testid="report-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-secondary border border-secondary hover:bg-secondary-container/40 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          {isLoading ? t('common.loading') : t('reports.refresh')}
        </button>
      </div>

      {!rangeValid && (
        <p data-testid="report-range-error" className="text-xs text-error font-medium">
          {t('reports.range_invalid')}
        </p>
      )}

      {/*
        `GET /admin/reports` is cached 5 minutes server-side, keyed per date
        range, and nothing busts that cache — so say so, next to a real refresh
        control, or an unchanged figure reads as a bug. Same treatment as the
        Dashboard and Verifications pages.
      */}
      {updatedAt && (
        <p data-testid="report-updated-at" className="text-xs text-on-surface-variant">
          {t('reports.updated_cached', {
            time: updatedAt.toLocaleTimeString(i18n.language, {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </p>
      )}

      {/* ── PDF export ────────────────────────────────────────────────────── */}
      <div className="border-t border-outline-variant pt-5 space-y-3">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {t('reports.export_sections_label')}
        </p>
        <div className="flex flex-wrap gap-2">
          {PDF_SECTIONS.map((section) => {
            const isSelected = sections.includes(section);
            return (
              <button
                key={section}
                data-testid={`pdf-section-${section}`}
                aria-pressed={isSelected}
                onClick={() => toggleSection(section)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t(`reports.export_sections.${section}`)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            data-testid="report-export-pdf"
            onClick={() => onExport(sections)}
            disabled={isExporting}
            className="flex items-center gap-2 text-xs font-bold text-secondary hover:bg-secondary-container px-4 py-2 rounded-full border border-secondary transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            {isExporting ? t('common.loading') : t('reports.export_pdf')}
          </button>
          <span className="text-[11px] text-on-surface-variant">
            {sections.length === 0
              ? t('reports.export_sections_all')
              : t('reports.export_sections_count', { count: sections.length })}
          </span>
        </div>
      </div>
    </section>
  );
};
