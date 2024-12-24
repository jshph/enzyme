import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthManager } from '../hooks/useAuthManager';

interface AuthContextType {
  isAuthenticated: boolean;
  email: string;
  loading: boolean;
  message: string;
  error: boolean;
  showOtpForm: boolean;
  handleLogin: (email: string) => Promise<void>;
  handleOtpVerification: (email: string, otp: string) => Promise<boolean>;
  handleLogout: () => Promise<void>;
  clearMessage: () => void;
  isSessionValid: () => Promise<boolean>;
  verifySession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuthManager();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 