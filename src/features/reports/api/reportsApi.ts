import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface RideStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  awaiting_confirmation: number;
}

/**
 * Shape confirmed live 2026-08-13 against `AdminReportService::financialStats()`.
 *
 * ⚠️ Two axes matter here and they are NOT the same:
 *
 *  - **Flows** (`total_*`) ARE filtered by `start_date`/`end_date`. On a
 *    2020-01-01..2020-01-02 range every one of them returns "0.00 SYP".
 *  - **Balances** (`current_balance`, `active_rides_locked`) are point-in-time
 *    and IGNORE the range entirely — they were unchanged on that same probe.
 *
 * `OverviewCards` therefore renders them in two separately-labelled groups.
 * Putting them in one row under a date picker would read as a period figure.
 *
 * The previous version of this interface declared
 * `primary_admin.total_collected`, `primary_admin.total_disbursed` and
 * `sycash.total_creation_fees`. **None of those exist in the payload** — the
 * first two were rendered and turned into a permanent "—" by `display()`, and
 * the four real `sycash` figures were typed wrong and shown nowhere.
 */
export interface FinancialStats {
  sycash: {
    /** Point-in-time. NOT affected by the date range. */
    current_balance: string;
    /** Range-filtered flow. */
    total_escrow_in: string;
    /** Range-filtered flow. */
    total_escrow_out: string;
    /** Range-filtered flow. */
    total_refunds_paid: string;
  };
  primary_admin: {
    /** Point-in-time. NOT affected by the date range. */
    current_balance: string;
    /** Range-filtered flow. */
    total_platform_fees: string;
  };
  /** Point-in-time. NOT affected by the date range. */
  active_rides_locked: string;
}

export interface ReportData {
  ride_stats: RideStats;
  financial_stats: FinancialStats;
  /**
   * `null` on both sides when unfiltered; when a range is sent the server
   * echoes it back as a full datetime ("2020-01-01 00:00:00" /
   * "2020-01-02 23:59:59"), not the `Y-m-d` that was submitted.
   */
  date_range: {
    start: string | null;
    end: string | null;
  };
}

/** `sections[]` is validated `in:stats,financial,growth,cities,recent`. */
export const PDF_SECTIONS = ['stats', 'financial', 'growth', 'cities', 'recent'] as const;
export type PdfSection = (typeof PDF_SECTIONS)[number];

export interface ReportDateRange {
  /** `Y-m-d`, or '' for unfiltered. */
  start_date?: string;
  /** `Y-m-d`, must be `after_or_equal:start_date`. */
  end_date?: string;
}

/**
 * Client-side mirror of the server's `end_date` rule
 * (`nullable|date_format:Y-m-d|after_or_equal:start_date`). `Y-m-d` strings
 * compare correctly lexicographically, so no Date parsing is needed. Either
 * side being empty is valid — both params are `nullable`.
 */
export const isValidRangeStrings = (start: string, end: string): boolean =>
  !start || !end || start <= end;

const rangeParams = (range: ReportDateRange): Record<string, string> => {
  const params: Record<string, string> = {};
  if (range.start_date) params.start_date = range.start_date;
  if (range.end_date) params.end_date = range.end_date;
  return params;
};

/** Reads a Blob body back into the JSON it actually holds, or null. */
const readBlobAsJson = async (data: unknown): Promise<unknown> => {
  if (!(data instanceof Blob)) return data;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
};

/**
 * With `responseType: 'blob'`, axios hands an error body over as a Blob, which
 * `extractApiError`/`getFieldErrors` cannot read. Swap it for the parsed body
 * in place so every existing error helper keeps working unchanged.
 */
const normaliseBlobError = async (error: unknown): Promise<unknown> => {
  const response = (error as { response?: { data?: unknown } })?.response;
  if (response?.data instanceof Blob) {
    response.data = await readBlobAsJson(response.data);
  }
  return error;
};

export const reportsApi = {
  /**
   * `GET /admin/reports` — server-cached 5 minutes, keyed `admin.report.{start}.{end}`.
   * Nothing busts that cache, so the page carries a "cached for up to 5 minutes"
   * note next to its refresh control.
   */
  generateFinancialReport: async (
    range: ReportDateRange = {}
  ): Promise<{ status: string; report_data: ReportData }> => {
    const response = await api.get(ENDPOINTS.REPORTS, { params: rangeParams(range) });
    return response.data;
  },

  /**
   * `GET /admin/export/pdf` → `application/pdf`.
   *
   * Laravel still answers with **JSON** on a validation failure even though the
   * request asked for a blob (`sections[]=bogus` → 422 JSON, verified live), so
   * both failure paths are normalised here: the rejected `error.response.data`
   * Blob is read back into the parsed body it actually contains, and a 200 that
   * is not a PDF is turned into a throw. Without this the caller writes a JSON
   * error page to disk under a `.pdf` name.
   */
  exportReportToPdf: async (
    range: ReportDateRange = {},
    sections: readonly PdfSection[] = []
  ): Promise<Blob> => {
    try {
      const response = await api.get(ENDPOINTS.EXPORT_PDF, {
        params: {
          ...rangeParams(range),
          ...(sections.length ? { 'sections[]': sections } : {}),
        },
        responseType: 'blob',
      });

      const contentType = String(response.headers?.['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const parsed = await readBlobAsJson(response.data);
        throw Object.assign(new Error('Export did not return a PDF'), {
          response: { status: response.status, data: parsed },
          isAxiosError: true,
        });
      }

      return response.data;
    } catch (error) {
      throw await normaliseBlobError(error);
    }
  },
};
