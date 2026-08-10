import { useCallback, useMemo, useState } from 'react';
import { extractApiError } from '../../services/apiError';

export type FeedbackTone = 'success' | 'error' | 'info';

/** Banner payload rendered by ActionBanner. */
export interface ActionFeedback {
  tone: FeedbackTone;
  message: string;
}

/**
 * @deprecated Use `extractApiError` from services/apiError directly.
 * Kept as a thin alias so existing call sites keep compiling.
 */
export const getApiErrorMessage = extractApiError;

interface RunApiActionInput<T> {
  key: string;
  action: () => Promise<T>;
  successMessage: string | ((result: T) => string);
  errorMessage: string;
  onSuccess?: (result: T) => void;
}

interface UseApiActionResult {
  busyKey: string | null;
  feedback: ActionFeedback | null;
  isBusy: (key: string) => boolean;
  clearFeedback: () => void;
  runAction: <T>(input: RunApiActionInput<T>) => Promise<void>;
}

/**
 * Runs an async API call while exposing per-key busy state and a feedback
 * banner payload, so pages get consistent pending/success/error handling.
 */
export const useApiAction = (): UseApiActionResult => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

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
        setFeedback({ tone: 'error', message: extractApiError(error, errorMessage) });
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
