import { useState, useCallback } from 'react';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { settingsApi } from '../api/settingsApi';

export const useSettings = () => {
  const [appName, setAppName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [commission, setCommission] = useState<number>(0);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(0);
  const [moderationWords, setModerationWords] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await settingsApi.getSettings();
      const settings = response.data;
      setAppName(settings.app_name);
      setSupportEmail(settings.support_email);
      setCommission(settings.commission_rate);
      setMinWithdrawal(settings.min_withdrawal);
      setModerationWords(settings.moderation_words);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load settings');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFetchEffect(fetchSettings);

  const saveSettings = useCallback(async () => {
    await settingsApi.updateSettings({
      app_name: appName,
      support_email: supportEmail,
      commission_rate: commission,
      min_withdrawal: minWithdrawal,
      moderation_words: moderationWords,
    });
  }, [appName, supportEmail, commission, minWithdrawal, moderationWords]);

  return {
    appName,
    setAppName,
    supportEmail,
    setSupportEmail,
    commission,
    setCommission,
    minWithdrawal,
    setMinWithdrawal,
    moderationWords,
    setModerationWords,
    isLoading,
    error,
    saveSettings,
    refresh: fetchSettings,
  };
};
