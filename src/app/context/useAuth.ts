import { createContext, useContext } from 'react';
import type { StaffRole, User } from '../../types/index';
import type { AuthKind } from '../../features/auth/api/authApi';

export interface AuthContextType {
  user: User | null;
  role: StaffRole | null;
  authKind: AuthKind | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (user: User, accessToken: string, refreshToken: string, kind: AuthKind) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
