import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  extractApiError,
  getApiErrorCode,
  getFieldErrors,
  isForbiddenError,
  isTerminalAuthError,
} from '../../src/services/apiError';

/** Builds an AxiosError shaped like a real backend response. */
const axiosError = (status: number, data: unknown): AxiosError => {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
};

describe('extractApiError', () => {
  it('prefers the backend message', () => {
    const error = axiosError(422, { status: 'error', message: 'Amount is too large' });

    expect(extractApiError(error, 'fallback')).toBe('Amount is too large');
  });

  it('falls back to the first field error when a 422 carries no message', () => {
    // Laravel's validator responses populate `errors` but usually not `message`
    const error = axiosError(422, {
      status: 'error',
      errors: { reason: ['Reason must be at least 10 characters.'] },
    });

    expect(extractApiError(error, 'fallback')).toBe('Reason must be at least 10 characters.');
  });

  it('uses the JS error message for non-axios failures', () => {
    expect(extractApiError(new Error('Network down'), 'fallback')).toBe('Network down');
  });

  it('uses the caller fallback when nothing else is available', () => {
    expect(extractApiError(axiosError(500, {}), 'Something went wrong')).toBe('Something went wrong');
    expect(extractApiError(undefined, 'Something went wrong')).toBe('Something went wrong');
  });
});

describe('getFieldErrors', () => {
  it('flattens a 422 body to field -> first message', () => {
    const error = axiosError(422, {
      errors: {
        username: ['Username may only contain letters, numbers, dashes, and underscores.'],
        password: ['The password must be at least 8 characters.'],
      },
    });

    expect(getFieldErrors(error)).toEqual({
      username: 'Username may only contain letters, numbers, dashes, and underscores.',
      password: 'The password must be at least 8 characters.',
    });
  });

  it('returns undefined for statuses other than 422', () => {
    expect(getFieldErrors(axiosError(403, { errors: { a: ['b'] } }))).toBeUndefined();
  });
});

describe('auth error classification', () => {
  it.each([
    ['ACCOUNT_INACTIVE'],
    ['TOKEN_INVALIDATED'],
    ['EMPLOYEE_NOT_FOUND'],
  ])('treats %s as terminal — a refresh cannot fix it', (code) => {
    expect(isTerminalAuthError(axiosError(401, { status: 'error', code }))).toBe(true);
  });

  it.each([
    ['TOKEN_MISSING'],
    ['TOKEN_INVALID'],
    ['TOKEN_TYPE_INVALID'],
  ])('treats %s as recoverable — refresh is worth attempting', (code) => {
    expect(isTerminalAuthError(axiosError(401, { status: 'error', code }))).toBe(false);
  });

  it('reads the code off the response body', () => {
    expect(getApiErrorCode(axiosError(403, { code: 'FORBIDDEN' }))).toBe('FORBIDDEN');
  });

  it('detects a role-gate rejection by status', () => {
    expect(isForbiddenError(axiosError(403, { code: 'FORBIDDEN' }))).toBe(true);
    expect(isForbiddenError(axiosError(401, { code: 'TOKEN_INVALID' }))).toBe(false);
  });
});
