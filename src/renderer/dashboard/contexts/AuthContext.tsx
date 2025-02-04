import React, { createContext, useContext, ReactNode } from 'react';
import { SubscriptionStatusResponse, useAuthManager } from '../hooks/useAuthManager.js';


// Add type for OTP verification response
export type OtpVerificationResult = {
  success: boolean;
  needsSubscription?: boolean;
  pricingUrl?: string;
};

interface AuthContextProps {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  email: string;
  loading: boolean;
  message: string;
  error: boolean;
  showOtpForm: boolean;
  handleLogin: (email: string) => Promise<void>;
  handleOtpVerification: (email: string, otpCode: string) => Promise<OtpVerificationResult>;
  handleLogout: () => Promise<void>;
  clearMessage: () => void;
  isSessionValid: () => Promise<boolean>;
  verifySession: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<SubscriptionStatusResponse>;
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