import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../../types/index';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAccessToken = localStorage.getItem('access_token');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');

    if (storedAccessToken && storedUser) {
      setAccessToken(storedAccessToken);
      if (storedRefreshToken) {
        setRefreshToken(storedRefreshToken);
      }
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, authAccessToken: string, authRefreshToken: string) => {
    setUser(userData);
    setAccessToken(authAccessToken);
    setRefreshToken(authRefreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('access_token', authAccessToken);
    localStorage.setItem('refresh_token', authRefreshToken);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, login, logout, isAuthenticated: !!accessToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
