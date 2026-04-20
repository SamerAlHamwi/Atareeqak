import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../app/context/AuthContext';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
            <input
              type="password"
              required
              className="input-editorial"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

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
    </div>
  );
};

export default Register;
