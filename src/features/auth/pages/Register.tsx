import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../app/context/AuthContext';
import { useMockAction } from '../../shared/useMockAction';
import ActionBanner from '../../shared/components/ActionBanner';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!acceptTerms) {
      setError('يجب الموافقة على الشروط أولاً');
      return;
    }

    setIsLoading(true);

    try {
      const mockUser = { id: '2', name, email };
      const mockToken = 'mock_jwt_token_new_user';
      login(mockUser, mockToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="title-lg mb-2">إنشاء حساب</h2>
        <p className="label-md">انضم إلى أسطول عطريقك اليوم</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <ActionBanner feedback={feedback} onDismiss={clearFeedback} variant="compact" />

        {error && <div className="text-error text-sm bg-error-container p-4 rounded-xl text-center font-medium">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="label-md mb-2 block">الاسم الكامل</label>
            <input
              type="text"
              required
              className="input-editorial"
              placeholder="أدخل اسمك الكامل"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-md mb-2 block">البريد الإلكتروني</label>
            <input
              type="email"
              required
              className="input-editorial"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label-md mb-2 block">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-editorial"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-xs text-on-surface-variant"
              >
                {showPassword ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-center justify-end gap-2 text-sm">
          <span>أوافق على شروط الاستخدام</span>
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary h-14 text-lg"
        >
          {isLoading ? 'جاري التحميل...' : 'إنشاء الحساب'}
        </button>
      </form>

      <p className="text-center label-md">
        لديك حساب بالفعل؟{' '}
        <Link to="/login" className="text-secondary font-bold hover:underline">
          تسجيل الدخول
        </Link>
      </p>

      <button
        onClick={async () => {
          await runAction({ key: 'register-help', successMessage: 'تم إرسال طلب المساعدة لفريق الدعم.', errorMessage: 'تعذر إرسال طلب المساعدة.' });
        }}
        disabled={isBusy('register-help')}
        className="text-secondary text-sm font-bold underline underline-offset-4 disabled:opacity-50"
      >
        تحتاج مساعدة بالتسجيل؟
      </button>
    </div>
  );
};

export default Register;
