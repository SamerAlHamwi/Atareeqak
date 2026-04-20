import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../app/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (email === 'admin@atareeqak.com' || email === 'admin') {
        const mockUser = { id: '1', name: 'سارة خالد', email: 'admin@atareeqak.com' };
        const mockToken = 'mock_jwt_token_12345';
        login(mockUser, mockToken);
        navigate(from, { replace: true });
      } else {
        throw new Error(t('auth.invalid_credentials') || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg flex flex-col items-center">
      {/* Shield Icon */}
      <div className="w-16 h-16 bg-white rounded-2xl shadow-ambient flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1A237E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><circle cx="12" cy="11" r="3"></circle><path d="M7 21h10"></path></svg>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-primary font-display mb-2">{t('auth.login_title')}</h2>
        <p className="text-on-surface-variant">{t('auth.login_subtitle')}</p>
      </div>

      <div className="w-full bg-white rounded-[32px] shadow-ambient p-12">
        <form className="space-y-8" onSubmit={handleSubmit}>
          <ActionBanner feedback={feedback} onDismiss={clearFeedback} variant="compact" />

          {error && <div className="text-error text-sm bg-error-container p-4 rounded-xl text-center font-medium">{error}</div>}

          <button
            type="button"
            onClick={() => {
              setEmail('admin@atareeqak.com');
              setPassword('123456');
            }}
            className="text-xs font-semibold text-primary underline underline-offset-4"
          >
            Use demo credentials
          </button>

          <div>
            <label className="text-sm font-medium text-on-surface-variant mb-3 block">
              {t('auth.username_label')}
            </label>
            <div className="relative group">
              <input
                type="text"
                required
                className="w-full bg-surface-container-low border-none rounded-2xl ltr:pl-14 ltr:pr-6 rtl:pr-14 rtl:pl-6 py-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder={t('auth.username_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 flex items-center ltr:pl-6 rtl:pr-6 pointer-events-none text-on-surface-variant/40 group-focus-within:text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <button
                type="button"
                onClick={async () => {
                  await runAction({
                    key: 'forgot-password',
                    successMessage: email ? `Password reset link sent to ${email}.` : 'Enter email first to request a reset link.',
                    errorMessage: 'Could not send reset link.',
                  });
                }}
                disabled={isBusy('forgot-password')}
                className="text-sm font-bold text-secondary hover:underline transition-all disabled:opacity-50"
              >
                {t('auth.forgot_password')}
              </button>
              <label className="text-sm font-medium text-on-surface-variant">
                {t('auth.password_label')}
              </label>
            </div>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-surface-container-low border-none rounded-2xl ltr:pl-14 ltr:pr-14 rtl:pr-14 rtl:pl-14 py-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder={t('auth.password_placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 flex items-center ltr:pl-6 rtl:pr-6 pointer-events-none text-on-surface-variant/40 group-focus-within:text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 ltr:right-0 rtl:left-0 flex items-center ltr:pr-6 rtl:pl-6 text-on-surface-variant/60 hover:text-primary transition-colors"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-on-surface-variant">{t('auth.remember_me')}</span>
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white h-16 rounded-2xl text-xl font-bold flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50"
          >
            <span>{t('auth.login_button')}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-on-surface-variant opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>{t('auth.secure_connection')}</span>
          </div>
        </form>
      </div>

      <p className="mt-10 text-on-surface-variant">
        {t('auth.no_account')}{' '}
        <button
          onClick={async () => {
            await runAction({ key: 'contact-support', successMessage: 'Support request submitted.', errorMessage: 'Could not contact support.' });
          }}
          disabled={isBusy('contact-support')}
          className="text-secondary font-bold hover:underline disabled:opacity-50"
        >
          {t('auth.contact_support')}
        </button>
      </p>
    </div>
  );
};

export default Login;
