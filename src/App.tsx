import React, { useEffect } from 'react';
import { AuthProvider } from './app/context/AuthContext';
import AppRoutes from './routes';
import ApiConfigGuard from './app/ApiConfigGuard';
import { useTranslation } from 'react-i18next';

const App: React.FC = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <ApiConfigGuard>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ApiConfigGuard>
  );
};

export default App;
