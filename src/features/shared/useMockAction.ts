import { useCallback, useMemo, useState } from 'react';

type FeedbackTone = 'success' | 'error' | 'info';

export interface MockFeedback {
  tone: FeedbackTone;
  message: string;
}

interface RunMockActionInput {
  key: string;
  successMessage: string;
  errorMessage?: string;
  minDelayMs?: number;
  failRate?: number;
  onSuccess?: () => void;
}

interface UseMockActionResult {
  busyKey: string | null;
  feedback: MockFeedback | null;
  isBusy: (key: string) => boolean;
  clearFeedback: () => void;
  runAction: (input: RunMockActionInput) => Promise<void>;
}

const wait = (ms: number) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

export const useMockAction = (): UseMockActionResult => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<MockFeedback | null>(null);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const isBusy = useCallback((key: string) => busyKey === key, [busyKey]);

  const runAction = useCallback(async ({
    key,
    successMessage,
    errorMessage = 'Action failed. Please try again.',
    minDelayMs = 650,
    failRate = 0.12,
    onSuccess,
  }: RunMockActionInput) => {
    setBusyKey(key);
    setFeedback({ tone: 'info', message: 'Processing request...' });

    await wait(minDelayMs + Math.floor(Math.random() * 500));

    const failed = Math.random() < failRate;

    if (failed) {
      setFeedback({ tone: 'error', message: errorMessage });
      setBusyKey(null);
      return;
    }

    onSuccess?.();
    setFeedback({ tone: 'success', message: successMessage });
    setBusyKey(null);
  }, []);

  return useMemo(() => ({
    busyKey,
    feedback,
    isBusy,
    clearFeedback,
    runAction,
  }), [busyKey, clearFeedback, feedback, isBusy, runAction]);
};

