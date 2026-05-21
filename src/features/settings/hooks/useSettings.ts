import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const useSettings = () => {
  const { t } = useTranslation();

  const [appName, setAppName] = useState<string>(t('auth.brand_name'));
  const [supportEmail, setSupportEmail] = useState<string>('support@atareeqak.com');
  const [commission, setCommission] = useState<number>(15);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(100);
  const [moderationWords, setModerationWords] = useState<string>(
    'كلمة1، كلمة2، رابط، احتيال، كود خصم غير رسمي'
  );

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
  };
};
