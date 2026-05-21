import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/context/AuthContext';

interface UseRegisterReturn {
  name: string;
  setName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  acceptTerms: boolean;
  setAcceptTerms: (val: boolean) => void;
  error: string;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export const useRegister = (): UseRegisterReturn => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [acceptTerms, setAcceptTerms] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!acceptTerms) {
        setError('يجب الموافقة على الشروط أولاً');
        return;
      }

      setIsLoading(true);

      try {
        // Mocked API call logic
        const mockUser = { id: '2', name, email };
        const mockToken = 'mock_jwt_token_new_user';
        const mockRefreshToken = 'mock_refresh_token_new_user';
        login(mockUser, mockToken, mockRefreshToken);
        navigate('/dashboard');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'فشل إنشاء الحساب';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [acceptTerms, name, email, login, navigate]
  );

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    acceptTerms,
    setAcceptTerms,
    error,
    isLoading,
    handleSubmit,
  };
};
