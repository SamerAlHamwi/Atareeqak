import axios from 'axios';

/**
 * Error envelope shared by every SyRide endpoint.
 *
 *   401/403  { status:'error', code, message }   ← StaffJwtMiddleware
 *   422      { status:'error', errors: { field: [msg] } }
 *   4xx/5xx  { status:'error', message }
 */
export interface ApiErrorBody {
  status?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Auth failure codes emitted by StaffJwtMiddleware.
 * Only TOKEN_INVALID is worth a refresh attempt — the rest are terminal, and
 * retrying them just burns a round-trip before the same 401 comes back.
 */
export const AUTH_ERROR_CODES = {
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_TYPE_INVALID: 'TOKEN_TYPE_INVALID',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  TOKEN_INVALIDATED: 'TOKEN_INVALIDATED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

/**
 * 401s that a token refresh cannot fix: the employee row is gone, deactivated,
 * or every token was revoked server-side (logout / password rotation).
 */
const TERMINAL_AUTH_CODES: readonly string[] = [
  AUTH_ERROR_CODES.EMPLOYEE_NOT_FOUND,
  AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
  AUTH_ERROR_CODES.TOKEN_INVALIDATED,
];

export const getApiErrorBody = (error: unknown): ApiErrorBody | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  const data = error.response?.data;
  return data && typeof data === 'object' ? (data as ApiErrorBody) : undefined;
};

export const getApiErrorCode = (error: unknown): string | undefined =>
  getApiErrorBody(error)?.code;

/** True when re-authenticating is pointless — the caller should log out instead. */
export const isTerminalAuthError = (error: unknown): boolean => {
  const code = getApiErrorCode(error);
  return !!code && TERMINAL_AUTH_CODES.includes(code);
};

/** True for a role-gate rejection. Never triggers a redirect — the page shows it inline. */
export const isForbiddenError = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 403;

/**
 * Field-level validation errors from a 422, flattened to `{ field: firstMessage }`.
 * Returns undefined for any other failure so callers can branch on it.
 */
export const getFieldErrors = (error: unknown): Record<string, string> | undefined => {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) {
    return undefined;
  }
  const errors = getApiErrorBody(error)?.errors;
  if (!errors) {
    return undefined;
  }
  return Object.entries(errors).reduce<Record<string, string>>((acc, [field, messages]) => {
    if (messages?.length) {
      acc[field] = messages[0];
    }
    return acc;
  }, {});
};

/**
 * Best human-readable message for any failure, in the order the backend
 * actually populates them: explicit `message`, then the first 422 field error,
 * then the caller's fallback.
 *
 * Note the ordering matters for 422s: Laravel's validator responses carry
 * `errors` but usually no `message`, so the field error is what the user sees.
 *
 * Axios's own `error.message` is deliberately NOT used — strings like
 * "Request failed with status code 500" and "Network Error" tell the user
 * nothing the caller's fallback ("Could not load trips") doesn't say better.
 * A non-axios Error is different: that message was written by us, so it is
 * preferred over the generic fallback.
 */
export const extractApiError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const body = getApiErrorBody(error);
    if (body?.message) {
      return body.message;
    }
    const firstFieldError = body?.errors ? Object.values(body.errors)[0] : undefined;
    if (firstFieldError?.length) {
      return firstFieldError[0];
    }
    return fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};
