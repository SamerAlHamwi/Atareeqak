import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import type { MockFeedback } from './useMockAction';

/**
 * Extracts a human-readable message from an axios/Laravel error response.
 * Laravel errors arrive as { status: 'error', message } or { errors: { field: [msg] } }.
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;
    if (data?.message) {
      return data.message;
    }
    const firstError = data?.errors ? Object.values(data.errors)[0] : undefined;
    if (firstError && firstError.length > 0) {
      return firstError[0];
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

interface RunApiActionInput<T> {
  key: string;
  action: () => Promise<T>;
  successMessage: string | ((result: T) => string);
  errorMessage: string;
  onSuccess?: (result: T) => void;
}

interface UseApiActionResult {
  busyKey: string | null;
  feedback: MockFeedback | null;
  isBusy: (key: string) => boolean;
  clearFeedback: () => void;
  runAction: <T>(input: RunApiActionInput<T>) => Promise<void>;
}

/**
 * Real-API counterpart of useMockAction: same feedback/isBusy interface
 * (so ActionBanner keeps working) but executes an actual async call.
 */
export const useApiAction = (): UseApiActionResult => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<MockFeedback | null>(null);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const isBusy = useCallback((key: string) => busyKey === key, [busyKey]);

  const runAction = useCallback(
    async <T,>({ key, action, successMessage, errorMessage, onSuccess }: RunApiActionInput<T>) => {
      setBusyKey(key);
      try {
        const result = await action();
        onSuccess?.(result);
        setFeedback({
          tone: 'success',
          message:
            typeof successMessage === 'function' ? successMessage(result) : successMessage,
        });
      } catch (error) {
        setFeedback({ tone: 'error', message: getApiErrorMessage(error, errorMessage) });
      } finally {
        setBusyKey(null);
      }
    },
    []
  );

  return useMemo(
    () => ({ busyKey, feedback, isBusy, clearFeedback, runAction }),
    [busyKey, clearFeedback, feedback, isBusy, runAction]
  );
};
