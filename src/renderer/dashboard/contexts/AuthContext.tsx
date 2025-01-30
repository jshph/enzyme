import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthManager } from '../hooks/useAuthManager.js';

interface AuthContextProps {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  email: string;
  loading: boolean;
  message: string;
  error: boolean;
  showOtpForm: boolean;
  handleLogin: (email: string) => Promise<void>;
  handleOtpVerification: (email: string, otpCode: string) => Promise<boolean>;
  handleLogout: () => Promise<void>;
  clearMessage: () => void;
  isSessionValid: () => Promise<boolean>;
  verifySession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuthManager();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 